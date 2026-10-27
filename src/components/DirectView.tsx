import React, { useState, useEffect } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Image as ImageIcon, MessageCircle, Search, Send, Heart } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { MOCK_DIRECTS, DirectThread } from "../data/mockData";
import { ScreenHeader } from "./ScreenHeader";
import { useAppTheme } from "../context/AppTheme";
import { loadDirectMessages, saveDirectMessages } from "../services/storage";

interface ChatMessage {
  id: string;
  text?: string;
  image?: string;
  reaction?: string;
  sender: "me" | "other";
}

export function DirectView({ onBack }: { onBack: () => void }) {
  const { colors } = useAppTheme();
  const [threads, setThreads] = useState<DirectThread[]>(MOCK_DIRECTS);
  const [open, setOpen] = useState<DirectThread | null>(null);
  const [query, setQuery] = useState("");
  const [msgText, setMsgText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (open) {
      loadDirectMessages(open.id).then(loaded => {
        if (loaded.length === 0) {
          const initial: ChatMessage[] = open.lastMessage
            ? [{ id: "init-1", text: open.lastMessage, sender: "other" }]
            : [];
          setMessages(initial);
        } else {
          // Converter mensagens string para ChatMessage se necessário
          const parsed: ChatMessage[] = loaded.map((item: any, idx: number) => {
            if (typeof item === "string") {
              return { id: `m-${idx}`, text: item, sender: "me" };
            }
            return item;
          });
          setMessages(parsed);
        }
      });
    }
  }, [open]);

  const handleSendText = () => {
    if (!open || !msgText.trim()) return;
    const newMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      text: msgText.trim(),
      sender: "me",
    };
    const updated = [...messages, newMsg];
    setMessages(updated);
    saveDirectMessages(open.id, updated as any);
    setMsgText("");
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
        const newMsg: ChatMessage = {
          id: `m-img-${Date.now()}`,
          image: res.assets[0].uri,
          sender: "me",
        };
        const updated = [...messages, newMsg];
        setMessages(updated);
        saveDirectMessages(open.id, updated as any);
      }
    } catch (e) {}
  };

  const handleToggleReaction = (id: string, emoji: string) => {
    if (!open) return;
    const updated = messages.map(m => {
      if (m.id === id) {
        return { ...m, reaction: m.reaction === emoji ? undefined : emoji };
      }
      return m;
    });
    setMessages(updated);
    saveDirectMessages(open.id, updated as any);
  };

  const filteredThreads = threads.filter(d => 
    d.username.toLowerCase().includes(query.toLowerCase()) || 
    d.lastMessage.toLowerCase().includes(query.toLowerCase())
  );

  if (open) {
    return (
      <View style={[s.full, { backgroundColor: colors.bg }]}>
        <ScreenHeader title={`@${open.username}`} onBack={() => setOpen(null)} />
        <ScrollView contentContainerStyle={s.chat}>
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
      </View>
    );
  }

  return (
    <View style={[s.full, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Direct" onBack={onBack} />
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
              <Image source={{ uri: d.avatar }} style={s.avatar} />
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
  chat: { padding: 16, gap: 14, paddingBottom: 90 },
  bubbleMeWrapper: { alignSelf: "flex-end", maxWidth: "82%", position: "relative" },
  bubbleOtherWrapper: { alignSelf: "flex-start", maxWidth: "82%", position: "relative" },
  bubbleOther: { padding: 12, borderRadius: 18, borderBottomLeftRadius: 4 },
  bubbleMe: { padding: 12, borderRadius: 18, borderBottomRightRadius: 4 },
  chatImage: { width: 210, height: 210, borderRadius: 12, marginBottom: 6 },
  reactionBar: { flexDirection: "row", gap: 6, marginTop: 6, opacity: 0.8 },
  reactionBtn: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, backgroundColor: "rgba(0,0,0,0.06)" },
  reactionBtnActive: { backgroundColor: "rgba(0,122,255,0.25)" },
  activeBadge: { position: "absolute", bottom: -8, right: 6, backgroundColor: "#FFF", borderRadius: 10, paddingHorizontal: 4, paddingVertical: 2, borderWidth: 1, borderColor: "#DDD" },
  composer: { position: "absolute", bottom: 76, left: 0, right: 0, borderTopWidth: 1, padding: 10, flexDirection: "row", gap: 10, alignItems: "center" },
  iconBtn: { padding: 4 },
  input: { height: 42, borderRadius: 22, flex: 1, paddingHorizontal: 15, fontSize: 13 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 36, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "800", marginTop: 6 }
});

