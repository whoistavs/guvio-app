import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { noSwipeBack } from "./gestures";
import { BarChart2, Check, FileText, Film, ImagePlus, Shirt, Trash2, Upload, X } from "lucide-react-native";
import { MediaPicker, PickerResult } from "./MediaPicker";
import { Toggle } from "./Toggle";
import { useAppTheme } from "../context/AppTheme";
import { toast } from "./motion";
import { ImagePlaceholder } from "./FastImage";
import { ClothingTag, WardrobeItem } from "../data/mockData";
import { deleteDraft, loadDrafts, loadSavedWardrobe, PostDraftData, saveDraft } from "../services/storage";
import { getSavedAuthSession } from "../services/auth";

const MAX_PHOTOS = 10;

export type PostDraft = { images: string[]; tags: ClothingTag[]; caption: string; id: number; video?: string; aspect?: number };

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
    aspect?: number;
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
  const [drafts, setDrafts] = useState<PostDraftData[]>(() => loadDrafts());
  const [draftId, setDraftId] = useState<string | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const [pollOn, setPollOn] = useState(false);
  const [pollLabels, setPollLabels] = useState<string[]>([]);
  const [aspect, setAspect] = useState(1);
  const [picker, setPicker] = useState<null | "new" | "add">(null);

  const onPicked = (r: PickerResult) => {
    const mode0 = picker;
    setPicker(null);
    if (r.kind === "video") {
      if (!r.cover) return;
      setVideo(r.video);
      setImages(r.cover ? [r.cover] : []);
      setAspect(r.aspect);
      setPollOn(false);
      if (!r.cover) Alert.alert("Sem capa", "Não conseguimos gerar a capa do vídeo. Tente outro vídeo.");
    } else if (mode0 === "add" && images.length && !video) {
      setImages(prev => [...prev, ...r.images].slice(0, MAX_PHOTOS));
    } else {
      setVideo(null);
      setImages(r.images.slice(0, MAX_PHOTOS));
      setAspect(r.aspect);
      setCurrent(0);
    }
    setMode("post");
  };

  // rascunhos e looks do guarda-roupa: proporção da primeira foto
  const aspectFrom = (uri?: string) => {
    if (!uri) return setAspect(1);
    Image.getSize(
      uri,
      (w, h) => setAspect(Math.min(1.91, Math.max(0.75, w / h))),
      () => setAspect(1)
    );
  };

  const imageUri = images[current] || images[0] || DEFAULT_IMAGE;

  useEffect(() => {
    if (!draft) return;
    setImages(draft.images.slice(0, MAX_PHOTOS));
    setVideo(draft.video || null);
    if (draft.aspect) setAspect(draft.aspect);
    else aspectFrom(draft.images[0]);
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
    setAspect(1);
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
      toast("Rascunho salvo em Criar › Rascunhos");
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Não foi possível salvar o rascunho.");
    }
  };

  const openDraft = (d: PostDraftData) => {
    setImages(d.images);
    aspectFrom(d.images[0]);
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

  if (mode === "hub") {
    return (
      <>
        <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={s.c}>
          <Text style={[s.h, { color: colors.text }]}>Criar</Text>
          <Text style={{ color: colors.muted, marginBottom: 22 }}>O que você quer adicionar ao Guvio?</Text>
          
          <Pressable onPress={() => setPicker("new")} style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
              <Text style={[s.label, { color: colors.muted, marginTop: 8 }]}>Rascunhos ({drafts.length})</Text>
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
                    <Text style={{ color: colors.text, fontWeight: "600" }} numberOfLines={1}>
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

        </ScrollView>
        <MediaPicker visible={!!picker} maxPhotos={picker === "add" ? Math.max(1, MAX_PHOTOS - images.length) : MAX_PHOTOS} lockAspect={picker === "add" ? aspect : undefined} photosOnly={picker === "add"} onClose={() => setPicker(null)} onDone={onPicked} />
      </>
    );
  }

  return (
    <>
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={s.c}>
      <Pressable onPress={() => setMode("hub")}>
        <Text style={{ color: colors.muted }}>← Voltar</Text>
      </Pressable>
      <Text style={[s.h, { color: colors.text }]}>Nova publicação</Text>
      
      {imageUri ? (
        <View>
          <Image source={{ uri: imageUri }} style={[s.preview, { aspectRatio: Math.min(1.91, Math.max(0.75, aspect)), backgroundColor: "#000" }]} resizeMode={aspect < 0.75 || aspect > 1.91 ? "contain" : "cover"} />
          {tags.map(t => (
            <View key={t.id} style={[s.pin, { left: `${t.x}%`, top: `${t.y}%` }]} pointerEvents="none">
              <Text style={s.pinText} numberOfLines={1}>{t.name}</Text>
            </View>
          ))}
          {images.length > 1 ? (
            <View style={s.counter}>
              <Text style={s.counterText}>{current + 1}/{images.length}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Pressable onPress={() => setPicker("new")}>
          <ImagePlaceholder style={s.preview} kind="photo" />
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: -40, marginBottom: 24, fontSize: 12 }}>
            Toque para escolher as fotos do look (até {MAX_PHOTOS})
          </Text>
        </Pressable>
      )}

      {images.length > 0 ? (
        <ScrollView {...noSwipeBack} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.thumbs}>
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
          {images.length < MAX_PHOTOS && !video ? (
            <Pressable
              onPress={() => setPicker("add")}
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
          <Text style={{ color: colors.text, fontWeight: "600", flex: 1 }}>Vídeo pronto · a foto acima é a capa</Text>
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
        <Pressable onPress={() => setPicker("new")} style={[s.pickerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ImagePlus size={18} color={colors.icon} />
          <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 }}>{images.length ? "Trocar fotos ou vídeo" : "Escolher fotos ou vídeo"}</Text>
        </Pressable>
      </View>

      {!video && images.length >= 2 && images.length <= 4 ? (
        <View style={[s.pollBox, { backgroundColor: colors.surface, borderColor: pollOn ? colors.text : colors.border }]}>
          <Pressable onPress={() => setPollOn(v => !v)} style={s.pollHead}>
            <BarChart2 size={20} color={colors.icon} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>Enquete "Qual look?"</Text>
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

      <Text style={[s.label, { color: colors.muted }]}>Marcar peças do guarda-roupa</Text>
      {wardrobe.length === 0 ? (
        <Pressable onPress={onWardrobe}>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 12 }}>
            Seu guarda-roupa está vazio. Toque para adicionar peças e marcá-las nos looks.
          </Text>
        </Pressable>
      ) : (
        <ScrollView {...noSwipeBack} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
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
        <Text style={{ color: colors.text, fontWeight: "600" }}>{draftId ? "Atualizar rascunho" : "Salvar rascunho"}</Text>
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
            aspect,
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
          <Text style={{ color: colors.bg, fontWeight: "700" }}>Publicar</Text>
        )}
      </Pressable>
    </ScrollView>
    <MediaPicker visible={!!picker} maxPhotos={picker === "add" ? Math.max(1, MAX_PHOTOS - images.length) : MAX_PHOTOS} lockAspect={picker === "add" ? aspect : undefined} photosOnly={picker === "add"} onClose={() => setPicker(null)} onDone={onPicked} />
    </>
  );
}

const s = StyleSheet.create({
  c: { padding: 22, paddingBottom: 120 },
  h: { fontSize: 28, fontWeight: "700", marginVertical: 16 },
  card: { borderWidth: 1, borderRadius: 22, padding: 20, flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 12 },
  ct: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
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
  label: { fontSize: 13, fontWeight: "600", marginTop: 4, marginBottom: 8 },
  pin: { position: "absolute", maxWidth: 130, backgroundColor: "rgba(0,0,0,.7)", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  pinText: { color: "#FFF", fontSize: 10, fontWeight: "600" },
  counter: { position: "absolute", top: 12, right: 12, backgroundColor: "rgba(0,0,0,.6)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  counterText: { color: "#FFF", fontSize: 11, fontWeight: "600" },
  thumbs: { gap: 8, paddingTop: 12 },
  thumb: { width: 62, height: 62, borderRadius: 12, borderWidth: 2 },
  thumbAdd: { alignItems: "center", justifyContent: "center", borderStyle: "dashed" },
  thumbX: { position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(0,0,0,.65)", alignItems: "center", justifyContent: "center" },
  capa: { position: "absolute", left: 4, bottom: 4, backgroundColor: "rgba(0,0,0,.65)", borderRadius: 5, paddingHorizontal: 4 },
  capaText: { color: "#FFF", fontSize: 8, fontWeight: "700" },
  chips: { gap: 8, paddingBottom: 14 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 18, paddingHorizontal: 10, height: 36, maxWidth: 180 },
  chipImg: { width: 22, height: 22, borderRadius: 6 },
  publish: { height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginTop: 14 }
});
