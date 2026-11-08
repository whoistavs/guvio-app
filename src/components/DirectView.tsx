import React, { useState, useEffect } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { topPad } from "../utils/insets";
import { MessageCircle, Search, SquarePen, X } from "lucide-react-native";
import { ChatView } from "./ChatView";
import { DirectThread, UserProfile } from "../data/mockData";
import { ScreenHeader } from "./ScreenHeader";
import { FastImage } from "./FastImage";
import { useAppTheme } from "../context/AppTheme";
import { loadThreads, threadForProfile, loadAllRegisteredProfiles, setThreadPinned, clearThread } from "../services/storage";
import { isCloud } from "../services/supabase";
import { subscribeOnline } from "../services/cloud";

export function DirectView({
  onBack,
  initialThread,
  onOpenProfile,
  onOpenPost
}: {
  onBack: () => void;
  initialThread?: DirectThread | null;
  onOpenProfile?: (username: string) => void;
  onOpenPost?: (postId: string) => void;
}) {
  const { colors } = useAppTheme();
  const [threads, setThreads] = useState<DirectThread[]>([]);
  const [open, setOpen] = useState<DirectThread | null>(initialThread || null);
  const [query, setQuery] = useState("");
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
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
    let stop: (() => void) | undefined;
    isCloud().then(cloud => {
      if (cloud) stop = subscribeOnline(setOnlineIds);
    });
    return () => stop?.();
  }, []);

  const reloadThreads = () => loadThreads().then(setThreads);

  const threadMenu = (d: DirectThread) =>
    Alert.alert(`@${d.username}`, undefined, [
      {
        text: d.pinned ? "Desafixar conversa" : "Fixar no topo",
        onPress: async () => {
          if (!d.pinned && threads.filter(t => t.pinned).length >= 3) {
            Alert.alert("Limite de 3", "Você pode fixar até 3 conversas.");
            return;
          }
          await setThreadPinned(d, !d.pinned).catch(() => {});
          reloadThreads();
        }
      },
      {
        text: "Apagar conversa",
        style: "destructive",
        onPress: () =>
          Alert.alert("Apagar conversa?", `As mensagens com @${d.username} somem só para você. Se a pessoa mandar algo novo, a conversa volta.`, [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Apagar",
              style: "destructive",
              onPress: async () => {
                await clearThread(d).catch(() => {});
                reloadThreads();
              }
            }
          ])
      },
      { text: "Cancelar", style: "cancel" }
    ]);

  const filteredThreads = threads.filter(d => 
    d.username.toLowerCase().includes(query.toLowerCase()) || 
    d.lastMessage.toLowerCase().includes(query.toLowerCase())
  );

  if (open) {
    return (
      <ChatView
        thread={open}
        onBack={() => {
          if (initialThread && open.id === initialThread.id) onBack();
          else setOpen(null);
        }}
        onOpenProfile={onOpenProfile}
        onOpenPost={onOpenPost}
      />
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
        <View style={[s.full, { backgroundColor: colors.bg, paddingTop: topPad(10) }]}>
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
              Quando você trocar mensagens com outros usuários, suas conversas aparecerão aqui. Segure uma conversa para fixar ou apagar.
            </Text>
          </View>
        ) : (
          filteredThreads.map(d => (
            <Pressable key={d.id} onPress={() => setOpen(d)} onLongPress={() => threadMenu(d)} delayLongPress={350} style={s.thread}>
              <View>
                <FastImage source={d.avatar} style={s.avatar} />
                {onlineIds.has(d.profileId) ? <View style={[s.onlineDot, { borderColor: colors.bg }]} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.user, { color: colors.text }]}>
                  @{d.username}
                  {d.pinned ? <Text style={{ fontSize: 11, color: colors.muted }}>  · Fixada</Text> : null}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ color: d.unread ? colors.text : colors.muted, fontSize: 12, fontWeight: d.unread ? "600" : "400" }}
                >
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
  onlineDot: { position: "absolute", right: 1, bottom: 1, width: 15, height: 15, borderRadius: 8, backgroundColor: "#22C55E", borderWidth: 3 },
  user: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  unread: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: "#168CFF", alignItems: "center", justifyContent: "center" },
  unreadText: { fontSize: 10, color: "white", fontWeight: "600" },
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
  emptyTitle: { fontSize: 16, fontWeight: "600", marginTop: 6 }
});

