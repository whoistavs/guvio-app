import React, { useMemo, useRef } from "react";
import { Animated, Dimensions, Easing, PanResponder, Platform, View } from "react-native";

const ND = Platform.OS !== "web";

// site: fotos não podem ser "arrastadas" pelo navegador nem abrir o menu "Salvar imagem" do iPhone
// ao segurar — isso roubava os gestos (prévia, pinça, voltar)
if (Platform.OS === "web" && typeof document !== "undefined" && !document.getElementById("guvio-gestures-css")) {
  const st = document.createElement("style");
  st.id = "guvio-gestures-css";
  st.textContent = "img{-webkit-user-drag:none;user-drag:none;-webkit-touch-callout:none}";
  document.head.appendChild(st);
  document.addEventListener("dragstart", e => {
    if ((e.target as any)?.tagName === "IMG") e.preventDefault();
  }, true);
}
const EDGE = 28; // largura da faixa da borda que aceita o gesto

/**
 * Listas que rolam para o lado (carrossel de fotos, stories, chips...) avisam quando o dedo
 * encosta nelas, para o "arrastar para voltar" não roubar o gesto delas.
 * Uso: <ScrollView horizontal {...noSwipeBack}>
 */
let touchingSideScroller = false;
export const noSwipeBack = {
  onTouchStart: () => {
    touchingSideScroller = true;
  },
  onTouchEnd: () => {
    touchingSideScroller = false;
  },
  onTouchCancel: () => {
    touchingSideScroller = false;
  }
};

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
  anywhere = false,
  children
}: {
  /** aceita o gesto começando em qualquer lugar da tela (fora das listas que rolam para o lado) */
  anywhere?: boolean;
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
    const grab = (g: any) => {
      if (!on.current || g.dx * dir <= 8) return false;
      if (fromEdge(g.moveX - g.dx)) return Math.abs(g.dx) > Math.abs(g.dy) * 1.4;
      // fora da borda: só se for bem horizontal e não estiver numa lista que rola para o lado
      return anywhere && !touchingSideScroller && g.dx * dir > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 2;
    };
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
  }, [side, interactive, anywhere]);

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
 * Segurar uma miniatura: abre a prévia grande com botões (Curtir, Ver perfil, Enviar).
 * Sem soltar, arraste o dedo até um botão e solte para escolher — como no Instagram.
 */
type PeekActions = { onProfile?: (username: string) => void };
type PeekApi = { open: (p: any, a?: PeekActions) => void; move: (x: number, y: number) => void; release: () => void; close: () => void };
let peekApi: PeekApi | null = null;
/** compatibilidade: abrir/fechar sem botões */
export function peekPost(p: any | null) {
  if (p) peekApi?.open(p);
  else peekApi?.close();
}

/** miniatura que sabe abrir a prévia (use no lugar do Pressable da grade) */
export function PeekTile({
  post,
  onPress,
  actions,
  style,
  children
}: {
  post: any;
  onPress: () => void;
  actions?: PeekActions;
  style?: any;
  children: React.ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const open = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  // no site, seleção de texto/rolagem da página derrubam o gesto: depois que a prévia abre,
  // acompanhamos o dedo/mouse direto pela janela até soltar
  const detachWeb = useRef<(() => void) | null>(null);
  const followWindow = () => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const pt = (ev: any) => (ev.touches && ev.touches[0] ? ev.touches[0] : ev.changedTouches && ev.changedTouches[0] ? ev.changedTouches[0] : ev);
    const onMove = (ev: any) => {
      if (!open.current) return;
      const t = pt(ev);
      peekApi?.move(t.clientX, t.clientY);
      if (ev.cancelable) ev.preventDefault();
    };
    const onUp = () => {
      if (open.current) {
        open.current = false;
        peekApi?.release();
      }
      detach();
    };
    const detach = () => {
      window.removeEventListener("mousemove", onMove, true);
      window.removeEventListener("touchmove", onMove, true);
      window.removeEventListener("mouseup", onUp, true);
      window.removeEventListener("touchend", onUp, true);
      window.removeEventListener("touchcancel", onUp, true);
      try {
        document.body.style.userSelect = "";
        (document.body.style as any).webkitUserSelect = "";
      } catch {}
      detachWeb.current = null;
    };
    // "capture": recebe os eventos antes de qualquer outra parte da página poder barrá-los
    window.addEventListener("mousemove", onMove, true);
    window.addEventListener("touchmove", onMove, { passive: false, capture: true } as any);
    window.addEventListener("mouseup", onUp, true);
    window.addEventListener("touchend", onUp, true);
    window.addEventListener("touchcancel", onUp, true);
    try {
      document.body.style.userSelect = "none";
      (document.body.style as any).webkitUserSelect = "none";
      window.getSelection()?.removeAllRanges();
    } catch {}
    detachWeb.current = detach;
  };
  React.useEffect(() => () => detachWeb.current?.(), []);
  return (
    <View
      style={style}
      onStartShouldSetResponder={() => true}
      onResponderTerminationRequest={() => !open.current}
      onResponderGrant={e => {
        open.current = false;
        start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
        clear();
        timer.current = setTimeout(() => {
          timer.current = null;
          open.current = true;
          peekApi?.open(post, actions);
          followWindow();
        }, 300);
      }}
      onResponderMove={e => {
        const { pageX, pageY } = e.nativeEvent;
        if (open.current) peekApi?.move(pageX, pageY);
        else if (Math.hypot(pageX - start.current.x, pageY - start.current.y) > 8) clear();
      }}
      onResponderRelease={() => {
        if (open.current) {
          open.current = false;
          detachWeb.current?.();
          peekApi?.release();
        } else if (timer.current) {
          clear();
          onPress();
        }
      }}
      onResponderTerminate={() => {
        clear();
        // no site quem cuida a partir daqui são os eventos da janela
        if (open.current && !detachWeb.current) {
          open.current = false;
          peekApi?.close();
        }
      }}
    >
      {children}
    </View>
  );
}

export function PeekHost() {
  const { useAppTheme } = require("../context/AppTheme");
  const { FastImage } = require("./FastImage");
  const { Text, Share } = require("react-native");
  const { Heart, Send, UserRound } = require("lucide-react-native");
  const { colors } = useAppTheme();
  const [post, setPost] = React.useState<any>(null);
  const [hover, setHover] = React.useState<number>(-1);
  const a = useRef(new Animated.Value(0)).current;
  const rects = useRef<{ x: number; y: number; w: number; h: number }[]>([]);
  const btnRefs = useRef<(View | null)[]>([]);
  const actionsRef = useRef<PeekActions>({});
  const hoverRef = useRef(-1);
  const postRef = useRef<any>(null);

  const hide = () => {
    Animated.timing(a, { toValue: 0, duration: 120, useNativeDriver: ND }).start(() => {
      setPost(null);
      setHover(-1);
      hoverRef.current = -1;
    });
  };

  const buttons = [
    {
      key: "like",
      label: "Curtir",
      run: async (p: any) => {
        try {
          const { setPostLike } = require("../services/storage");
          await setPostLike(p, !p.isLiked);
          require("./motion").toast(p.isLiked ? "Curtida removida" : "Curtido");
        } catch {}
      }
    },
    { key: "profile", label: "Ver perfil", run: (p: any) => actionsRef.current.onProfile?.(p.creatorUsername || p.creatorName) },
    {
      key: "share",
      label: "Enviar",
      run: (p: any) => {
        try {
          const { postWebLink } = require("../utils/profileLink");
          const link = postWebLink(p.id);
          if (Platform.OS === "web") {
            const nav: any = typeof navigator !== "undefined" ? navigator : null;
            if (nav?.share) nav.share({ text: "Olha esse look no Guvio", url: link }).catch(() => {});
            else {
              nav?.clipboard?.writeText(link);
              require("./motion").toast("Link copiado");
            }
          } else Share.share({ message: `Olha esse look no Guvio: ${link}` });
        } catch {}
      }
    }
  ];

  React.useEffect(() => {
    peekApi = {
      open: (p, acts) => {
        actionsRef.current = acts || {};
        postRef.current = p;
        rects.current = [];
        setPost(p);
        setHover(-1);
        hoverRef.current = -1;
        a.setValue(0);
        Animated.spring(a, { toValue: 1, useNativeDriver: ND, friction: 7, tension: 120 }).start(() => {
          // mede onde ficaram os botões, para saber em qual o dedo está
          btnRefs.current.forEach((r, i) => r?.measureInWindow((x, y, w, h) => (rects.current[i] = { x, y, w, h })));
        });
        try {
          require("../utils/haptics").tapFeedback();
        } catch {}
      },
      move: (x, y) => {
        if (!rects.current.length) btnRefs.current.forEach((r, k) => r?.measureInWindow((bx, by, w, h) => (rects.current[k] = { x: bx, y: by, w, h })));
        const i = rects.current.findIndex(r => r && x >= r.x - 6 && x <= r.x + r.w + 6 && y >= r.y - 10 && y <= r.y + r.h + 10);
        if (i !== hoverRef.current) {
          hoverRef.current = i;
          setHover(i);
          if (i >= 0) {
            try {
              require("../utils/haptics").tapFeedback();
            } catch {}
          }
        }
      },
      release: () => {
        const i = hoverRef.current;
        const p = postRef.current;
        hide();
        if (i >= 0 && p) setTimeout(() => buttons[i].run(p), 150);
      },
      close: hide
    };
    return () => {
      peekApi = null;
    };
  }, []);

  if (!post) return null;
  const W = Math.min(Dimensions.get("window").width - 40, 420);
  const ratio = Math.min(1.91, Math.max(0.75, post.aspect || 1));
  const icons = [
    <Heart key="h" size={22} color={hover === 0 ? "#FF3B4A" : colors.text} fill={post.isLiked || hover === 0 ? "#FF3B4A" : "none"} />,
    <UserRound key="u" size={22} color={colors.text} />,
    <Send key="s" size={21} color={colors.text} />
  ];
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
        <View style={{ flexDirection: "row", justifyContent: "space-around", paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
          {buttons.map((b, i) => (
            <View
              key={b.key}
              ref={r => {
                btnRefs.current[i] = r;
              }}
              collapsable={false}
              style={{ alignItems: "center", gap: 4, paddingHorizontal: 18, paddingVertical: 6, borderRadius: 12, backgroundColor: hover === i ? colors.surface : "transparent" }}
            >
              {icons[i]}
              <Text style={{ color: colors.text, fontSize: 11, fontWeight: hover === i ? "700" : "500" }}>{b.label}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
      {hover >= 0 ? (
        <Animated.View style={{ position: "absolute", top: 70, backgroundColor: "rgba(0,0,0,.75)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, opacity: a }}>
          <Text style={{ color: "#FFF", fontWeight: "600" }}>{buttons[hover].label}</Text>
        </Animated.View>
      ) : null}
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
