import React, { useMemo, useRef } from "react";
import { Linking, PanResponder, Platform, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { AtSign, Clock, Hash, Link2, MapPin } from "lucide-react-native";
import { StoryLayer, StoryPlacement, StoryTextFont } from "../../data/mockData";

export const STORY_COLORS = ["#FFFFFF", "#111111", "#FF3B5C", "#FF9500", "#FFD60A", "#34C759", "#0A84FF", "#BF5AF2", "#FF8FB1", "#8E8E93"];

export const STORY_FONTS: { id: StoryTextFont; label: string }[] = [
  { id: "classica", label: "Clássica" },
  { id: "forte", label: "Forte" },
  { id: "maquina", label: "Máquina" },
  { id: "neon", label: "Neon" },
  { id: "serifa", label: "Serifa" }
];

/** fundos para o story só de texto (imagens publicadas junto com o site) */
export const STORY_BACKGROUNDS = [1, 2, 3, 4, 5, 6].map(n => `https://guvioapp.github.io/guvio-app/storybg-${n}.jpg`);

const MONO = Platform.select({ ios: "Courier", android: "monospace", default: "monospace" });
const SERIF = Platform.select({ ios: "Georgia", android: "serif", default: "Georgia, serif" });

export const newLayerId = () => `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** cor do texto que contrasta com um fundo */
const ink = (c: string) => (["#FFFFFF", "#FFD60A", "#34C759", "#FF8FB1", "#FF9500"].includes(c) ? "#111111" : "#FFFFFF");

/** estilo do texto, em proporção à largura do story (fica igual no editor e no visualizador) */
export function textStyle(l: Extract<StoryLayer, { kind: "text" }>, W: number) {
  const base = W * 0.068;
  const st: any = {
    fontSize: base,
    lineHeight: base * 1.22,
    textAlign: l.align,
    color: l.color,
    fontWeight: "700"
  };
  if (l.font === "forte") Object.assign(st, { fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 });
  if (l.font === "maquina") Object.assign(st, { fontFamily: MONO, fontWeight: "600" });
  if (l.font === "serifa") Object.assign(st, { fontFamily: SERIF, fontStyle: "italic", fontWeight: "600" });
  if (l.font === "neon") Object.assign(st, { color: "#FFFFFF", textShadowColor: l.color, textShadowRadius: base * 0.45, textShadowOffset: { width: 0, height: 0 } });
  if (l.bg === "solid") Object.assign(st, { color: l.font === "neon" ? "#FFFFFF" : ink(l.color), backgroundColor: l.color });
  if (l.bg === "soft") Object.assign(st, { backgroundColor: "rgba(0,0,0,.45)" });
  if (l.bg === "none" && l.font !== "neon") Object.assign(st, { textShadowColor: "rgba(0,0,0,.45)", textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } });
  if (l.bg !== "none") Object.assign(st, { paddingHorizontal: base * 0.35, paddingVertical: base * 0.12, borderRadius: base * 0.25, overflow: "hidden" });
  return st;
}

const TAG_ICON = { mention: AtSign, hashtag: Hash, location: MapPin, link: Link2, time: Clock } as const;

/** uma camada desenhada (sem posição: quem posiciona é o pai) */
export function LayerBody({ layer, W }: { layer: StoryLayer; W: number }) {
  if (layer.kind === "text") return <Text style={textStyle(layer, W)}>{layer.text}</Text>;
  if (layer.kind === "emoji") return <Text style={{ fontSize: W * 0.16 }}>{layer.text}</Text>;
  if (layer.kind === "tag") {
    const Icon = TAG_ICON[layer.tag];
    const size = W * 0.05;
    const colorful = layer.tag === "mention" || layer.tag === "hashtag";
    return (
      <View style={[st.tag, { paddingHorizontal: size * 0.6, paddingVertical: size * 0.32, borderRadius: size * 0.5, gap: size * 0.25 }]}>
        <Icon size={size} color={colorful ? "#C13584" : layer.tag === "link" ? "#0A84FF" : "#111"} strokeWidth={2.6} />
        <Text
          style={{ fontSize: size, fontWeight: "800", color: colorful ? "#C13584" : layer.tag === "link" ? "#0A84FF" : "#111", textTransform: layer.tag === "location" ? "uppercase" : "none" }}
          numberOfLines={1}
        >
          {layer.text}
        </Text>
      </View>
    );
  }
  return null;
}

/** desenhos (todas as linhas) por cima da foto */
export function StoryDrawing({ layers, W, H, extra }: { layers: StoryLayer[]; W: number; H: number; extra?: StoryLayer | null }) {
  const lines = [...layers.filter(l => l.kind === "draw"), ...(extra ? [extra] : [])] as Extract<StoryLayer, { kind: "draw" }>[];
  if (!lines.length || !W || !H) return null;
  return (
    <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
      {lines.map(l => {
        if (l.points.length < 2) return null;
        let d = `M ${l.points[0] * W} ${l.points[1] * H}`;
        for (let i = 2; i < l.points.length; i += 2) d += ` L ${l.points[i] * W} ${l.points[i + 1] * H}`;
        if (l.points.length === 2) d += ` L ${l.points[0] * W + 0.1} ${l.points[1] * H + 0.1}`;
        return (
          <React.Fragment key={l.id}>
            {l.neon ? <Path d={d} stroke={l.color} strokeOpacity={0.35} strokeWidth={l.width * W * 2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" /> : null}
            <Path d={d} stroke={l.neon ? "#FFFFFF" : l.color} strokeWidth={l.width * W} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

/**
 * Caixa grande centrada no ponto da camada: o conteúdo fica no meio dela,
 * então não precisamos medir o tamanho do texto para centralizar.
 * A caixa não pega toques (box-none); só o conteúdo.
 */
export function placeStyle(p: StoryPlacement, W: number, H: number): ViewStyle {
  const B = W * 2;
  return {
    position: "absolute",
    left: p.x * W - B / 2,
    top: p.y * H - B / 2,
    width: B,
    height: B,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ scale: p.scale }, { rotate: `${p.rot}deg` }]
  };
}

/**
 * Visualizador: desenha todas as camadas no tamanho W×H.
 * Marcações (@, #, link) são tocáveis.
 */
export function StoryLayersView({
  layers,
  W,
  H,
  onMention,
  onHashtag
}: {
  layers?: StoryLayer[] | null;
  W: number;
  H: number;
  onMention?: (username: string) => void;
  onHashtag?: (tag: string) => void;
}) {
  if (!layers?.length || !W || !H) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <StoryDrawing layers={layers} W={W} H={H} />
      {layers.map(l => {
        if (l.kind === "draw") return null;
        const tap =
          l.kind === "tag" && l.tag === "mention"
            ? () => onMention?.(l.text.replace(/^@/, ""))
            : l.kind === "tag" && l.tag === "hashtag"
            ? () => onHashtag?.(l.text.replace(/^#/, ""))
            : l.kind === "tag" && l.tag === "link" && l.url
            ? () => Linking.openURL(/^https?:\/\//.test(l.url!) ? l.url! : `https://${l.url}`).catch(() => {})
            : null;
        return (
          <View key={l.id} style={placeStyle(l, W, H)} pointerEvents="box-none">
            <View style={{ maxWidth: W * 0.9 }} pointerEvents={tap ? "auto" : "none"}>
              {tap ? (
                <Pressable onPress={tap} hitSlop={6}>
                  <LayerBody layer={l} W={W} />
                </Pressable>
              ) : (
                <LayerBody layer={l} W={W} />
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * Editor: camada que dá para arrastar com um dedo e aumentar/girar com dois.
 * Ao arrastar, avisa o pai (para mostrar a lixeira); soltar em cima da lixeira apaga.
 */
export function DraggableLayer({
  placement,
  W,
  H,
  onChange,
  onTap,
  onDragState,
  children,
  maxWidth
}: {
  placement: StoryPlacement;
  W: number;
  H: number;
  onChange: (p: StoryPlacement) => void;
  onTap?: () => void;
  /** dragging: true/false; overTrash: o dedo está em cima da lixeira; drop: soltou (apagar se overTrash) */
  onDragState?: (s: { dragging: boolean; overTrash: boolean; drop?: boolean }) => void;
  children: React.ReactNode;
  maxWidth?: number;
}) {
  const cur = useRef(placement);
  cur.current = placement;
  const cbs = useRef({ onChange, onTap, onDragState });
  cbs.current = { onChange, onTap, onDragState };
  const size = useRef({ W, H });
  size.current = { W, H };

  const pan = useMemo(() => {
    let start: StoryPlacement = cur.current;
    let pinch: { d: number; a: number; cx: number; cy: number } | null = null;
    let moved = false;
    let overTrash = false;
    const two = (e: any) => {
      const t = e.nativeEvent.touches;
      if (!t || t.length < 2) return null;
      const dx = t[1].pageX - t[0].pageX;
      const dy = t[1].pageY - t[0].pageY;
      return { d: Math.hypot(dx, dy), a: (Math.atan2(dy, dx) * 180) / Math.PI, cx: (t[0].pageX + t[1].pageX) / 2, cy: (t[0].pageY + t[1].pageY) / 2 };
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: e => {
        start = { ...cur.current };
        pinch = two(e);
        moved = false;
        overTrash = false;
      },
      onPanResponderMove: (e, g) => {
        const { W: w, H: h } = size.current;
        const p2 = two(e);
        if (p2) {
          if (!pinch) {
            // segundo dedo chegou agora: recomeça a conta daqui
            pinch = p2;
            start = { ...cur.current };
            return;
          }
          moved = true;
          const scale = Math.max(0.3, Math.min(5, start.scale * (p2.d / Math.max(1, pinch.d))));
          const rot = start.rot + (p2.a - pinch.a);
          const x = Math.max(0, Math.min(1, start.x + (p2.cx - pinch.cx) / w));
          const y = Math.max(0, Math.min(1, start.y + (p2.cy - pinch.cy) / h));
          cbs.current.onChange({ x, y, scale, rot });
          return;
        }
        if (pinch) {
          // tirou um dedo: continua arrastando a partir daqui
          pinch = null;
          start = { ...cur.current, x: cur.current.x - g.dx / w, y: cur.current.y - g.dy / h };
        }
        if (!moved && Math.hypot(g.dx, g.dy) < 4) return;
        if (!moved) cbs.current.onDragState?.({ dragging: true, overTrash: false });
        moved = true;
        const x = Math.max(0, Math.min(1, start.x + g.dx / w));
        const y = Math.max(0, Math.min(1, start.y + g.dy / h));
        // lixeira: embaixo, no meio
        const nowOver = y > 0.86 && Math.abs(x - 0.5) < 0.14;
        if (nowOver !== overTrash) {
          overTrash = nowOver;
          cbs.current.onDragState?.({ dragging: true, overTrash });
        }
        cbs.current.onChange({ ...cur.current, x, y });
      },
      onPanResponderRelease: () => {
        if (!moved) cbs.current.onTap?.();
        cbs.current.onDragState?.({ dragging: false, overTrash, drop: moved });
        pinch = null;
      },
      onPanResponderTerminate: () => {
        cbs.current.onDragState?.({ dragging: false, overTrash: false });
        pinch = null;
      }
    });
  }, []);

  return (
    <View style={placeStyle(placement, W, H)} pointerEvents="box-none">
      <View {...pan.panHandlers} style={{ maxWidth: maxWidth ?? W * 0.9 }}>
        {children}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  tag: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 }
});
