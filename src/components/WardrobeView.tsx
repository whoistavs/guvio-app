import React, { useState, useEffect, useMemo } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BarChart3, CalendarDays, Camera, Check, Heart, ImagePlus, Layers, Luggage, Plus, Send, Sparkles, Tag, Trash2, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { ClothingTag, Outfit, OutfitStyle, STYLES, WardrobeItem } from "../data/mockData";
import { StyleCard } from "./OutfitCard";
import { useAppTheme } from "../context/AppTheme";
import { generateSmartOutfit, getWeatherRecommendationTip, AIOutfitRecommendation } from "../services/aiStyling";
import {
  loadSavedWardrobe,
  addWardrobeItem,
  removeWardrobeItem,
  loadOutfits,
  saveOutfit,
  deleteOutfit,
  updateWardrobeItem,
  saveOutfitLog
} from "../services/storage";
import { WishlistModal } from "./WishlistModal";
import { OutfitCalendarModal, dayKey } from "./OutfitCalendarModal";
import { TripPackingModal } from "./TripPackingModal";
import { successFeedback, tapFeedback } from "../utils/haptics";
import { DailyLookCard } from "./DailyLookCard";
import { WardrobeStatsModal } from "./WardrobeStatsModal";
import { OutfitStoryModal } from "./OutfitStoryModal";
import { WeatherData } from "../services/weather";
import { getSavedAuthSession } from "../services/auth";
import { ImagePlaceholder, FastImage, preloadImages } from "./FastImage";

const DEFAULT_CLOTH = ""; // sem foto escolhida ainda

const ALL = "Todas";

/** transforma as peças de um look em fotos + marcações para o post */
function outfitToPost(pieces: WardrobeItem[]): { images: string[]; tags: ClothingTag[] } {
  const images = pieces.map(p => p.image).filter(Boolean);
  const tags: ClothingTag[] = pieces.map((p, i) => ({
    id: `tag-${p.id}`,
    name: p.name,
    brand: p.category,
    image: p.image,
    x: i % 2 === 0 ? 24 : 70,
    y: Math.min(85, 22 + Math.floor(i / 2) * 18)
  }));
  return { images, tags };
}

export function WardrobeView({
  onAdd,
  currentWeather,
  onPublishOutfit
}: {
  onAdd?: () => void;
  currentWeather?: WeatherData | null;
  /** abre "Nova publicação" já com as fotos e peças marcadas */
  onPublishOutfit?: (images: string[], tags: ClothingTag[], name: string) => void;
}) {
  const { colors } = useAppTheme();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [catFilter, setCatFilter] = useState(ALL);
  const [colorFilter, setColorFilter] = useState(ALL);
  const [building, setBuilding] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [outfitName, setOutfitName] = useState("");
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [showStats, setShowStats] = useState(false);
  const [storyLook, setStoryLook] = useState<{ pieces: WardrobeItem[]; title: string } | null>(null);
  const [tool, setTool] = useState<"wish" | "calendar" | "trip" | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [selectedStyle, setSelectedStyle] = useState<OutfitStyle | null>(null);
  const [aiResult, setAiResult] = useState<AIOutfitRecommendation | null>(null);

  const weatherTip = getWeatherRecommendationTip(currentWeather);

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
      loadSavedWardrobe(uId).then(loadedItems => {
        setItems(loadedItems);
        preloadImages(loadedItems.map(i => i.image));
      });
    });
    loadOutfits().then(setOutfits).catch(() => {});
  }, []);

  const uniq = (vals: string[]) => {
    const seen = new Map<string, string>();
    vals.forEach(v => {
      const k = v.trim().toLowerCase();
      if (k && !seen.has(k)) seen.set(k, v.trim());
    });
    return [ALL, ...Array.from(seen.values())];
  };
  const categories = useMemo(() => uniq(items.map(i => i.category)), [items]);
  const colorsList = useMemo(() => uniq(items.map(i => i.colorTag)), [items]);
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const visible = items.filter(
    i => (catFilter === ALL || same(i.category, catFilter)) && (colorFilter === ALL || same(i.colorTag, colorFilter))
  );
  const byId = (ids: string[]) => ids.map(id => items.find(i => i.id === id)).filter(Boolean) as WardrobeItem[];

  const togglePick = (id: string) => {
    tapFeedback();
    setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  };

  const cancelBuild = () => {
    setBuilding(false);
    setPicked([]);
    setOutfitName("");
  };

  const handleSaveOutfit = async () => {
    if (picked.length < 2) {
      Alert.alert("Monte o look", "Escolha pelo menos 2 peças.");
      return;
    }
    try {
      const o = await saveOutfit(outfitName.trim() || "Meu look", picked);
      setOutfits(prev => [o, ...prev]);
      successFeedback();
      cancelBuild();
    } catch (e: any) {
      Alert.alert("Não foi possível salvar", e?.message || "Tente novamente.");
    }
  };

  const publishPieces = (pieces: WardrobeItem[], name: string) => {
    if (!onPublishOutfit) return;
    if (pieces.length === 0) {
      Alert.alert("Look vazio", "As peças desse look não estão mais no guarda-roupa.");
      return;
    }
    const { images, tags } = outfitToPost(pieces);
    onPublishOutfit(images, tags, name);
  };

  const handleDeleteOutfit = (o: Outfit) => {
    Alert.alert("Apagar look", `Apagar "${o.name}"? As peças continuam no guarda-roupa.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteOutfit(o.id);
            setOutfits(prev => prev.filter(x => x.id !== o.id));
          } catch (e: any) {
            Alert.alert("Erro", e?.message || "Não foi possível apagar.");
          }
        }
      }
    ]);
  };

  const renderChips = (list: string[], value: string, set: (v: string) => void) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
      {list.map(v => {
        const on = v === value;
        return (
          <Pressable
            key={v}
            onPress={() => set(v)}
            style={[s.chip, { backgroundColor: on ? colors.text : colors.surface, borderColor: colors.border }]}
          >
            <Text style={{ color: on ? colors.bg : colors.text, fontSize: 11, fontWeight: "800" }}>{v}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

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

  const [savingItem, setSavingItem] = useState(false);

  const handleSaveItem = async () => {
    if (savingItem) return;
    if (!newName.trim()) {
      Alert.alert("Nome da peça", "Por favor informe o nome da peça de roupa.");
      return;
    }
    if (!newImageUri) {
      Alert.alert("Foto da peça", "Tire uma foto ou escolha da galeria.");
      return;
    }
    const newItem: WardrobeItem = {
      id: editingItemId || `w-${Date.now()}`,
      name: newName.trim(),
      category: newCategory,
      colorTag: newColorTag,
      image: newImageUri
    };
    setSavingItem(true);
    try {
      const updated = editingItemId
        ? await updateWardrobeItem(newItem, items, currentUserId)
        : await addWardrobeItem(newItem, items, currentUserId);
      setItems(updated);
      preloadImages(updated.map(i => i.image).slice(0, 3));
    } catch (e: any) {
      Alert.alert("Não foi possível salvar", e?.message || "Tente novamente.");
      return;
    } finally {
      setSavingItem(false);
    }

    setNewName("");
    setNewImageUri(DEFAULT_CLOTH);
    setEditingItemId(null);
    setAddModalVisible(false);
  };

  const itemMenu = (it: WardrobeItem) =>
    Alert.alert(it.name, `${it.category} · ${it.colorTag}`, [
      {
        text: "Editar",
        onPress: () => {
          setEditingItemId(it.id);
          setNewName(it.name);
          setNewCategory(it.category);
          setNewColorTag(it.colorTag);
          setNewImageUri(it.image);
          setAddModalVisible(true);
        }
      },
      {
        text: "Duplicar",
        onPress: async () => {
          try {
            const copy: WardrobeItem = { ...it, id: `w-${Date.now()}`, name: `${it.name} (cópia)` };
            setItems(await addWardrobeItem(copy, items, currentUserId));
          } catch (e: any) {
            Alert.alert("Erro", e?.message || "Não foi possível duplicar.");
          }
        }
      },
      { text: "Apagar", style: "destructive", onPress: () => handleDeleteItem(it.id, it.name) },
      { text: "Cancelar", style: "cancel" }
    ]);

  const handleDeleteItem = (id: string, name: string) => {
    Alert.alert("Remover peça", `Deseja excluir "${name}" do seu guarda-roupa?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            setItems(await removeWardrobeItem(id, items, currentUserId));
          } catch (e: any) {
            Alert.alert("Erro", e?.message || "Não foi possível remover.");
          }
        }
      }
    ]);
  };

  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={s.c}>
        <DailyLookCard
          items={items}
          weather={currentWeather}
          onSave={async pieces => {
            try {
              const o = await saveOutfit("Look do dia", pieces.map(p => p.id));
              setOutfits(prev => [o, ...prev]);
              successFeedback();
              Alert.alert("Look salvo", "Está em \"Meus looks\", mais abaixo.");
            } catch (e: any) {
              Alert.alert("Não foi possível salvar", e?.message || "Tente novamente.");
            }
          }}
          onPublish={onPublishOutfit ? pieces => publishPieces(pieces, "Look do dia") : undefined}
          onWore={async pieces => {
            try {
              await saveOutfitLog({ day: dayKey(new Date()), itemIds: pieces.map(p => p.id), note: "" });
              successFeedback();
              Alert.alert("Anotado no calendário 📅", "O look de hoje foi registrado.");
            } catch (e: any) {
              Alert.alert("Erro", e?.message || "Tente novamente.");
            }
          }}
        />

        <View style={s.tools}>
          {[
            { id: "wish" as const, label: "Desejos", icon: Heart },
            { id: "calendar" as const, label: "Calendário", icon: CalendarDays },
            { id: "trip" as const, label: "Mala de viagem", icon: Luggage }
          ].map(t => {
            const I = t.icon;
            return (
              <Pressable key={t.id} onPress={() => setTool(t.id)} style={[s.toolBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <I size={18} color={colors.text} />
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 11 }} numberOfLines={1}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

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

        {outfits.length > 0 ? (
          <View style={[s.section, { borderTopColor: colors.border }]}>
            <Text style={[s.badge, { color: colors.muted }]}>LOOKS SALVOS ({outfits.length})</Text>
            <Text style={[s.sh, { color: colors.text, marginBottom: 12 }]}>Meus looks</Text>
            {outfits.map(o => {
              const pieces = byId(o.itemIds);
              return (
                <View key={o.id} style={[s.outfit, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={s.outfitHead}>
                    <Text style={{ color: colors.text, fontWeight: "900", flex: 1 }} numberOfLines={1}>
                      {o.name}
                    </Text>
                    <Pressable onPress={() => handleDeleteOutfit(o)} hitSlop={10}>
                      <Trash2 size={16} color={colors.muted} />
                    </Pressable>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {pieces.map(p => (
                      <FastImage key={p.id} source={p.image} style={s.outfitImg} contentFit="cover" />
                    ))}
                  </ScrollView>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      onPress={() => pieces.length && setStoryLook({ pieces, title: o.name })}
                      style={[s.outfitBtn, { flex: 1, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border }]}
                    >
                      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>◎ Story</Text>
                    </Pressable>
                    {onPublishOutfit ? (
                      <Pressable onPress={() => publishPieces(pieces, o.name)} style={[s.outfitBtn, { flex: 1, backgroundColor: colors.text }]}>
                        <Send size={14} color={colors.bg} />
                        <Text style={{ color: colors.bg, fontWeight: "900", fontSize: 12 }}>Publicar</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={[s.section, { borderTopColor: colors.border }]}>
          <View style={s.row}>
            <View style={{ flexGrow: 1, minWidth: 170 }}>
              <Text style={[s.badge, { color: colors.muted }]}>PEÇAS CADASTRADAS ({items.length})</Text>
              <Text style={[s.sh, { color: colors.text }]}>{building ? "Escolha as peças" : "Meu guarda-roupa"}</Text>
            </View>
            {building ? (
              <Pressable onPress={cancelBuild} style={[s.add, { backgroundColor: colors.surface }]}>
                <X size={16} color={colors.text} />
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 11 }}>Cancelar</Text>
              </Pressable>
            ) : (
              <View style={{ flexDirection: "row", gap: 8 }}>
                {items.length > 0 ? (
                  <Pressable onPress={() => setShowStats(true)} style={[s.add, { backgroundColor: colors.surface }]}>
                    <BarChart3 size={16} color={colors.text} />
                  </Pressable>
                ) : null}
                {items.length >= 2 ? (
                  <Pressable onPress={() => setBuilding(true)} style={[s.add, { backgroundColor: colors.surface }]}>
                    <Layers size={16} color={colors.text} />
                    <Text style={{ color: colors.text, fontWeight: "800", fontSize: 11 }}>Montar look</Text>
                  </Pressable>
                ) : null}
                <Pressable
              onPress={() => {
                setEditingItemId(null);
                setNewName("");
                setNewImageUri(DEFAULT_CLOTH);
                setAddModalVisible(true);
              }}
              style={[s.add, { backgroundColor: colors.text }]}
            >
                  <Plus size={16} color={colors.bg} />
                  <Text style={{ color: colors.bg, fontWeight: "800", fontSize: 11 }}>Adicionar</Text>
                </Pressable>
              </View>
            )}
          </View>

          {building ? (
            <View style={[s.builder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                value={outfitName}
                onChangeText={setOutfitName}
                placeholder="Nome do look (ex: Sexta casual)"
                placeholderTextColor={colors.muted}
                style={[s.input, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }]}
              />
              <Text style={{ color: colors.muted, fontSize: 12, marginVertical: 6 }}>
                {picked.length === 0 ? "Toque nas peças abaixo para montar o look." : `${picked.length} peça(s) escolhida(s)`}
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable onPress={handleSaveOutfit} style={[s.outfitBtn, { flex: 1, backgroundColor: colors.text }]}>
                  <Check size={14} color={colors.bg} />
                  <Text style={{ color: colors.bg, fontWeight: "900", fontSize: 12 }}>Salvar look</Text>
                </Pressable>
                {onPublishOutfit ? (
                  <Pressable
                    onPress={() => {
                      if (picked.length === 0) {
                        Alert.alert("Monte o look", "Escolha pelo menos 1 peça.");
                        return;
                      }
                      publishPieces(byId(picked), outfitName.trim() || "Meu look");
                      cancelBuild();
                    }}
                    style={[s.outfitBtn, { flex: 1, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border }]}
                  >
                    <Send size={14} color={colors.text} />
                    <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>Publicar</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          {items.length > 0 ? (
            <>
              {categories.length > 2 ? renderChips(categories, catFilter, setCatFilter) : null}
              {colorsList.length > 2 ? renderChips(colorsList, colorFilter, setColorFilter) : null}
            </>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 12 }}>
              Nenhuma peça ainda. Toque em "Adicionar" para começar seu guarda-roupa digital.
            </Text>
          )}

          {items.length > 0 && visible.length === 0 ? (
            <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 12 }}>Nenhuma peça com esses filtros.</Text>
          ) : null}

          <View style={s.items}>
            {visible.map(it => {
              const on = picked.includes(it.id);
              return (
                <Pressable
                  key={it.id}
                  onPress={building ? () => togglePick(it.id) : () => itemMenu(it)}
                  style={[
                    s.item,
                    { backgroundColor: colors.surface, borderColor: on ? colors.text : colors.border },
                    on && { borderWidth: 2 }
                  ]}
                >
                  <FastImage source={it.image} style={s.img} contentFit="cover" transition={100} />
                  {building ? (
                    <View style={[s.pickDot, { backgroundColor: on ? colors.text : "rgba(0,0,0,0.45)" }]}>
                      {on ? <Text style={{ color: colors.bg, fontWeight: "900", fontSize: 12 }}>{picked.indexOf(it.id) + 1}</Text> : null}
                    </View>
                  ) : (
                    <Pressable onPress={() => handleDeleteItem(it.id, it.name)} style={s.trashBtn}>
                      <Trash2 size={14} color="#FFF" />
                    </Pressable>
                  )}
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
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <WishlistModal
        visible={tool === "wish"}
        onClose={() => setTool(null)}
        onMoveToWardrobe={w => {
          setTool(null);
          setEditingItemId(null);
          setNewName(w.name);
          setNewImageUri(w.image || DEFAULT_CLOTH);
          setAddModalVisible(true);
        }}
      />
      <OutfitCalendarModal visible={tool === "calendar"} onClose={() => setTool(null)} items={items} outfits={outfits} />
      <TripPackingModal
        visible={tool === "trip"}
        onClose={() => setTool(null)}
        items={items}
        onSaveAsLook={async (name, ids) => {
          try {
            const o = await saveOutfit(name, ids);
            setOutfits(prev => [o, ...prev]);
            successFeedback();
            Alert.alert("Mala salva", "Ela está em \"Meus looks\".");
          } catch (e: any) {
            Alert.alert("Erro", e?.message || "Tente novamente.");
          }
        }}
      />
      <OutfitStoryModal
        pieces={storyLook?.pieces || null}
        title={storyLook?.title || ""}
        onClose={() => setStoryLook(null)}
        onPublished={() => setStoryLook(null)}
      />
      <WardrobeStatsModal visible={showStats} onClose={() => setShowStats(false)} items={items} outfits={outfits} />

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
                      <FastImage source={i.image} style={s.miniImg} contentFit="cover" transition={100} />
                      <Text numberOfLines={1} style={{ fontSize: 9, color: colors.text, fontWeight: "700", marginTop: 4, width: 82, textAlign: "center" }}>
                        {i.name}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {aiResult && aiResult.matchedItems.length > 0 ? (
              <Pressable
                onPress={async () => {
                  try {
                    const o = await saveOutfit(`Look ${selectedStyle?.title || ""}`.trim(), aiResult.matchedItems.map(i => i.id));
                    setOutfits(prev => [o, ...prev]);
                    successFeedback();
                  } catch {}
                  setSelectedStyle(null);
                }}
                style={[s.done, { backgroundColor: colors.surface }]}
              >
                <Text style={{ color: colors.text, fontWeight: "900" }}>Salvar nos meus looks</Text>
              </Pressable>
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
              <Text style={[s.modalH, { color: colors.text, fontSize: 18 }]}>{editingItemId ? "Editar peça" : "Nova peça de roupa"}</Text>
              <Pressable
                onPress={() => {
                  setAddModalVisible(false);
                  setEditingItemId(null);
                }}
              >
                <X size={22} color={colors.icon} />
              </Pressable>
            </View>

            {newImageUri ? (
              <FastImage source={newImageUri} style={s.previewImg} contentFit="cover" transition={100} />
            ) : (
              <ImagePlaceholder style={s.previewImg} kind="photo" />
            )}

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
              <Text style={{ color: colors.bg, fontWeight: "900" }}>{editingItemId ? "Salvar alterações" : "Salvar no Guarda-roupa"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  c: { padding: 22, paddingBottom: 120 },
  weatherTipBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  weatherTipText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
  badge: { fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginBottom: 5 },
  h: { fontSize: 25, fontWeight: "900", letterSpacing: -0.5, marginBottom: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  ai: { height: 48, borderRadius: 24, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center", marginVertical: 8 },
  section: { borderTopWidth: 1, paddingTop: 22, marginTop: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14 },
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
  chips: { gap: 6, paddingBottom: 10 },
  tools: { flexDirection: "row", gap: 8, marginBottom: 18 },
  toolBtn: { flex: 1, borderWidth: 1, borderRadius: 16, paddingVertical: 12, alignItems: "center", gap: 5 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, height: 30, alignItems: "center", justifyContent: "center" },
  builder: { borderWidth: 1, borderRadius: 18, padding: 12, marginBottom: 12 },
  pickDot: { position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: "#FFF", alignItems: "center", justifyContent: "center" },
  outfit: { borderWidth: 1, borderRadius: 18, padding: 12, marginBottom: 12, gap: 10 },
  outfitHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  outfitImg: { width: 70, height: 86, borderRadius: 12 },
  outfitBtn: { height: 38, borderRadius: 19, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" },
  input: { width: "100%", height: 44, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, fontSize: 13, marginBottom: 4 }
});
