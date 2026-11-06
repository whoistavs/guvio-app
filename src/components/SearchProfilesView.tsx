import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BadgeCheck, Compass, Search, Users, X } from "lucide-react-native";
import { FeedPost, UserProfile } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import {
  loadAllRegisteredProfiles,
  loadExplore,
  loadFollowedUsers,
  saveFollowedUsers,
  searchLooks
} from "../services/storage";
import { FastImage } from "./FastImage";

const n = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const SCREEN_W = Math.min(Dimensions.get("window").width, 700);
const TILE = (SCREEN_W - 40 - 4) / 3;

type Mode = "looks" | "people";

export function SearchProfilesView({
  onOpenProfile,
  onOpenPost
}: {
  onOpenProfile: (p: UserProfile) => void;
  onOpenPost?: (postId: string) => void;
}) {
  const { colors } = useAppTheme();
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<Mode>("looks");
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [explore, setExplore] = useState<FeedPost[]>([]);
  const [looks, setLooks] = useState<FeedPost[]>([]);
  const [loadingExplore, setLoadingExplore] = useState(true);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadAllRegisteredProfiles().then(setProfiles);
    loadFollowedUsers().then(setFollowing);
    loadExplore()
      .then(setExplore)
      .finally(() => setLoadingExplore(false));
  }, []);

  // busca de looks com pequeno atraso para não consultar a cada letra
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const term = q.trim();
    if (!term) {
      setLooks([]);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(() => {
      searchLooks(term)
        .then(setLooks)
        .finally(() => setSearching(false));
    }, 350);
  }, [q]);

  const handleToggleFollow = async (profileId: string) => {
    const updated = following.includes(profileId)
      ? following.filter(x => x !== profileId)
      : [...following, profileId];
    setFollowing(updated);
    await saveFollowedUsers(updated);
  };

  const people = useMemo(() => {
    if (!q.trim()) return profiles;
    const term = n(q.trim().replace(/^@/, ""));
    return profiles.filter(p => n(`${p.displayName} ${p.username} ${p.location} ${p.bio || ""}`).includes(term));
  }, [q, profiles]);

  const renderGrid = (posts: FeedPost[]) => (
    <View style={s.grid}>
      {posts.map(p => (
        <Pressable key={p.id} onPress={() => onOpenPost?.(p.id)} style={{ width: TILE, height: TILE * 1.25 }}>
          <FastImage source={p.image} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          {p.city ? (
            <View style={s.tileTag}>
              <Text style={s.tileTagText} numberOfLines={1}>
                {p.city}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );

  const renderPeople = (list: UserProfile[]) =>
    list.length === 0 ? (
      <View style={s.empty}>
        <Users size={38} color={colors.muted} />
        <Text style={{ color: colors.text, fontWeight: "800", marginTop: 8 }}>Nenhum perfil encontrado</Text>
      </View>
    ) : (
      list.map(p => {
        const isF = following.includes(p.id) || following.includes(p.username);
        return (
          <Pressable key={p.id || p.username} onPress={() => onOpenProfile(p)} style={s.row}>
            <FastImage source={p.avatar} style={s.avatar} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <View style={s.name}>
                <Text style={[s.user, { color: colors.text }]}>@{p.username}</Text>
                {p.verified ? <BadgeCheck size={15} color="#0095F6" /> : null}
              </View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {p.displayName} {p.location ? `· ${p.location}` : ""}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>
                {(p.followers || 0).toLocaleString("pt-BR")} seguidores
              </Text>
            </View>
            <Pressable
              onPress={e => {
                e.stopPropagation?.();
                handleToggleFollow(p.id || p.username);
              }}
              style={[s.follow, { backgroundColor: isF ? colors.surface : "#0095F6" }]}
            >
              <Text style={{ color: isF ? colors.text : "#FFF", fontWeight: "800", fontSize: 11 }}>
                {isF ? "Seguindo" : "Seguir"}
              </Text>
            </Pressable>
          </Pressable>
        );
      })
    );

  const hasQuery = q.trim().length > 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={[s.h, { color: colors.text }]}>{hasQuery ? "Pesquisar" : "Explorar"}</Text>
      <View style={[s.search, { backgroundColor: colors.surface }]}>
        <Search size={18} color={colors.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Cidade, estilo, @username..."
          placeholderTextColor={colors.muted}
          style={[s.input, { color: colors.text }]}
          autoCapitalize="none"
        />
        {q ? (
          <Pressable onPress={() => setQ("")} hitSlop={10}>
            <X size={16} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {hasQuery ? (
        <>
          <View style={[s.tabs, { borderBottomColor: colors.border }]}>
            {(["looks", "people"] as Mode[]).map(m => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={[s.tab, mode === m && { borderBottomColor: colors.text }]}
              >
                <Text style={{ color: mode === m ? colors.text : colors.muted, fontWeight: "800" }}>
                  {m === "looks" ? `Looks (${looks.length})` : `Pessoas (${people.length})`}
                </Text>
              </Pressable>
            ))}
          </View>
          {mode === "looks" ? (
            searching ? (
              <ActivityIndicator color={colors.muted} style={{ marginTop: 30 }} />
            ) : looks.length === 0 ? (
              <View style={s.empty}>
                <Compass size={38} color={colors.muted} />
                <Text style={{ color: colors.text, fontWeight: "800", marginTop: 8 }}>Nenhum look encontrado</Text>
                <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 4 }}>
                  Tente uma cidade (Porto, Lisboa, Campinas) ou um estilo.
                </Text>
              </View>
            ) : (
              renderGrid(looks)
            )
          ) : (
            renderPeople(people)
          )}
        </>
      ) : (
        <>
          <Text style={[s.label, { color: colors.muted }]}>EM ALTA NA COMUNIDADE</Text>
          {loadingExplore ? (
            <ActivityIndicator color={colors.muted} style={{ marginTop: 30 }} />
          ) : explore.length === 0 ? (
            <View style={s.empty}>
              <Compass size={38} color={colors.muted} />
              <Text style={{ color: colors.text, fontWeight: "800", marginTop: 8 }}>Ainda não há looks para explorar</Text>
            </View>
          ) : (
            renderGrid(explore)
          )}
          <Text style={[s.label, { color: colors.muted }]}>MEMBROS DA COMUNIDADE</Text>
          {renderPeople(profiles.slice(0, 20))}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 120, maxWidth: 700, width: "100%", alignSelf: "center" },
  h: { fontSize: 28, fontWeight: "900", letterSpacing: -0.8, marginBottom: 18 },
  search: { height: 46, borderRadius: 14, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 9 },
  input: { flex: 1, height: "100%", fontSize: 14 },
  label: { fontSize: 10, fontWeight: "800", letterSpacing: 1.3, marginTop: 24, marginBottom: 10 },
  tabs: { flexDirection: "row", marginTop: 16, marginBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 2 },
  tileTag: {
    position: "absolute",
    left: 5,
    bottom: 5,
    maxWidth: TILE - 10,
    backgroundColor: "rgba(0,0,0,.55)",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2
  },
  tileTagText: { color: "#FFF", fontSize: 9, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 11 },
  avatar: { width: 54, height: 54, borderRadius: 27, marginRight: 12 },
  name: { flexDirection: "row", alignItems: "center", gap: 4 },
  user: { fontSize: 14, fontWeight: "800" },
  follow: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10, minWidth: 78, alignItems: "center" },
  empty: { alignItems: "center", justifyContent: "center", padding: 40, width: "100%" }
});
