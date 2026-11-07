import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from "react-native";
import { AppThemeProvider, useAppTheme } from "./src/context/AppTheme";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { Header } from "./src/components/Header";
import { Globe3D, GlobeMarker } from "./src/components/Globe3D";
import { GlobeLocationSearch, GlobeSearchSelection } from "./src/components/GlobeLocationSearch";
import { HomeFeed } from "./src/components/HomeFeed";
import { WardrobeView } from "./src/components/WardrobeView";
import { SearchProfilesView } from "./src/components/SearchProfilesView";
import { BottomNavLiquid } from "./src/components/BottomNavLiquid";
import { FeedPost, UserProfile, DirectThread, ClothingTag } from "./src/data/mockData";
import { MyProfileView, PublicProfileView, SettingsView, SimpleSettingsPage } from "./src/components/ProfileViews";
import { DirectView } from "./src/components/DirectView";
import { ActivityView } from "./src/components/ActivityView";
import { CreateHubView } from "./src/components/CreateHubView";
import { AuthScreen } from "./src/components/AuthScreen";
import {
  loadSavedPosts,
  savePosts,
  publishPost,
  findProfile,
  hasUnreadActivity,
  threadForProfile,
  unreadMessages,
  loadMorePosts,
  getCachedFeed,
  subscribeOffline
} from "./src/services/storage";
import { successFeedback } from "./src/utils/haptics";
import { shouldNotify } from "./src/services/settings";
import { getCurrentPlace, CurrentPlace } from "./src/services/location";
import { PostDetailView } from "./src/components/PostDetailView";
import { ChallengeCard } from "./src/components/ChallengeCard";
import { OnboardingView, onboardingDone, resetOnboarding } from "./src/components/OnboardingView";
import { FeedbackView } from "./src/components/FeedbackView";
import { ChallengeView } from "./src/components/ChallengeView";
import { FollowListView } from "./src/components/FollowListView";
import { fetchCityWeather, WeatherData } from "./src/services/weather";
import { requestNotificationPermissions, sendLocalNotification } from "./src/services/notifications";
import { getSavedAuthSession, signOut, handleAuthRedirect, deleteAccount } from "./src/services/auth";
import { parseProfileLink } from "./src/utils/profileLink";
import { FastStorage } from "./src/services/FastStorage";
import { supabase, isCloud } from "./src/services/supabase";
import { subscribeFeed, fetchPostCounts, subscribeMyAlerts, startPresence } from "./src/services/cloud";

type Screen =
  | { name: "direct"; thread?: DirectThread | null }
  | { name: "activity" }
  | { name: "publicProfile"; profile: UserProfile }
  | { name: "settings" }
  | { name: "settingsPage"; kind: string }
  | { name: "post"; postId: string }
  | { name: "challenge" }
  | { name: "follows"; profile: UserProfile; kind: "followers" | "following" };

function Guvio() {
  const { colors, dark } = useAppTheme();
  const scroll = useRef<ScrollView>(null);

  const [authenticated, setAuthenticated] = useState(false);
  const [booting, setBooting] = useState(true);
  // perfil aberto por link/QR (guvio://u/<username>), abre depois do login
  const [pendingProfile, setPendingProfile] = useState<string | null>(null);
  const openNameRef = useRef<((name: string) => void) | null>(null);
  const [tab, setTab] = useState("home");
  // pilha de telas abertas por cima das abas (voltar = tirar a de cima)
  const [stack, setStack] = useState<Screen[]>([]);
  const push = (sc: Screen) => setStack(prev => [...prev, sc]);
  const back = () => setStack(prev => prev.slice(0, -1));
  const top = stack[stack.length - 1];
  const [place, setPlace] = useState<CurrentPlace | null>(null);
  const [unreadDm, setUnreadDm] = useState(0);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [location, setLocation] = useState("Sua cidade");
  const [filterCity, setFilterCity] = useState<string | null>(null);
  const [filterCountry, setFilterCountry] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [unread, setUnread] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [globeTouching, setGlobeTouching] = useState(false);
  const [searchMarkerId, setSearchMarkerId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [offline, setOffline] = useState(false);
  const [newLooks, setNewLooks] = useState(0);
  const scrollY = useRef(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  // pedido de busca vindo de uma #hashtag
  const [searchRequest, setSearchRequest] = useState<{ text: string; id: number } | null>(null);
  // rascunho de post vindo do montador de looks
  const [draft, setDraft] = useState<{ images: string[]; tags: ClothingTag[]; caption: string; id: number } | null>(null);

  // pontos do globo: cidades onde há looks com localização
  const globeMarkers = useMemo<GlobeMarker[]>(() => {
    const byCity = new Map<string, GlobeMarker & { sumLat: number; sumLon: number }>();
    for (const p of posts) {
      if (typeof p.lat !== "number" || typeof p.lng !== "number" || !p.city) continue;
      const key = `${p.city.toLowerCase()}|${(p.country || "").toLowerCase()}`;
      const cur = byCity.get(key);
      if (cur) {
        cur.count += 1;
        cur.sumLat += p.lat;
        cur.sumLon += p.lng;
      } else {
        byCity.set(key, { id: key, city: p.city, country: p.country || "", lat: p.lat, lon: p.lng, count: 1, sumLat: p.lat, sumLon: p.lng });
      }
    }
    return Array.from(byCity.values()).map(m => ({
      id: m.id,
      city: m.city,
      country: m.country,
      count: m.count,
      lat: m.sumLat / m.count,
      lon: m.sumLon / m.count
    }));
  }, [posts]);

  const searchMarker = globeMarkers.find(m => m.id === searchMarkerId) || null;

  /** limpa o filtro de cidade/país do feed e volta para a sua localização */
  const clearGlobeSelection = () => {
    setFilterCity(null);
    setFilterCountry(null);
    if (place) {
      if (place.city) setLocation([place.city, place.region || place.country].filter(Boolean).join(", "));
      fetchCityWeather(place.lat, place.lng).then(setWeather);
    }
  };

  // Inicialização: cache local, clima, sessão salva e retorno de login (Google/Apple/e-mail)
  useEffect(() => {
    FastStorage.init().then(async () => {
      const initialUrl = await Linking.getInitialURL().catch(() => null);
      await handleAuthRedirect(initialUrl).catch(() => false);
      const linkedUser = parseProfileLink(initialUrl);
      if (linkedUser) setPendingProfile(linkedUser);
      const session = await getSavedAuthSession();
      setAuthenticated(Boolean(session));
      setBooting(false);
    });

    requestNotificationPermissions();
    fetchCityWeather(41.5388, -8.6151).then(setWeather);

    const linkSub = Linking.addEventListener("url", ({ url }) => {
      const linkedUser = parseProfileLink(url);
      if (linkedUser) {
        setPendingProfile(linkedUser);
        return;
      }
      handleAuthRedirect(url).then(ok => ok && setAuthenticated(true));
    });
    const authSub = supabase?.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) setAuthenticated(true);
      if (event === "SIGNED_OUT") setAuthenticated(false);
    });

    return () => {
      linkSub.remove();
      authSub?.data.subscription.unsubscribe();
    };
  }, []);

  // Depois do login: carrega o feed e liga o tempo real
  useEffect(() => {
    if (!authenticated) return;
    if (!onboardingDone()) setShowOnboarding(true);
    const stopOffline = subscribeOffline(setOffline);
    let stop: (() => void) | undefined;
    let stopAlerts: (() => void) | undefined;
    let stopPresence: (() => void) | undefined;
    // abre na hora com o último feed salvo no aparelho; depois atualiza pela internet
    const cached = getCachedFeed();
    if (cached.length) setPosts(prev => (prev.length ? prev : cached));
    loadSavedPosts().then(setPosts);
    hasUnreadActivity().then(setUnread);
    unreadMessages().then(setUnreadDm);
    getCurrentPlace().then(pl => {
      if (!pl) return;
      setPlace(pl);
      if (pl.city) setLocation([pl.city, pl.region || pl.country].filter(Boolean).join(", "));
      fetchCityWeather(pl.lat, pl.lng).then(setWeather);
    });

    isCloud().then(cloud => {
      if (!cloud) return;
      stopPresence = startPresence();
      const refreshCounts = (postId: string) => {
        fetchPostCounts(postId).then(c => {
          if (!c) return;
          setPosts(prev =>
            prev.map(p => (p.id === postId ? { ...p, likes: c.likes, commentsCount: c.comments } : p))
          );
        });
      };
      stopAlerts = subscribeMyAlerts((title, body, kind, type) => {
        if (kind === "activity") setUnread(true);
        else setUnreadDm(n => n + 1);
        // respeita o que a pessoa escolheu receber em Configurações › Notificações
        const pref =
          kind === "message"
            ? "message"
            : type === "like" || type === "comment_like"
            ? "like"
            : type === "comment" || type === "reply"
            ? "comment"
            : "follow";
        if (shouldNotify(pref)) sendLocalNotification(title, body);
      });
      stop = subscribeFeed({
        onNewPost: newPost => {
          setPosts(prev => (prev.some(p => p.id === newPost.id) ? prev : [newPost, ...prev]));
          // se você está lá embaixo no feed, mostra o aviso em vez de pular a tela
          if (scrollY.current > 500) setNewLooks(n => n + 1);
        },
        onDeletedPost: id => setPosts(prev => prev.filter(p => p.id !== id)),
        onLikesChanged: refreshCounts,
        onCommentsChanged: id => {
          refreshCounts(id);
          hasUnreadActivity().then(setUnread);
        }
      });
    });
    return () => {
      stop?.();
      stopAlerts?.();
      stopPresence?.();
      stopOffline();
    };
  }, [authenticated]);

  const handleUpdatePosts = (action: React.SetStateAction<FeedPost[]>) => {
    setPosts(prev => {
      const updated = typeof action === "function" ? action(prev) : action;
      savePosts(updated);
      return updated;
    });
  };

  const handleSignOut = async () => {
    await signOut();
    setAuthenticated(false);
    setPosts([]);
    setStack([]);
    setTab("home");
  };

  const refreshFeed = async () => {
    setRefreshing(true);
    try {
      const fresh = await loadSavedPosts();
      setPosts(fresh);
      setHasMore(true);
      setRefreshKey(k => k + 1);
      hasUnreadActivity().then(setUnread);
      unreadMessages().then(setUnreadDm);
    } finally {
      setRefreshing(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || posts.length === 0) return;
    const oldest = posts[posts.length - 1]?.createdAt;
    if (!oldest) return;
    setLoadingMore(true);
    try {
      const more = await loadMorePosts(oldest);
      if (more.length === 0) setHasMore(false);
      else setPosts(prev => [...prev, ...more.filter(m => !prev.some(p => p.id === m.id))]);
    } finally {
      setLoadingMore(false);
    }
  };

  const openTag = (tag: string) => {
    setSearchRequest({ text: `#${tag}`, id: Date.now() });
    setStack([]);
    setTab("search");
  };

  const handlePublish = async (x: {
    image: string;
    images?: string[];
    clothingTags?: ClothingTag[];
    caption: string;
  }): Promise<boolean> => {
    if (publishing) return false;
    setPublishing(true);
    try {
      const p = await publishPost({
        image: x.image,
        images: x.images,
        clothingTags: x.clothingTags,
        caption: x.caption,
        city: place?.city || location.split(",")[0] || "",
        country: place?.country || filterCountry || "",
        styleTag: "Novo look",
        lat: place?.lat,
        lng: place?.lng
      });
      setPosts(prev => {
        const updated = prev.some(v => v.id === p.id) ? prev : [p, ...prev];
        savePosts(updated);
        return updated;
      });
      successFeedback();
      setDraft(null);
      sendLocalNotification(
        "Novo look publicado! ✨",
        `Seu look em ${p.city} já está visível para a comunidade Guvio.`
      );
      setTab("home");
      return true;
    } catch (e: any) {
      Alert.alert("Não foi possível publicar", e?.message || "Tente novamente.");
      return false;
    } finally {
      setPublishing(false);
    }
  };

  useEffect(() => {
    if (!pendingProfile || booting || !authenticated) return;
    const name = pendingProfile;
    // espera as telas montarem antes de abrir o perfil
    const t = setTimeout(() => {
      setPendingProfile(null);
      openNameRef.current?.(name);
    }, 300);
    return () => clearTimeout(t);
  }, [pendingProfile, booting, authenticated]);

  if (booting) return <View style={[s.safe, { backgroundColor: colors.bg }]} />;

  if (!authenticated) return <AuthScreen onAuthenticated={() => setAuthenticated(true)} />;
  if (showOnboarding)
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
        <OnboardingView onDone={() => setShowOnboarding(false)} />
      </SafeAreaView>
    );

  const search = (x: GlobeSearchSelection) => {
    setLocation(`${x.label}${x.subtitle ? `, ${x.subtitle}` : ""}`);

    if (x.type === "city") {
      setFilterCity(x.label);
      setFilterCountry(x.countryName || null);
    } else {
      setFilterCity(null);
      setFilterCountry(x.label);
    }

    fetchCityWeather(x.lat, x.lon).then(setWeather);
  };

  const openName = async (name: string) => {
    const cleanName = name.replace("@", "").toLowerCase();
    const found = await findProfile(name);
    if (!found && (await isCloud())) {
      Alert.alert("Perfil não encontrado", `Não encontramos @${cleanName}.`);
      return;
    }
    const p =
      found || {
        id: `p-${cleanName}`,
        username: cleanName,
        displayName: name,
        avatar: "",
        location: location || "Brasil",
        followers: 0,
        following: 0,
        bio: ""
      };
    push({ name: "publicProfile", profile: p });
  };

  openNameRef.current = openName;

  const openProfileObj = (p: UserProfile) => push({ name: "publicProfile", profile: p });
  const openPost = (postId: string) => push({ name: "post", postId });

  /** abre "Nova publicação" já com a #hashtag do desafio na legenda */
  const joinChallenge = (tag: string) => {
    setDraft({ images: [], tags: [], caption: `#${tag} `, id: Date.now() });
    setStack([]);
    setTab("add");
  };
  const openFollows = (p: UserProfile, kind: "followers" | "following") => push({ name: "follows", profile: p, kind });

  if (top) {
    let screen: React.ReactNode = null;
    switch (top.name) {
      case "direct":
        screen = (
          <DirectView
            onOpenPost={openPost}
            initialThread={top.thread || null}
            onBack={() => {
              back();
              unreadMessages().then(setUnreadDm);
            }}
            onOpenProfile={openName}
          />
        );
        break;
      case "activity":
        screen = <ActivityView onBack={back} onOpenProfile={openName} onOpenPost={openPost} />;
        break;
      case "publicProfile":
        screen = (
          <PublicProfileView
            profile={top.profile}
            onBack={back}
            onMessage={() => push({ name: "direct", thread: threadForProfile(top.profile) })}
            onOpenPost={openPost}
            onOpenFollows={kind => openFollows(top.profile, kind)}
          />
        );
        break;
      case "post":
        screen = (
          <PostDetailView
            postId={top.postId}
            onBack={back}
            onOpenProfile={openName}
            onOpenTag={openTag}
            onDeleted={id => {
              setPosts(prev => prev.filter(p => p.id !== id));
              back();
            }}
          />
        );
        break;
      case "follows":
        screen = (
          <FollowListView profile={top.profile} kind={top.kind} onBack={back} onOpenProfile={openProfileObj} />
        );
        break;
      case "settings":
        screen = (
          <SettingsView
            onBack={back}
            onOpen={x => {
              if (x === "tutorial") {
                resetOnboarding();
                setStack([]);
                setShowOnboarding(true);
                return;
              }
              push({ name: "settingsPage", kind: x });
            }}
            onSignOut={handleSignOut}
            onDeleteAccount={async () => {
              await deleteAccount();
              setAuthenticated(false);
              setPosts([]);
              setStack([]);
              setTab("home");
              Alert.alert("Conta apagada", "Sua conta e seus dados foram removidos do Guvio.");
            }}
          />
        );
        break;
      case "challenge":
        screen = <ChallengeView onBack={back} onJoin={joinChallenge} onOpenPost={openPost} />;
        break;
      case "settingsPage":
        screen =
          top.kind === "feedback" ? (
            <FeedbackView onBack={back} />
          ) : (
            <SimpleSettingsPage kind={top.kind} onBack={back} onOpenPost={openPost} />
          );
        break;
    }
    return <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>{screen}</SafeAreaView>;
  }

  const weatherText = weather ? `${weather.condition} ${weather.temperature}°C` : undefined;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} backgroundColor={colors.bg} />
      {offline ? (
        <Pressable onPress={refreshFeed} style={[s.offline, { backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
            Sem conexão · mostrando looks salvos no aparelho. <Text style={{ color: "#0095F6" }}>Tentar de novo</Text>
          </Text>
        </Pressable>
      ) : null}
      {tab === "home" ? (
        <ScrollView
          ref={scroll}
          style={{ flex: 1, backgroundColor: colors.bg }}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshFeed} tintColor={colors.muted} />}
          scrollEventThrottle={200}
          onScroll={e => {
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
            scrollY.current = contentOffset.y;
            if (contentOffset.y < 200 && newLooks) setNewLooks(0);
            if (layoutMeasurement.height + contentOffset.y > contentSize.height - 900) loadMore();
          }}
        >
          <View style={{ backgroundColor: colors.bg }}>
            <Header
              locationText={location}
              weatherText={weatherText}
              onOpenDirect={() => push({ name: "direct" })}
              onOpenActivity={() => {
                setUnread(false);
                push({ name: "activity" });
              }}
              hasUnreadActivity={unread}
              unreadMessages={unreadDm}
            />
            <GlobeLocationSearch onSelect={search} />
          </View>
          <HomeFeed
            posts={posts}
            setPosts={handleUpdatePosts}
            countryFilter={filterCountry}
            cityFilter={filterCity}
            onClearFilter={clearGlobeSelection}
            onAssembleWithWardrobe={() => setTab("wardrobe")}
            onOpenProfile={openName}
            onOpenTag={openTag}
            refreshKey={refreshKey}
            belowStories={<ChallengeCard onJoin={joinChallenge} onOpenRanking={() => push({ name: "challenge" })} />}
          />
          {loadingMore ? <ActivityIndicator color={colors.muted} style={{ marginVertical: 24 }} /> : null}
          {!hasMore && posts.length > 0 ? (
            <Text style={{ color: colors.muted, textAlign: "center", fontSize: 12, marginVertical: 24 }}>
              Você viu todos os looks ✨
            </Text>
          ) : null}
          <View style={{ height: 110 }} />
        </ScrollView>
      ) : null}
      {tab === "home" && newLooks > 0 ? (
        <Pressable
          onPress={() => {
            scroll.current?.scrollTo({ y: 0, animated: true });
            setNewLooks(0);
          }}
          style={s.newPill}
        >
          <Text style={{ color: "#FFF", fontWeight: "900", fontSize: 13 }}>
            ↑ {newLooks === 1 ? "1 novo look" : `${newLooks} novos looks`}
          </Text>
        </Pressable>
      ) : null}
      {tab === "home" ? null : tab === "wardrobe" ? (
        <WardrobeView
          onAdd={() => setTab("add")}
          currentWeather={weather}
          onPublishOutfit={(images, tags, name) => {
            setDraft({ images, tags, caption: name, id: Date.now() });
            setTab("add");
          }}
        />
      ) : tab === "search" ? (
        <SearchProfilesView
          onOpenProfile={openProfileObj}
          onOpenPost={openPost}
          scrollEnabled={!globeTouching}
          searchRequest={searchRequest}
          globe={
            <Globe3D
              markers={globeMarkers}
              origin={place ? { lat: place.lat, lon: place.lng } : null}
              selectedId={searchMarkerId}
              onSelectMarker={m => setSearchMarkerId(m.id)}
              onClearSelection={() => setSearchMarkerId(null)}
              onInteractionChange={setGlobeTouching}
            />
          }
          cityFocus={
            searchMarker
              ? {
                  title: [searchMarker.city, searchMarker.country].filter(Boolean).join(", "),
                  city: searchMarker.city,
                  posts: posts.filter(
                    p => p.city === searchMarker.city && (p.country || "") === (searchMarker.country || "")
                  )
                }
              : null
          }
          onClearCityFocus={() => setSearchMarkerId(null)}
        />
      ) : tab === "profile" ? (
        <MyProfileView
          onSettings={() => push({ name: "settings" })}
          postsVersion={posts.length}
          onOpenPost={openPost}
          onOpenFollows={openFollows}
        />
      ) : (
        <CreateHubView
          onWardrobe={() => setTab("wardrobe")}
          publishing={publishing}
          onPublish={handlePublish}
          draft={draft}
        />
      )}
      <BottomNavLiquid activeTab={tab} onTabChange={setTab} />
    </SafeAreaView>
  );
}

// Erros de JavaScript fora da tela (timers, rede) não fecham mais o app:
// mostram um aviso com a mensagem, para sabermos o que aconteceu.
const errorUtils = (global as any).ErrorUtils;
if (errorUtils && !__DEV__) {
  const previous = errorUtils.getGlobalHandler?.();
  let lastShown = 0;
  errorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    const now = Date.now();
    if (now - lastShown > 4000) {
      lastShown = now;
      try {
        Alert.alert(
          "Ops, algo deu errado",
          `${String(error?.message || error).slice(0, 300)}\n\nMande um print desta mensagem para corrigirmos.`
        );
      } catch (e) {}
    }
    if (!isFatal) previous?.(error, isFatal);
  });
}

export default function App() {
  return (
    <AppThemeProvider>
      <ErrorBoundary>
        <Guvio />
      </ErrorBoundary>
    </AppThemeProvider>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  offline: { paddingHorizontal: 16, paddingVertical: 8, alignItems: "center" },
  newPill: {
    position: "absolute",
    top: 70,
    alignSelf: "center",
    backgroundColor: "#0095F6",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    zIndex: 50,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6
  },
  first: { width: "100%", justifyContent: "space-between", alignItems: "center", paddingBottom: 16 }
});
