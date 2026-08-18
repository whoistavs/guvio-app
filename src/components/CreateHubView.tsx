import React, { useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Camera, ImagePlus, Shirt, Upload } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { useAppTheme } from "../context/AppTheme";

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?q=80&w=800&auto=format&fit=crop";

export function CreateHubView({ onPublish, onWardrobe }: { onPublish: (p: { image: string; caption: string }) => void; onWardrobe: () => void }) {
  const { colors } = useAppTheme();
  const [mode, setMode] = useState<"hub" | "post">("hub");
  const [caption, setCaption] = useState("");
  const [imageUri, setImageUri] = useState<string>(DEFAULT_IMAGE);

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
          setImageUri(result.assets[0].uri);
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permissão necessária", "Precisamos de acesso à galeria de fotos.");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.8,
          allowsEditing: true,
          aspect: [1, 1],
        });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          setImageUri(result.assets[0].uri);
        }
      }
    } catch (error: any) {
      Alert.alert("Erro de mídia", "Não foi possível carregar a imagem selecionada.");
    }
  };

  if (mode === "hub") {
    return (
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
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={s.c}>
      <Pressable onPress={() => setMode("hub")}>
        <Text style={{ color: colors.muted }}>← Voltar</Text>
      </Pressable>
      <Text style={[s.h, { color: colors.text }]}>Nova publicação</Text>
      
      <Image source={{ uri: imageUri }} style={s.preview} />
      
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

      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder="Escreva uma legenda sobre o seu look..."
        placeholderTextColor={colors.muted}
        multiline
        style={[s.text, { backgroundColor: colors.surface, color: colors.text }]}
      />
      
      <Pressable
        onPress={() => {
          onPublish({ image: imageUri, caption: caption || "Novo look no Guvio." });
          setCaption("");
          setImageUri(DEFAULT_IMAGE);
          setMode("hub");
        }}
        style={[s.publish, { backgroundColor: colors.text }]}
      >
        <Text style={{ color: colors.bg, fontWeight: "900" }}>Publicar</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  c: { padding: 22, paddingBottom: 120 },
  h: { fontSize: 28, fontWeight: "900", marginVertical: 16 },
  card: { borderWidth: 1, borderRadius: 22, padding: 20, flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 12 },
  ct: { fontSize: 16, fontWeight: "900", marginBottom: 4 },
  preview: { width: "100%", aspectRatio: 1, borderRadius: 22 },
  pickers: { flexDirection: "row", gap: 10, marginVertical: 14 },
  pickerBtn: { flex: 1, height: 44, borderWidth: 1, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  text: { minHeight: 110, borderRadius: 18, padding: 14, textAlignVertical: "top" },
  publish: { height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginTop: 14 }
});
