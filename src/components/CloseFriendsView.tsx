import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Search, Star } from "lucide-react-native";
import { UserProfile } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { ScreenHeader } from "./ScreenHeader";
import { FastImage } from "./FastImage";
import { ListSkeleton } from "./SkeletonLoader";
import { loadAllRegisteredProfiles, loadCloseFriends, loadFollowedUsers, setCloseFriend } from "../services/storage";
import { tapFeedback } from "../utils/haptics";

const norm = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Lista de melhores amigos: quem vê os stories marcados com ★ */
export function CloseFriendsView({ onBack }: { onBack: () => void }) {
  const { colors } = useAppTheme();
  const [people, setPeople] = useState<UserProfile[] | null>(null);
  const [friends, setFriends] = useState<string[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    Promise.all([loadAllRegisteredProfiles(), loadFollowedUsers(), loadCloseFriends()]).then(([all, following, cf]) => {
      setFriends(cf);
      // amigos e quem eu sigo primeiro
      const rank = (p: UserProfile) => (cf.includes(p.id) ? 0 : following.includes(p.id) || following.includes(p.username) ? 1 : 2);
      setPeople([...all].sort((a, b) => rank(a) - rank(b)));
    });
  }, []);

  const shown = useMemo(() => {
    const t = norm(q.trim().replace(/^@/, ""));
    return (people || []).filter(p => !t || norm(`${p.username} ${p.displayName}`).includes(t)).slice(0, 100);
  }, [people, q]);

  const toggle = async (p: UserProfile) => {
    tapFeedback();
    const on = !friends.includes(p.id);
    setFriends(prev => (on ? [...prev, p.id] : prev.filter(x => x !== p.id)));
    try {
      await setCloseFriend(p.id, on);
    } catch {
      setFriends(prev => (on ? prev.filter(x => x !== p.id) : [...prev, p.id]));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Melhores amigos" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: colors.muted, lineHeight: 19, marginBottom: 12 }}>
          Só as pessoas com ★ veem os stories que você marcar como "Melhores amigos". Ninguém é avisado quando entra ou sai da lista.
        </Text>
        <View style={[s.search, { backgroundColor: colors.surface }]}>
          <Search size={16} color={colors.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Pesquisar" placeholderTextColor={colors.muted} autoCapitalize="none" style={{ flex: 1, color: colors.text, height: "100%" }} />
        </View>
        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, marginVertical: 10 }}>
          {friends.length} {friends.length === 1 ? "PESSOA" : "PESSOAS"} NA LISTA
        </Text>
        {people === null ? (
          <ListSkeleton rows={6} />
        ) : (
          shown.map(p => {
            const on = friends.includes(p.id);
            return (
              <Pressable key={p.id} onPress={() => toggle(p)} style={s.row}>
                <FastImage source={p.avatar} style={[s.avatar, on && { borderColor: "#22C55E", borderWidth: 2 }]} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "800" }}>@{p.username}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
                    {p.displayName}
                  </Text>
                </View>
                <View style={[s.star, { backgroundColor: on ? "#22C55E" : "transparent", borderColor: on ? "#22C55E" : colors.border }]}>
                  <Star size={15} color={on ? "#FFF" : colors.muted} fill={on ? "#FFF" : "none"} />
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  search: { height: 42, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  star: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: "center", justifyContent: "center" }
});
