import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { FeedPost } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { editCaption, removePost, reportPost } from "../services/storage";

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
            Alert.alert("Obrigado pela denúncia", "Vamos analisar. Este post não vai mais aparecer para você.");
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

/** Modal para editar a legenda de um post */
export function EditCaptionModal({
  post,
  onClose,
  onSaved
}: {
  post: FeedPost | null;
  onClose: () => void;
  onSaved: (postId: string, caption: string) => void;
}) {
  const { colors } = useAppTheme();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setText(post?.caption || "");
  }, [post?.id]);

  const save = async () => {
    if (!post || saving) return;
    setSaving(true);
    try {
      await editCaption(post.id, text.trim());
      onSaved(post.id, text.trim());
      onClose();
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Não foi possível salvar a legenda.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={!!post} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.back} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[s.card, { backgroundColor: colors.bg }]}>
          <Text style={[s.title, { color: colors.text }]}>Editar legenda</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2200}
            autoFocus
            placeholder="Escreva uma legenda..."
            placeholderTextColor={colors.muted}
            style={[s.input, { color: colors.text, backgroundColor: colors.surface }]}
          />
          <View style={s.row}>
            <Pressable onPress={onClose} style={[s.btn, { backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={save} disabled={saving} style={[s.btn, { backgroundColor: colors.text }]}>
              {saving ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={{ color: colors.bg, fontWeight: "800" }}>Salvar</Text>
              )}
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
  btn: { flex: 1, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" }
});
