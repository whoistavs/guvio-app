import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { topPad } from "../utils/insets";
import * as ImagePicker from "expo-image-picker";
import { Camera, Copy, ImagePlus, Minus, Plus, Scan, X } from "lucide-react-native";
import { useAppTheme } from "../context/AppTheme";
import { FastImage } from "./FastImage";
import { videoThumbnail } from "../utils/videoThumb";
import { tapFeedback } from "../utils/haptics";

// expo-media-library só existe no app (no site usamos o seletor do navegador)
const ML: typeof import("expo-media-library") | null = Platform.OS === "web" ? null : require("expo-media-library");

type Ratio = "original" | "1:1" | "4:5" | "16:9";
const RATIOS: Ratio[] = ["original", "1:1", "4:5", "16:9"];
const RATIO_VALUE: Record<Exclude<Ratio, "original">, number> = { "1:1": 1, "4:5": 0.8, "16:9": 16 / 9 };
const RATIO_LABEL: Record<Ratio, string> = { original: "Inteira", "1:1": "1:1", "4:5": "4:5", "16:9": "16:9" };
const MAX_VIDEO_S = 30.5;
const MAX_VIDEO_BYTES = 48 * 1024 * 1024;

type Item = {
  id: string;
  uri: string; // para mostrar (ph:// no iPhone)
  width: number;
  height: number;
  isVideo: boolean;
  duration?: number; // segundos
  asset?: any; // asset do MediaLibrary
};
type CropState = { z: number; tx: number; ty: number };

export type PickerResult =
  | { kind: "photos"; images: string[]; aspect: number }
  | { kind: "video"; video: string; cover: string; aspect: number };

const fmtDur = (s?: number) => {
  if (!s) return "";
  const t = Math.round(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

/** Tela de escolher fotos/vídeo para publicar: câmera, galeria e corte livre */
export function MediaPicker({
  visible,
  maxPhotos,
  onClose,
  onDone,
  lockAspect,
  photosOnly
}: {
  visible: boolean;
  maxPhotos: number;
  /** adicionando fotos a um post: usa a mesma proporção das que já estão */
  lockAspect?: number;
  photosOnly?: boolean;
  onClose: () => void;
  onDone: (r: PickerResult) => void;
}) {
  const { colors } = useAppTheme();
  const [win, setWin] = useState(() => Dimensions.get("window"));
  const W = Math.min(win.width, 560);
  const [perm, setPerm] = useState<"unknown" | "all" | "limited" | "denied">("unknown");
  const [assets, setAssets] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [multi, setMulti] = useState(false);
  const [selected, setSelected] = useState<Item[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [ratio, setRatio] = useState<Ratio>("original");
  const [crops, setCrops] = useState<Record<string, CropState>>({});
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const sub = Dimensions.addEventListener("change", ({ window }) => setWin(window));
    return () => sub.remove();
  }, []);

  // ao abrir: pede permissão e carrega as primeiras fotos
  useEffect(() => {
    if (!visible) return;
    setSelected([]);
    setFocusId(null);
    setCrops({});
    setMulti(false);
    setRatio("original");
    if (!ML) return;
    (async () => {
      const p = await ML.requestPermissionsAsync(false, ["photo", "video"]).catch(() => null);
      if (!p || p.status !== "granted") {
        setPerm("denied");
        return;
      }
      setPerm(p.accessPrivileges === "limited" ? "limited" : "all");
      await reload();
    })();
  }, [visible]);

  const toItem = (a: any): Item => ({
    id: a.id,
    uri: a.uri,
    width: a.width || 1080,
    height: a.height || 1080,
    isVideo: a.mediaType === "video",
    duration: a.duration,
    asset: a
  });

  const reload = async () => {
    if (!ML) return;
    const page = await ML.getAssetsAsync({
      first: 80,
      mediaType: [ML.MediaType.photo, ML.MediaType.video],
      sortBy: [[ML.SortBy.creationTime, false]]
    });
    const list = page.assets.map(toItem);
    setAssets(list);
    setCursor(page.endCursor);
    setHasMore(page.hasNextPage);
    // já mostra a foto mais recente, como as redes sociais fazem
    const first = list.find(i => !i.isVideo) || list[0];
    if (first) {
      setSelected([first]);
      setFocusId(first.id);
    }
  };

  const loadMore = async () => {
    if (!ML || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await ML.getAssetsAsync({
        first: 80,
        after: cursor,
        mediaType: [ML.MediaType.photo, ML.MediaType.video],
        sortBy: [[ML.SortBy.creationTime, false]]
      });
      setAssets(prev => [...prev, ...page.assets.map(toItem)]);
      setCursor(page.endCursor);
      setHasMore(page.hasNextPage);
    } finally {
      setLoadingMore(false);
    }
  };

  const focus = selected.find(i => i.id === focusId) || selected[selected.length - 1] || null;
  const hasVideo = selected.some(i => i.isVideo);
  const base = selected.find(i => !i.isVideo) || focus;
  // proporção do quadro: a escolhida ou a da foto (no carrossel, a da primeira)
  const frameRatio = useMemo(() => {
    if (lockAspect) return lockAspect;
    if (!base) return 1;
    if (hasVideo) return base.width / base.height;
    if (ratio === "original") return base.width / base.height;
    return RATIO_VALUE[ratio];
  }, [base?.id, ratio, hasVideo, lockAspect]);

  // o quadro cabe num quadrado W x W
  const fw = frameRatio >= 1 ? W : W * frameRatio;
  const fh = frameRatio >= 1 ? W / frameRatio : W;

  const geom = (it: Item, c?: CropState) => {
    const s0 = Math.max(fw / it.width, fh / it.height);
    const z = c?.z || 1;
    const dw = it.width * s0 * z;
    const dh = it.height * s0 * z;
    return { s0, z, dw, dh, maxX: Math.max(0, (dw - fw) / 2), maxY: Math.max(0, (dh - fh) / 2) };
  };
  const clamp = (it: Item, c: CropState): CropState => {
    const g = geom(it, c);
    return { z: c.z, tx: Math.max(-g.maxX, Math.min(g.maxX, c.tx)), ty: Math.max(-g.maxY, Math.min(g.maxY, c.ty)) };
  };

  // ---- arrastar e pinçar para ajustar o corte ----
  const gesture = useRef<{ startTx: number; startTy: number; startZ: number; startDist: number; x0: number; y0: number; pinch: boolean }>({
    startTx: 0,
    startTy: 0,
    startZ: 1,
    startDist: 0,
    x0: 0,
    y0: 0,
    pinch: false
  });
  const focusRef = useRef<Item | null>(null);
  focusRef.current = focus && !focus.isVideo ? focus : null;
  const cropsRef = useRef(crops);
  cropsRef.current = crops;
  const geomRef = useRef(geom);
  geomRef.current = geom;

  const dist = (t: any[]) => Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !!focusRef.current,
        onMoveShouldSetPanResponder: () => !!focusRef.current,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: e => {
          const it = focusRef.current!;
          const c = cropsRef.current[it.id] || { z: 1, tx: 0, ty: 0 };
          const t = e.nativeEvent.touches;
          gesture.current = {
            startTx: c.tx,
            startTy: c.ty,
            startZ: c.z,
            startDist: t.length >= 2 ? dist(t as any) : 0,
            x0: e.nativeEvent.pageX,
            y0: e.nativeEvent.pageY,
            pinch: t.length >= 2
          };
          setDragging(true);
        },
        onPanResponderMove: (e, g) => {
          const it = focusRef.current;
          if (!it) return;
          const t = e.nativeEvent.touches as any[];
          const st = gesture.current;
          let next: CropState;
          if (t.length >= 2) {
            if (!st.pinch) {
              st.pinch = true;
              st.startDist = dist(t);
              st.startZ = cropsRef.current[it.id]?.z || 1;
            }
            const z = Math.max(1, Math.min(4, st.startZ * (dist(t) / (st.startDist || 1))));
            const cur = cropsRef.current[it.id] || { z: 1, tx: 0, ty: 0 };
            next = { ...cur, z };
          } else {
            const cur = cropsRef.current[it.id] || { z: 1, tx: 0, ty: 0 };
            if (st.pinch) {
              // soltou um dedo depois de pinçar: continua arrastando de onde está, sem pulo
              st.pinch = false;
              st.startTx = cur.tx - g.dx;
              st.startTy = cur.ty - g.dy;
            }
            next = { z: cur.z, tx: st.startTx + g.dx, ty: st.startTy + g.dy };
          }
          setCrops(prev => ({ ...prev, [it.id]: clamp(it, next) }));
        },
        onPanResponderRelease: () => setDragging(false),
        onPanResponderTerminate: () => setDragging(false)
      }),
    [fw, fh]
  );

  const zoomBy = (d: number) => {
    if (!focus || focus.isVideo) return;
    const c = crops[focus.id] || { z: 1, tx: 0, ty: 0 };
    setCrops(prev => ({ ...prev, [focus.id]: clamp(focus, { ...c, z: Math.max(1, Math.min(4, c.z + d)) }) }));
  };

  // mudou a proporção: recomeça o enquadramento
  useEffect(() => setCrops({}), [frameRatio]);

  const tapItem = (it: Item) => {
    tapFeedback();
    if (photosOnly && it.isVideo) {
      Alert.alert("Só fotos aqui", "Para publicar um vídeo, comece uma publicação nova.");
      return;
    }
    if (!multi) {
      setSelected([it]);
      setFocusId(it.id);
      return;
    }
    if (it.isVideo || hasVideo) {
      Alert.alert("Vídeo vai sozinho", "Um vídeo é publicado sozinho. Desligue “Selecionar vários” para escolher um vídeo.");
      return;
    }
    const isSel = selected.some(s => s.id === it.id);
    if (isSel && focusId !== it.id) {
      setFocusId(it.id);
      return;
    }
    if (isSel) {
      const rest = selected.filter(s => s.id !== it.id);
      setSelected(rest);
      setFocusId(rest[rest.length - 1]?.id || null);
      return;
    }
    if (selected.length >= maxPhotos) {
      Alert.alert("Limite de fotos", `Um post pode ter até ${maxPhotos} fotos.`);
      return;
    }
    setSelected([...selected, it]);
    setFocusId(it.id);
  };

  const toggleMulti = () => {
    tapFeedback();
    setMulti(m => {
      const next = !m;
      if (!next && selected.length > 1) {
        const keep = focus || selected[0];
        setSelected([keep]);
        setFocusId(keep.id);
      }
      if (next && hasVideo) {
        setSelected([]);
        setFocusId(null);
      }
      return next;
    });
  };

  // ---- câmera e galeria do sistema (também é o caminho no site) ----
  const fromPicker = (assetsIn: ImagePicker.ImagePickerAsset[]) => {
    const list: Item[] = assetsIn.filter(a => !(photosOnly && a.type === "video")).map((a, i) => ({
      id: `pick-${Date.now()}-${i}`,
      uri: a.uri,
      width: a.width || 1080,
      height: a.height || 1080,
      isVideo: a.type === "video",
      duration: a.duration ? a.duration / 1000 : undefined
    }));
    if (!list.length) return;
    const vid = list.find(i => i.isVideo);
    if (vid) {
      setMulti(false);
      setSelected([vid]);
      setFocusId(vid.id);
    } else {
      const sel = list.slice(0, maxPhotos);
      if (sel.length > 1) setMulti(true);
      setSelected(sel);
      setFocusId(sel[0].id);
    }
    setAssets(prev => [...list, ...prev]);
  };

  const openCamera = async () => {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (p.status !== "granted") {
      Alert.alert("Câmera bloqueada", "Libere a câmera para o Guvio nos Ajustes do iPhone.", [
        { text: "Agora não", style: "cancel" },
        { text: "Abrir Ajustes", onPress: () => Linking.openSettings() }
      ]);
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images", "videos"], quality: 0.9, videoMaxDuration: 30 });
    if (!r.canceled && r.assets?.length) fromPicker(r.assets);
  };

  const openSystemLibrary = async (videoTrim = false) => {
    const r = await ImagePicker.launchImageLibraryAsync(
      videoTrim
        ? { mediaTypes: ["videos"], allowsEditing: true, videoMaxDuration: 30, quality: 0.7, videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720 }
        : { mediaTypes: ["images", "videos"], allowsMultipleSelection: true, selectionLimit: maxPhotos, orderedSelection: true, quality: 0.9 }
    );
    if (!r.canceled && r.assets?.length) fromPicker(r.assets);
  };

  // ---- avançar: aplica os cortes ----
  const localFile = async (it: Item): Promise<string> => {
    if (!it.asset || !ML) return it.uri;
    const info = await ML.getAssetInfoAsync(it.asset, { shouldDownloadFromNetwork: true });
    const uri = info.localUri || it.uri;
    return uri.split("#")[0];
  };
  const copyVideo = async (it: Item): Promise<string | null> => {
    if (Platform.OS === "web" || !it.asset || !ML) return it.uri;
    try {
      const { File, Paths } = require("expo-file-system") as typeof import("expo-file-system");
      const info = await ML.getAssetInfoAsync(it.asset, { shouldDownloadFromNetwork: true });
      const raw = info.localUri || "";
      const candidates = Array.from(new Set([raw, raw.split("#")[0]])).filter(Boolean);
      for (const c of candidates) {
        try {
          const src = new File(c);
          if (!src.exists) continue;
          const ext = (c.split("#")[0].split(".").pop() || "mov").toLowerCase();
          const dest = new File(Paths.cache, `guvio-video-${Date.now()}.${ext}`);
          src.copy(dest);
          if (dest.exists) return dest.uri;
        } catch {}
      }
    } catch {}
    return null;
  };
  const realSize = (uri: string) =>
    new Promise<{ width: number; height: number } | null>(res => Image.getSize(uri, (width, height) => res({ width, height }), () => res(null)));

  const next = async () => {
    if (!selected.length || busy) return;
    setBusy(true);
    try {
      const { manipulateAsync, SaveFormat } = require("expo-image-manipulator") as typeof import("expo-image-manipulator");
      if (hasVideo) {
        const v = selected[0];
        if ((v.duration || 0) > MAX_VIDEO_S) {
          Alert.alert("Vídeo longo demais", "Vídeos podem ter até 30 segundos. Quer cortar este vídeo?", [
            { text: "Agora não", style: "cancel" },
            { text: "Cortar vídeo", onPress: () => openSystemLibrary(true) }
          ]);
          return;
        }
        // copia o vídeo para dentro do app (o caminho da galeria nem sempre pode ser lido direto)
        const file = await copyVideo(v);
        if (!file) {
          Alert.alert("Não deu para abrir este vídeo", "Vamos abrir o seletor do iPhone para escolher o vídeo de lá.", [
            { text: "Cancelar", style: "cancel" },
            { text: "Abrir", onPress: () => openSystemLibrary(true) }
          ]);
          return;
        }
        if (Platform.OS !== "web") {
          try {
            const { File } = require("expo-file-system") as typeof import("expo-file-system");
            const size = new File(file).size || 0;
            if (size > MAX_VIDEO_BYTES) {
              Alert.alert("Vídeo pesado demais", "O limite é de uns 45 MB. Quer escolher e compactar o vídeo?", [
                { text: "Agora não", style: "cancel" },
                { text: "Compactar", onPress: () => openSystemLibrary(true) }
              ]);
              return;
            }
          } catch {}
        }
        // capa: um quadro do vídeo; se falhar, a miniatura que a própria galeria guarda
        let cover = await videoThumbnail(file).catch(() => "");
        if (!cover && v.asset) {
          cover = await manipulateAsync(v.uri, [{ resize: { width: 1080 } }], { compress: 0.85, format: SaveFormat.JPEG })
            .then(r => r.uri)
            .catch(() => "");
        }
        if (!cover) {
          Alert.alert("Sem capa", "Não conseguimos montar a capa deste vídeo. Tente escolher pelo seletor do iPhone.", [
            { text: "Cancelar", style: "cancel" },
            { text: "Abrir", onPress: () => openSystemLibrary(true) }
          ]);
          return;
        }
        onDone({ kind: "video", video: file, cover, aspect: v.width / v.height });
        return;
      }
      const out: string[] = [];
      for (const it of selected) {
        const file = await localFile(it).catch(() => it.uri);
        const real = (await realSize(file)) || { width: it.width, height: it.height };
        // a conta é feita no tamanho mostrado; converte para os pixels reais
        const k = real.width / it.width;
        const c = clamp(it, crops[it.id] || { z: 1, tx: 0, ty: 0 });
        const g = geom(it, c);
        const scale = g.s0 * g.z;
        const left = fw / 2 + c.tx - g.dw / 2;
        const top = fh / 2 + c.ty - g.dh / 2;
        let cx = Math.max(0, Math.round((-left / scale) * k));
        let cy = Math.max(0, Math.round((-top / scale) * k));
        let cw = Math.round((fw / scale) * k);
        let ch = Math.round((fh / scale) * k);
        cw = Math.min(cw, real.width - cx);
        ch = Math.min(ch, real.height - cy);
        const actions: any[] = [];
        const whole = cx <= 1 && cy <= 1 && cw >= real.width - 2 && ch >= real.height - 2;
        if (!whole) actions.push({ crop: { originX: cx, originY: cy, width: cw, height: ch } });
        const longSide = Math.max(whole ? real.width : cw, whole ? real.height : ch);
        // 1920px no lado maior: nítida até nos iPhones Pro Max (a foto é comprimida uma vez só)
        if (longSide > 1920) actions.push({ resize: (whole ? real.width : cw) >= (whole ? real.height : ch) ? { width: 1920 } : { height: 1920 } });
        const r = await manipulateAsync(file, actions, { compress: 0.88, format: SaveFormat.JPEG }).catch(() =>
          // se o arquivo não abrir, pede a foto direto para a galeria
          manipulateAsync(it.uri, actions, { compress: 0.88, format: SaveFormat.JPEG })
        );
        out.push(r.uri);
      }
      onDone({ kind: "photos", images: out, aspect: fw / fh });
    } catch (e: any) {
      Alert.alert("Não deu para preparar as fotos", e?.message || "Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  // ---- desenho ----
  const COLS = 4;
  const cell = (Math.min(win.width, 560) - (COLS - 1) * 2) / COLS;
  const fc = focus ? crops[focus.id] || { z: 1, tx: 0, ty: 0 } : null;
  const fg = focus && fc ? geom(focus, fc) : null;

  const header = (
    <View style={[s.head, { borderBottomColor: colors.border }]}>
      <Pressable onPress={onClose} hitSlop={12} style={s.headBtn}>
        <X size={26} color={colors.icon} />
      </Pressable>
      <Text style={[s.title, { color: colors.text }]}>Nova publicação</Text>
      <Pressable onPress={next} disabled={!selected.length || busy} hitSlop={12} style={s.headBtn}>
        {busy ? <ActivityIndicator color="#0095F6" /> : <Text style={[s.next, { opacity: selected.length ? 1 : 0.4 }]}>Avançar</Text>}
      </Pressable>
    </View>
  );

  const preview = (
    <View style={[s.previewBox, { width: W, height: W, backgroundColor: colors.surface2 }]}>
      {focus && fg && fc ? (
        <View style={{ width: fw, height: fh, overflow: "hidden" }} {...pan.panHandlers}>
          <FastImage
            source={focus.uri}
            contentFit="cover"
            style={{
              position: "absolute",
              width: fg.dw,
              height: fg.dh,
              left: (fw - fg.dw) / 2 + (focus.isVideo ? 0 : fc.tx),
              top: (fh - fg.dh) / 2 + (focus.isVideo ? 0 : fc.ty)
            }}
          />
          {dragging ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <View style={[s.gridV, { left: "33.33%" }]} />
              <View style={[s.gridV, { left: "66.66%" }]} />
              <View style={[s.gridH, { top: "33.33%" }]} />
              <View style={[s.gridH, { top: "66.66%" }]} />
            </View>
          ) : null}
          {focus.isVideo ? (
            <View style={s.videoTag} pointerEvents="none">
              <Text style={s.videoTagText}>Vídeo · {fmtDur(focus.duration)}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={{ alignItems: "center", gap: 10, padding: 24 }}>
          <ImagePlus size={36} color={colors.muted} />
          <Text style={{ color: colors.muted, textAlign: "center" }}>Escolha fotos ou um vídeo abaixo</Text>
        </View>
      )}
      {focus && !hasVideo && !lockAspect ? (
        <Pressable
          onPress={() => {
            tapFeedback();
            setRatio(r => RATIOS[(RATIOS.indexOf(r) + 1) % RATIOS.length]);
          }}
          style={s.ratioBtn}
          hitSlop={8}
        >
          <Scan size={15} color="#FFF" />
          <Text style={s.ratioText}>{RATIO_LABEL[ratio]}</Text>
        </Pressable>
      ) : null}
      {focus && !focus.isVideo && Platform.OS === "web" ? (
        <View style={s.zoomBtns}>
          <Pressable onPress={() => zoomBy(-0.25)} style={s.zoomBtn}>
            <Minus size={16} color="#FFF" />
          </Pressable>
          <Pressable onPress={() => zoomBy(0.25)} style={s.zoomBtn}>
            <Plus size={16} color="#FFF" />
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const bar = (
    <View style={s.bar}>
      <Text style={[s.recent, { color: colors.text }]}>Recentes</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {ML ? (
          <Pressable onPress={() => openSystemLibrary(false)} style={[s.pill, { backgroundColor: colors.surface }]}>
            <ImagePlus size={15} color={colors.text} />
            <Text style={[s.pillText, { color: colors.text }]}>Álbuns</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={toggleMulti} style={[s.pill, { backgroundColor: multi ? "#0095F6" : colors.surface }]}>
          <Copy size={15} color={multi ? "#FFF" : colors.text} />
          <Text style={[s.pillText, { color: multi ? "#FFF" : colors.text }]}>Selecionar vários</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderCell = ({ item }: { item: Item | "camera" }) => {
    if (item === "camera") {
      return (
        <Pressable onPress={openCamera} style={[s.cell, { width: cell, height: cell, backgroundColor: colors.surface2 }]}>
          <Camera size={30} color={colors.icon} />
        </Pressable>
      );
    }
    const idx = selected.findIndex(x => x.id === item.id);
    const on = idx >= 0;
    return (
      <Pressable onPress={() => tapItem(item)} style={{ width: cell, height: cell }}>
        <FastImage source={item.uri} style={{ width: cell, height: cell }} contentFit="cover" />
        {on && (!multi || focusId === item.id) ? <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(255,255,255,.35)" }]} /> : null}
        {item.isVideo ? <Text style={s.dur}>{fmtDur(item.duration)}</Text> : null}
        {multi ? (
          <View style={[s.num, on && { backgroundColor: "#0095F6", borderColor: "#FFF" }]}>
            {on ? <Text style={s.numText}>{idx + 1}</Text> : null}
          </View>
        ) : null}
      </Pressable>
    );
  };

  let body: React.ReactNode;
  if (!ML) {
    // site: seletor do navegador
    body = (
      <View style={{ padding: 20, gap: 12 }}>
        <Pressable onPress={() => openSystemLibrary(false)} style={[s.bigBtn, { backgroundColor: colors.text }]}>
          <ImagePlus size={18} color={colors.bg} />
          <Text style={{ color: colors.bg, fontWeight: "600" }}>Escolher fotos ou vídeo</Text>
        </Pressable>
        <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}>
          Arraste a foto para enquadrar e use + e − para aproximar. O botão no canto troca a proporção.
        </Text>
      </View>
    );
  } else if (perm === "denied") {
    body = (
      <View style={{ padding: 24, gap: 12, alignItems: "center" }}>
        <Text style={{ color: colors.text, fontWeight: "600", fontSize: 16, textAlign: "center" }}>Permita o acesso às suas fotos</Text>
        <Text style={{ color: colors.muted, textAlign: "center" }}>
          Para escolher fotos e vídeos aqui dentro, o Guvio precisa de acesso à sua galeria.
        </Text>
        <Pressable onPress={() => Linking.openSettings()} style={[s.bigBtn, { backgroundColor: "#0095F6", alignSelf: "stretch" }]}>
          <Text style={{ color: "#FFF", fontWeight: "600" }}>Abrir Ajustes</Text>
        </Pressable>
        <Pressable onPress={openCamera} style={[s.bigBtn, { backgroundColor: colors.surface, alignSelf: "stretch" }]}>
          <Camera size={18} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: "600" }}>Usar a câmera</Text>
        </Pressable>
      </View>
    );
  } else {
    body = (
      <FlatList
        data={["camera", ...assets] as (Item | "camera")[]}
        keyExtractor={i => (i === "camera" ? "camera" : i.id)}
        numColumns={COLS}
        renderItem={renderCell}
        columnWrapperStyle={{ gap: 2 }}
        contentContainerStyle={{ gap: 2, paddingBottom: 40 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        initialNumToRender={24}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          perm === "limited" ? (
            <Pressable
              onPress={async () => {
                await ML.presentPermissionsPickerAsync().catch(() => {});
                reload();
              }}
              style={[s.limited, { backgroundColor: colors.surface }]}
            >
              <Text style={{ color: colors.text, fontSize: 12, flex: 1 }}>Você liberou só algumas fotos.</Text>
              <Text style={{ color: "#0095F6", fontWeight: "600", fontSize: 12 }}>Gerenciar</Text>
            </Pressable>
          ) : null
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginTop: 12 }} color={colors.muted} /> : null}
      />
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.root, { backgroundColor: colors.bg }]}>
        <View style={{ width: "100%", maxWidth: 560, alignSelf: "center", flex: 1 }}>
          {header}
          {preview}
          {bar}
          <View style={{ flex: 1 }}>{body}</View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, paddingTop: topPad(10) },
  head: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
  headBtn: { minWidth: 70, height: 40, justifyContent: "center" },
  title: { fontSize: 17, fontWeight: "700" },
  next: { color: "#0095F6", fontSize: 16, fontWeight: "600", textAlign: "right" },
  previewBox: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  gridV: { position: "absolute", top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,.7)" },
  gridH: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,.7)" },
  ratioBtn: { position: "absolute", left: 12, bottom: 12, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,.6)", borderRadius: 16, paddingHorizontal: 10, height: 32 },
  ratioText: { color: "#FFF", fontSize: 12, fontWeight: "600" },
  zoomBtns: { position: "absolute", right: 12, bottom: 12, flexDirection: "row", gap: 8 },
  zoomBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,.6)", alignItems: "center", justifyContent: "center" },
  videoTag: { position: "absolute", top: 10, left: 10, backgroundColor: "rgba(0,0,0,.6)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  videoTagText: { color: "#FFF", fontSize: 11, fontWeight: "600" },
  bar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10 },
  recent: { fontSize: 17, fontWeight: "700" },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 16, paddingHorizontal: 11, height: 32 },
  pillText: { fontSize: 12, fontWeight: "600" },
  cell: { alignItems: "center", justifyContent: "center" },
  dur: { position: "absolute", right: 6, bottom: 5, color: "#FFF", fontSize: 12, fontWeight: "600", textShadowColor: "rgba(0,0,0,.7)", textShadowRadius: 3 },
  num: { position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "rgba(255,255,255,.9)", backgroundColor: "rgba(0,0,0,.2)", alignItems: "center", justifyContent: "center" },
  numText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  bigBtn: { height: 50, borderRadius: 14, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  limited: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, marginBottom: 2 }
});
