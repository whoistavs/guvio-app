import React, { useState, useEffect } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Camera, ImagePlus, Plus, Sparkles, Tag, Trash2, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { OutfitStyle, STYLES, WardrobeItem } from "../data/mockData";
import { StyleCard } from "./OutfitCard";
import { useAppTheme } from "../context/AppTheme";
import { generateSmartOutfit, AIOutfitRecommendation } from "../services/aiStyling";
import { loadSavedWardrobe, saveWardrobe } from "../services/storage";
import { WeatherData } from "../services/weather";
import { getSavedAuthSession } from "../services/auth";

const DEFAULT_CLOTH = "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?q=80&w=400&auto=format&fit=crop";

export function WardrobeView({ onAdd, currentWeather }: { onAdd?: () => void; currentWeather?: WeatherData | null }) {
  const { colors } = useAppTheme();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [selectedStyle, setSelectedStyle] = useState<OutfitStyle | null>(null);
  const [aiResult, setAiResult] = useState<AIOutfitRecommendation | null>(null);

  // Add Item Modal state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Camisetas");
  const [newColorTag, setNewColorTag] = useState("Preto");
  const [newImageUri, setNewImageUri] = useState(DEFAULT_CLOTH);

  useEffect(() => {
    getSavedAuthSession().then(session => {
      const uId = session?.user?.email || session?.user?.id;
      setCurrentUserId(uId);
      loadSavedWardrobe(uId).then(setItems);
    });
  }, []);

  const handleSelectStyle = (st: OutfitStyle) => {
    setSelectedStyle(st);
    const rec = generateSmartOutfit(st, items, currentWeather);
    setAiResult(rec);
  };

  const pickImage = async (useCamera: boolean) => {
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permissão necessária", "Acesso à câmera necessário.");
          return;
        }
        const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          setNewImageUri(result.assets[0].uri);
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permissão necessária", "Acesso à galeria necessário.");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
        if (!result.canceled && result.assets && result.assets.length > 0) {
          setNewImageUri(result.assets[0].uri);
        }
      }
    } catch (e) {
      Alert.alert("Erro de mídia", "Falha ao carregar imagem.");
    }
  };

  const handleSaveItem = () => {
    if (!newName.trim()) {
      Alert.alert("Nome da peça", "Por favor informe o nome da peça de roupa.");
      return;
    }
    const newItem: WardrobeItem = {
      id: `w-${Date.now()}`,
      name: newName.trim(),
      category: newCategory,
      colorTag: newColorTag,
      image: newImageUri
    };
    const updated = [newItem, ...items];
    setItems(updated);
    saveWardrobe(updated, currentUserId);

    setNewName("");
    setNewImageUri(DEFAULT_CLOTH);
    setAddModalVisible(false);
  };

  const handleDeleteItem = (id: string, name: string) => {
    Alert.alert("Remover peça", `Deseja excluir "${name}" do seu guarda-roupa?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          const updated = items.filter(i => i.id !== id);
          setItems(updated);
          saveWardrobe(updated, currentUserId);
        }
      }
    ]);
  };

  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={s.c}>
        <Text style={[s.badge, { color: colors.muted }]}>SELEÇÃO DE ESTILO</Text>
        <Text style={[s.h, { color: colors.text }]}>Qual estilo você quer hoje?</Text>
        <Text style={{ color: colors.muted, marginBottom: 18 }}>
          {currentWeather ? `Clima atual: ${currentWeather.temperature}°C (${currentWeather.condition}).` : "Escolha um estilo e a IA montará uma combinação."}
        </Text>
        
        <View style={s.grid}>
          {STYLES.map(st => (
            <StyleCard
              key={st.id}
              styleItem={st}
              isSelected={selectedStyle?.id === st.id}
              onPress={() => handleSelectStyle(st)}
            />
          ))}
        </View>

        {selectedStyle ? (
          <Pressable onPress={() => handleSelectStyle(selectedStyle)} style={[s.ai, { backgroundColor: colors.text }]}>
            <Sparkles size={18} color={colors.bg} />
            <Text style={{ color: colors.bg, fontWeight: "900" }}>Montar look {selectedStyle.title}</Text>
          </Pressable>
        ) : null}

        <View style={[s.section, { borderTopColor: colors.border }]}>
          <View style={s.row}>
            <View>
              <Text style={[s.badge, { color: colors.muted }]}>PEÇAS CADASTRADAS ({items.length})</Text>
              <Text style={[s.sh, { color: colors.text }]}>Meu guarda-roupa</Text>
            </View>
            <Pressable onPress={() => setAddModalVisible(true)} style={[s.add, { backgroundColor: colors.text }]}>
              <Plus size={16} color={colors.bg} />
              <Text style={{ color: colors.bg, fontWeight: "800", fontSize: 11 }}>Adicionar</Text>
            </Pressable>
          </View>

          <View style={s.items}>
            {items.map(it => (
              <View key={it.id} style={[s.item, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Image source={{ uri: it.image }} style={s.img} />
                <Pressable onPress={() => handleDeleteItem(it.id, it.name)} style={s.trashBtn}>
                  <Trash2 size={14} color="#FFF" />
                </Pressable>
                <View style={{ padding: 10 }}>
                  <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                    <Tag size={10} color={colors.muted} />
                    <Text style={{ fontSize: 9, color: colors.muted, fontWeight: "800" }}>{it.category.toUpperCase()}</Text>
                  </View>
                  <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "800", fontSize: 12, marginTop: 3 }}>
                    {it.name}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 10 }}>{it.colorTag}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* AI Recommendation Modal */}
      <Modal visible={!!selectedStyle} transparent animationType="fade" onRequestClose={() => setSelectedStyle(null)}>
        <View style={s.modalBack}>
          <View style={[s.modal, { backgroundColor: colors.bg }]}>
            <Pressable onPress={() => setSelectedStyle(null)} style={{ alignSelf: "flex-end" }}>
              <X size={22} color={colors.icon} />
            </Pressable>
            
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Sparkles size={28} color={colors.icon} />
              <Text style={[s.modalH, { color: colors.text }]}>Look {selectedStyle?.title}</Text>
            </View>

            {aiResult ? (
              <>
                <View style={[s.scoreBadge, { backgroundColor: colors.surface }]}>
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 11 }}>
                    Compatibilidade IA: {aiResult.matchScore}%
                  </Text>
                </View>

                <Text style={{ color: colors.muted, textAlign: "center", lineHeight: 18, fontSize: 12 }}>
                  {aiResult.reasoning}
                </Text>

                <View style={s.mini}>
                  {aiResult.matchedItems.map(i => (
                    <View key={i.id} style={{ alignItems: "center" }}>
                      <Image source={{ uri: i.image }} style={s.miniImg} />
                      <Text numberOfLines={1} style={{ fontSize: 9, color: colors.text, fontWeight: "700", marginTop: 4, width: 82, textAlign: "center" }}>
                        {i.name}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            <Pressable onPress={() => setSelectedStyle(null)} style={[s.done, { backgroundColor: colors.text }]}>
              <Text style={{ color: colors.bg, fontWeight: "900" }}>Usar este look hoje</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal Adicionar Peça */}
      <Modal visible={addModalVisible} transparent animationType="slide" onRequestClose={() => setAddModalVisible(false)}>
        <View style={s.modalBack}>
          <View style={[s.modal, { backgroundColor: colors.bg }]}>
            <View style={{ width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[s.modalH, { color: colors.text, fontSize: 18 }]}>Nova peça de roupa</Text>
              <Pressable onPress={() => setAddModalVisible(false)}>
                <X size={22} color={colors.icon} />
              </Pressable>
            </View>

            <Image source={{ uri: newImageUri }} style={s.previewImg} />

            <View style={s.pickers}>
              <Pressable onPress={() => pickImage(true)} style={[s.pickerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Camera size={16} color={colors.icon} />
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 11 }}>Câmera</Text>
              </Pressable>
              <Pressable onPress={() => pickImage(false)} style={[s.pickerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ImagePlus size={16} color={colors.icon} />
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 11 }}>Galeria</Text>
              </Pressable>
            </View>

            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Nome da peça (ex: Jaqueta Couro Oversized)"
              placeholderTextColor={colors.muted}
              style={[s.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            />
            <TextInput
              value={newCategory}
              onChangeText={setNewCategory}
              placeholder="Categoria (ex: Sobretudos, Camisetas, Calças, Calçados)"
              placeholderTextColor={colors.muted}
              style={[s.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            />
            <TextInput
              value={newColorTag}
              onChangeText={setNewColorTag}
              placeholder="Cor/Tom (ex: Preto Profundo, Branco Egípcio)"
              placeholderTextColor={colors.muted}
              style={[s.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            />

            <Pressable onPress={handleSaveItem} style={[s.done, { backgroundColor: colors.text, marginTop: 6 }]}>
              <Text style={{ color: colors.bg, fontWeight: "900" }}>Salvar no Guarda-roupa</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  c: { padding: 22, paddingBottom: 120 },
  badge: { fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginBottom: 5 },
  h: { fontSize: 25, fontWeight: "900", letterSpacing: -0.5, marginBottom: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  ai: { height: 48, borderRadius: 24, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center", marginVertical: 8 },
  section: { borderTopWidth: 1, paddingTop: 22, marginTop: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sh: { fontSize: 20, fontWeight: "900" },
  add: { flexDirection: "row", gap: 4, alignItems: "center", paddingHorizontal: 13, paddingVertical: 8, borderRadius: 16 },
  items: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  item: { width: "48%", borderRadius: 18, borderWidth: 1, overflow: "hidden", marginBottom: 14, position: "relative" },
  img: { width: "100%", height: 155 },
  trashBtn: { position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  modalBack: { flex: 1, backgroundColor: "rgba(0,0,0,.45)", alignItems: "center", justifyContent: "center", padding: 20 },
  modal: { width: "100%", maxWidth: 390, borderRadius: 28, padding: 22, alignItems: "center", gap: 10 },
  modalH: { fontSize: 22, fontWeight: "900" },
  scoreBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginVertical: 4 },
  mini: { flexDirection: "row", gap: 10, marginVertical: 10 },
  miniImg: { width: 82, height: 100, borderRadius: 14 },
  done: { width: "100%", height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  previewImg: { width: 100, height: 100, borderRadius: 16, marginVertical: 6 },
  pickers: { flexDirection: "row", gap: 10, marginBottom: 8, width: "100%" },
  pickerBtn: { flex: 1, height: 40, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  input: { width: "100%", height: 44, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, fontSize: 13, marginBottom: 4 }
});
