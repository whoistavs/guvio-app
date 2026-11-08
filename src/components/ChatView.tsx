import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { KeyboardSafeView } from "./KeyboardSafeView";
import { ArrowLeft, Camera, CornerUpLeft, Image as ImageIcon, Search, Send, Trash2, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { DirectThread, FeedPost } from "../data/mockData";
import { FastImage } from "./FastImage";
import { ImageZoomModal } from "./ImageZoomModal";
import { useAppTheme } from "../context/AppTheme";
import { Skeleton } from "./SkeletonLoader";
import {
  ChatMessage,
  loadChat,
  sendChatMessage,
  setChatReaction,
  deleteChatMessage,
  markThreadRead,
  loadPost
} from "../services/storage";
import { isCloud } from "../services/supabase";
import { subscribeMessages, subscribeOnline, typingChannel } from "../services/cloud";
import { likeFeedback, tapFeedback } from "../utils/haptics";

const REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👏"];

// cache dos looks compartilhados para não buscar de novo a cada render
const postCache = new Map<string, FeedPost | null>();

function SharedPostCard({
  postId,
  isMe,
  onOpen
}: {
  postId: string;
  isMe: boolean;
  onOpen?: (id: string) => void;
}) {
  const { colors } = useAppTheme();
  const [post, setPost] = useState<FeedPost | null | undefined>(postCache.get(postId));
  useEffect(() => {
    if (postCache.has(postId)) return;
    loadPost(postId).then(p => {
      postCache.set(postId, p);
      setPost(p);
    });
  }, [postId]);

  if (post === undefined) return <Skeleton width={220} height={300} borderRadius={14} />;
  if (!post)
    return (
      <Text style={{ color: isMe ? colors.bg : colors.muted, fontStyle: "italic", fontSize: 13 }}>Este look não está mais disponível</Text>
    );
  return (
    <Pressable onPress={() => onOpen?.(post.id)} style={s.postCard}>
      <View style={s.postHead}>
        <FastImage source={post.creatorAvatar} style={s.postAvatar} />
        <Text style={{ color: isMe ? colors.bg : colors.text, fontWeight: "600", fontSize: 12 }} numberOfLines={1}>
          @{post.creatorUsername || post.creatorName}
        </Text>
      </View>
      <FastImage source={post.image} style={s.postImage} contentFit="cover" />
      {post.caption ? (
        <Text style={{ color: isMe ? colors.bg : colors.text, fontSize: 12, marginTop: 6 }} numberOfLines={2}>
          {post.caption}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function ChatView({
  thread,
  onBack,
  onOpenProfile,
  onOpenPost
}: {
  thread: DirectThread;
  onBack: () => void;
  onOpenProfile?: (username: string) => void;
  onOpenPost?: (postId: string) => void;
}) {
  const { colors } = useAppTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [menuFor, setMenuFor] = useState<ChatMessage | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [typing, setTyping] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const typingRef = useRef<ReturnType<typeof typingChannel> | null>(null);
  const lastTap = useRef<Record<string, number>>({});
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  useEffect(() => {
    let stopMsgs: (() => void) | undefined;
    let stopOnline: (() => void) | undefined;
    setLoading(true);
    loadChat(thread)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
    markThreadRead(thread);
    isCloud().then(cloud => {
      if (!cloud) return;
      stopMsgs = subscribeMessages(thread.profileId, m => {
        setMessages(prev => (prev.some(x => x.id === m.id) ? prev.map(x => (x.id === m.id ? m : x)) : [...prev, m]));
        if (m.sender === "other") {
          setTyping(false);
          markThreadRead(thread);
        }
      });
      stopOnline = subscribeOnline(ids => setOnline(ids.has(thread.profileId)));
      typingRef.current = typingChannel(thread.profileId, setTyping);
    });
    return () => {
      stopMsgs?.();
      stopOnline?.();
      typingRef.current?.ping(false);
      typingRef.current?.stop();
      typingRef.current = null;
    };
  }, [thread.profileId]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  }, [messages.length, typing]);

  const q = query
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  // na busca, mostra só as mensagens com o texto procurado
  const shown =
    searching && q
      ? messages.filter(m =>
          (m.text || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .includes(q)
        )
      : messages;

  const byId = useMemo(() => new Map(messages.map(m => [m.id, m])), [messages]);
  const lastMine = [...messages].reverse().find(m => m.sender === "me" && !m.deleted);

  const send = async (msg: { text?: string; image?: string }) => {
    setSending(true);
    const reply = replyTo;
    setReplyTo(null);
    try {
      setMessages(await sendChatMessage(thread, messagesRef.current, { ...msg, replyTo: reply?.id }));
      typingRef.current?.ping(false);
    } catch (e: any) {
      setReplyTo(reply);
      Alert.alert("Mensagem não enviada", e?.message || "Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  const sendText = () => {
    const t = text.trim();
    if (!t || sending) return;
    setText("");
    send({ text: t });
  };

  const pickImage = async (camera: boolean) => {
    try {
      const perm = camera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permissão necessária", camera ? "Libere a câmera nos Ajustes." : "Libere as fotos nos Ajustes.");
        return;
      }
      const res = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (!res.canceled && res.assets?.[0]?.uri) send({ image: res.assets[0].uri });
    } catch {}
  };

  const react = async (m: ChatMessage, emoji: string) => {
    setMenuFor(null);
    if (emoji === "❤️") likeFeedback();
    else tapFeedback();
    const prev = messagesRef.current;
    setMessages(prev.map(x => (x.id === m.id ? { ...x, reaction: x.reaction === emoji ? undefined : emoji } : x)));
    try {
      await setChatReaction(thread, prev, m.id, emoji);
    } catch {
      setMessages(prev);
    }
  };

  const remove = (m: ChatMessage) => {
    setMenuFor(null);
    Alert.alert("Apagar mensagem?", "Ela será apagada para os dois.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          try {
            setMessages(await deleteChatMessage(thread, messagesRef.current, m.id));
          } catch (e: any) {
            Alert.alert("Erro", e?.message || "Não foi possível apagar.");
          }
        }
      }
    ]);
  };

  const onBubblePress = (m: ChatMessage) => {
    if (m.deleted) return;
    const now = Date.now();
    if (now - (lastTap.current[m.id] || 0) < 300) {
      lastTap.current[m.id] = 0;
      if (m.reaction !== "❤️") react(m, "❤️");
    } else {
      lastTap.current[m.id] = now;
      if (m.image && !m.text) setTimeout(() => lastTap.current[m.id] === now && setZoom(m.image!), 310);
    }
  };

  const preview = (m?: ChatMessage) =>
    !m ? "Mensagem" : m.deleted ? "Mensagem apagada" : m.text || (m.postId ? "Look" : "Foto");

  const status = typing ? "digitando..." : online ? "online agora" : "";

  return (
    <KeyboardSafeView style={[s.full, { backgroundColor: colors.bg }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={onBack} hitSlop={10}>
          <ArrowLeft size={24} color={colors.icon} />
        </Pressable>
        <Pressable style={s.headerWho} onPress={() => onOpenProfile?.(thread.username)}>
          <View>
            <FastImage source={thread.avatar} style={s.headAvatar} />
            {online ? <View style={[s.onlineDot, { borderColor: colors.bg }]} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "600", fontSize: 15 }} numberOfLines={1}>
              @{thread.username}
            </Text>
            {status ? (
              <Text style={{ color: typing ? "#0095F6" : "#22C55E", fontSize: 11, fontWeight: "700" }}>{status}</Text>
            ) : null}
          </View>
        </Pressable>
        <Pressable
          onPress={() => {
            setSearching(v => !v);
            setQuery("");
          }}
          hitSlop={10}
        >
          {searching ? <X size={22} color={colors.icon} /> : <Search size={21} color={colors.icon} />}
        </Pressable>
      </View>
      {searching ? (
        <View style={[s.searchBar, { backgroundColor: colors.surface }]}>
          <Search size={16} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder="Buscar nesta conversa..."
            placeholderTextColor={colors.muted}
            style={{ flex: 1, color: colors.text, fontSize: 14, height: "100%" }}
          />
          {query.trim() ? (
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {shown.length} {shown.length === 1 ? "resultado" : "resultados"}
            </Text>
          ) : null}
        </View>
      ) : null}

      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={s.chat} keyboardShouldPersistTaps="handled">
        {loading ? (
          <View style={{ gap: 10 }}>
            {[150, 210, 120, 180, 90].map((w, i) => (
              <Skeleton key={i} width={w} height={36} borderRadius={18} style={{ alignSelf: i % 2 ? "flex-end" : "flex-start" }} />
            ))}
          </View>
        ) : null}
        {!loading && messages.length === 0 ? (
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}>Diga oi para @{thread.username}</Text>
        ) : null}
        {shown.map(m => {
          const isMe = m.sender === "me";
          const quoted = m.replyTo ? byId.get(m.replyTo) : undefined;
          const fg = isMe ? colors.bg : colors.text;
          return (
            <View key={m.id} style={[isMe ? s.meWrap : s.otherWrap, m.reaction ? { marginBottom: 10 } : null]}>
              {/* a reação fica presa ao balão (não à linha do "Visto") */}
              <View style={{ position: "relative", maxWidth: "100%", alignItems: isMe ? "flex-end" : "flex-start" }}>
              <Pressable
                onPress={() => onBubblePress(m)}
                onLongPress={() => {
                  if (m.deleted) return;
                  tapFeedback();
                  setMenuFor(m);
                }}
                delayLongPress={300}
                style={[
                  s.bubble,
                  isMe ? s.bubbleMe : s.bubbleOther,
                  { backgroundColor: m.deleted ? "transparent" : isMe ? colors.text : colors.surface },
                  m.deleted && { borderWidth: 1, borderColor: colors.border },
                  (m.image || m.postId) && !m.deleted ? { padding: 6 } : null
                ]}
              >
                {m.replyTo && !m.deleted ? (
                  <View style={[s.quote, { borderLeftColor: isMe ? colors.bg : colors.muted }]}>
                    <Text style={{ color: fg, opacity: 0.7, fontSize: 11, fontWeight: "600" }}>
                      {quoted?.sender === "me" ? "Você" : `@${thread.username}`}
                    </Text>
                    <Text style={{ color: fg, opacity: 0.7, fontSize: 12 }} numberOfLines={2}>
                      {preview(quoted)}
                    </Text>
                  </View>
                ) : null}
                {m.deleted ? (
                  <Text style={{ color: colors.muted, fontStyle: "italic", fontSize: 13 }}>Mensagem apagada</Text>
                ) : (
                  <>
                    {m.postId ? <SharedPostCard postId={m.postId} isMe={isMe} onOpen={onOpenPost} /> : null}
                    {m.image ? <FastImage source={m.image} style={s.chatImage} contentFit="cover" /> : null}
                    {m.text ? (
                      <Text style={{ color: fg, fontSize: 14, lineHeight: 19, paddingHorizontal: m.image || m.postId ? 6 : 0, paddingTop: m.image || m.postId ? 6 : 0 }}>
                        {m.text}
                      </Text>
                    ) : null}
                  </>
                )}
              </Pressable>
              {m.reaction ? (
                <View style={[s.badge, isMe ? { right: 8 } : { left: 8 }, { backgroundColor: colors.surface, borderColor: colors.bg }]}>
                  <Text style={{ fontSize: 12 }}>{m.reaction}</Text>
                </View>
              ) : null}
              </View>
              {lastMine && m.id === lastMine.id && m.readAt ? (
                <Text style={[s.seen, { color: colors.muted }, m.reaction ? { marginTop: 14 } : null]}>Visto</Text>
              ) : null}
            </View>
          );
        })}
        {typing ? (
          <View style={[s.otherWrap]}>
            <View style={[s.bubble, s.bubbleOther, { backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.muted, fontSize: 18, letterSpacing: 2 }}>•••</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={[s.composer, { borderTopColor: colors.border, backgroundColor: colors.bg }]}>
        {replyTo ? (
          <View style={[s.replyBar, { backgroundColor: colors.surface }]}>
            <CornerUpLeft size={14} color={colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 11, fontWeight: "600" }}>
                Respondendo {replyTo.sender === "me" ? "a você" : `@${thread.username}`}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
                {preview(replyTo)}
              </Text>
            </View>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={10}>
              <X size={16} color={colors.muted} />
            </Pressable>
          </View>
        ) : null}
        <View style={s.composerRow}>
          <Pressable onPress={() => pickImage(true)} style={s.iconBtn} hitSlop={6}>
            <Camera color={colors.icon} size={22} />
          </Pressable>
          <Pressable onPress={() => pickImage(false)} style={s.iconBtn} hitSlop={6}>
            <ImageIcon color={colors.icon} size={22} />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={v => {
              setText(v);
              if (v) typingRef.current?.ping(true);
            }}
            onBlur={() => typingRef.current?.ping(false)}
            onSubmitEditing={sendText}
            placeholder="Mensagem..."
            placeholderTextColor={colors.muted}
            style={[s.input, { backgroundColor: colors.surface, color: colors.text }]}
          />
          <Pressable onPress={sendText} disabled={sending} hitSlop={6}>
            {sending ? <ActivityIndicator color={colors.icon} /> : <Send color={text.trim() ? "#0095F6" : colors.icon} size={22} />}
          </Pressable>
        </View>
      </View>

      <Modal visible={!!menuFor} transparent animationType="fade" onRequestClose={() => setMenuFor(null)}>
        <Pressable style={s.menuBack} onPress={() => setMenuFor(null)}>
          <View style={[s.menu, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <View style={s.emojiRow}>
              {REACTIONS.map(e => (
                <Pressable
                  key={e}
                  onPress={() => menuFor && react(menuFor, e)}
                  style={[s.emoji, menuFor?.reaction === e && { backgroundColor: colors.surface }]}
                >
                  <Text style={{ fontSize: 26 }}>{e}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={[s.menuItem, { borderTopColor: colors.border }]}
              onPress={() => {
                setReplyTo(menuFor);
                setMenuFor(null);
              }}
            >
              <CornerUpLeft size={18} color={colors.icon} />
              <Text style={{ color: colors.text, fontWeight: "700" }}>Responder</Text>
            </Pressable>
            {menuFor?.sender === "me" ? (
              <Pressable style={[s.menuItem, { borderTopColor: colors.border }]} onPress={() => menuFor && remove(menuFor)}>
                <Trash2 size={18} color="#FF3B30" />
                <Text style={{ color: "#FF3B30", fontWeight: "700" }}>Apagar para todos</Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </Modal>

      <ImageZoomModal images={zoom ? [zoom] : null} index={0} onClose={() => setZoom(null)} />
    </KeyboardSafeView>
  );
}

const s = StyleSheet.create({
  full: { flex: 1 },
  header: { height: 60, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  headerWho: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headAvatar: { width: 36, height: 36, borderRadius: 18 },
  onlineDot: { position: "absolute", right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, backgroundColor: "#22C55E", borderWidth: 2 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 14, marginTop: 8, height: 40, borderRadius: 12, paddingHorizontal: 12 },
  chat: { padding: 14, gap: 8, paddingBottom: 18 },
  meWrap: { alignSelf: "flex-end", maxWidth: "80%", alignItems: "flex-end" },
  otherWrap: { alignSelf: "flex-start", maxWidth: "80%", alignItems: "flex-start" },
  bubble: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 20 },
  bubbleMe: { borderBottomRightRadius: 6 },
  bubbleOther: { borderBottomLeftRadius: 6 },
  quote: { borderLeftWidth: 3, paddingLeft: 8, marginBottom: 6, paddingVertical: 2 },
  chatImage: { width: 220, height: 260, borderRadius: 16 },
  postCard: { width: 220 },
  postHead: { flexDirection: "row", alignItems: "center", gap: 6, padding: 6 },
  postAvatar: { width: 20, height: 20, borderRadius: 10 },
  postImage: { width: 220, height: 260, borderRadius: 14 },
  badge: { position: "absolute", bottom: -10, borderRadius: 12, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 2 },
  seen: { fontSize: 10, marginTop: 3, marginRight: 4 },
  composer: { borderTopWidth: 1, padding: 10, paddingBottom: Platform.OS === "ios" ? 26 : 10 },
  composerRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  replyBar: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 8, marginBottom: 8 },
  iconBtn: { padding: 3 },
  input: { height: 42, borderRadius: 22, flex: 1, paddingHorizontal: 15, fontSize: 14 },
  menuBack: { flex: 1, backgroundColor: "rgba(0,0,0,.45)", alignItems: "center", justifyContent: "center", padding: 24 },
  menu: { width: "100%", maxWidth: 360, borderRadius: 22, borderWidth: 1, overflow: "hidden" },
  emojiRow: { flexDirection: "row", justifyContent: "space-around", padding: 10 },
  emoji: { padding: 6, borderRadius: 14 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 15, borderTopWidth: StyleSheet.hairlineWidth }
});
