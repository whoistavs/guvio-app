import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Bookmark, Check, FolderPlus, X } from "lucide-react-native";
import { FeedPost, SavedCollection } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { FastImage } from "./FastImage";
import {
  createCollection,
  loadCollections,
  loadPostCollectionIds,
  setPostInCollection
} from "../services/storage";
import { tapFeedback } from "../utils/haptics";

/** Escolher em quais coleções o look fica salvo (abre ao segurar o botão de salvar) */
export function CollectionPickerModal({
  post,
  onClose,
  onSaved
}: {
  post: FeedPost | null;
  onClose: () => void;
  /** avisa que o post ficou salvo (para pintar o ícone) */
  onSaved?: (postId: string) => void;
}) {
  const { colors } = useAppTheme();
  const [cols, setCols] = useState<SavedCollection[]>([]);
  const [inIds, setInIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!post) return;
    setLoading(true);
    setCreating(false);
    setName("");
    Promise.all([loadCollections(), loadPostCollectionIds(post.id)])
      .then(([c, ids]) => {
        setCols(c);
        setInIds(ids);
      })
      .finally(() => setLoading(false));
  }, [post?.id]);

  if (!post) return null;

  const toggle = async (c: SavedCollection) => {
    tapFeedback();
    const on = !inIds.includes(c.id);
    setInIds(prev => (on ? [...prev, c.id] : prev.filter(x => x !== c.id)));
    setCols(prev => prev.map(x => (x.id === c.id ? { ...x, count: Math.max(0, x.count + (on ? 1 : -1)), cover: on ? post.image : x.cover } : x)));
    try {
      await setPostInCollection(c.id, post, on);
      if (on) onSaved?.(post.id);
    } catch (e: any) {
      setInIds(prev => (on ? prev.filter(x => x !== c.id) : [...prev, c.id]));
      Alert.alert("Erro", e?.message || "Não foi possível atualizar a coleção.");
    }
  };

  const create = async () => {
    const n = name.trim();
    if (!n) return;
    try {
      const c = await createCollection(n);
      await setPostInCollection(c.id, post, true);
      onSaved?.(post.id);
      setCols(prev => [{ ...c, count: 1, cover: post.image }, ...prev]);
      setInIds(prev => [...prev, c.id]);
      setCreating(false);
      setName("");
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Não foi possível criar a coleção.");
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
          <View style={s.titleRow}>
            <Text style={[s.title, { color: colors.text }]}>Salvar em coleção</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={22} color={colors.icon} />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.muted} style={{ marginVertical: 24 }} />
          ) : (
            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              {cols.length === 0 && !creating ? (
                <Text style={{ color: colors.muted, textAlign: "center", marginVertical: 14 }}>
                  Crie pastas como "Inverno" ou "Trabalho" para organizar seus looks salvos.
                </Text>
              ) : null}
              {cols.map(c => {
                const on = inIds.includes(c.id);
                return (
                  <Pressable key={c.id} onPress={() => toggle(c)} style={s.row}>
                    {c.cover ? (
                      <FastImage source={c.cover} style={s.cover} contentFit="cover" />
                    ) : (
                      <View style={[s.cover, { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }]}>
                        <Bookmark size={18} color={colors.muted} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: "800" }}>{c.name}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>
                        {c.count} {c.count === 1 ? "look" : "looks"}
                      </Text>
                    </View>
                    <View style={[s.check, { borderColor: on ? colors.text : colors.border, backgroundColor: on ? colors.text : "transparent" }]}>
                      {on ? <Check size={14} color={colors.bg} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {creating ? (
            <View style={s.createRow}>
              <TextInput
                value={name}
                onChangeText={setName}
                autoFocus
                maxLength={40}
                onSubmitEditing={create}
                placeholder="Nome da coleção"
                placeholderTextColor={colors.muted}
                style={[s.input, { backgroundColor: colors.surface, color: colors.text }]}
              />
              <Pressable onPress={create} style={[s.createBtn, { backgroundColor: colors.text }]}>
                <Text style={{ color: colors.bg, fontWeight: "900" }}>Criar</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setCreating(true)} style={[s.newBtn, { borderColor: colors.border }]}>
              <FolderPlus size={18} color={colors.icon} />
              <Text style={{ color: colors.text, fontWeight: "800" }}>Nova coleção</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, padding: 20, paddingBottom: 34 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { fontSize: 16, fontWeight: "900" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  cover: { width: 48, height: 48, borderRadius: 10 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  newBtn: { marginTop: 12, height: 46, borderRadius: 23, borderWidth: 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  createRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  input: { flex: 1, height: 46, borderRadius: 14, paddingHorizontal: 14 },
  createBtn: { paddingHorizontal: 18, borderRadius: 14, alignItems: "center", justifyContent: "center" }
});
