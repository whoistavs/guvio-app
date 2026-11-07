import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { Heart, Send, Trash2, X } from "lucide-react-native";
import { CommentItem, FeedPost } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { ListSkeleton } from "./SkeletonLoader";
import { FastImage } from "./FastImage";
import { addComment, deleteComment, loadComments, setCommentLike, setPinnedComment } from "../services/storage";
import { RichCaption } from "./RichCaption";
import { PopOnActive, toast } from "./motion";
import { likeFeedback, tapFeedback } from "../utils/haptics";

export function CommentsModal({
  post,
  visible,
  onClose,
  onCommented,
  onOpenProfile,
  onOpenTag,
  isOwner,
  onPostChange
}: {
  /** dono do post pode fixar um comentário no topo */
  isOwner?: boolean;
  onPostChange?: (p: FeedPost) => void;
  post: FeedPost | null;
  visible: boolean;
  onClose: () => void;
  onCommented?: (postId: string, total: number) => void;
  onOpenProfile?: (username: string) => void;
  onOpenTag?: (tag: string) => void;
}) {
  const { colors } = useAppTheme();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(post?.pinnedCommentId || null);
  useEffect(() => setPinnedId(post?.pinnedCommentId || null), [post?.id, post?.pinnedCommentId]);

  const togglePin = async (c: CommentItem) => {
    if (!post) return;
    const next = pinnedId === c.id ? null : c.id;
    setPinnedId(next);
    try {
      const updated = await setPinnedComment(post, next);
      onPostChange?.(updated);
      if (next) toast("Comentário fixado no topo", "📌");
    } catch {
      setPinnedId(pinnedId);
    }
  };
  const [openThreads, setOpenThreads] = useState<Set<string>>(new Set());
  const input = useRef<TextInput>(null);

  // comentários principais + respostas agrupadas embaixo de cada um
  const { roots, repliesOf } = useMemo(() => {
    const ids = new Set(comments.map(c => c.id));
    const roots = comments.filter(c => !c.parentId || !ids.has(c.parentId));
    const repliesOf = new Map<string, CommentItem[]>();
    comments.forEach(c => {
      if (c.parentId && ids.has(c.parentId)) {
        // resposta de resposta fica no mesmo fio do comentário principal
        let root = c.parentId;
        let guard = 0;
        while (guard++ < 10) {
          const parent = comments.find(x => x.id === root);
          if (!parent?.parentId || !ids.has(parent.parentId)) break;
          root = parent.parentId;
        }
        repliesOf.set(root, [...(repliesOf.get(root) || []), c]);
      }
    });
    // comentário fixado vem primeiro
    const pinned = pinnedId ? roots.find(c => c.id === pinnedId) : undefined;
    const ordered = pinned ? [pinned, ...roots.filter(c => c !== pinned)] : roots;
    return { roots: ordered, repliesOf };
  }, [comments, pinnedId]);

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
      const list = await addComment(post.id, text.trim(), replyTo?.id);
      setComments(list);
      setText("");
      if (replyTo) {
        const root = list.find(c => c.id === replyTo.id)?.parentId || replyTo.id;
        setOpenThreads(prev => new Set(prev).add(root).add(replyTo.id));
      }
      setReplyTo(null);
      onCommented?.(post.id, list.length);
    } catch (e: any) {
      Alert.alert("Comentário não enviado", e?.message || "Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  const startReply = (c: CommentItem) => {
    tapFeedback();
    setReplyTo(c);
    setText(`@${c.username} `);
    setTimeout(() => input.current?.focus(), 50);
  };

  const toggleLike = async (c: CommentItem) => {
    const on = !c.isLiked;
    if (on) likeFeedback();
    setComments(prev => prev.map(x => (x.id === c.id ? { ...x, isLiked: on, likes: Math.max(0, x.likes + (on ? 1 : -1)) } : x)));
    try {
      await setCommentLike(c, on);
    } catch {
      setComments(prev => prev.map(x => (x.id === c.id ? c : x)));
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

  const renderComment = (c: CommentItem, isReply: boolean) => (
    <Pressable
      style={[s.comment, isReply && s.reply]}
      onLongPress={c.canDelete ? () => remove(c) : undefined}
    >
      <Pressable onPress={() => onOpenProfile?.(c.username)}>
        <FastImage source={c.avatar} style={isReply ? s.avatarSmall : s.avatar} />
      </Pressable>
      <View style={{ flex: 1 }}>
        {!isReply && pinnedId === c.id ? (
          <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", marginBottom: 2 }}>📌 Fixado pelo autor</Text>
        ) : null}
        <RichCaption
          text={c.text}
          style={[s.body, { color: colors.text }]}
          prefix={
            <Text style={[s.user, { color: colors.text }]} onPress={() => onOpenProfile?.(c.username)}>
              @{c.username}{" "}
            </Text>
          }
          onMention={u => onOpenProfile?.(u)}
          onTag={onOpenTag}
        />
        <View style={s.metaRow}>
          <Text style={[s.meta, { color: colors.muted }]}>{c.createdAt}</Text>
          {c.likes > 0 ? (
            <Text style={[s.meta, { color: colors.muted, fontWeight: "800" }]}>
              {c.likes} {c.likes === 1 ? "curtida" : "curtidas"}
            </Text>
          ) : null}
          <Pressable onPress={() => startReply(c)} hitSlop={8}>
            <Text style={[s.meta, { color: colors.muted, fontWeight: "800" }]}>Responder</Text>
          </Pressable>
          {isOwner && !isReply ? (
            <Pressable onPress={() => togglePin(c)} hitSlop={8}>
              <Text style={[s.meta, { color: colors.muted, fontWeight: "800" }]}>{pinnedId === c.id ? "Desafixar" : "Fixar"}</Text>
            </Pressable>
          ) : null}
          {c.canDelete ? (
            <Pressable onPress={() => remove(c)} hitSlop={8}>
              <Trash2 size={12} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <Pressable onPress={() => toggleLike(c)} hitSlop={10} style={{ paddingTop: 4, alignItems: "center" }}>
        <PopOnActive active={!!c.isLiked}>
          <Heart size={14} color={c.isLiked ? "#FF3B30" : colors.muted} fill={c.isLiked ? "#FF3B30" : "transparent"} />
        </PopOnActive>
      </Pressable>
    </Pressable>
  );

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
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: replyTo ? 130 : 90 }} keyboardShouldPersistTaps="handled">
            {loading ? (
              <ListSkeleton rows={5} avatar={36} />
            ) : comments.length === 0 ? (
              <Text style={{ color: colors.muted, textAlign: "center", marginTop: 30 }}>
                Seja o primeiro a comentar este look.
              </Text>
            ) : (
              roots.map(c => {
                const replies = repliesOf.get(c.id) || [];
                const open = openThreads.has(c.id);
                return (
                  <View key={c.id}>
                    {renderComment(c, false)}
                    {replies.length > 0 ? (
                      <Pressable
                        onPress={() =>
                          setOpenThreads(prev => {
                            const n = new Set(prev);
                            n.has(c.id) ? n.delete(c.id) : n.add(c.id);
                            return n;
                          })
                        }
                        style={s.moreReplies}
                      >
                        <View style={[s.line, { backgroundColor: colors.muted }]} />
                        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>
                          {open ? "Ocultar respostas" : `Ver ${replies.length} ${replies.length === 1 ? "resposta" : "respostas"}`}
                        </Text>
                      </Pressable>
                    ) : null}
                    {open ? replies.map(r => <View key={r.id}>{renderComment(r, true)}</View>) : null}
                  </View>
                );
              })
            )}
          </ScrollView>
          <View style={[s.composer, { borderTopColor: colors.border, backgroundColor: colors.bg }]}>
            {replyTo ? (
              <View style={[s.replyBar, { backgroundColor: colors.surface }]}>
                <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }} numberOfLines={1}>
                  Respondendo a @{replyTo.username}
                </Text>
                <Pressable
                  onPress={() => {
                    setReplyTo(null);
                    setText("");
                  }}
                  hitSlop={10}
                >
                  <X size={14} color={colors.muted} />
                </Pressable>
              </View>
            ) : null}
            <View style={s.composerRow}>
            <TextInput
              ref={input}
              value={text}
              onChangeText={setText}
              onSubmitEditing={send}
              placeholder={replyTo ? "Escreva sua resposta..." : "Adicione um comentário... use @ para marcar"}
              placeholderTextColor={colors.muted}
              style={[s.input, { backgroundColor: colors.surface, color: colors.text }]}
            />
            <Pressable onPress={send} disabled={sending}>
              {sending ? <ActivityIndicator color={colors.icon} /> : <Send size={22} color={colors.icon} />}
            </Pressable>
            </View>
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
  comment: { flexDirection: "row", gap: 10, marginBottom: 16, alignItems: "flex-start" },
  reply: { marginLeft: 46, marginBottom: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarSmall: { width: 26, height: 26, borderRadius: 13 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 5 },
  moreReplies: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 46, marginTop: -6, marginBottom: 14 },
  line: { width: 22, height: StyleSheet.hairlineWidth, opacity: 0.8 },
  replyBar: { flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 8 },
  composerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  user: { fontSize: 12, fontWeight: "800" },
  body: { fontWeight: "400", lineHeight: 18 },
  meta: { fontSize: 10 },
  composer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    padding: 10
  },
  input: { flex: 1, height: 42, borderRadius: 22, paddingHorizontal: 15, fontSize: 13 }
});
