import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Check, Link2, Search, X } from "lucide-react-native";
import { FeedPost, UserProfile } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { toast } from "./motion";
import { ListSkeleton } from "./SkeletonLoader";
import { FastImage } from "./FastImage";
import { loadAllRegisteredProfiles, loadThreads, sharePostToProfiles } from "../services/storage";
import { successFeedback, tapFeedback } from "../utils/haptics";

const norm = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Enviar um look pelo Direct (vai como cartão do post, não como cópia da foto) */
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
  const [note, setNote] = useState("");
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSelected([]);
    setNote("");
    setQuery("");
    setLoading(true);
    Promise.all([loadThreads().catch(() => []), loadAllRegisteredProfiles().catch(() => [])])
      .then(([threads, profiles]) => {
        const recent = threads.map(t => t.profileId);
        setRecentIds(recent);
        // conversas recentes primeiro, depois quem eu sigo, depois o resto
        const byId = new Map<string, UserProfile>();
        threads.forEach(t =>
          byId.set(t.profileId, {
            id: t.profileId,
            username: t.username,
            displayName: t.username,
            avatar: t.avatar,
            location: "",
            followers: 0,
            following: 0
          } as UserProfile)
        );
        profiles.forEach(p => {
          if (!byId.has(p.id)) byId.set(p.id, p);
          else byId.set(p.id, { ...p });
        });
        const list = Array.from(byId.values()).sort((a, b) => {
          const ra = recent.indexOf(a.id), rb = recent.indexOf(b.id);
          if (ra !== -1 || rb !== -1) return (ra === -1 ? 999 : ra) - (rb === -1 ? 999 : rb);
          return Number(!!b.isFollowing) - Number(!!a.isFollowing) || (b.followers || 0) - (a.followers || 0);
        });
        setPeople(list);
      })
      .finally(() => setLoading(false));
  }, [visible]);

  const filtered = useMemo(() => {
    const q = norm(query.trim().replace(/^@/, ""));
    const list = q ? people.filter(p => norm(`${p.username} ${p.displayName}`).includes(q)) : people;
    return list.slice(0, 60);
  }, [people, query]);

  if (!visible || !post) return null;

  const isSel = (p: UserProfile) => selected.some(x => x.id === p.id);
  const toggle = (p: UserProfile) => {
    tapFeedback();
    setSelected(prev => (isSel(p) ? prev.filter(x => x.id !== p.id) : [...prev, p]));
  };

  const send = async () => {
    if (!selected.length || sending) return;
    setSending(true);
    try {
      await sharePostToProfiles(post, selected, note);
      successFeedback();
      toast(selected.length === 1 ? `Look enviado para @${selected[0].username}` : `Look enviado para ${selected.length} pessoas`, "✈️");
      onClose();
    } catch (e: any) {
      Alert.alert("Falha ao enviar", e?.message || "Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  const shareOutside = async () => {
    const who = post.creatorUsername || post.creatorName;
    try {
      await Share.share({
        message: `Olha esse look de @${who} no Guvio${post.city ? ` (${post.city})` : ""} 👗 guvio://u/${who}`
      });
    } catch {}
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
          <View style={s.header}>
            <View style={s.dragHandle} />
            <View style={s.titleRow}>
              <Text style={[s.title, { color: colors.text }]}>Enviar look</Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <X size={22} color={colors.icon} />
              </Pressable>
            </View>
          </View>

          <View style={[s.postPreview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <FastImage source={post.image} style={s.postThumb} contentFit="cover" />
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text style={[s.postAuthor, { color: colors.text }]}>@{post.creatorUsername || post.creatorName}</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
                {[post.city, post.country].filter(Boolean).join(", ")}
                {post.styleTag ? ` · ${post.styleTag}` : ""}
              </Text>
            </View>
            <Pressable onPress={shareOutside} hitSlop={8} style={[s.outBtn, { borderColor: colors.border }]}>
              <Link2 size={15} color={colors.icon} />
              <Text style={{ color: colors.text, fontSize: 11, fontWeight: "800" }}>Fora do app</Text>
            </Pressable>
          </View>

          <View style={[s.searchBar, { backgroundColor: colors.surface }]}>
            <Search size={16} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Pesquisar pessoas..."
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              style={[s.searchInput, { color: colors.text }]}
            />
          </View>

          <ScrollView style={s.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {loading ? (
              <ListSkeleton rows={5} avatar={46} />
            ) : filtered.length === 0 ? (
              <Text style={{ color: colors.muted, textAlign: "center", marginVertical: 24 }}>Ninguém encontrado.</Text>
            ) : (
              filtered.map(p => {
                const on = isSel(p);
                return (
                  <Pressable key={p.id} onPress={() => toggle(p)} style={s.row}>
                    <FastImage source={p.avatar} style={s.avatar} contentFit="cover" />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.username, { color: colors.text }]}>@{p.username}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>
                        {recentIds.includes(p.id) ? "Conversa recente" : p.displayName}
                      </Text>
                    </View>
                    <View
                      style={[
                        s.check,
                        { borderColor: on ? "#0095F6" : colors.border, backgroundColor: on ? "#0095F6" : "transparent" }
                      ]}
                    >
                      {on ? <Check size={14} color="#FFF" /> : null}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {selected.length > 0 ? (
            <View style={[s.footer, { borderTopColor: colors.border }]}>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Escreva uma mensagem (opcional)..."
                placeholderTextColor={colors.muted}
                style={[s.note, { backgroundColor: colors.surface, color: colors.text }]}
              />
              <Pressable onPress={send} disabled={sending} style={[s.sendBtn, { opacity: sending ? 0.6 : 1 }]}>
                {sending ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={s.sendText}>
                    {selected.length === 1 ? `Enviar para @${selected[0].username}` : `Enviar para ${selected.length} pessoas`}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "82%", paddingBottom: 28, borderTopWidth: 1 },
  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, alignItems: "center" },
  dragHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(150,150,150,0.4)", marginBottom: 12 },
  titleRow: { width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 16, fontWeight: "900" },
  postPreview: { flexDirection: "row", gap: 12, marginHorizontal: 20, marginBottom: 14, padding: 8, borderRadius: 14, borderWidth: 1, alignItems: "center" },
  postThumb: { width: 44, height: 44, borderRadius: 8 },
  postAuthor: { fontSize: 13, fontWeight: "800" },
  outBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 14, paddingHorizontal: 9, paddingVertical: 6 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20, paddingHorizontal: 14, height: 40, borderRadius: 12, marginBottom: 6 },
  searchInput: { flex: 1, fontSize: 13, height: "100%" },
  list: { paddingHorizontal: 20, maxHeight: 330 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  username: { fontSize: 14, fontWeight: "700" },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  note: { height: 42, borderRadius: 14, paddingHorizontal: 14, fontSize: 13 },
  sendBtn: { height: 46, borderRadius: 23, backgroundColor: "#0095F6", alignItems: "center", justifyContent: "center" },
  sendText: { color: "#FFF", fontWeight: "900" }
});
