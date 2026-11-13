import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ChevronRight,
  Image as ImageIcon,
  Pencil,
  Smile,
  Sticker,
  Trash2,
  Type,
  Undo2,
  Volume2,
  VolumeX,
  X
} from "lucide-react-native";
import { StoryLayer, StoryPlacement, StorySticker, StoryTextFont } from "../../data/mockData";
import { FastImage } from "../FastImage";
import { StoryStickerView } from "../StoryStickerView";
import {
  DraggableLayer,
  LayerBody,
  newLayerId,
  STORY_BACKGROUNDS,
  STORY_COLORS,
  STORY_FONTS,
  StoryDrawing,
  textStyle
} from "./StoryLayers";
import { publishStory, loadSavedProfile } from "../../services/storage";
import { getCurrentPlace } from "../../services/location";
import { videoThumbnail } from "../../utils/videoThumb";
import { tapFeedback, successFeedback } from "../../utils/haptics";

export type StoryMedia = { uri: string; type: "image" | "video" } | { textOnly: true };

// ---------- abrir de qualquer lugar ----------
let openFn: ((m: StoryMedia) => void) | null = null;
export function openStoryEditor(m: StoryMedia) {
  openFn?.(m);
}
const published = new Set<() => void>();
/** a Home escuta para recarregar os stories depois de publicar */
export function onStoryPublished(cb: () => void) {
  published.add(cb);
  return () => {
    published.delete(cb);
  };
}

const EMOJIS = ["🔥", "😍", "✨", "💯", "👀", "🖤", "🤍", "💅", "🕶️", "👟", "👗", "🧥", "👜", "💄", "🌧️", "☀️", "❄️", "📍", "🎉", "😎"];

type Mode = "idle" | "text" | "draw" | "stickers";
type TagKind = "mention" | "hashtag" | "location" | "link";

const center = (): StoryPlacement => ({ x: 0.5, y: 0.42, scale: 1, rot: 0 });

export function StoryEditorHost() {
  const insets = useSafeAreaInsets();
  const [media, setMedia] = useState<StoryMedia | null>(null);
  const [bg, setBg] = useState(0);
  const [layers, setLayers] = useState<StoryLayer[]>([]);
  const [sticker, setSticker] = useState<StorySticker | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [drag, setDrag] = useState<{ dragging: boolean; overTrash: boolean }>({ dragging: false, overTrash: false });
  const [publishing, setPublishing] = useState<null | "all" | "close">(null);
  const [muted, setMuted] = useState(false);
  const [canvas, setCanvas] = useState({ W: 0, H: 0 });

  // texto sendo editado
  const [editId, setEditId] = useState<string | null>(null);
  const [tText, setTText] = useState("");
  const [tColor, setTColor] = useState(STORY_COLORS[0]);
  const [tFont, setTFont] = useState<StoryTextFont>("classica");
  const [tBg, setTBg] = useState<"none" | "solid" | "soft">("none");
  const [tAlign, setTAlign] = useState<"center" | "left" | "right">("center");

  // figurinha que pede um texto (menção, hashtag, local, link) ou enquete/pergunta
  const [form, setForm] = useState<null | { kind: TagKind | "poll" | "question"; a: string; b: string; c: string }>(null);

  // desenho
  const [penColor, setPenColor] = useState("#FFFFFF");
  const [penSize, setPenSize] = useState(0.012);
  const [neon, setNeon] = useState(false);
  const [stroke, setStroke] = useState<Extract<StoryLayer, { kind: "draw" }> | null>(null);

  useEffect(() => {
    openFn = m => {
      setMedia(m);
      setLayers([]);
      setSticker(null);
      setForm(null);
      setStroke(null);
      setMuted(false);
      setBg(0);
      if ("textOnly" in m) startText();
      else setMode("idle");
    };
    return () => {
      openFn = null;
    };
  }, []);

  const close = (force = false) => {
    if (!force && (layers.length || sticker)) {
      Alert.alert("Descartar este story?", "As edições vão se perder.", [
        { text: "Continuar editando", style: "cancel" },
        { text: "Descartar", style: "destructive", onPress: () => setMedia(null) }
      ]);
      return;
    }
    setMedia(null);
  };

  // ---------- texto ----------
  function startText(l?: Extract<StoryLayer, { kind: "text" }>) {
    setEditId(l?.id || null);
    setTText(l?.text || "");
    setTColor(l?.color || STORY_COLORS[0]);
    setTFont(l?.font || "classica");
    setTBg(l?.bg || "none");
    setTAlign(l?.align || "center");
    setMode("text");
  }

  const finishText = () => {
    Keyboard.dismiss();
    const text = tText.trim();
    setLayers(prev => {
      if (!text) return prev.filter(l => l.id !== editId);
      if (editId) return prev.map(l => (l.id === editId && l.kind === "text" ? { ...l, text, color: tColor, font: tFont, bg: tBg, align: tAlign } : l));
      return [...prev, { id: newLayerId(), kind: "text", text, color: tColor, font: tFont, bg: tBg, align: tAlign, ...center() }];
    });
    setEditId(null);
    setMode("idle");
  };

  // ---------- figurinhas ----------
  const addTag = (tag: "mention" | "hashtag" | "location" | "link" | "time", text: string, url?: string) =>
    setLayers(prev => [...prev, { id: newLayerId(), kind: "tag", tag, text, url, x: 0.5, y: 0.56, scale: 1, rot: 0 } as StoryLayer]);

  const openForm = async (kind: TagKind | "poll" | "question") => {
    setMode("idle");
    // no iPhone uma janela só abre depois que a outra terminou de fechar
    await new Promise(r => setTimeout(r, Platform.OS === "ios" ? 380 : 60));
    if (kind === "location") {
      setForm({ kind, a: "", b: "", c: "" });
      const pl = await getCurrentPlace().catch(() => null);
      if (pl?.city) setForm(f => (f && f.kind === "location" && !f.a ? { ...f, a: pl.city } : f));
      return;
    }
    setForm({ kind, a: "", b: kind === "poll" ? "Sim" : "", c: kind === "poll" ? "Não" : "" });
  };

  const submitForm = () => {
    if (!form) return;
    const a = form.a.trim();
    if (form.kind === "poll") setSticker({ type: "poll", question: a || "O que acham?", options: [form.b.trim() || "Sim", form.c.trim() || "Não"], x: 0.5, y: 0.72, scale: 1, rot: 0 });
    else if (form.kind === "question") setSticker({ type: "question", prompt: a || "Me pergunte algo", x: 0.5, y: 0.72, scale: 1, rot: 0 });
    else if (!a) return setForm(null);
    else if (form.kind === "mention") addTag("mention", `@${a.replace(/^@/, "").replace(/\s/g, "")}`);
    else if (form.kind === "hashtag") addTag("hashtag", `#${a.replace(/^#/, "").replace(/\s/g, "")}`);
    else if (form.kind === "location") addTag("location", a);
    else if (form.kind === "link") {
      const url = a.replace(/\s/g, "");
      addTag("link", url.replace(/^https?:\/\//, "").replace(/\/$/, "").slice(0, 32), url);
    }
    tapFeedback();
    setForm(null);
  };

  const addTime = () => {
    const d = new Date();
    addTag("time", `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    setMode("idle");
  };

  const addEmoji = (e: string) => {
    setLayers(prev => [...prev, { id: newLayerId(), kind: "emoji", text: e, x: 0.5, y: 0.45, scale: 1, rot: 0 }]);
    setMode("idle");
  };

  // ---------- desenho ----------
  const strokeRef = useRef<typeof stroke>(null);
  strokeRef.current = stroke;
  const canvasRef = useRef(canvas);
  canvasRef.current = canvas;
  const penRef = useRef({ penColor, penSize, neon });
  penRef.current = { penColor, penSize, neon };
  const drawPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: e => {
          const { W, H } = canvasRef.current;
          const { locationX, locationY } = e.nativeEvent;
          setStroke({
            id: newLayerId(),
            kind: "draw",
            color: penRef.current.penColor,
            width: penRef.current.penSize,
            neon: penRef.current.neon,
            points: [locationX / W, locationY / H]
          });
        },
        onPanResponderMove: e => {
          const { W, H } = canvasRef.current;
          const { locationX, locationY } = e.nativeEvent;
          setStroke(s => (s ? { ...s, points: [...s.points, locationX / W, locationY / H] } : s));
        },
        onPanResponderRelease: () => {
          const s = strokeRef.current;
          if (s) setLayers(prev => [...prev, s]);
          setStroke(null);
        }
      }),
    []
  );

  const undoDraw = () => {
    setLayers(prev => {
      const i = [...prev].reverse().findIndex(l => l.kind === "draw");
      if (i < 0) return prev;
      const idx = prev.length - 1 - i;
      return prev.filter((_, k) => k !== idx);
    });
  };

  // ---------- publicar ----------
  const publish = async (closeFriends: boolean) => {
    if (!media || publishing) return;
    setPublishing(closeFriends ? "close" : "all");
    try {
      let image = "";
      let video: string | null = null;
      if ("textOnly" in media) image = STORY_BACKGROUNDS[bg];
      else if (media.type === "video") {
        video = media.uri;
        image = await videoThumbnail(media.uri).catch(() => "");
        if (!image) throw new Error("Não foi possível gerar a capa do vídeo. Tente outro vídeo.");
      } else image = media.uri;
      const allText = layers
        .map(l => (l.kind === "text" || l.kind === "tag" ? l.text : ""))
        .filter(Boolean)
        .join(" ")
        .slice(0, 500);
      await publishStory({
        image,
        video,
        overlay: { text: allText, layers, background: "textOnly" in media ? image : undefined },
        sticker,
        closeFriends
      });
      successFeedback();
      published.forEach(cb => cb());
      setMedia(null);
    } catch (e: any) {
      Alert.alert("Story não publicado", e?.message || "Tente de novo.");
    } finally {
      setPublishing(null);
    }
  };

  // ---------- tamanho do story (9:16 dentro da tela) ----------
  const screen = Dimensions.get("window");
  const maxH = screen.height - insets.top - insets.bottom - 86;
  const W = Math.min(screen.width, maxH * (9 / 16));
  const H = W * (16 / 9);

  const isVideo = !!media && !("textOnly" in media) && media.type === "video";
  const player = useVideoPlayer(isVideo && media && !("textOnly" in media) ? media.uri : null, p => {
    p.loop = true;
    p.play();
  });
  useEffect(() => {
    if (player) player.muted = muted;
  }, [player, muted]);

  if (!media) return null;
  const textOnly = "textOnly" in media;

  const preview: any = {
    kind: "text",
    id: "preview",
    text: tText || " ",
    color: tColor,
    font: tFont,
    bg: tBg,
    align: tAlign,
    ...center()
  };

  return (
    <Modal visible animationType="slide" onRequestClose={() => close()} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={[s.root, { paddingTop: insets.top + 4, paddingBottom: insets.bottom }]}>
        <View
          style={[s.canvas, { width: W, height: H }]}
          onLayout={e => setCanvas({ W: e.nativeEvent.layout.width, H: e.nativeEvent.layout.height })}
        >
          {/* fundo: foto, vídeo ou cor */}
          {textOnly ? (
            <FastImage source={STORY_BACKGROUNDS[bg]} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : isVideo ? (
            <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
          ) : (
            <FastImage source={(media as any).uri} style={StyleSheet.absoluteFill} contentFit="cover" />
          )}

          {/* desenho */}
          <StoryDrawing layers={layers} W={W} H={H} extra={stroke} />

          {/* camadas que dá para arrastar */}
          {mode !== "draw"
            ? layers.map(l =>
                l.kind === "draw" ? null : (
                  <DraggableLayer
                    key={l.id}
                    placement={l}
                    W={W}
                    H={H}
                    onChange={p => setLayers(prev => prev.map(x => (x.id === l.id ? ({ ...x, ...p } as StoryLayer) : x)))}
                    onTap={() => (l.kind === "text" ? startText(l) : undefined)}
                    onDragState={st => {
                      setDrag({ dragging: st.dragging, overTrash: st.overTrash });
                      if (st.drop && st.overTrash) setLayers(prev => prev.filter(x => x.id !== l.id));
                    }}
                  >
                    {mode === "text" && editId === l.id ? null : <LayerBody layer={l} W={W} />}
                  </DraggableLayer>
                )
              )
            : null}

          {sticker && mode !== "draw" ? (
            <DraggableLayer
              placement={{ x: sticker.x ?? 0.5, y: sticker.y ?? 0.62, scale: sticker.scale ?? 1, rot: sticker.rot ?? 0 }}
              W={W}
              H={H}
              maxWidth={W}
              onChange={p => setSticker(sk => (sk ? { ...sk, ...p } : sk))}
              onDragState={st => {
                setDrag({ dragging: st.dragging, overTrash: st.overTrash });
                if (st.drop && st.overTrash) setSticker(null);
              }}
            >
              <View style={{ width: W }} pointerEvents="none">
                <StoryStickerView sticker={sticker} preview />
              </View>
            </DraggableLayer>
          ) : null}

          {/* lixeira ao arrastar */}
          {drag.dragging ? (
            <View pointerEvents="none" style={[s.trash, drag.overTrash && s.trashOn]}>
              <Trash2 size={drag.overTrash ? 26 : 22} color="#FFF" />
            </View>
          ) : null}

          {/* desenhar: o dedo pinta por cima */}
          {mode === "draw" ? <View style={StyleSheet.absoluteFill} {...drawPan.panHandlers} /> : null}

          {/* topo: fechar e ferramentas */}
          {mode === "idle" ? (
            <>
              <Pressable onPress={() => close()} style={[s.round, { position: "absolute", left: 12, top: 12 }]} hitSlop={8}>
                <X size={24} color="#FFF" />
              </Pressable>
              <View style={s.tools}>
                <ToolBtn label="Texto" onPress={() => startText()}>
                  <Type size={22} color="#FFF" />
                </ToolBtn>
                <ToolBtn label="Figurinhas" onPress={() => setMode("stickers")}>
                  <Sticker size={22} color="#FFF" />
                </ToolBtn>
                <ToolBtn label="Desenhar" onPress={() => setMode("draw")}>
                  <Pencil size={21} color="#FFF" />
                </ToolBtn>
                {textOnly ? (
                  <ToolBtn label="Fundo" onPress={() => setBg(b => (b + 1) % STORY_BACKGROUNDS.length)}>
                    <ImageIcon size={21} color="#FFF" />
                  </ToolBtn>
                ) : null}
                {isVideo ? (
                  <ToolBtn label={muted ? "Sem som" : "Som"} onPress={() => setMuted(m => !m)}>
                    {muted ? <VolumeX size={21} color="#FFF" /> : <Volume2 size={21} color="#FFF" />}
                  </ToolBtn>
                ) : null}
              </View>
              {textOnly && !layers.length ? (
                <Pressable onPress={() => startText()} style={StyleSheet.absoluteFill}>
                  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "rgba(255,255,255,.85)", fontSize: 24, fontWeight: "700" }}>Toque para digitar</Text>
                  </View>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {/* modo desenhar: cores, espessura, neon, desfazer */}
          {mode === "draw" ? (
            <>
              <View style={s.drawTop} pointerEvents="box-none">
                <Pressable onPress={undoDraw} style={s.round} hitSlop={8}>
                  <Undo2 size={22} color="#FFF" />
                </Pressable>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {[0.007, 0.012, 0.022].map(w => (
                    <Pressable key={w} onPress={() => setPenSize(w)} style={[s.round, penSize === w && { backgroundColor: "rgba(255,255,255,.3)" }]}>
                      <View style={{ width: w * 900, height: w * 900, borderRadius: 20, backgroundColor: "#FFF" }} />
                    </Pressable>
                  ))}
                  <Pressable onPress={() => setNeon(n => !n)} style={[s.pill, neon && { backgroundColor: "#FFF" }]}>
                    <Text style={{ color: neon ? "#111" : "#FFF", fontWeight: "800", fontSize: 12 }}>Neon</Text>
                  </Pressable>
                </View>
                <Pressable onPress={() => setMode("idle")} style={s.pill}>
                  <Text style={s.pillText}>Concluir</Text>
                </Pressable>
              </View>
              <View style={s.colorsBottom} pointerEvents="box-none">
                <ColorRow value={penColor} onChange={setPenColor} />
              </View>
            </>
          ) : null}

          {/* modo texto */}
          {mode === "text" ? (
            <View style={s.textMode}>
              <View style={s.drawTop}>
                <Pressable
                  onPress={() => setTAlign(a => (a === "center" ? "left" : a === "left" ? "right" : "center"))}
                  style={s.round}
                >
                  {tAlign === "center" ? <AlignCenter size={21} color="#FFF" /> : tAlign === "left" ? <AlignLeft size={21} color="#FFF" /> : <AlignRight size={21} color="#FFF" />}
                </Pressable>
                <Pressable onPress={() => setTBg(b => (b === "none" ? "solid" : b === "solid" ? "soft" : "none"))} style={[s.round, tBg !== "none" && { backgroundColor: "#FFF" }]}>
                  <Text style={{ color: tBg !== "none" ? "#111" : "#FFF", fontWeight: "900", fontSize: 16 }}>A</Text>
                </Pressable>
                <View style={{ flex: 1 }} />
                <Pressable onPress={finishText} style={s.pill}>
                  <Text style={s.pillText}>Concluir</Text>
                </Pressable>
              </View>
              <Pressable style={{ flex: 1, justifyContent: "center", paddingHorizontal: 18 }} onPress={finishText}>
                <TextInput
                  value={tText}
                  onChangeText={setTText}
                  autoFocus
                  multiline
                  maxLength={220}
                  placeholder="Escreva algo..."
                  placeholderTextColor="rgba(255,255,255,.6)"
                  style={[textStyle(preview, W), Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null, { minHeight: 50, alignSelf: tAlign === "center" ? "center" : tAlign === "left" ? "flex-start" : "flex-end" }]}
                />
              </Pressable>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.fonts} keyboardShouldPersistTaps="always">
                {STORY_FONTS.map(f => (
                  <Pressable key={f.id} onPress={() => setTFont(f.id)} style={[s.fontBtn, tFont === f.id && { backgroundColor: "#FFF" }]}>
                    <Text style={{ color: tFont === f.id ? "#111" : "#FFF", fontWeight: "700", fontSize: 13 }}>{f.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <ColorRow value={tColor} onChange={setTColor} />
            </View>
          ) : null}
        </View>

        {/* embaixo: publicar */}
        {mode === "idle" ? (
          <View style={s.bottom}>
            <Pressable onPress={() => publish(false)} disabled={!!publishing} style={s.shareBtn}>
              {publishing === "all" ? <ActivityIndicator color="#111" /> : <Text style={s.shareText}>Seu story</Text>}
            </Pressable>
            <Pressable onPress={() => publish(true)} disabled={!!publishing} style={[s.shareBtn, { backgroundColor: "#22C55E" }]}>
              {publishing === "close" ? <ActivityIndicator color="#FFF" /> : <Text style={[s.shareText, { color: "#FFF" }]}>Melhores amigos</Text>}
            </Pressable>
            <Pressable onPress={() => publish(false)} disabled={!!publishing} style={s.send}>
              <ChevronRight size={24} color="#111" />
            </Pressable>
          </View>
        ) : null}

        {/* folha de figurinhas */}
        <Modal visible={mode === "stickers"} transparent animationType="slide" onRequestClose={() => setMode("idle")}>
          <Pressable style={{ flex: 1 }} onPress={() => setMode("idle")} />
          <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.grabber} />
            <View style={s.stickerGrid}>
              <StickerChip label="LOCALIZAÇÃO" onPress={() => openForm("location")} />
              <StickerChip label="@MENÇÃO" onPress={() => openForm("mention")} />
              <StickerChip label="#HASHTAG" onPress={() => openForm("hashtag")} />
              <StickerChip label="LINK" onPress={() => openForm("link")} />
              <StickerChip label="HORÁRIO" onPress={addTime} />
              <StickerChip label="ENQUETE" onPress={() => openForm("poll")} />
              <StickerChip label="PERGUNTAS" onPress={() => openForm("question")} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, marginBottom: 8 }}>
              <Smile size={16} color="rgba(255,255,255,.7)" />
              <Text style={{ color: "rgba(255,255,255,.7)", fontWeight: "600" }}>Emojis</Text>
            </View>
            <View style={s.emojiGrid}>
              {EMOJIS.map(e => (
                <Pressable key={e} onPress={() => addEmoji(e)} style={s.emoji}>
                  <Text style={{ fontSize: 30 }}>{e}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Modal>

        {/* formulário da figurinha */}
        <Modal visible={!!form} transparent animationType="fade" onRequestClose={() => setForm(null)}>
          <View style={s.formWrap}>
            <Text style={s.formTitle}>
              {form?.kind === "mention"
                ? "Marcar alguém"
                : form?.kind === "hashtag"
                ? "Hashtag"
                : form?.kind === "location"
                ? "Localização"
                : form?.kind === "link"
                ? "Link"
                : form?.kind === "poll"
                ? "Enquete"
                : "Caixinha de perguntas"}
            </Text>
            <TextInput
              value={form?.a || ""}
              onChangeText={a => setForm(f => (f ? { ...f, a } : f))}
              autoFocus
              autoCapitalize={form?.kind === "location" || form?.kind === "poll" || form?.kind === "question" ? "sentences" : "none"}
              keyboardType={form?.kind === "link" ? "url" : "default"}
              placeholder={
                form?.kind === "mention"
                  ? "@usuario"
                  : form?.kind === "hashtag"
                  ? "#estilodacidade"
                  : form?.kind === "location"
                  ? "Cidade ou lugar"
                  : form?.kind === "link"
                  ? "https://..."
                  : form?.kind === "poll"
                  ? "Pergunta (ex.: Uso esse look hoje?)"
                  : "Ex.: Me pergunte sobre estilo"
              }
              placeholderTextColor="rgba(255,255,255,.55)"
              style={s.formInput}
              onSubmitEditing={form?.kind === "poll" ? undefined : submitForm}
            />
            {form?.kind === "poll" ? (
              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <TextInput value={form.b} onChangeText={b => setForm(f => (f ? { ...f, b } : f))} maxLength={24} placeholder="Opção 1" placeholderTextColor="rgba(255,255,255,.55)" style={[s.formInput, { flex: 1 }]} />
                <TextInput value={form.c} onChangeText={c => setForm(f => (f ? { ...f, c } : f))} maxLength={24} placeholder="Opção 2" placeholderTextColor="rgba(255,255,255,.55)" style={[s.formInput, { flex: 1 }]} />
              </View>
            ) : null}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 22 }}>
              <Pressable onPress={() => setForm(null)} style={[s.pill, { flex: 1, alignItems: "center", paddingVertical: 12 }]}>
                <Text style={s.pillText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={submitForm} style={[s.pill, { flex: 1, alignItems: "center", paddingVertical: 12, backgroundColor: "#FFF" }]}>
                <Text style={[s.pillText, { color: "#111" }]}>Adicionar</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

function ToolBtn({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={s.toolRow} hitSlop={4} accessibilityLabel={label}>
      <View style={s.round}>{children}</View>
    </Pressable>
  );
}

function StickerChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.chip}>
      <Text style={s.chipText}>{label}</Text>
    </Pressable>
  );
}

function ColorRow({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.colors} keyboardShouldPersistTaps="always">
      {STORY_COLORS.map(c => (
        <Pressable key={c} onPress={() => onChange(c)} style={[s.colorDot, { backgroundColor: c, borderWidth: value === c ? 3 : 1.5 }]} />
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", alignItems: "center" },
  canvas: { borderRadius: 16, overflow: "hidden", backgroundColor: "#111" },
  tools: { position: "absolute", right: 10, top: 10, gap: 10 },
  toolRow: { alignItems: "center" },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(0,0,0,.45)", alignItems: "center", justifyContent: "center" },
  pill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: "rgba(0,0,0,.45)" },
  pillText: { color: "#FFF", fontWeight: "700" },
  drawTop: { position: "absolute", left: 10, right: 10, top: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  colorsBottom: { position: "absolute", left: 0, right: 0, bottom: 14 },
  colors: { gap: 10, paddingHorizontal: 14 },
  colorDot: { width: 28, height: 28, borderRadius: 14, borderColor: "#FFF" },
  textMode: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,.55)", paddingBottom: 12 },
  fonts: { gap: 8, paddingHorizontal: 14, paddingBottom: 10 },
  fontBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,.7)" },
  trash: { position: "absolute", bottom: 22, alignSelf: "center", left: "50%", marginLeft: -26, width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: "#FFF", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,.3)" },
  trashOn: { backgroundColor: "#FF3B30", borderColor: "#FF3B30", transform: [{ scale: 1.2 }] },
  bottom: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingTop: 12, width: "100%" },
  shareBtn: { flex: 1, height: 44, borderRadius: 22, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center" },
  shareText: { color: "#111", fontWeight: "700" },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center" },
  sheet: { backgroundColor: "#1C1C1E", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,.3)", marginBottom: 14 },
  stickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  chip: { backgroundColor: "#FFF", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  chipText: { color: "#C13584", fontWeight: "900", fontSize: 13 },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  emoji: { width: "20%", alignItems: "center", paddingVertical: 6 },
  formWrap: { flex: 1, backgroundColor: "rgba(0,0,0,.85)", justifyContent: "center", padding: 26 },
  formTitle: { color: "#FFF", fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 18 },
  formInput: { color: "#FFF", fontSize: 18, fontWeight: "700", borderBottomWidth: 1.5, borderBottomColor: "rgba(255,255,255,.4)", paddingVertical: 10, textAlign: "center" }
});
