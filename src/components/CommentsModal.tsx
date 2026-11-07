import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { Send, Trash2, X } from "lucide-react-native";
import { CommentItem, FeedPost } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { FastImage } from "./FastImage";
import { addComment, deleteComment, loadComments } from "../services/storage";

export function CommentsModal({
  post,
  visible,
  onClose,
  onCommented
}: {
  post: FeedPost | null;
  visible: boolean;
  onClose: () => void;
  onCommented?: (postId: string, total: number) => void;
}) {
  const { colors } = useAppTheme();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible || !post) return;
    setLoading(true);
    loadComments(post.id)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [visible, post?.id]);

  const send = async () => {
    if (!post || !text.trim() || sending) return;
    setSending(true);
    try {
      const list = await addComment(post.id, text.trim());
      setComments(list);
      setText("");
      onCommented?.(post.id, list.length);
    } catch (e: any) {
      Alert.alert("Comentário não enviado", e?.message || "Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  const remove = (c: CommentItem) => {
    if (!post) return;
    Alert.alert("Apagar comentário?", c.text, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          try {
            const list = await deleteComment(post.id, c.id);
            setComments(list);
            onCommented?.(post.id, list.length);
          } catch (e: any) {
            Alert.alert("Erro", e?.message || "Não foi possível apagar.");
          }
        }
      }
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.back} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={s.dismiss} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: colors.bg }]}>
          <View style={s.head}>
            <Text style={[s.title, { color: colors.text }]}>Comentários</Text>
            <Pressable onPress={onClose}>
              <X size={23} color={colors.icon} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 90 }}>
            {loading ? (
              <ActivityIndicator color={colors.muted} style={{ marginTop: 30 }} />
            ) : comments.length === 0 ? (
              <Text style={{ color: colors.muted, textAlign: "center", marginTop: 30 }}>
                Seja o primeiro a comentar este look.
              </Text>
            ) : (
              comments.map(c => (
                <Pressable key={c.id} style={s.comment} onLongPress={c.canDelete ? () => remove(c) : undefined}>
                  <FastImage source={c.avatar} style={s.avatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.user, { color: colors.text }]}>
                      @{c.username} <Text style={[s.body, { color: colors.text }]}>{c.text}</Text>
                    </Text>
                    <Text style={[s.meta, { color: colors.muted }]}>{c.createdAt}</Text>
                  </View>
                  {c.canDelete ? (
                    <Pressable onPress={() => remove(c)} hitSlop={10}>
                      <Trash2 size={15} color={colors.muted} />
                    </Pressable>
                  ) : null}
                </Pressable>
              ))
            )}
          </ScrollView>
          <View style={[s.composer, { borderTopColor: colors.border, backgroundColor: colors.bg }]}>
            <TextInput
              value={text}
              onChangeText={setText}
              onSubmitEditing={send}
              placeholder="Adicione um comentário..."
              placeholderTextColor={colors.muted}
              style={[s.input, { backgroundColor: colors.surface, color: colors.text }]}
            />
            <Pressable onPress={send} disabled={sending}>
              {sending ? <ActivityIndicator color={colors.icon} /> : <Send size={22} color={colors.icon} />}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  back: { flex: 1, backgroundColor: "rgba(0,0,0,.26)", justifyContent: "flex-end" },
  dismiss: { flex: 1 },
  sheet: { height: "72%", borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden" },
  head: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18 },
  title: { fontSize: 16, fontWeight: "800" },
  comment: { flexDirection: "row", gap: 10, marginBottom: 18, alignItems: "flex-start" },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  user: { fontSize: 12, fontWeight: "800" },
  body: { fontWeight: "400", lineHeight: 18 },
  meta: { fontSize: 10, marginTop: 5 },
  composer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  input: { flex: 1, height: 42, borderRadius: 22, paddingHorizontal: 15, fontSize: 13 }
});
