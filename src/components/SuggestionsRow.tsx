import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { noSwipeBack } from "./gestures";
import { X } from "lucide-react-native";
import { UserProfile } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { PressableScale } from "./motion";
import { FastImage } from "./FastImage";
import { loadFollowedUsers, loadSuggestions, saveFollowedUsers } from "../services/storage";
import { tapFeedback } from "../utils/haptics";

type Suggestion = UserProfile & { mutuals?: number };

/** Cartões "Quem seguir": primeiro amigos de quem você segue, depois os populares */
export function SuggestionsRow({
  onOpenProfile,
  title = "Sugestões para você",
  reloadKey = 0
}: {
  onOpenProfile?: (p: UserProfile) => void;
  title?: string;
  reloadKey?: number;
}) {
  const { colors } = useAppTheme();
  const [list, setList] = useState<Suggestion[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);

  useEffect(() => {
    loadSuggestions(15).then(setList).catch(() => setList([]));
    loadFollowedUsers().then(setFollowing).catch(() => {});
  }, [reloadKey]);

  const visible = list.filter(p => !hidden.includes(p.id));
  if (visible.length === 0) return null;

  const toggleFollow = async (p: Suggestion) => {
    tapFeedback();
    const id = p.id || p.username;
    const updated = following.includes(id) ? following.filter(x => x !== id) : [...following, id];
    setFollowing(updated);
    try {
      await saveFollowedUsers(updated);
    } catch {
      setFollowing(following);
    }
  };

  return (
    <View style={s.wrap}>
      <Text style={[s.title, { color: colors.text }]}>{title}</Text>
      <ScrollView {...noSwipeBack} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {visible.map(p => {
          const on = following.includes(p.id) || following.includes(p.username);
          return (
            <Pressable
              key={p.id}
              onPress={() => onOpenProfile?.(p)}
              style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Pressable onPress={() => setHidden(h => [...h, p.id])} hitSlop={10} style={s.close}>
                <X size={13} color={colors.muted} />
              </Pressable>
              <FastImage source={p.avatar} style={s.avatar} contentFit="cover" />
              <Text style={[s.user, { color: colors.text }]} numberOfLines={1}>
                @{p.username}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 10, textAlign: "center", minHeight: 26 }} numberOfLines={2}>
                {p.mutuals
                  ? `Seguido por ${p.mutuals} ${p.mutuals === 1 ? "pessoa" : "pessoas"} que você segue`
                  : p.location || `${(p.followers || 0).toLocaleString("pt-BR")} seguidores`}
              </Text>
              <PressableScale
                onPress={() => toggleFollow(p)}
                style={[s.btn, { backgroundColor: on ? colors.bg : "#0095F6", borderColor: on ? colors.border : "#0095F6" }]}
              >
                <Text style={{ color: on ? colors.text : "#FFF", fontWeight: "600", fontSize: 12 }}>
                  {on ? "Seguindo" : "Seguir"}
                </Text>
              </PressableScale>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingVertical: 14 },
  title: { fontSize: 14, fontWeight: "700", paddingHorizontal: 16, marginBottom: 10 },
  row: { paddingHorizontal: 16, gap: 10 },
  card: { width: 150, borderWidth: 1, borderRadius: 18, padding: 12, alignItems: "center", gap: 4 },
  close: { position: "absolute", top: 8, right: 8, zIndex: 2 },
  avatar: { width: 66, height: 66, borderRadius: 33, marginBottom: 4 },
  user: { fontWeight: "600", fontSize: 13, maxWidth: 126 },
  btn: { marginTop: 6, alignSelf: "stretch", height: 32, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" }
});
