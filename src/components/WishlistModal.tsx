import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Check, ExternalLink, ImagePlus, Plus, Trash2, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { WishlistItem } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { ListSkeleton } from "./SkeletonLoader";
import { FastImage } from "./FastImage";
import { deleteWish, loadWishlist, saveWish } from "../services/storage";
import { successFeedback } from "../utils/haptics";

/** Lista de desejos: peças que quero comprar, com link e preço */
export function WishlistModal({
  visible,
  onClose,
  onMoveToWardrobe
}: {
  visible: boolean;
  onClose: () => void;
  /** comprei: abre "Nova peça" já preenchida */
  onMoveToWardrobe?: (w: WishlistItem) => void;
}) {
  const { colors } = useAppTheme();
  const [list, setList] = useState<WishlistItem[] | null>(null);
  const [form, setForm] = useState<WishlistItem | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) loadWishlist().then(setList);
  }, [visible]);

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (!r.canceled && r.assets?.[0]?.uri && form) setForm({ ...form, image: r.assets[0].uri });
  };

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) return Alert.alert("Nome da peça", "Ex.: Bota Chelsea preta");
    setSaving(true);
    try {
      const saved = await saveWish(form);
      setList(prev => {
        const cur = prev || [];
        return cur.some(x => x.id === saved.id) ? cur.map(x => (x.id === saved.id ? saved : x)) : [saved, ...cur];
      });
      setForm(null);
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const toggleBought = async (w: WishlistItem) => {
    const next = { ...w, bought: !w.bought };
    setList(prev => (prev || []).map(x => (x.id === w.id ? next : x)));
    await saveWish(next).catch(() => {});
    if (next.bought) {
      successFeedback();
      if (onMoveToWardrobe)
        Alert.alert("Comprou!", "Quer adicionar essa peça ao seu guarda-roupa?", [
          { text: "Agora não", style: "cancel" },
          { text: "Adicionar", onPress: () => onMoveToWardrobe(next) }
        ]);
    }
  };

  const remove = (w: WishlistItem) =>
    Alert.alert("Tirar da lista?", w.name, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Tirar",
        style: "destructive",
        onPress: async () => {
          await deleteWish(w.id).catch(() => {});
          setList(prev => (prev || []).filter(x => x.id !== w.id));
        }
      }
    ]);

  const pending = (list || []).filter(w => !w.bought);
  const bought = (list || []).filter(w => w.bought);
  const total = pending.reduce((acc, w) => {
    const v = parseFloat((w.price || "").replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", "."));
    return acc + (isFinite(v) ? v : 0);
  }, 0);

  const row = (w: WishlistItem) => (
    <Pressable key={w.id} onPress={() => setForm(w)} style={[s.row, { backgroundColor: colors.surface, borderColor: colors.border, opacity: w.bought ? 0.6 : 1 }]}>
      {w.image ? <FastImage source={w.image} style={s.img} contentFit="cover" /> : <View style={[s.img, { backgroundColor: colors.bg }]} />}
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "600", textDecorationLine: w.bought ? "line-through" : "none" }} numberOfLines={1}>
          {w.name}
        </Text>
        {w.price ? <Text style={{ color: colors.muted, fontSize: 12 }}>{w.price}</Text> : null}
        {w.link ? (
          <Pressable onPress={() => Linking.openURL(/^https?:/i.test(w.link!) ? w.link! : `https://${w.link}`).catch(() => {})} hitSlop={6} style={s.link}>
            <ExternalLink size={12} color="#0095F6" />
            <Text style={{ color: "#0095F6", fontSize: 12, fontWeight: "700" }}>Ver na loja</Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable onPress={() => toggleBought(w)} hitSlop={8} style={[s.check, { borderColor: w.bought ? "#22C55E" : colors.border, backgroundColor: w.bought ? "#22C55E" : "transparent" }]}>
        {w.bought ? <Check size={14} color="#FFF" /> : null}
      </Pressable>
      <Pressable onPress={() => remove(w)} hitSlop={8}>
        <Trash2 size={16} color={colors.muted} />
      </Pressable>
    </Pressable>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.full, { backgroundColor: colors.bg }]}>
        <View style={s.head}>
          <Text style={[s.h, { color: colors.text }]}>Lista de desejos</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <X size={24} color={colors.icon} />
          </Pressable>
        </View>
        {list === null ? (
          <ListSkeleton rows={4} avatar={56} style={{ padding: 20 }} />
        ) : (
          <ScrollView contentContainerStyle={s.c}>
            <Pressable onPress={() => setForm({ id: "tmp-new", name: "" })} style={[s.add, { backgroundColor: colors.text }]}>
              <Plus size={16} color={colors.bg} />
              <Text style={{ color: colors.bg, fontWeight: "700" }}>Adicionar desejo</Text>
            </Pressable>
            {pending.length ? (
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 10 }}>
                {pending.length} {pending.length === 1 ? "peça" : "peças"}
                {total > 0 ? ` · total aproximado ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}
              </Text>
            ) : null}
            {list.length === 0 ? (
              <Text style={{ color: colors.muted, textAlign: "center", marginTop: 20, lineHeight: 20 }}>
                Viu uma peça que amou? Guarde aqui com o link e o preço. Quando comprar, marque como comprada e ela vai para o guarda-roupa.
              </Text>
            ) : null}
            {pending.map(row)}
            {bought.length ? <Text style={[s.label, { color: colors.muted }]}>Comprados</Text> : null}
            {bought.map(row)}
          </ScrollView>
        )}
      </View>

      <Modal visible={!!form} transparent animationType="fade" onRequestClose={() => setForm(null)}>
        <KeyboardAvoidingView style={s.back} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[s.card, { backgroundColor: colors.bg }]}>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>{form?.id?.startsWith("tmp-") ? "Novo desejo" : "Editar desejo"}</Text>
            <Pressable onPress={pick} style={[s.pickImg, { backgroundColor: colors.surface }]}>
              {form?.image ? <Image source={{ uri: form.image }} style={{ width: "100%", height: "100%", borderRadius: 14 }} /> : <ImagePlus size={24} color={colors.muted} />}
            </Pressable>
            {(["name", "price", "link"] as const).map(k => (
              <TextInput
                key={k}
                value={(form?.[k] as string) || ""}
                onChangeText={v => form && setForm({ ...form, [k]: v })}
                placeholder={k === "name" ? "Nome da peça" : k === "price" ? "Preço (ex.: R$ 199,90)" : "Link da loja (opcional)"}
                placeholderTextColor={colors.muted}
                autoCapitalize={k === "link" ? "none" : "sentences"}
                keyboardType={k === "link" ? "url" : "default"}
                style={[s.input, { backgroundColor: colors.surface, color: colors.text }]}
              />
            ))}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => setForm(null)} style={[s.btn, { backgroundColor: colors.surface }]}>
                <Text style={{ color: colors.text, fontWeight: "600" }}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={save} disabled={saving} style={[s.btn, { backgroundColor: colors.text }]}>
                {saving ? <ActivityIndicator color={colors.bg} /> : <Text style={{ color: colors.bg, fontWeight: "600" }}>Salvar</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Modal>
  );
}

const s = StyleSheet.create({
  full: { flex: 1, paddingTop: 50 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20 },
  h: { fontSize: 26, fontWeight: "700" },
  c: { padding: 20, paddingBottom: 60 },
  add: { height: 46, borderRadius: 23, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 16, padding: 10, marginBottom: 8 },
  img: { width: 56, height: 56, borderRadius: 12 },
  link: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 13, fontWeight: "600", marginTop: 18, marginBottom: 8 },
  back: { flex: 1, backgroundColor: "rgba(0,0,0,.5)", justifyContent: "center", padding: 22 },
  card: { borderRadius: 24, padding: 18, gap: 10 },
  pickImg: { alignSelf: "center", width: 110, height: 110, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  input: { height: 46, borderRadius: 12, paddingHorizontal: 12 },
  btn: { flex: 1, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" }
});
