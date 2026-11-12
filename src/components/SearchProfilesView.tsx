import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BadgeCheck, Heart, Clock3, Compass, Hash, Search, TrendingUp, Users, X } from "lucide-react-native";
import { FeedPost, UserProfile } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { GridSkeleton } from "./SkeletonLoader";
import {
  loadAllRegisteredProfiles,
  loadExplore,
  loadFollowedUsers,
  saveFollowedUsers,
  searchLooks,
  loadCityRanking,
  loadRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  loadTrendingTags,
  loadTopCreators,
  searchByColor
} from "../services/storage";
import { weekStart } from "../data/challenges";
import { COLOR_CHIPS } from "../utils/colorHarmony";
import { PeekTile, noSwipeBack } from "./gestures";
import { STYLES } from "../data/mockData";
import { RankingGrid } from "./RankingGrid";
import { CityWeekCard } from "./CityWeekCard";
import { FastImage } from "./FastImage";
import { SuggestionsRow } from "./SuggestionsRow";

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
  onOpenPost,
  globe,
  cityFocus,
  onClearCityFocus,
  scrollEnabled = true,
  searchRequest,
  myCity
}: {
  /** cidade de quem está usando (para o "Look da semana") */
  myCity?: string;
  onOpenProfile: (p: UserProfile) => void;
  onOpenPost?: (postId: string) => void;
  /** globo mostrado acima de "Em alta na comunidade" */
  globe?: React.ReactNode;
  /** cidade tocada no globo e os looks dela */
  cityFocus?: { title: string; city?: string; posts: FeedPost[] } | null;
  onClearCityFocus?: () => void;
  scrollEnabled?: boolean;
  /** texto para pesquisar ao abrir (ex.: uma #hashtag tocada no feed) */
  searchRequest?: { text: string; id: number } | null;
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
  const [cityRank, setCityRank] = useState<FeedPost[] | null>(null);
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => loadRecentSearches());
  const [trending, setTrending] = useState<{ tag: string; count: number }[]>([]);
  const [styleFilter, setStyleFilter] = useState<string | null>(null);
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [colorLooks, setColorLooks] = useState<FeedPost[] | null>(null);
  const [creators, setCreators] = useState<(UserProfile & { weekLikes: number; weekPosts: number })[]>([]);

  useEffect(() => {
    loadTopCreators(weekStart(new Date()).toISOString()).then(setCreators).catch(() => {});
  }, []);

  useEffect(() => {
    setColorLooks(null);
    if (!colorFilter) return;
    let alive = true;
    searchByColor(colorFilter)
      .then(list => alive && setColorLooks(list))
      .catch(() => alive && setColorLooks([]));
    return () => {
      alive = false;
    };
  }, [colorFilter]);

  useEffect(() => {
    loadTrendingTags(12).then(setTrending).catch(() => {});
  }, []);

  const remember = (term?: string) => {
    const t = (term ?? q).trim();
    if (t.length < 2) return;
    addRecentSearch(t);
    setRecent(loadRecentSearches());
  };

  // ranking da cidade tocada no globo (busca no servidor os mais curtidos de lá)
  useEffect(() => {
    setCityRank(null);
    const city = cityFocus?.city;
    if (!city) return;
    let alive = true;
    loadCityRanking(city).then(list => alive && setCityRank(list));
    return () => {
      alive = false;
    };
  }, [cityFocus?.city]);

  useEffect(() => {
    if (searchRequest?.text) {
      setQ(searchRequest.text);
      setMode("looks");
    }
  }, [searchRequest?.id]);

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
        <PeekTile
          key={p.id}
          post={p}
          onPress={() => {
            if (q.trim()) remember();
            onOpenPost?.(p.id);
          }}
          actions={{ onProfile: u => onOpenProfile({ id: p.userId || "", username: u, displayName: p.creatorName, avatar: p.creatorAvatar, location: "", followers: 0 } as unknown as UserProfile) }}
          style={{ width: TILE, height: TILE * 1.25 }}
        >
          <FastImage source={p.image} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          {p.city ? (
            <View style={s.tileTag}>
              <Text style={s.tileTagText} numberOfLines={1}>
                {p.city}
              </Text>
            </View>
          ) : null}
        </PeekTile>
      ))}
    </View>
  );

  const renderPeople = (list: UserProfile[]) =>
    list.length === 0 ? (
      <View style={s.empty}>
        <Users size={38} color={colors.muted} />
        <Text style={{ color: colors.text, fontWeight: "600", marginTop: 8 }}>Nenhum perfil encontrado</Text>
      </View>
    ) : (
      list.map(p => {
        const isF = following.includes(p.id) || following.includes(p.username);
        return (
          <Pressable
            key={p.id || p.username}
            onPress={() => {
              if (q.trim()) remember(`@${p.username}`);
              onOpenProfile(p);
            }}
            style={s.row}
          >
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
              <Text style={{ color: isF ? colors.text : "#FFF", fontWeight: "600", fontSize: 11 }}>
                {isF ? "Seguindo" : "Seguir"}
              </Text>
            </Pressable>
          </Pressable>
        );
      })
    );

  const hasQuery = q.trim().length > 0;
  const exploreShown = styleFilter
    ? explore.filter(p => n(`${p.styleTag} ${p.caption}`).includes(n(styleFilter)))
    : explore;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
      scrollEnabled={scrollEnabled}
    >
      <Text style={[s.h, { color: colors.text }]}>{hasQuery ? "Pesquisar" : "Explorar"}</Text>
      <View style={[s.search, { backgroundColor: colors.surface }]}>
        <Search size={18} color={colors.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onSubmitEditing={() => remember()}
          returnKeyType="search"
          placeholder="Cidade, estilo, #hashtag, @username..."
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

      {focused && !hasQuery && recent.length > 0 ? (
        <View style={{ marginTop: 14 }}>
          <View style={s.recentHead}>
            <Text style={[s.label, { color: colors.muted, marginTop: 0, marginBottom: 0 }]}>Recentes</Text>
            <Pressable
              onPress={() => {
                removeRecentSearch();
                setRecent([]);
              }}
              hitSlop={10}
            >
              <Text style={{ color: "#0095F6", fontWeight: "600", fontSize: 12 }}>Limpar tudo</Text>
            </Pressable>
          </View>
          {recent.map(r => (
            <Pressable key={r} onPress={() => setQ(r)} style={s.recentRow}>
              <Clock3 size={16} color={colors.muted} />
              <Text style={{ color: colors.text, flex: 1 }}>{r}</Text>
              <Pressable
                onPress={() => {
                  removeRecentSearch(r);
                  setRecent(loadRecentSearches());
                }}
                hitSlop={10}
              >
                <X size={15} color={colors.muted} />
              </Pressable>
            </Pressable>
          ))}
        </View>
      ) : null}

      {hasQuery ? (
        <>
          <View style={[s.tabs, { borderBottomColor: colors.border }]}>
            {(["looks", "people"] as Mode[]).map(m => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={[s.tab, mode === m && { borderBottomColor: colors.text }]}
              >
                <Text style={{ color: mode === m ? colors.text : colors.muted, fontWeight: "600" }}>
                  {m === "looks" ? `Looks (${looks.length})` : `Pessoas (${people.length})`}
                </Text>
              </Pressable>
            ))}
          </View>
          {mode === "looks" ? (
            searching ? (
              <GridSkeleton count={9} />
            ) : looks.length === 0 ? (
              <View style={s.empty}>
                <Compass size={38} color={colors.muted} />
                <Text style={{ color: colors.text, fontWeight: "600", marginTop: 8 }}>Nenhum look encontrado</Text>
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
          {globe ? <View style={s.globe}>{globe}</View> : null}
          {cityFocus ? (
            <>
              <View style={s.cityHead}>
                <Text style={[s.label, { color: colors.muted, marginTop: 0, marginBottom: 0, flex: 1 }]} numberOfLines={1}>
                  Top looks de {cityFocus.title}
                </Text>
                <Pressable onPress={onClearCityFocus} hitSlop={10} style={[s.clear, { backgroundColor: colors.surface }]}>
                  <X size={13} color={colors.text} />
                  <Text style={{ color: colors.text, fontWeight: "600", fontSize: 11 }}>Limpar</Text>
                </Pressable>
              </View>
              {(() => {
                const ranked =
                  cityRank && cityRank.length
                    ? cityRank
                    : [...cityFocus.posts].sort((a, b) => (b.likes || 0) - (a.likes || 0));
                return ranked.length === 0 ? (
                  <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>Nenhum look nessa cidade ainda.</Text>
                ) : (
                  <RankingGrid posts={ranked} onOpenPost={onOpenPost} />
                );
              })()}
              {cityFocus.city ? <CityWeekCard city={cityFocus.city} onOpenPost={onOpenPost} /> : null}
            </>
          ) : myCity ? (
            <CityWeekCard city={myCity} onOpenPost={onOpenPost} />
          ) : null}
          {trending.length > 0 ? (
            <>
              <View style={[s.recentHead, { marginTop: 22 }]}>
                <TrendingUp size={14} color={colors.muted} />
                <Text style={[s.label, { color: colors.muted, marginTop: 0, marginBottom: 0, flex: 1 }]}>Hashtags em alta</Text>
              </View>
              <View style={s.tagWrap}>
                {trending.map((t, i) => (
                  <Pressable
                    key={t.tag}
                    onPress={() => {
                      setQ(`#${t.tag}`);
                      remember(`#${t.tag}`);
                    }}
                    style={[s.tagChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{i + 1}</Text>
                    <Text style={{ color: colors.text, fontWeight: "600", fontSize: 12 }}>#{t.tag}</Text>
                    <Text style={{ color: colors.muted, fontSize: 10 }}>{t.count}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
          {creators.length > 0 ? (
            <>
              <Text style={[s.label, { color: colors.muted }]}>Criadores da semana</Text>
              <ScrollView {...noSwipeBack} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 4 }}>
                {creators.map((c, i) => (
                  <Pressable key={c.id || c.username} onPress={() => onOpenProfile(c)} style={{ width: 76, alignItems: "center" }}>
                    <View>
                      <FastImage source={c.avatar} style={[s.creatorAv, { borderColor: i === 0 ? "#F2C230" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : colors.border }]} contentFit="cover" />
                      <View style={[s.rank, { backgroundColor: colors.text }]}>
                        <Text style={{ color: colors.bg, fontSize: 10, fontWeight: "700" }}>{i + 1}</Text>
                      </View>
                    </View>
                    <Text style={{ color: colors.text, fontSize: 11, fontWeight: "600", marginTop: 6 }} numberOfLines={1}>
                      @{c.username}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                      <Heart size={10} color={colors.muted} />
                      <Text style={{ color: colors.muted, fontSize: 10 }}>{c.weekLikes}</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}
          <Text style={[s.label, { color: colors.muted }]}>Looks por cor</Text>
          <ScrollView {...noSwipeBack} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {COLOR_CHIPS.map(c => {
              const on = colorFilter === c.term;
              return (
                <Pressable
                  key={c.label}
                  onPress={() => setColorFilter(on ? null : c.term)}
                  style={[s.colorChip, { borderColor: on ? colors.text : colors.border, backgroundColor: on ? colors.surface : "transparent" }]}
                >
                  <View style={[s.colorDot, { backgroundColor: c.hex, borderColor: colors.border }]} />
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: on ? "700" : "700" }}>{c.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {colorFilter ? (
            colorLooks === null ? (
              <View style={{ marginTop: 10 }}>
                <GridSkeleton count={6} />
              </View>
            ) : colorLooks.length === 0 ? (
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 10 }}>
                Nenhum look com peças nessa cor ainda. Marque as peças com a cor ao publicar.
              </Text>
            ) : (
              <View style={{ marginTop: 10 }}>{renderGrid(colorLooks)}</View>
            )
          ) : null}
          <Text style={[s.label, { color: colors.muted }]}>Em alta na comunidade</Text>
          <ScrollView {...noSwipeBack} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 10 }}>
            {[null, ...STYLES.map(st => st.title)].map(t => {
              const on = styleFilter === t;
              return (
                <Pressable
                  key={t || "all"}
                  onPress={() => setStyleFilter(t)}
                  style={[s.styleChip, { backgroundColor: on ? colors.text : colors.surface, borderColor: colors.border }]}
                >
                  <Text style={{ color: on ? colors.bg : colors.text, fontWeight: "600", fontSize: 12 }}>{t || "Todos"}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {loadingExplore ? (
            <GridSkeleton count={9} />
          ) : exploreShown.length === 0 ? (
            <View style={s.empty}>
              <Compass size={38} color={colors.muted} />
              <Text style={{ color: colors.text, fontWeight: "600", marginTop: 8 }}>
                {styleFilter ? `Nenhum look ${styleFilter} por enquanto` : "Ainda não há looks para explorar"}
              </Text>
            </View>
          ) : (
            renderGrid(exploreShown)
          )}
          <View style={{ marginHorizontal: -20, marginTop: 10 }}>
            <SuggestionsRow onOpenProfile={onOpenProfile} title="Quem seguir" />
          </View>
          <Text style={[s.label, { color: colors.muted }]}>Membros da comunidade</Text>
          {renderPeople(profiles.slice(0, 20))}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 120, maxWidth: 700, width: "100%", alignSelf: "center" },
  h: { fontSize: 28, fontWeight: "700", letterSpacing: -0.8, marginBottom: 18 },
  search: { height: 46, borderRadius: 14, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 9 },
  input: { flex: 1, height: "100%", fontSize: 14 },
  label: { fontSize: 13, fontWeight: "600", marginTop: 24, marginBottom: 10 },
  recentHead: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "space-between", marginBottom: 8 },
  recentRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tagChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 },
  creatorAv: { width: 64, height: 64, borderRadius: 32, borderWidth: 3 },
  rank: { position: "absolute", right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  colorChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, height: 32 },
  colorDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1 },
  styleChip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, height: 32, alignItems: "center", justifyContent: "center" },
  globe: { marginTop: 14, marginHorizontal: -20, alignItems: "center" },
  cityHead: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18, marginBottom: 10 },
  clear: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
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
  tileTagText: { color: "#FFF", fontSize: 9, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 11 },
  avatar: { width: 54, height: 54, borderRadius: 27, marginRight: 12 },
  name: { flexDirection: "row", alignItems: "center", gap: 4 },
  user: { fontSize: 14, fontWeight: "600" },
  follow: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10, minWidth: 78, alignItems: "center" },
  empty: { alignItems: "center", justifyContent: "center", padding: 40, width: "100%" }
});
