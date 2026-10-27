import React, { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BadgeCheck, Search, UserCheck, UserPlus, Users, X } from "lucide-react-native";
import { UserProfile } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { loadAllRegisteredProfiles, loadFollowedUsers, saveFollowedUsers } from "../services/storage";
import { FastImage } from "./FastImage";

const n = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function SearchProfilesView({ onOpenProfile }: { onOpenProfile: (p: UserProfile) => void }) {
  const { colors } = useAppTheme();
  const [q, setQ] = useState("");
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [following, setFollowing] = useState<string[]>([]);

  useEffect(() => {
    loadAllRegisteredProfiles().then(setProfiles);
    loadFollowedUsers().then(setFollowing);
  }, []);

  const handleToggleFollow = async (profileId: string) => {
    const updated = following.includes(profileId)
      ? following.filter(x => x !== profileId)
      : [...following, profileId];
    setFollowing(updated);
    await saveFollowedUsers(updated);
  };

  const list = useMemo(() => {
    if (!q.trim()) return profiles;
    const searchNormalized = n(q.trim().replace(/^@/, ""));
    return profiles.filter(p =>
      n(`${p.displayName} ${p.username} ${p.location} ${p.bio || ""}`).includes(searchNormalized)
    );
  }, [q, profiles]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={s.content}>
      <Text style={[s.h, { color: colors.text }]}>Pesquisar</Text>
      <View style={[s.search, { backgroundColor: colors.surface }]}>
        <Search size={18} color={colors.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Pesquisar por @username, nome ou cidade"
          placeholderTextColor={colors.muted}
          style={[s.input, { color: colors.text }]}
        />
        {q ? (
          <Pressable onPress={() => setQ("")} hitSlop={10}>
            <X size={16} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <Text style={[s.label, { color: colors.muted }]}>
        {q ? `RESULTADOS (${list.length})` : "TODOS OS MEMBROS DA COMUNIDADE"}
      </Text>

      {list.length === 0 ? (
        <View style={s.empty}>
          <Users size={38} color={colors.muted} />
          <Text style={{ color: colors.text, fontWeight: "800", marginTop: 8 }}>Nenhum perfil encontrado</Text>
          <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 4 }}>
            Verifique se o @username ou nome foi digitado corretamente.
          </Text>
        </View>
      ) : (
        list.map(p => {
          const isF = following.includes(p.id) || following.includes(p.username);
          return (
            <Pressable key={p.id || p.username} onPress={() => onOpenProfile(p)} style={s.row}>
              <FastImage
                source={p.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200"}
                style={s.avatar}
                contentFit="cover"
              />
              <View style={{ flex: 1 }}>
                <View style={s.name}>
                  <Text style={[s.user, { color: colors.text }]}>@{p.username}</Text>
                  {p.verified ? <BadgeCheck size={15} color="#0095F6" /> : null}
                </View>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {p.displayName} {p.location ? `· ${p.location}` : ""}
                </Text>
                {p.bio ? (
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                    {p.bio}
                  </Text>
                ) : null}
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                  {(p.followers || 0).toLocaleString("pt-BR")} seguidores
                </Text>
              </View>
              <Pressable
                onPress={e => {
                  e.stopPropagation?.();
                  handleToggleFollow(p.id || p.username);
                }}
                style={[
                  s.follow,
                  { backgroundColor: isF ? colors.surface : "#0095F6" }
                ]}
              >
                <Text
                  style={{
                    color: isF ? colors.text : "#FFF",
                    fontWeight: "800",
                    fontSize: 11
                  }}
                >
                  {isF ? "Seguindo" : "Seguir"}
                </Text>
              </Pressable>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 120, maxWidth: 700, width: "100%", alignSelf: "center" },
  h: { fontSize: 28, fontWeight: "900", letterSpacing: -0.8, marginBottom: 18 },
  search: { height: 46, borderRadius: 14, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 9 },
  input: { flex: 1, height: "100%", fontSize: 14 },
  label: { fontSize: 10, fontWeight: "800", letterSpacing: 1.3, marginTop: 24, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 11 },
  avatar: { width: 54, height: 54, borderRadius: 27, marginRight: 12 },
  name: { flexDirection: "row", alignItems: "center", gap: 4 },
  user: { fontSize: 14, fontWeight: "800" },
  follow: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10, minWidth: 78, alignItems: "center" },
  empty: { alignItems: "center", justifyContent: "center", padding: 40, width: "100%" }
});
