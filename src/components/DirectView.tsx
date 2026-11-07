import React, { useState, useEffect, useRef } from "react";
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Image as ImageIcon, MessageCircle, Search, Send, Heart, SquarePen, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { DirectThread, UserProfile } from "../data/mockData";
import { ScreenHeader } from "./ScreenHeader";
import { FastImage } from "./FastImage";
import { useAppTheme } from "../context/AppTheme";
import {
  ChatMessage,
  loadThreads,
  loadChat,
  sendChatMessage,
  setChatReaction,
  markThreadRead,
  threadForProfile,
  loadAllRegisteredProfiles
} from "../services/storage";
import { isCloud } from "../services/supabase";
import { subscribeMessages } from "../services/cloud";

export function DirectView({
  onBack,
  initialThread,
  onOpenProfile
}: {
  onBack: () => void;
  initialThread?: DirectThread | null;
  onOpenProfile?: (username: string) => void;
}) {
  const { colors } = useAppTheme();
  const [threads, setThreads] = useState<DirectThread[]>([]);
  const [open, setOpen] = useState<DirectThread | null>(initialThread || null);
  const [query, setQuery] = useState("");
  const [msgText, setMsgText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [picking, setPicking] = useState(false);
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [peopleQuery, setPeopleQuery] = useState("");

  useEffect(() => {
    if (picking && people.length === 0) loadAllRegisteredProfiles().then(setPeople);
  }, [picking]);

  useEffect(() => {
    if (!open) loadThreads().then(setThreads);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let stop: (() => void) | undefined;
    loadChat(open).then(setMessages).catch(() => setMessages([]));
    markThreadRead(open);
    isCloud().then(cloud => {
      if (!cloud) return;
      stop = subscribeMessages(open.profileId, m => {
        setMessages(prev => (prev.some(x => x.id === m.id) ? prev.map(x => (x.id === m.id ? m : x)) : [...prev, m]));
        if (m.sender === "other") markThreadRead(open);
      });
    });
    return () => stop?.();
  }, [open]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length]);

  const send = async (msg: { text?: string; image?: string }) => {
    if (!open) return;
    setSending(true);
    try {
      setMessages(await sendChatMessage(open, messages, msg));
    } catch (e: any) {
      Alert.alert("Mensagem não enviada", e?.message || "Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  const handleSendText = () => {
    if (!open || !msgText.trim() || sending) return;
    const text = msgText.trim();
    setMsgText("");
    send({ text });
  };

  const handlePickImage = async () => {
    if (!open) return;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") return;
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: true,
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        send({ image: res.assets[0].uri });
      }
    } catch (e) {}
  };

  const handleToggleReaction = async (id: string, emoji: string) => {
    if (!open) return;
    try {
      setMessages(await setChatReaction(open, messages, id, emoji));
    } catch (e) {}
  };

  const filteredThreads = threads.filter(d => 
    d.username.toLowerCase().includes(query.toLowerCase()) || 
    d.lastMessage.toLowerCase().includes(query.toLowerCase())
  );

  if (open) {
    return (
      <KeyboardAvoidingView
        style={[s.full, { backgroundColor: colors.bg }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScreenHeader
          title={`@${open.username}`}
          onBack={() => {
            if (initialThread && open.id === initialThread.id) onBack();
            else setOpen(null);
          }}
          right={
            onOpenProfile ? (
              <Pressable onPress={() => onOpenProfile(open.username)} hitSlop={8}>
                <FastImage source={open.avatar} style={s.headAvatar} />
              </Pressable>
            ) : undefined
          }
        />
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={s.chat}>
          {messages.length === 0 ? (
            <Text style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}>
              Diga oi para @{open.username} 👋
            </Text>
          ) : null}
          {messages.map(m => {
            const isMe = m.sender === "me";
            return (
              <View key={m.id} style={isMe ? s.bubbleMeWrapper : s.bubbleOtherWrapper}>
                <View
                  style={[
                    isMe ? s.bubbleMe : s.bubbleOther,
                    { backgroundColor: isMe ? colors.text : colors.surface },
                  ]}
                >
                  {m.image ? (
                    <Image source={{ uri: m.image }} style={s.chatImage} />
                  ) : null}
                  {m.text ? (
                    <Text style={{ color: isMe ? colors.bg : colors.text, fontSize: 14 }}>
                      {m.text}
                    </Text>
                  ) : null}

                  {/* Reações com Emojis */}
                  <View style={s.reactionBar}>
                    {["❤️", "🔥", "✨"].map(emoji => (
                      <Pressable
                        key={emoji}
                        onPress={() => handleToggleReaction(m.id, emoji)}
                        style={[
                          s.reactionBtn,
                          m.reaction === emoji && s.reactionBtnActive,
                        ]}
                      >
                        <Text style={{ fontSize: 11 }}>{emoji}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                {m.reaction ? (
                  <View style={s.activeBadge}>
                    <Text style={{ fontSize: 12 }}>{m.reaction}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>

        <View style={[s.composer, { borderTopColor: colors.border, backgroundColor: colors.bg }]}>
          <Pressable onPress={handlePickImage} style={s.iconBtn}>
            <ImageIcon color={colors.icon} size={22} />
          </Pressable>
          <TextInput
            value={msgText}
            onChangeText={setMsgText}
            placeholder="Mensagem..."
            placeholderTextColor={colors.muted}
            style={[s.input, { backgroundColor: colors.surface, color: colors.text }]}
          />
          <Pressable onPress={handleSendText}>
            <Send color={colors.icon} size={22} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  const peopleList = people.filter(p =>
    `${p.username} ${p.displayName}`.toLowerCase().includes(peopleQuery.trim().toLowerCase().replace(/^@/, ""))
  );

  return (
    <View style={[s.full, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title="Direct"
        onBack={onBack}
        right={
          <Pressable onPress={() => setPicking(true)} hitSlop={10}>
            <SquarePen size={22} color={colors.icon} />
          </Pressable>
        }
      />
      <Modal visible={picking} animationType="slide" onRequestClose={() => setPicking(false)}>
        <View style={[s.full, { backgroundColor: colors.bg, paddingTop: Platform.OS === "ios" ? 50 : 10 }]}>
          <View style={s.pickHead}>
            <Text style={[s.user, { color: colors.text, fontSize: 17 }]}>Nova mensagem</Text>
            <Pressable onPress={() => setPicking(false)} hitSlop={10}>
              <X size={24} color={colors.icon} />
            </Pressable>
          </View>
          <View style={[s.search, { backgroundColor: colors.surface }]}>
            <Search size={18} color={colors.muted} />
            <TextInput
              value={peopleQuery}
              onChangeText={setPeopleQuery}
              placeholder="Buscar @username"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              style={{ flex: 1, color: colors.text, fontSize: 13 }}
            />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {peopleList.map(p => (
              <Pressable
                key={p.id}
                style={s.thread}
                onPress={() => {
                  setPicking(false);
                  setPeopleQuery("");
                  setOpen(threads.find(t => t.profileId === p.id) || threadForProfile(p));
                }}
              >
                <FastImage source={p.avatar} style={s.avatar} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.user, { color: colors.text }]}>@{p.username}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{p.displayName}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
      <View style={[s.search, { backgroundColor: colors.surface }]}>
        <Search size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Pesquisar conversas..."
          placeholderTextColor={colors.muted}
          style={{ flex: 1, color: colors.text, fontSize: 13 }}
        />
      </View>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {filteredThreads.length === 0 ? (
          <View style={s.empty}>
            <MessageCircle size={42} color={colors.muted} />
            <Text style={[s.emptyTitle, { color: colors.text }]}>Sua caixa de mensagens está limpa</Text>
            <Text style={{ color: colors.muted, textAlign: "center", fontSize: 12, lineHeight: 18 }}>
              Quando você trocar mensagens com outros usuários, suas conversas aparecerão aqui.
            </Text>
          </View>
        ) : (
          filteredThreads.map(d => (
            <Pressable key={d.id} onPress={() => setOpen(d)} style={s.thread}>
              <FastImage source={d.avatar} style={s.avatar} />
              <View style={{ flex: 1 }}>
                <Text style={[s.user, { color: colors.text }]}>@{d.username}</Text>
                <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
                  {d.lastMessage}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <Text style={{ color: colors.muted, fontSize: 10 }}>{d.time}</Text>
                {d.unread ? (
                  <View style={s.unread}>
                    <Text style={s.unreadText}>{d.unread}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  full: { flex: 1, paddingBottom: 90 },
  search: { marginHorizontal: 18, height: 42, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 13, marginBottom: 8 },
  thread: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 11 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  user: { fontSize: 14, fontWeight: "800", marginBottom: 4 },
  unread: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: "#168CFF", alignItems: "center", justifyContent: "center" },
  unreadText: { fontSize: 10, color: "white", fontWeight: "800" },
  chat: { padding: 16, gap: 14, paddingBottom: 20 },
  headAvatar: { width: 28, height: 28, borderRadius: 14 },
  pickHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 18, paddingVertical: 12 },
  bubbleMeWrapper: { alignSelf: "flex-end", maxWidth: "82%", position: "relative" },
  bubbleOtherWrapper: { alignSelf: "flex-start", maxWidth: "82%", position: "relative" },
  bubbleOther: { padding: 12, borderRadius: 18, borderBottomLeftRadius: 4 },
  bubbleMe: { padding: 12, borderRadius: 18, borderBottomRightRadius: 4 },
  chatImage: { width: 210, height: 210, borderRadius: 12, marginBottom: 6 },
  reactionBar: { flexDirection: "row", gap: 6, marginTop: 6, opacity: 0.8 },
  reactionBtn: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.06)" },
  reactionBtnActive: { backgroundColor: "rgba(0,122,255,0.25)" },
  activeBadge: { position: "absolute", bottom: -8, right: 6, backgroundColor: "#FFF", borderRadius: 10, paddingHorizontal: 4, paddingVertical: 2, borderWidth: 1, borderColor: "#DDD" },
  composer: { borderTopWidth: 1, padding: 10, paddingBottom: Platform.OS === "ios" ? 26 : 10, flexDirection: "row", gap: 10, alignItems: "center" },
  iconBtn: { padding: 4 },
  input: { height: 42, borderRadius: 22, flex: 1, paddingHorizontal: 15, fontSize: 13 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 36, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "800", marginTop: 6 }
});

