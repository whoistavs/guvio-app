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
import { ClothingTag, FeedPost, WardrobeItem } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { toast } from "./motion";
import { loadSavedWardrobe, removePost, reportPost, setPostFlags, updatePost } from "../services/storage";
import { getSavedAuthSession } from "../services/auth";

const REPORT_REASONS = ["Conteúdo impróprio ou nudez", "Spam ou golpe", "Discurso de ódio ou assédio", "Violência", "Outro motivo"];

/** Pergunta o motivo e envia a denúncia. Resolve true se denunciou. */
export function askReport(post: FeedPost): Promise<boolean> {
  return new Promise(resolve => {
    Alert.alert("Denunciar post", "Por que você está denunciando este look?", [
      ...REPORT_REASONS.map(reason => ({
        text: reason,
        onPress: async () => {
          try {
            await reportPost(post.id, reason);
            toast("Obrigado pela denúncia. Esse post sumiu do seu feed", "🛡️");
            resolve(true);
          } catch (e: any) {
            Alert.alert("Erro", e?.message || "Não foi possível denunciar.");
            resolve(false);
          }
        }
      })),
      { text: "Cancelar", style: "cancel", onPress: () => resolve(false) }
    ]);
  });
}

/** Confirma e apaga o post. Resolve true se apagou. */
export function askDelete(post: FeedPost): Promise<boolean> {
  return new Promise(resolve => {
    Alert.alert("Apagar look?", "Este post será removido para sempre.", [
      { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          try {
            await removePost(post);
            resolve(true);
          } catch (e: any) {
            Alert.alert("Erro", e?.message || "Não foi possível apagar.");
            resolve(false);
          }
        }
      }
    ]);
  });
}

/**
 * Menu do dono do post: editar, fixar no perfil, arquivar, esconder curtidas e apagar.
 * onChanged recebe o post atualizado; onRemoved avisa que ele saiu da lista (arquivado/apagado).
 */
export function openOwnPostMenu(
  post: FeedPost,
  h: { onEdit: () => void; onChanged: (p: FeedPost) => void; onRemoved: (id: string) => void; pinnedCount?: number }
  // onRemoved só é chamado quando o post foi apagado de verdade
) {
  const run = async (flags: { archived?: boolean; pinned?: boolean; hideLikes?: boolean }, msg?: string) => {
    try {
      const updated = await setPostFlags(post, flags);
      // arquivado continua na lista com archived: true (as telas escondem); nunca é apagado
      h.onChanged(updated);
      if (msg) toast(msg, flags.archived ? "📦" : "✓");
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Não foi possível alterar o post.");
    }
  };
  Alert.alert("Seu look", undefined, [
    { text: "Editar post", onPress: h.onEdit },
    {
      text: post.pinned ? "Desafixar do perfil" : "Fixar no perfil",
      onPress: () => {
        if (!post.pinned && (h.pinnedCount || 0) >= 3) {
          Alert.alert("Limite de 3", "Você pode fixar até 3 looks. Desafixe um antes.");
          return;
        }
        run({ pinned: !post.pinned });
      }
    },
    { text: post.hideLikes ? "Mostrar curtidas" : "Esconder curtidas", onPress: () => run({ hideLikes: !post.hideLikes }) },
    post.archived
      ? { text: "Mostrar no perfil de novo", onPress: () => run({ archived: false }, "Look de volta ao seu perfil") }
      : {
          text: "Arquivar",
          onPress: () => run({ archived: true }, "Arquivado: está em Configurações › Arquivados")
        },
    {
      text: "Apagar",
      style: "destructive",
      onPress: async () => {
        if (await askDelete(post)) h.onRemoved(post.id);
      }
    },
    { text: "Cancelar", style: "cancel" }
  ]);
}

/** Editor completo do post: legenda, cidade, país, estilo e peças marcadas */
export function EditPostModal({
  post,
  onClose,
  onSaved
}: {
  post: FeedPost | null;
  onClose: () => void;
  onSaved: (updated: FeedPost) => void;
}) {
  const { colors } = useAppTheme();
  const [caption, setCaption] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [style, setStyle] = useState("");
  const [tags, setTags] = useState<ClothingTag[]>([]);
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!post) return;
    setCaption(post.caption || "");
    setCity(post.city || "");
    setCountry(post.country || "");
    setStyle(post.styleTag || "");
    setTags(post.clothingTags || []);
    getSavedAuthSession()
      .then(se => loadSavedWardrobe(se?.user?.email || se?.user?.id))
      .then(setWardrobe)
      .catch(() => {});
  }, [post?.id]);

  const toggle = (it: WardrobeItem) => {
    const id = `tag-${it.id}`;
    setTags(prev =>
      prev.some(t => t.id === id)
        ? prev.filter(t => t.id !== id)
        : [...prev, { id, name: it.name, brand: it.category, image: it.image, link: it.link, color: it.colorTag, x: prev.length % 2 ? 70 : 24, y: Math.min(85, 22 + Math.floor(prev.length / 2) * 18) }]
    );
  };

  const save = async () => {
    if (!post || saving) return;
    setSaving(true);
    try {
      const updated = await updatePost(post, {
        caption: caption.trim(),
        city: city.trim(),
        country: country.trim(),
        styleTag: style.trim() || post.styleTag,
        clothingTags: tags
      });
      onSaved(updated);
      onClose();
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  // peças marcadas que não estão mais no guarda-roupa continuam aparecendo
  const extra = tags.filter(t => !wardrobe.some(w => `tag-${w.id}` === t.id));

  return (
    <Modal visible={!!post} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.back} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[s.card, { backgroundColor: colors.bg }]}>
          <Text style={[s.title, { color: colors.text }]}>Editar post</Text>
          <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10 }}>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={2200}
              placeholder="Legenda, #hashtags e @menções"
              placeholderTextColor={colors.muted}
              style={[s.input, { color: colors.text, backgroundColor: colors.surface }]}
            />
            <View style={s.row}>
              <TextInput value={city} onChangeText={setCity} placeholder="Cidade" placeholderTextColor={colors.muted} style={[s.field, { color: colors.text, backgroundColor: colors.surface }]} />
              <TextInput value={country} onChangeText={setCountry} placeholder="País" placeholderTextColor={colors.muted} style={[s.field, { color: colors.text, backgroundColor: colors.surface }]} />
            </View>
            <TextInput value={style} onChangeText={setStyle} placeholder="Estilo (ex.: Streetwear)" placeholderTextColor={colors.muted} style={[s.field, { color: colors.text, backgroundColor: colors.surface, flex: 0 }]} />
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 }}>PEÇAS MARCADAS</Text>
            <View style={s.chips}>
              {extra.map(t => (
                <Pressable key={t.id} onPress={() => setTags(prev => prev.filter(x => x.id !== t.id))} style={[s.chip, { backgroundColor: colors.text, borderColor: colors.border }]}>
                  <Text style={{ color: colors.bg, fontSize: 12, fontWeight: "700" }}>{t.name} ✕</Text>
                </Pressable>
              ))}
              {wardrobe.map(it => {
                const on = tags.some(t => t.id === `tag-${it.id}`);
                return (
                  <Pressable key={it.id} onPress={() => toggle(it)} style={[s.chip, { backgroundColor: on ? colors.text : colors.surface, borderColor: colors.border }]}>
                    <Text style={{ color: on ? colors.bg : colors.text, fontSize: 12, fontWeight: "700" }}>
                      {on ? "✓ " : ""}{it.name}
                    </Text>
                  </Pressable>
                );
              })}
              {wardrobe.length === 0 && extra.length === 0 ? (
                <Text style={{ color: colors.muted, fontSize: 12 }}>Seu guarda-roupa está vazio.</Text>
              ) : null}
            </View>
          </ScrollView>
          <View style={s.row}>
            <Pressable onPress={onClose} style={[s.btn, { backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={save} disabled={saving} style={[s.btn, { backgroundColor: colors.text }]}>
              {saving ? <ActivityIndicator color={colors.bg} /> : <Text style={{ color: colors.bg, fontWeight: "800" }}>Salvar</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  back: { flex: 1, backgroundColor: "rgba(0,0,0,.35)", justifyContent: "center", padding: 24 },
  card: { borderRadius: 22, padding: 20, gap: 14 },
  title: { fontSize: 16, fontWeight: "900" },
  input: { minHeight: 110, borderRadius: 14, padding: 14, fontSize: 14, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  field: { flex: 1, height: 44, borderRadius: 12, paddingHorizontal: 12, fontSize: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 }
});
