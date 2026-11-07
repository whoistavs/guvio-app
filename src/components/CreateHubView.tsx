import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Camera, Check, ImagePlus, Shirt, Sparkles, Upload, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useAppTheme } from "../context/AppTheme";
import { ImagePlaceholder } from "./FastImage";
import { OutfitPromoExporter } from "./OutfitPromoExporter";
import { ClothingTag, WardrobeItem } from "../data/mockData";
import { loadSavedWardrobe } from "../services/storage";
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
  const imageUri = images[current] || images[0] || DEFAULT_IMAGE;

  useEffect(() => {
    if (!draft) return;
    setImages(draft.images.slice(0, MAX_PHOTOS));
    setTags(draft.tags);
    setCaption(draft.caption);
    setCurrent(0);
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

      <View style={s.pickers}>
        <Pressable onPress={() => pickImage(true)} style={[s.pickerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Camera size={18} color={colors.icon} />
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Tirar Foto</Text>
        </Pressable>
        <Pressable onPress={() => pickImage(false)} style={[s.pickerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ImagePlus size={18} color={colors.icon} />
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Abrir Galeria</Text>
        </Pressable>
      </View>

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
      
      <Pressable
        disabled={publishing}
        onPress={async () => {
          if (images.length === 0) {
            Alert.alert("Escolha uma foto", "Tire uma foto ou abra a galeria para publicar seu look.");
            return;
          }
          const ok = await onPublish({
            image: images[0],
            images,
            clothingTags: tags,
            caption: caption || "Novo look no Guvio."
          });
          if (ok === false) return;
          setCaption("");
          setImages([]);
          setTags([]);
          setCurrent(0);
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
