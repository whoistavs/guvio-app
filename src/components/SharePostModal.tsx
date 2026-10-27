import React, { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Check, Search, Send, X } from "lucide-react-native";
import { FeedPost, MOCK_DIRECTS, DirectThread } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { FastImage } from "./FastImage";
import { saveDirectMessages, loadDirectMessages } from "../services/storage";

export function SharePostModal({
  visible,
  post,
  onClose
}: {
  visible: boolean;
  post: FeedPost | null;
  onClose: () => void;
}) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sentMap, setSentMap] = useState<Record<string, boolean>>({});

  if (!visible || !post) return null;

  const filteredThreads = MOCK_DIRECTS.filter(d =>
    d.username.toLowerCase().includes(query.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const handleSendToSelected = async () => {
    if (selectedIds.length === 0) return;

    for (const threadId of selectedIds) {
      const current = await loadDirectMessages(threadId);
      const postShareMsg = `📷 Compartilhou um look de @${post.creatorName} (${post.styleTag} em ${post.city})`;
      const updated = [...current, postShareMsg];
      await saveDirectMessages(threadId, updated);
    }

    Alert.alert("Enviado com sucesso!", `Look compartilhado via Direct com ${selectedIds.length} amigo(s).`);
    setSelectedIds([]);
    onClose();
  };

  const handleQuickSend = async (thread: DirectThread) => {
    const current = await loadDirectMessages(thread.id);
    const postShareMsg = `📷 Compartilhou um look de @${post.creatorName} (${post.styleTag} em ${post.city})`;
    const updated = [...current, postShareMsg];
    await saveDirectMessages(thread.id, updated);

    setSentMap(prev => ({ ...prev, [thread.id]: true }));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
          {/* Header */}
          <View style={s.header}>
            <View style={s.dragHandle} />
            <View style={s.titleRow}>
              <Text style={[s.title, { color: colors.text }]}>Compartilhar Look</Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <X size={22} color={colors.icon} />
              </Pressable>
            </View>
          </View>

          {/* Post Mini Card */}
          <View style={[s.postPreview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <FastImage source={post.image} style={s.postThumb} contentFit="cover" />
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text style={[s.postAuthor, { color: colors.text }]}>@{post.creatorName}</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {post.city}, {post.country} · {post.styleTag}
              </Text>
            </View>
          </View>

          {/* Search bar */}
          <View style={[s.searchBar, { backgroundColor: colors.surface }]}>
            <Search size={16} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Pesquisar contatos..."
              placeholderTextColor={colors.muted}
              style={[s.searchInput, { color: colors.text }]}
            />
          </View>

          {/* Friends list */}
          <ScrollView style={s.friendsList} showsVerticalScrollIndicator={false}>
            {filteredThreads.map(thread => {
              const isSent = sentMap[thread.id];
              return (
                <View key={thread.id} style={s.threadRow}>
                  <FastImage source={thread.avatar} style={s.avatar} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.username, { color: colors.text }]}>@{thread.username}</Text>
                  </View>
                  <Pressable
                    onPress={() => handleQuickSend(thread)}
                    disabled={isSent}
                    style={[
                      s.sendButton,
                      {
                        backgroundColor: isSent ? colors.surface : "#0095F6"
                      }
                    ]}
                  >
                    {isSent ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Check size={14} color={colors.muted} />
                        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Enviado</Text>
                      </View>
                    ) : (
                      <Text style={s.sendButtonText}>Enviar</Text>
                    )}
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "75%",
    paddingBottom: 34,
    borderTopWidth: 1
  },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, alignItems: "center" },
  dragHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(150,150,150,0.4)", marginBottom: 12 },
  titleRow: { width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 16, fontWeight: "900" },
  postPreview: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 8,
    borderRadius: 14,
    borderWidth: 1
  },
  postThumb: { width: 44, height: 44, borderRadius: 8 },
  postAuthor: { fontSize: 13, fontWeight: "800" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 12,
    marginBottom: 12
  },
  searchInput: { flex: 1, fontSize: 13 },
  friendsList: { paddingHorizontal: 20, maxHeight: 280 },
  threadRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  username: { fontSize: 14, fontWeight: "700" },
  sendButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  sendButtonText: { color: "#FFF", fontSize: 12, fontWeight: "800" }
});
