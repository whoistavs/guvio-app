import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Camera, Check, Crop, FileText, Film, ImagePlus, RotateCw, Shirt, Sparkles, Trash2, Upload, X } from "lucide-react-native";
import { videoThumbnail } from "../utils/videoThumb";
import { Toggle } from "./Toggle";
import * as ImagePicker from "expo-image-picker";
import { useAppTheme } from "../context/AppTheme";
import { toast } from "./motion";
import { ImagePlaceholder } from "./FastImage";
import { OutfitPromoExporter } from "./OutfitPromoExporter";
import { ClothingTag, WardrobeItem } from "../data/mockData";
import { deleteDraft, loadDrafts, loadSavedWardrobe, PostDraftData, saveDraft } from "../services/storage";
import { getSavedAuthSession } from "../services/auth";

const MAX_PHOTOS = 10;

export type PostDraft = { images: string[]; tags: ClothingTag[]; caption: string; id: number };

/** espalha as marcações pela foto para não ficarem umas em cima das outras */
function tagFromItem(it: WardrobeItem, idx: number): ClothingTag {
  const col = idx % 2, row = Math.floor(idx / 2);
  return {
    id: `tag-${it.id}`,
    name: it.name,
    brand: it.category,
    image: it.image,
    link: it.link,
    color: it.colorTag,
    x: col === 0 ? 24 : 70,
    y: Math.min(85, 22 + row * 18)
  };
}

const DEFAULT_IMAGE = ""; // sem foto escolhida ainda

export function CreateHubView({
  onPublish,
  onWardrobe,
  publishing = false,
  draft
}: {
  onPublish: (p: {
    image: string;
    images?: string[];
    clothingTags?: ClothingTag[];
    caption: string;
    video?: string;
    pollOptions?: string[];
  }) => void | boolean | Promise<void | boolean>;
  onWardrobe: () => void;
  publishing?: boolean;
  /** look montado no guarda-roupa, pronto para publicar */
  draft?: PostDraft | null;
}) {
  const { colors } = useAppTheme();
  const [mode, setMode] = useState<"hub" | "post">("hub");
  const [caption, setCaption] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [tags, setTags] = useState<ClothingTag[]>([]);
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [current, setCurrent] = useState(0);
  const [showPromoExporter, setShowPromoExporter] = useState(false);
  const [drafts, setDrafts] = useState<PostDraftData[]>(() => loadDrafts());
  const [draftId, setDraftId] = useState<string | null>(null);
  const [editingImg, setEditingImg] = useState(false);
  const [video, setVideo] = useState<string | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [pollOn, setPollOn] = useState(false);
  const [pollLabels, setPollLabels] = useState<string[]>([]);

  // vídeo de até 30s; a capa vira a "foto" do post
  const pickVideo = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permissão necessária", "Libere o acesso aos vídeos nos Ajustes.");
        return;
      }
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        videoMaxDuration: 30,
        allowsEditing: true,
        quality: 0.7,
        videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720
      });
      if (r.canceled || !r.assets?.[0]) return;
      const a = r.assets[0];
      if (a.duration && a.duration > 31000) {
        Alert.alert("Vídeo longo demais", "Escolha um vídeo de até 30 segundos (dá para cortar ao escolher).");
        return;
      }
      if (a.fileSize && a.fileSize > 48 * 1024 * 1024) {
        Alert.alert("Vídeo pesado demais", "O limite é de uns 45 MB. Tente um vídeo mais curto.");
        return;
      }
      setLoadingVideo(true);
      const cover = await videoThumbnail(a.uri).catch(() => "");
      setVideo(a.uri);
      setImages(cover ? [cover] : []);
      setCurrent(0);
      setPollOn(false);
      if (!cover) Alert.alert("Escolha uma capa", "Não conseguimos gerar a capa. Escolha uma foto na galeria para ser a capa.");
    } catch (e: any) {
      Alert.alert("Não deu para usar o vídeo", e?.message || "Tente outro.");
    } finally {
      setLoadingVideo(false);
    }
  };
  const imageUri = images[current] || images[0] || DEFAULT_IMAGE;

  useEffect(() => {
    if (!draft) return;
    setImages(draft.images.slice(0, MAX_PHOTOS));
    setTags(draft.tags);
    setCaption(draft.caption);
    setCurrent(0);
    setDraftId(null);
    setMode("post");
  }, [draft?.id]);

  useEffect(() => {
    if (mode !== "post") return;
    getSavedAuthSession()
      .then(session => loadSavedWardrobe(session?.user?.email || session?.user?.id))
      .then(setWardrobe)
      .catch(() => {});
  }, [mode]);

  const addImages = (uris: string[]) => {
    setImages(prev => {
      const next = [...prev, ...uris].slice(0, MAX_PHOTOS);
      setCurrent(Math.min(prev.length, next.length - 1));
      return next;
    });
  };

  // ----- girar e recortar a foto atual -----
  const manipulate = async (actions: any[]) => {
    const uri = images[current];
    if (!uri) return;
    setEditingImg(true);
    try {
      const { manipulateAsync, SaveFormat } = require("expo-image-manipulator") as typeof import("expo-image-manipulator");
      const out = await manipulateAsync(uri, actions, { compress: 0.92, format: SaveFormat.JPEG });
      setImages(prev => prev.map((x, i) => (i === current ? out.uri : x)));
    } catch (e: any) {
      Alert.alert("Não deu para editar a foto", e?.message || "Tente outra imagem.");
    } finally {
      setEditingImg(false);
    }
  };

  const sizeOf = (uri: string) =>
    new Promise<{ width: number; height: number } | null>(res => Image.getSize(uri, (width, height) => res({ width, height }), () => res(null)));

  const cropTo = async (ratio: number) => {
    const size = await sizeOf(images[current]);
    if (!size) return;
    let w = size.width,
      h = Math.round(size.width / ratio);
    if (h > size.height) {
      h = size.height;
      w = Math.round(size.height * ratio);
    }
    await manipulate([{ crop: { originX: Math.round((size.width - w) / 2), originY: Math.round((size.height - h) / 2), width: w, height: h } }]);
  };

  const askCrop = () =>
    Alert.alert("Recortar foto", "Corta pelo centro da imagem.", [
      { text: "Quadrado 1:1", onPress: () => cropTo(1) },
      { text: "Retrato 4:5", onPress: () => cropTo(4 / 5) },
      { text: "Story 9:16", onPress: () => cropTo(9 / 16) },
      { text: "Cancelar", style: "cancel" }
    ]);

  // ----- rascunhos -----
  const resetPost = () => {
    setVideo(null);
    setPollOn(false);
    setPollLabels([]);
    setCaption("");
    setImages([]);
    setTags([]);
    setCurrent(0);
    setDraftId(null);
  };

  const handleSaveDraft = async () => {
    if (!images.length && !caption.trim()) {
      Alert.alert("Nada para salvar", "Escolha uma foto ou escreva a legenda primeiro.");
      return;
    }
    try {
      await saveDraft({ id: draftId || undefined, images, caption, tags });
      setDrafts(loadDrafts());
      resetPost();
      setMode("hub");
      toast("Rascunho salvo em Criar › Rascunhos", "📝");
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Não foi possível salvar o rascunho.");
    }
  };

  const openDraft = (d: PostDraftData) => {
    setImages(d.images);
    setCaption(d.caption);
    setTags(d.tags);
    setCurrent(0);
    setDraftId(d.id);
    setMode("post");
  };

  const removeDraft = (d: PostDraftData) =>
    Alert.alert("Apagar rascunho?", undefined, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: () => {
          deleteDraft(d.id);
          setDrafts(loadDrafts());
        }
      }
    ]);

  const removeImage = (i: number) => {
    setImages(prev => prev.filter((_, k) => k !== i));
    setCurrent(0);
  };

  const toggleTag = (it: WardrobeItem) => {
    setTags(prev => {
      const has = prev.some(t => t.id === `tag-${it.id}`);
      if (has) return prev.filter(t => t.id !== `tag-${it.id}`);
      return [...prev, tagFromItem(it, prev.length)];
    });
  };

  const pickImage = async (useCamera: boolean) => {
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permissão necessária", "Precisamos de acesso à câmera para tirar fotos do seu look.");
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.8,
          allowsEditing: true,
          aspect: [1, 1],
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          addImages([result.assets[0].uri]);
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permissão necessária", "Precisamos de acesso à galeria de fotos.");
          return;
        }
        const room = MAX_PHOTOS - images.length;
        if (room <= 0) {
          Alert.alert("Limite de fotos", `Um post pode ter até ${MAX_PHOTOS} fotos.`);
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.8,
          allowsMultipleSelection: true,
          selectionLimit: room,
          orderedSelection: true
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          addImages(result.assets.map(a => a.uri));
        }
      }
    } catch (error: any) {
      Alert.alert("Erro de mídia", "Não foi possível carregar a imagem selecionada.");
    }
  };

  if (mode === "hub") {
    return (
      <>
        <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={s.c}>
          <Text style={[s.h, { color: colors.text }]}>Criar</Text>
          <Text style={{ color: colors.muted, marginBottom: 22 }}>O que você quer adicionar ao Guvio?</Text>
          
          <Pressable onPress={() => setMode("post")} style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Upload size={28} color={colors.icon} />
            <View style={{ flex: 1 }}>
              <Text style={[s.ct, { color: colors.text }]}>Publicar um look</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Tire uma foto ou escolha da galeria para o feed.</Text>
            </View>
          </Pressable>

          <Pressable onPress={onWardrobe} style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Shirt size={28} color={colors.icon} />
            <View style={{ flex: 1 }}>
              <Text style={[s.ct, { color: colors.text }]}>Adicionar roupa</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Envie uma peça para seu guarda-roupa digital.</Text>
            </View>
          </Pressable>

          {drafts.length > 0 ? (
            <View style={{ marginBottom: 12 }}>
              <Text style={[s.label, { color: colors.muted, marginTop: 8 }]}>RASCUNHOS ({drafts.length})</Text>
              {drafts.map(d => (
                <Pressable key={d.id} onPress={() => openDraft(d)} style={[s.draft, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {d.images[0] ? (
                    <Image source={{ uri: d.images[0] }} style={s.draftImg} />
                  ) : (
                    <View style={[s.draftImg, { alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }]}>
                      <FileText size={18} color={colors.muted} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "800" }} numberOfLines={1}>
                      {d.caption.trim() || "Sem legenda"}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {d.images.length} {d.images.length === 1 ? "foto" : "fotos"} · {new Date(d.savedAt).toLocaleDateString("pt-BR")}
                    </Text>
                  </View>
                  <Pressable onPress={() => removeDraft(d)} hitSlop={10}>
                    <Trash2 size={16} color={colors.muted} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          ) : null}

          <Pressable onPress={() => setShowPromoExporter(true)} style={[s.card, s.viralCard, { backgroundColor: colors.text }]}>
            <Sparkles size={28} color={colors.bg} />
            <View style={{ flex: 1 }}>
              <Text style={[s.ct, { color: colors.bg }]}>Gerar Vídeo Promo 9:16 ✨</Text>
              <Text style={{ color: colors.bg, opacity: 0.8, fontSize: 12 }}>Crie comerciais virais de seus looks para o TikTok & Reels.</Text>
            </View>
          </Pressable>
        </ScrollView>

        <OutfitPromoExporter
          visible={showPromoExporter}
          onClose={() => setShowPromoExporter(false)}
          items={[]}
        />
      </>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={s.c}>
      <Pressable onPress={() => setMode("hub")}>
        <Text style={{ color: colors.muted }}>← Voltar</Text>
      </Pressable>
      <Text style={[s.h, { color: colors.text }]}>Nova publicação</Text>
      
      {imageUri ? (
        <View>
          <Image source={{ uri: imageUri }} style={s.preview} />
          {tags.map(t => (
            <View key={t.id} style={[s.pin, { left: `${t.x}%`, top: `${t.y}%` }]} pointerEvents="none">
              <Text style={s.pinText} numberOfLines={1}>{t.name}</Text>
            </View>
          ))}
          <View style={s.editBar}>
            <Pressable onPress={() => manipulate([{ rotate: 90 }])} disabled={editingImg} style={s.editBtn} hitSlop={6}>
              <RotateCw size={16} color="#FFF" />
            </Pressable>
            <Pressable onPress={askCrop} disabled={editingImg} style={s.editBtn} hitSlop={6}>
              <Crop size={16} color="#FFF" />
            </Pressable>
            {editingImg ? <ActivityIndicator color="#FFF" /> : null}
          </View>
          {images.length > 1 ? (
            <View style={s.counter}>
              <Text style={s.counterText}>{current + 1}/{images.length}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Pressable onPress={() => pickImage(false)}>
          <ImagePlaceholder style={s.preview} kind="photo" />
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: -40, marginBottom: 24, fontSize: 12 }}>
            Toque para escolher as fotos do look (até {MAX_PHOTOS})
          </Text>
        </Pressable>
      )}

      {images.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.thumbs}>
          {images.map((uri, i) => (
            <Pressable key={uri + i} onPress={() => setCurrent(i)}>
              <Image
                source={{ uri }}
                style={[s.thumb, { borderColor: i === current ? colors.text : "transparent" }]}
              />
              <Pressable onPress={() => removeImage(i)} hitSlop={8} style={s.thumbX}>
                <X size={11} color="#FFF" />
              </Pressable>
              {i === 0 ? (
                <View style={s.capa}><Text style={s.capaText}>Capa</Text></View>
              ) : null}
            </Pressable>
          ))}
          {images.length < MAX_PHOTOS ? (
            <Pressable
              onPress={() => pickImage(false)}
              style={[s.thumb, s.thumbAdd, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <ImagePlus size={20} color={colors.icon} />
            </Pressable>
          ) : null}
        </ScrollView>
      ) : null}

      {video ? (
        <View style={[s.videoInfo, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Film size={18} color={colors.icon} />
          <Text style={{ color: colors.text, fontWeight: "800", flex: 1 }}>Vídeo pronto · a foto acima é a capa</Text>
          <Pressable
            onPress={() => {
              setVideo(null);
              setImages([]);
            }}
            hitSlop={8}
          >
            <X size={16} color={colors.muted} />
          </Pressable>
        </View>
      ) : null}

      <View style={s.pickers}>
        <Pressable onPress={() => pickImage(true)} style={[s.pickerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Camera size={18} color={colors.icon} />
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Tirar Foto</Text>
        </Pressable>
        <Pressable onPress={() => pickImage(false)} style={[s.pickerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ImagePlus size={18} color={colors.icon} />
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Galeria</Text>
        </Pressable>
        <Pressable onPress={pickVideo} style={[s.pickerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {loadingVideo ? <ActivityIndicator color={colors.icon} /> : <Film size={18} color={colors.icon} />}
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Vídeo</Text>
        </Pressable>
      </View>

      {!video && images.length >= 2 && images.length <= 4 ? (
        <View style={[s.pollBox, { backgroundColor: colors.surface, borderColor: pollOn ? colors.text : colors.border }]}>
          <Pressable onPress={() => setPollOn(v => !v)} style={s.pollHead}>
            <Text style={{ fontSize: 18 }}>🗳️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "900" }}>Enquete "Qual look?"</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Cada foto vira uma opção para a comunidade votar</Text>
            </View>
            <Toggle value={pollOn} onValueChange={() => setPollOn(v => !v)} />
          </Pressable>
          {pollOn
            ? images.map((_, i) => (
                <TextInput
                  key={i}
                  value={pollLabels[i] || ""}
                  onChangeText={v => setPollLabels(prev => {
                    const n = [...prev];
                    n[i] = v;
                    return n;
                  })}
                  maxLength={30}
                  placeholder={`Opção ${i + 1} (ex.: ${i === 0 ? "Com blazer" : "Com jaqueta"})`}
                  placeholderTextColor={colors.muted}
                  style={[s.pollInput, { backgroundColor: colors.bg, color: colors.text }]}
                />
              ))
            : null}
        </View>
      ) : null}

      <Text style={[s.label, { color: colors.muted }]}>MARCAR PEÇAS DO GUARDA-ROUPA</Text>
      {wardrobe.length === 0 ? (
        <Pressable onPress={onWardrobe}>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 12 }}>
            Seu guarda-roupa está vazio. Toque para adicionar peças e marcá-las nos looks.
          </Text>
        </Pressable>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {wardrobe.map(it => {
            const on = tags.some(t => t.id === `tag-${it.id}`);
            return (
              <Pressable
                key={it.id}
                onPress={() => toggleTag(it)}
                style={[s.chip, { backgroundColor: on ? colors.text : colors.surface, borderColor: colors.border }]}
              >
                {it.image ? <Image source={{ uri: it.image }} style={s.chipImg} /> : <Shirt size={14} color={on ? colors.bg : colors.icon} />}
                <Text style={{ color: on ? colors.bg : colors.text, fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
                  {it.name}
                </Text>
                {on ? <Check size={13} color={colors.bg} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder="Escreva uma legenda... use #hashtags e @menções"
        placeholderTextColor={colors.muted}
        multiline
        style={[s.text, { backgroundColor: colors.surface, color: colors.text }]}
      />
      
      <Pressable onPress={handleSaveDraft} disabled={publishing} style={[s.draftBtn, { borderColor: colors.border }]}>
        <Text style={{ color: colors.text, fontWeight: "800" }}>{draftId ? "Atualizar rascunho" : "Salvar rascunho"}</Text>
      </Pressable>

      <Pressable
        disabled={publishing}
        onPress={async () => {
          if (images.length === 0) {
            Alert.alert("Escolha uma foto", "Tire uma foto ou abra a galeria para publicar seu look.");
            return;
          }
          const ok = await onPublish({
            image: images[0],
            images: video ? [images[0]] : images,
            clothingTags: tags,
            caption: caption || "Novo look no Guvio.",
            video: video || undefined,
            pollOptions: !video && pollOn && images.length >= 2 && images.length <= 4 ? images.map((_, i) => pollLabels[i] || `Look ${i + 1}`) : undefined
          });
          if (ok === false) return;
          if (draftId) {
            deleteDraft(draftId);
            setDrafts(loadDrafts());
          }
          resetPost();
          setMode("hub");
        }}
        style={[s.publish, { backgroundColor: colors.text, opacity: publishing ? 0.6 : 1 }]}
      >
        {publishing ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <Text style={{ color: colors.bg, fontWeight: "900" }}>Publicar</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  c: { padding: 22, paddingBottom: 120 },
  h: { fontSize: 28, fontWeight: "900", marginVertical: 16 },
  card: { borderWidth: 1, borderRadius: 22, padding: 20, flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 12 },
  viralCard: { marginTop: 6 },
  ct: { fontSize: 16, fontWeight: "900", marginBottom: 4 },
  preview: { width: "100%", aspectRatio: 1, borderRadius: 22 },
  pickers: { flexDirection: "row", gap: 10, marginVertical: 14 },
  pickerBtn: { flex: 1, height: 44, borderWidth: 1, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  text: { minHeight: 110, borderRadius: 18, padding: 14, textAlignVertical: "top" },
  videoInfo: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 12 },
  pollBox: { borderWidth: 1.5, borderRadius: 16, padding: 12, gap: 8, marginBottom: 14 },
  pollHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  pollInput: { height: 42, borderRadius: 10, paddingHorizontal: 12 },
  editBar: { position: "absolute", left: 12, top: 12, flexDirection: "row", gap: 8, alignItems: "center" },
  editBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,.6)", alignItems: "center", justifyContent: "center" },
  draft: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 16, padding: 10, marginBottom: 8 },
  draftImg: { width: 46, height: 46, borderRadius: 10 },
  draftBtn: { height: 46, borderRadius: 23, borderWidth: 1, alignItems: "center", justifyContent: "center", marginTop: 14 },
  label: { fontSize: 10, fontWeight: "800", letterSpacing: 1.3, marginTop: 4, marginBottom: 8 },
  pin: { position: "absolute", maxWidth: 130, backgroundColor: "rgba(0,0,0,.7)", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  pinText: { color: "#FFF", fontSize: 10, fontWeight: "800" },
  counter: { position: "absolute", top: 12, right: 12, backgroundColor: "rgba(0,0,0,.6)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  counterText: { color: "#FFF", fontSize: 11, fontWeight: "800" },
  thumbs: { gap: 8, paddingTop: 12 },
  thumb: { width: 62, height: 62, borderRadius: 12, borderWidth: 2 },
  thumbAdd: { alignItems: "center", justifyContent: "center", borderStyle: "dashed" },
  thumbX: { position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(0,0,0,.65)", alignItems: "center", justifyContent: "center" },
  capa: { position: "absolute", left: 4, bottom: 4, backgroundColor: "rgba(0,0,0,.65)", borderRadius: 5, paddingHorizontal: 4 },
  capaText: { color: "#FFF", fontSize: 8, fontWeight: "900" },
  chips: { gap: 8, paddingBottom: 14 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 18, paddingHorizontal: 10, height: 36, maxWidth: 180 },
  chipImg: { width: 22, height: 22, borderRadius: 6 },
  publish: { height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginTop: 14 }
});
