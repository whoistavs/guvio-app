import React, { useState, useEffect } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MessageCircle, Search, Send } from "lucide-react-native";
import { MOCK_DIRECTS, DirectThread } from "../data/mockData";
import { ScreenHeader } from "./ScreenHeader";
import { useAppTheme } from "../context/AppTheme";
import { loadDirectMessages, saveDirectMessages } from "../services/storage";

export function DirectView({ onBack }: { onBack: () => void }) {
  const { colors } = useAppTheme();
  const [threads, setThreads] = useState<DirectThread[]>(MOCK_DIRECTS);
  const [open, setOpen] = useState<DirectThread | null>(null);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      loadDirectMessages(open.id).then(setMessages);
    }
  }, [open]);

  const handleSend = () => {
    if (!open || !msg.trim()) return;
    const updated = [...messages, msg.trim()];
    setMessages(updated);
    saveDirectMessages(open.id, updated);
    setMsg("");
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
          {open.lastMessage ? (
            <View style={[s.bubbleOther, { backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.text }}>{open.lastMessage}</Text>
            </View>
          ) : null}
          {messages.map((m, i) => (
            <View key={i} style={[s.bubbleMe, { backgroundColor: colors.text }]}>
              <Text style={{ color: colors.bg }}>{m}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={[s.composer, { borderTopColor: colors.border, backgroundColor: colors.bg }]}>
          <TextInput
            value={msg}
            onChangeText={setMsg}
            placeholder="Mensagem..."
            placeholderTextColor={colors.muted}
            style={[s.input, { backgroundColor: colors.surface, color: colors.text }]}
          />
          <Pressable onPress={handleSend}>
            <Send color={colors.icon} />
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
  chat: { padding: 16, gap: 10, paddingBottom: 90 },
  bubbleOther: { alignSelf: "flex-start", maxWidth: "78%", padding: 12, borderRadius: 18 },
  bubbleMe: { alignSelf: "flex-end", maxWidth: "78%", padding: 12, borderRadius: 18 },
  composer: { position: "absolute", bottom: 76, left: 0, right: 0, borderTopWidth: 1, padding: 10, flexDirection: "row", gap: 10, alignItems: "center" },
  input: { height: 42, borderRadius: 22, flex: 1, paddingHorizontal: 15 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 36, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "800", marginTop: 6 }
});
