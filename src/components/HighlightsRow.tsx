import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { noSwipeBack } from "./gestures";
import { topPad } from "../utils/insets";
import { Check, Plus, X } from "lucide-react-native";
import { Highlight, StoryItem, UserStoryGroup } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { GridSkeleton } from "./SkeletonLoader";
import { FastImage } from "./FastImage";
import { StoryViewerModal } from "./StoryViewerModal";
import { deleteHighlight, loadHighlights, loadMyStoryArchive, saveHighlight } from "../services/storage";

/** Destaques de stories no perfil (bolinhas abaixo da bio) */
export function HighlightsRow({
  userId,
  username,
  avatar,
  isMe
}: {
  userId: string;
  username: string;
  avatar: string;
  isMe?: boolean;
}) {
  const { colors } = useAppTheme();
  const [list, setList] = useState<Highlight[]>([]);
  const [playing, setPlaying] = useState<Highlight | null>(null);
  const [editing, setEditing] = useState<Highlight | "new" | null>(null);

  const reload = () => loadHighlights(userId).then(setList).catch(() => {});
  useEffect(() => {
    if (userId) reload();
  }, [userId]);

  if (!isMe && list.length === 0) return null;

  const group: UserStoryGroup | null = playing
    ? { id: userId, username, displayName: playing.title, avatar, isMe: false, hasUnseen: false, stories: playing.stories.map(s => ({ ...s, seen: true })) }
    : null;

  const manage = (h: Highlight) =>
    Alert.alert(h.title, undefined, [
      { text: "Editar", onPress: () => setEditing(h) },
      {
        text: "Apagar destaque",
        style: "destructive",
        onPress: async () => {
          await deleteHighlight(h.id).catch(() => {});
          reload();
        }
      },
      { text: "Cancelar", style: "cancel" }
    ]);

  return (
    <>
      <ScrollView {...noSwipeBack} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {isMe ? (
          <Pressable onPress={() => setEditing("new")} style={s.item}>
            <View style={[s.circle, { borderColor: colors.border, alignItems: "center", justifyContent: "center" }]}>
              <Plus size={24} color={colors.text} />
            </View>
            <Text style={[s.label, { color: colors.text }]}>Novo</Text>
          </Pressable>
        ) : null}
        {list.map(h => (
          <Pressable
            key={h.id}
            onPress={() => (h.stories.length ? setPlaying(h) : isMe ? setEditing(h) : null)}
            onLongPress={isMe ? () => manage(h) : undefined}
            style={s.item}
          >
            <View style={[s.circle, { borderColor: colors.border }]}>
              <FastImage source={h.cover || ""} style={s.cover} contentFit="cover" />
            </View>
            <Text style={[s.label, { color: colors.text }]} numberOfLines={1}>
              {h.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {group ? (
        <StoryViewerModal visible storyGroups={[group]} initialGroupIndex={0} onClose={() => setPlaying(null)} />
      ) : null}
      {editing && isMe ? (
        <HighlightEditor
          userId={userId}
          highlight={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      ) : null}
    </>
  );
}

function HighlightEditor({
  userId,
  highlight,
  onClose,
  onSaved
}: {
  userId: string;
  highlight: Highlight | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { colors } = useAppTheme();
  const [title, setTitle] = useState(highlight?.title || "");
  const [archive, setArchive] = useState<StoryItem[] | null>(null);
  const [picked, setPicked] = useState<string[]>(highlight?.stories.map(s => s.id) || []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMyStoryArchive().then(list => {
      // stories que já estão no destaque e não vieram no arquivo também aparecem
      const extra = (highlight?.stories || []).filter(s => !list.some(x => x.id === s.id));
      setArchive([...extra, ...list]);
    });
  }, []);

  const save = async () => {
    if (!title.trim()) return Alert.alert("Dê um nome", "Ex.: Viagens, Trabalho, Looks de inverno.");
    if (!picked.length) return Alert.alert("Escolha stories", "Selecione pelo menos um story.");
    setSaving(true);
    try {
      const stories = (archive || []).filter(s => picked.includes(s.id));
      await saveHighlight(userId, { id: highlight?.id, title: title.trim().slice(0, 30), stories, cover: stories[0]?.image });
      onSaved();
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Não foi possível salvar o destaque.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[s.full, { backgroundColor: colors.bg }]}>
        <View style={s.head}>
          <Pressable onPress={onClose} hitSlop={10}>
            <X size={24} color={colors.icon} />
          </Pressable>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>{highlight ? "Editar destaque" : "Novo destaque"}</Text>
          <Pressable onPress={save} disabled={saving} hitSlop={10}>
            {saving ? <ActivityIndicator color={colors.text} /> : <Text style={{ color: "#0095F6", fontWeight: "700" }}>Salvar</Text>}
          </Pressable>
        </View>
        <TextInput
          value={title}
          onChangeText={setTitle}
          maxLength={30}
          placeholder="Nome do destaque"
          placeholderTextColor={colors.muted}
          style={[s.input, { backgroundColor: colors.surface, color: colors.text }]}
        />
        <Text style={{ color: colors.muted, fontSize: 12, marginHorizontal: 16, marginBottom: 8 }}>
          Escolha os stories (inclusive os que já sumiram depois de 24h):
        </Text>
        {archive === null ? (
          <GridSkeleton count={6} ratio={16 / 9} />
        ) : archive.length === 0 ? (
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: 30, paddingHorizontal: 30 }}>
            Você ainda não publicou nenhum story. Publique um pela bolinha "Seu story" na Home.
          </Text>
        ) : (
          <ScrollView contentContainerStyle={s.grid}>
            {archive.map(st => {
              const on = picked.includes(st.id);
              return (
                <Pressable
                  key={st.id}
                  onPress={() => setPicked(p => (on ? p.filter(x => x !== st.id) : [...p, st.id]))}
                  style={s.tile}
                >
                  <FastImage source={st.image} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  <View style={[s.check, { backgroundColor: on ? "#0095F6" : "rgba(0,0,0,.4)" }]}>
                    {on ? <Check size={13} color="#FFF" /> : null}
                  </View>
                  <Text style={s.tileTime}>{st.timestamp}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  row: { paddingHorizontal: 18, paddingTop: 14, gap: 14 },
  item: { width: 68, alignItems: "center", gap: 5 },
  circle: { width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, padding: 3, overflow: "hidden" },
  cover: { width: "100%", height: "100%", borderRadius: 30 },
  label: { fontSize: 11, fontWeight: "600" },
  full: { flex: 1, paddingTop: topPad(50) },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 14 },
  input: { marginHorizontal: 16, height: 46, borderRadius: 14, paddingHorizontal: 14, marginBottom: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 2, paddingBottom: 40 },
  tile: { width: "33%", aspectRatio: 9 / 16 },
  check: { position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "#FFF", alignItems: "center", justifyContent: "center" },
  tileTime: { position: "absolute", left: 6, bottom: 6, color: "#FFF", fontSize: 10, fontWeight: "600" }
});
