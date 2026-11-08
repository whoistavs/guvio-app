import React, { useMemo, useRef } from "react";
import { Animated, Dimensions, Easing, PanResponder, Platform, View } from "react-native";

const ND = Platform.OS !== "web";
const EDGE = 28; // largura da faixa da borda que aceita o gesto

/**
 * Arrastar a partir da borda da tela.
 * - side "left" + interactive: a tela acompanha o dedo (voltar, como no iPhone)
 * - sem interactive: só dispara quando o arrasto passa do limite (abrir Direct/Publicar)
 */
export function EdgeSwipe({
  side = "left",
  onSwipe,
  interactive = true,
  enabled = true,
  under = "#000",
  children
}: {
  /** cor que aparece por trás enquanto a tela desliza */
  under?: string;
  side?: "left" | "right";
  onSwipe: () => void;
  interactive?: boolean;
  enabled?: boolean;
  children: React.ReactNode;
}) {
  const x = useRef(new Animated.Value(0)).current;
  const cb = useRef(onSwipe);
  cb.current = onSwipe;
  const on = useRef(enabled);
  on.current = enabled;

  const pan = useMemo(() => {
    const W = () => Dimensions.get("window").width;
    const fromEdge = (x0: number) => (side === "left" ? x0 <= EDGE : x0 >= W() - EDGE);
    const dir = side === "left" ? 1 : -1;
    // x0 ainda vale 0 antes do gesto ser aceito: o início real é a posição atual menos o quanto andou
    const grab = (g: any) => on.current && fromEdge(g.moveX - g.dx) && g.dx * dir > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4;
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_e, g) => grab(g),
      onMoveShouldSetPanResponder: (_e, g) => grab(g),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => {
        if (interactive) x.setValue(Math.max(0, g.dx * dir) * dir);
      },
      onPanResponderRelease: (_e, g) => {
        const dist = g.dx * dir;
        const fast = g.vx * dir > 0.5;
        const done = dist > W() * (interactive ? 0.33 : 0.18) || (fast && dist > 40);
        if (!interactive) {
          if (done) cb.current();
          return;
        }
        if (done) {
          Animated.timing(x, { toValue: W() * dir, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: ND }).start(() => {
            cb.current();
            x.setValue(0);
          });
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: ND, friction: 8 }).start();
        }
      },
      onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: ND }).start()
    });
  }, [side, interactive]);

  if (!interactive) {
    return (
      <View style={{ flex: 1 }} {...pan.panHandlers}>
        {children}
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: under }}>
      <Animated.View
        style={{
          flex: 1,
          transform: [{ translateX: x }],
          shadowColor: "#000",
          shadowOpacity: 0.25,
          shadowRadius: 12
        }}
        {...pan.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

/**
 * Arrastar para baixo para fechar (folhas de baixo, stories).
 * Só pega o gesto quando ele é claramente vertical para baixo.
 * `onlyFromTop`: aceita só quando o toque começa na parte de cima (alça da folha).
 */
export function useDragToClose(onClose: () => void, opts: { onlyFromTopPx?: number; enabled?: boolean } = {}) {
  const y = useRef(new Animated.Value(0)).current;
  const cb = useRef(onClose);
  cb.current = onClose;
  const top = useRef<number>(0);
  const enabled = opts.enabled !== false;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (e, g) => {
          if (!enabled) return false;
          if (opts.onlyFromTopPx != null && e.nativeEvent.locationY > opts.onlyFromTopPx && g.moveY - g.dy - top.current > opts.onlyFromTopPx) return false;
          return g.dy > 10 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5;
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_e, g) => y.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_e, g) => {
          const H = Dimensions.get("window").height;
          if (g.dy > Math.min(160, H * 0.2) || (g.vy > 0.8 && g.dy > 40)) {
            Animated.timing(y, { toValue: H, duration: 200, useNativeDriver: ND }).start(() => {
              cb.current();
              y.setValue(0);
            });
          } else {
            Animated.spring(y, { toValue: 0, useNativeDriver: ND, friction: 8 }).start();
          }
        },
        onPanResponderTerminate: () => Animated.spring(y, { toValue: 0, useNativeDriver: ND }).start()
      }),
    [enabled, opts.onlyFromTopPx]
  );

  return { y, panHandlers: pan.panHandlers, onLayoutTop: (pageY: number) => (top.current = pageY) };
}

/**
 * Pinça com dois dedos na foto: ela cresce por cima de tudo e volta ao soltar (como no Instagram).
 * A foto ampliada é desenhada pelo <PinchHost/> (montado uma vez no App), sem abrir outra janela,
 * para o iPhone não cancelar o gesto no meio.
 */
type PinchState = {
  rect: { x: number; y: number; w: number; h: number };
  node: React.ReactNode;
  scale: Animated.Value;
  tx: Animated.Value;
  ty: Animated.Value;
} | null;
let showPinch: ((p: PinchState) => void) | null = null;

export function PinchHost() {
  const [p, setP] = React.useState<PinchState>(null);
  const [origin, setOrigin] = React.useState({ x: 0, y: 0 });
  const hostRef = useRef<View>(null);
  React.useEffect(() => {
    showPinch = setP;
    return () => {
      showPinch = null;
    };
  }, []);
  return (
    <View
      ref={hostRef}
      pointerEvents="none"
      style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, zIndex: 9998, elevation: 30 }}
      onLayout={() => hostRef.current?.measureInWindow((x, y) => setOrigin({ x, y }))}
    >
      {p ? (
        <>
          <Animated.View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: -origin.y,
              bottom: 0,
              backgroundColor: "#000",
              opacity: p.scale.interpolate({ inputRange: [1, 2.2], outputRange: [0, 0.75], extrapolate: "clamp" })
            }}
          />
          <Animated.View
            style={{
              position: "absolute",
              left: p.rect.x - origin.x,
              top: p.rect.y - origin.y,
              width: p.rect.w,
              height: p.rect.h,
              transform: [{ translateX: p.tx }, { translateY: p.ty }, { scale: p.scale }]
            }}
          >
            {p.node}
          </Animated.View>
        </>
      ) : null}
    </View>
  );
}

export function usePinchZoom(render: () => React.ReactNode) {
  const ref = useRef<View>(null);
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const renderRef = useRef(render);
  renderRef.current = render;
  const st = useRef({ d0: 0, mx: 0, my: 0, active: false });

  const dist = (t: any[]) => Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
  const mid = (t: any[]) => ({ x: (t[0].pageX + t[1].pageX) / 2, y: (t[0].pageY + t[1].pageY) / 2 });

  const end = () => {
    if (!st.current.active) return;
    st.current.active = false;
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: ND, friction: 7 }),
      Animated.spring(tx, { toValue: 0, useNativeDriver: ND, friction: 7 }),
      Animated.spring(ty, { toValue: 0, useNativeDriver: ND, friction: 7 })
    ]).start(() => showPinch?.(null));
  };

  const start = (t: any[]) => {
    st.current = { d0: dist(t), mx: mid(t).x, my: mid(t).y, active: true };
    scale.setValue(1);
    tx.setValue(0);
    ty.setValue(0);
    ref.current?.measureInWindow((x, y, w, h) => showPinch?.({ rect: { x, y, w, h }, node: renderRef.current(), scale, tx, ty }));
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: e => e.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponderCapture: e => e.nativeEvent.touches.length >= 2,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: e => {
          const t = e.nativeEvent.touches as any[];
          if (t.length >= 2) start(t);
        },
        onPanResponderMove: e => {
          const t = e.nativeEvent.touches as any[];
          if (t.length < 2) return;
          if (!st.current.active) {
            start(t);
            return;
          }
          scale.setValue(Math.max(1, Math.min(4, dist(t) / (st.current.d0 || 1))));
          const m = mid(t);
          tx.setValue(m.x - st.current.mx);
          ty.setValue(m.y - st.current.my);
        },
        onPanResponderRelease: end,
        onPanResponderTerminate: end
      }),
    []
  );

  return { ref, panHandlers: pan.panHandlers };
}

/**
 * Segurar uma miniatura da grade: mostra uma prévia grande do post; soltar fecha.
 * Uso: onLongPress={() => peekPost(p)} onPressOut={() => peekPost(null)}
 */
let showPeek: ((p: any) => void) | null = null;
export function peekPost(p: any | null) {
  showPeek?.(p);
}

export function PeekHost() {
  const { useAppTheme } = require("../context/AppTheme");
  const { FastImage } = require("./FastImage");
  const { Text } = require("react-native");
  const { colors } = useAppTheme();
  const [post, setPost] = React.useState<any>(null);
  const a = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    showPeek = (p: any) => {
      if (p) {
        setPost(p);
        a.setValue(0);
        Animated.spring(a, { toValue: 1, useNativeDriver: ND, friction: 7, tension: 120 }).start();
        try {
          require("../utils/haptics").tapFeedback();
        } catch {}
      } else {
        Animated.timing(a, { toValue: 0, duration: 120, useNativeDriver: ND }).start(() => setPost(null));
      }
    };
    return () => {
      showPeek = null;
    };
  }, []);
  if (!post) return null;
  const W = Math.min(Dimensions.get("window").width - 40, 420);
  const ratio = Math.min(1.91, Math.max(0.75, post.aspect || 1));
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 9997, elevation: 29, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,.55)", opacity: a }} />
      <Animated.View
        style={{
          width: W,
          borderRadius: 18,
          overflow: "hidden",
          backgroundColor: colors.bg,
          opacity: a,
          transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }]
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12 }}>
          <FastImage source={post.creatorAvatar} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surface2 }} contentFit="cover" />
          <Text style={{ color: colors.text, fontWeight: "600" }} numberOfLines={1}>
            {post.creatorUsername || post.creatorName}
          </Text>
        </View>
        <FastImage source={post.image} style={{ width: W, height: W / ratio, backgroundColor: colors.surface2 }} contentFit="cover" />
        {post.caption ? (
          <Text style={{ color: colors.text, padding: 12, fontSize: 13 }} numberOfLines={2}>
            {post.caption}
          </Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

/** Arrastar a mensagem para a direita: aparece a setinha e, ao soltar, responde */
export function SwipeToReply({ onReply, enabled = true, color, children }: { onReply: () => void; enabled?: boolean; color: string; children: React.ReactNode }) {
  const { Reply } = require("lucide-react-native");
  const x = useRef(new Animated.Value(0)).current;
  const fired = useRef(false);
  const cb = useRef(onReply);
  cb.current = onReply;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => enabled && g.moveX - g.dx > EDGE + 4 && g.dx > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
        onPanResponderGrant: () => (fired.current = false),
        onPanResponderMove: (_e, g) => {
          const v = Math.max(0, Math.min(90, g.dx * 0.6));
          x.setValue(v);
          if (v >= 56 && !fired.current) {
            fired.current = true;
            try {
              require("../utils/haptics").tapFeedback();
            } catch {}
          }
        },
        onPanResponderRelease: () => {
          if (fired.current) cb.current();
          Animated.spring(x, { toValue: 0, useNativeDriver: ND, friction: 7 }).start();
        },
        onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: ND }).start()
      }),
    [enabled]
  );
  return (
    <View {...pan.panHandlers}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 6,
          top: 0,
          bottom: 0,
          justifyContent: "center",
          opacity: x.interpolate({ inputRange: [10, 56], outputRange: [0, 1], extrapolate: "clamp" })
        }}
      >
        <Reply size={20} color={color} />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: x }] }}>{children}</Animated.View>
    </View>
  );
}
