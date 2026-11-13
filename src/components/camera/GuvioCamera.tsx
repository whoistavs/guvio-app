import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChevronLeft, Hand, Image as ImageIcon, RefreshCw, Settings, Type, X, Zap, ZapOff } from "lucide-react-native";
import { FastImage } from "../FastImage";
import { Toggle } from "../Toggle";
import { openStoryEditor } from "../story/StoryEditor";
import { videoThumbnail } from "../../utils/videoThumb";
import { tapFeedback } from "../../utils/haptics";

const ML: typeof import("expo-media-library") | null = Platform.OS === "web" ? null : require("expo-media-library");

export type CameraMode = "post" | "story" | "video" | "clothing";
const MODES: { id: CameraMode; label: string }[] = [
  { id: "post", label: "POST" },
  { id: "story", label: "STORY" },
  { id: "video", label: "VÍDEO" },
  { id: "clothing", label: "ROUPA" }
];
const MAX_S = 30;
const WEB = Platform.OS === "web";

export type CameraResult =
  | { kind: "post"; images: string[]; aspect: number; video?: string }
  | { kind: "clothing"; image: string }
  | { kind: "gallery-post" };

type Prefs = { front: boolean; mirror: boolean; save: boolean; grid: boolean };
const PREFS_KEY = "guvio_camera_prefs";
const DEFAULT_PREFS: Prefs = { front: false, mirror: true, save: false, grid: false };

// ---------- abrir de qualquer lugar ----------
let openFn: ((m: CameraMode) => void) | null = null;
export function openCamera(mode: CameraMode = "story") {
  openFn?.(mode);
}

export function CameraHost({ onResult }: { onResult: (r: CameraResult) => void }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CameraMode>("story");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [flash, setFlash] = useState<"off" | "on" | "auto">("off");
  const [handsFree, setHandsFree] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [camMode, setCamMode] = useState<"picture" | "video">("picture");
  const [lastThumb, setLastThumb] = useState<string | null>(null);
  const [camPerm, askCam] = useCameraPermissions();
  const [micPerm, askMic] = useMicrophonePermissions();
  const cam = useRef<CameraView>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  useEffect(() => {
    openFn = m => {
      setMode(m);
      setOpen(true);
      setRecording(false);
      setHandsFree(false);
      setBusy(false);
      AsyncStorage.getItem(PREFS_KEY)
        .then(v => {
          const p = { ...DEFAULT_PREFS, ...(v ? JSON.parse(v) : {}) } as Prefs;
          setPrefs(p);
          setFacing(p.front ? "front" : "back");
        })
        .catch(() => {});
      if (ML)
        ML.getPermissionsAsync()
          .then(pp => (pp.granted ? ML.getAssetsAsync({ first: 1, sortBy: [[ML.SortBy.creationTime, false]], mediaType: ["photo", "video"] }) : null))
          .then(r => setLastThumb(r?.assets?.[0]?.uri || null))
          .catch(() => {});
    };
    return () => {
      openFn = null;
    };
  }, []);

  useEffect(() => {
    if (open && camPerm && !camPerm.granted && camPerm.canAskAgain) askCam();
  }, [open, camPerm?.granted]);

  // vídeo: modo vídeo da câmera; foto: modo foto
  useEffect(() => {
    setCamMode(mode === "video" ? "video" : "picture");
  }, [mode]);

  useEffect(() => {
    if (!recording) return setElapsed(0);
    const t0 = Date.now();
    const iv = setInterval(() => setElapsed((Date.now() - t0) / 1000), 200);
    return () => clearInterval(iv);
  }, [recording]);

  const savePrefs = (p: Partial<Prefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...p };
      AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const close = () => {
    if (recording) cam.current?.stopRecording();
    setOpen(false);
  };

  const keep = async (uri: string) => {
    if (!prefs.save || !ML) return;
    try {
      const p = await ML.requestPermissionsAsync(true);
      if (p.granted) await ML.saveToLibraryAsync(uri);
    } catch {}
  };

  /** manda a foto/vídeo para o lugar certo de cada modo */
  const deliver = async (media: { uri: string; type: "image" | "video"; width?: number; height?: number }) => {
    keep(media.uri);
    const m = mode;
    setOpen(false);
    // espera a câmera fechar antes de abrir a próxima tela (iPhone não abre duas de uma vez)
    await new Promise(r => setTimeout(r, Platform.OS === "ios" ? 450 : 80));
    if (m === "story") return openStoryEditor({ uri: media.uri, type: media.type });
    if (m === "clothing") return onResult({ kind: "clothing", image: media.uri });
    const aspect = media.width && media.height ? Math.min(1.91, Math.max(0.75, media.width / media.height)) : 0.8;
    if (media.type === "video") {
      const cover = await videoThumbnail(media.uri).catch(() => "");
      if (!cover) return Alert.alert("Sem capa", "Não conseguimos gerar a capa do vídeo. Tente de novo.");
      return onResult({ kind: "post", images: [cover], video: media.uri, aspect: 0.75 });
    }
    onResult({ kind: "post", images: [media.uri], aspect });
  };

  const takePhoto = async () => {
    if (busy || !cam.current) return;
    setBusy(true);
    try {
      tapFeedback();
      const pic = await cam.current.takePictureAsync({ quality: 0.9, skipProcessing: false });
      if (pic?.uri) await deliver({ uri: pic.uri, type: "image", width: pic.width, height: pic.height });
    } catch (e: any) {
      Alert.alert("Não deu para tirar a foto", e?.message || "Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const startRecording = async () => {
    if (WEB) return Alert.alert("Só no app", "Gravar vídeo pela câmera funciona no app do celular. No site, escolha um vídeo da galeria.");
    if (!cam.current || recording) return;
    if (!micPerm?.granted) {
      const r = await askMic();
      if (!r.granted) return Alert.alert("Microfone", "Libere o microfone nos ajustes do celular para gravar com som.");
    }
    if (camMode !== "video") {
      setCamMode("video");
      // a câmera precisa de um instante para trocar para vídeo
      await new Promise(r => setTimeout(r, 450));
    }
    setRecording(true);
    tapFeedback();
    try {
      const v = await cam.current?.recordAsync({ maxDuration: MAX_S });
      setRecording(false);
      if (v?.uri) await deliver({ uri: v.uri, type: "video" });
    } catch (e: any) {
      setRecording(false);
      Alert.alert("Não deu para gravar", e?.message || "Tente de novo.");
    } finally {
      if (mode !== "video") setCamMode("picture");
    }
  };

  const stopRecording = () => {
    if (recording) cam.current?.stopRecording();
  };

  // botão: toque = foto (no VÍDEO, grava); segurar = vídeo; mãos livres = toque liga/desliga a gravação
  const onShutterIn = () => {
    held.current = false;
    if (mode === "video" || handsFree || recording || mode === "clothing" || WEB) return;
    holdTimer.current = setTimeout(() => {
      held.current = true;
      startRecording();
    }, 280);
  };
  const onShutterOut = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (held.current) {
      held.current = false;
      stopRecording();
    }
  };
  const onShutterPress = () => {
    if (held.current) return;
    if (recording) return stopRecording();
    if (mode === "video" || (handsFree && mode !== "clothing")) return startRecording();
    takePhoto();
  };

  const openGallery = async () => {
    if (mode === "post" || mode === "video") {
      setOpen(false);
      onResult({ kind: "gallery-post" });
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mode === "story" ? ["images", "videos"] : ["images"],
      quality: 0.9,
      videoMaxDuration: MAX_S,
      allowsEditing: mode === "clothing",
      aspect: mode === "clothing" ? [1, 1] : undefined
    }).catch(() => null);
    const a = r && !r.canceled ? r.assets?.[0] : null;
    if (!a) return;
    if (a.type === "video" && (a.duration || 0) / 1000 > MAX_S + 0.5)
      return Alert.alert("Vídeo longo", `Escolha um vídeo de até ${MAX_S} segundos.`);
    deliver({ uri: a.uri, type: a.type === "video" ? "video" : "image", width: a.width, height: a.height });
  };

  if (!open) return null;

  const granted = !!camPerm?.granted;
  const front = facing === "front";

  return (
    <Modal visible animationType="fade" onRequestClose={close} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={s.preview}>
          {granted ? (
            <CameraView
              ref={cam}
              style={StyleSheet.absoluteFill}
              facing={facing}
              flash={flash}
              enableTorch={recording && flash === "on" && !front}
              mode={camMode}
              mirror={front && prefs.mirror}
              animateShutter
            />
          ) : (
            <View style={s.noPerm}>
              <Text style={s.noPermTitle}>Câmera do GUVIO</Text>
              <Text style={s.noPermText}>Libere a câmera para fotografar looks, stories e peças.</Text>
              <Pressable
                onPress={() => (camPerm?.canAskAgain === false ? Linking.openSettings() : askCam())}
                style={s.noPermBtn}
              >
                <Text style={{ color: "#111", fontWeight: "800" }}>{camPerm?.canAskAgain === false ? "Abrir ajustes" : "Permitir câmera"}</Text>
              </Pressable>
            </View>
          )}

          {prefs.grid && granted ? (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <View style={[s.gridV, { left: "33.33%" }]} />
              <View style={[s.gridV, { left: "66.66%" }]} />
              <View style={[s.gridH, { top: "33.33%" }]} />
              <View style={[s.gridH, { top: "66.66%" }]} />
            </View>
          ) : null}

          {/* topo */}
          <View style={s.top}>
            <Pressable onPress={() => setSettingsOpen(true)} style={s.icon} hitSlop={8} accessibilityLabel="Configurações da câmera">
              <Settings size={24} color="#FFF" />
            </Pressable>
            <Pressable
              onPress={() => setFlash(f => (f === "off" ? "on" : f === "on" ? "auto" : "off"))}
              style={s.icon}
              hitSlop={8}
              accessibilityLabel="Flash"
            >
              {flash === "off" ? <ZapOff size={24} color="#FFF" /> : <Zap size={24} color="#FFF" fill={flash === "on" ? "#FFF" : "transparent"} />}
              {flash === "auto" ? <Text style={s.auto}>A</Text> : null}
            </Pressable>
            <Pressable onPress={close} style={s.icon} hitSlop={8} accessibilityLabel="Fechar">
              <X size={28} color="#FFF" />
            </Pressable>
          </View>

          {/* ferramentas da esquerda (story) */}
          {mode === "story" && !recording ? (
            <View style={s.side}>
              <Pressable
                onPress={() => {
                  setOpen(false);
                  setTimeout(() => openStoryEditor({ textOnly: true }), Platform.OS === "ios" ? 450 : 50);
                }}
                style={s.sideBtn}
              >
                <Type size={24} color="#FFF" />
                <Text style={s.sideText}>Criar</Text>
              </Pressable>
              {!WEB ? (
                <Pressable onPress={() => setHandsFree(h => !h)} style={s.sideBtn}>
                  <Hand size={24} color={handsFree ? "#FFD60A" : "#FFF"} />
                  <Text style={[s.sideText, handsFree && { color: "#FFD60A" }]}>Mãos livres</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {recording ? (
            <View style={s.rec}>
              <View style={s.recDot} />
              <Text style={{ color: "#FFF", fontWeight: "700" }}>
                0:{String(Math.floor(elapsed)).padStart(2, "0")} / 0:{MAX_S}
              </Text>
            </View>
          ) : null}

          {/* botão de captura */}
          <View style={s.shutterRow}>
            <Pressable onPress={openGallery} style={s.thumb} accessibilityLabel="Galeria">
              {lastThumb ? <FastImage source={lastThumb} style={StyleSheet.absoluteFill} contentFit="cover" /> : <ImageIcon size={22} color="#FFF" />}
            </Pressable>
            <Pressable
              onPressIn={onShutterIn}
              onPressOut={onShutterOut}
              onPress={onShutterPress}
              disabled={!granted || busy}
              style={[s.shutter, recording && s.shutterRec]}
              accessibilityLabel={mode === "video" ? "Gravar" : "Tirar foto"}
            >
              {busy ? (
                <ActivityIndicator color="#111" />
              ) : (
                <View
                  style={[
                    s.shutterIn,
                    (mode === "video" || handsFree) && { backgroundColor: "#FF3B30" },
                    recording && { width: 28, height: 28, borderRadius: 6 }
                  ]}
                />
              )}
            </Pressable>
            <Pressable onPress={() => setFacing(f => (f === "back" ? "front" : "back"))} style={s.flip} disabled={recording} accessibilityLabel="Virar câmera">
              <RefreshCw size={24} color="#FFF" />
            </Pressable>
          </View>
          {!recording ? (
            <Text style={s.hint}>
              {mode === "story"
                ? handsFree
                  ? "Toque para começar e parar de gravar"
                  : WEB
                  ? "Toque para tirar a foto"
                  : "Toque para foto, segure para vídeo"
                : mode === "video"
                ? "Toque para gravar (até 30s)"
                : mode === "clothing"
                ? "Fotografe a peça num fundo liso"
                : WEB
                ? "Toque para tirar a foto"
                : "Toque para foto, segure para vídeo"}
            </Text>
          ) : null}
        </View>

        {/* modos */}
        {!recording ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.modes}>
            {MODES.map(m => (
              <Pressable key={m.id} onPress={() => setMode(m.id)} hitSlop={6}>
                <Text style={[s.mode, mode === m.id && s.modeOn]}>{m.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={{ height: 52 }} />
        )}

        {/* configurações da câmera */}
        <Modal visible={settingsOpen} animationType="slide" onRequestClose={() => setSettingsOpen(false)}>
          <View style={[s.settings, { paddingTop: insets.top + 6 }]}>
            <View style={s.settingsHead}>
              <Pressable onPress={() => setSettingsOpen(false)} hitSlop={10}>
                <ChevronLeft size={28} color="#FFF" />
              </Pressable>
              <Text style={s.settingsTitle}>Configurações da câmera</Text>
              <View style={{ width: 28 }} />
            </View>
            <Text style={s.section}>Câmera</Text>
            <SetRow label="Abrir com a câmera frontal" value={prefs.front} onChange={v => savePrefs({ front: v })} />
            <SetRow label="Espelhar a câmera frontal" value={prefs.mirror} onChange={v => savePrefs({ mirror: v })} />
            <SetRow label="Mostrar grade" value={prefs.grid} onChange={v => savePrefs({ grid: v })} />
            {!WEB ? (
              <>
                <Text style={s.section}>Salvar</Text>
                <SetRow
                  label="Salvar fotos e vídeos na galeria"
                  hint="Guarda no celular o que você fotografar pela câmera do GUVIO."
                  value={prefs.save}
                  onChange={v => savePrefs({ save: v })}
                />
              </>
            ) : null}
            <Text style={s.section}>Em breve</Text>
            <Text style={s.soon}>Filtros, efeitos e música nos stories.</Text>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

function SetRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.setRow}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#FFF", fontSize: 16 }}>{label}</Text>
        {hint ? <Text style={{ color: "rgba(255,255,255,.55)", fontSize: 13, marginTop: 3 }}>{hint}</Text> : null}
      </View>
      <Toggle value={value} onValueChange={onChange} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  preview: { flex: 1, borderRadius: 18, overflow: "hidden", backgroundColor: "#111" },
  top: { position: "absolute", top: 10, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  auto: { position: "absolute", right: 4, bottom: 6, color: "#FFF", fontSize: 10, fontWeight: "900" },
  side: { position: "absolute", left: 14, top: 80, gap: 22 },
  sideBtn: { flexDirection: "row", alignItems: "center", gap: 10 },
  sideText: { color: "#FFF", fontWeight: "700", textShadowColor: "rgba(0,0,0,.5)", textShadowRadius: 4 },
  rec: { position: "absolute", top: 64, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(0,0,0,.45)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  recDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#FF3B30" },
  shutterRow: { position: "absolute", bottom: 34, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 28 },
  thumb: { width: 42, height: 42, borderRadius: 10, borderWidth: 2, borderColor: "#FFF", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  flip: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(0,0,0,.35)", alignItems: "center", justifyContent: "center" },
  shutter: { width: 80, height: 80, borderRadius: 40, borderWidth: 5, borderColor: "#FFF", alignItems: "center", justifyContent: "center" },
  shutterRec: { borderColor: "rgba(255,255,255,.6)", transform: [{ scale: 1.15 }] },
  shutterIn: { width: 62, height: 62, borderRadius: 31, backgroundColor: "#FFF" },
  hint: { position: "absolute", bottom: 10, alignSelf: "center", color: "rgba(255,255,255,.75)", fontSize: 12 },
  modes: { gap: 26, paddingHorizontal: 40, height: 52, alignItems: "center", flexGrow: 1, justifyContent: "center" },
  mode: { color: "rgba(255,255,255,.55)", fontWeight: "800", fontSize: 14, letterSpacing: 0.5 },
  modeOn: { color: "#FFF" },
  gridV: { position: "absolute", top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,.5)" },
  gridH: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,.5)" },
  noPerm: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  noPermTitle: { color: "#FFF", fontSize: 20, fontWeight: "800", marginBottom: 8 },
  noPermText: { color: "rgba(255,255,255,.7)", textAlign: "center", marginBottom: 20 },
  noPermBtn: { backgroundColor: "#FFF", paddingHorizontal: 22, paddingVertical: 12, borderRadius: 22 },
  settings: { flex: 1, backgroundColor: "#000", paddingHorizontal: 16 },
  settingsHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  settingsTitle: { color: "#FFF", fontSize: 17, fontWeight: "800" },
  section: { color: "rgba(255,255,255,.55)", fontWeight: "700", marginTop: 22, marginBottom: 6 },
  setRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  soon: { color: "rgba(255,255,255,.7)" }
});
