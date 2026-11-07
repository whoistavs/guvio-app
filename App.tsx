import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Dimensions, Linking, SafeAreaView, ScrollView, StatusBar, StyleSheet, View } from "react-native";
import { AppThemeProvider, useAppTheme } from "./src/context/AppTheme";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { Header } from "./src/components/Header";
import { Globe3D, GlobeFocusTarget, GlobeMarker } from "./src/components/Globe3D";
import { GlobeLocationSearch, GlobeSearchSelection } from "./src/components/GlobeLocationSearch";
import { ScrollIndicator } from "./src/components/ScrollIndicator";
import { HomeFeed } from "./src/components/HomeFeed";
import { WardrobeView } from "./src/components/WardrobeView";
import { SearchProfilesView } from "./src/components/SearchProfilesView";
import { BottomNavLiquid } from "./src/components/BottomNavLiquid";
import { FeedPost, UserProfile, DirectThread } from "./src/data/mockData";
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
  unreadMessages
} from "./src/services/storage";
import { getCurrentPlace, CurrentPlace } from "./src/services/location";
import { PostDetailView } from "./src/components/PostDetailView";
import { FollowListView } from "./src/components/FollowListView";
import { fetchCityWeather, WeatherData } from "./src/services/weather";
import { requestNotificationPermissions, sendLocalNotification } from "./src/services/notifications";
import { getSavedAuthSession, signOut, handleAuthRedirect, deleteAccount } from "./src/services/auth";
import { FastStorage } from "./src/services/FastStorage";
import { supabase, isCloud } from "./src/services/supabase";
import { subscribeFeed, fetchPostCounts, subscribeMyAlerts } from "./src/services/cloud";

type Screen =
  | { name: "direct"; thread?: DirectThread | null }
  | { name: "activity" }
  | { name: "publicProfile"; profile: UserProfile }
  | { name: "settings" }
  | { name: "settingsPage"; kind: string }
  | { name: "post"; postId: string }
  | { name: "follows"; profile: UserProfile; kind: "followers" | "following" };

function Guvio() {
  const { colors, dark } = useAppTheme();
  const scroll = useRef<ScrollView>(null);
  const h = Dimensions.get("window").height;

  const [authenticated, setAuthenticated] = useState(false);
  const [booting, setBooting] = useState(true);
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
  const [focus, setFocus] = useState<GlobeFocusTarget | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [unread, setUnread] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [globeTouching, setGlobeTouching] = useState(false);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);

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

  const selectGlobeMarker = (m: GlobeMarker) => {
    setSelectedMarkerId(m.id);
    setFilterCity(m.city);
    setFilterCountry(m.country || null);
    setLocation([m.city, m.country].filter(Boolean).join(", "));
    fetchCityWeather(m.lat, m.lon).then(setWeather);
  };

  const clearGlobeSelection = () => {
    setSelectedMarkerId(null);
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
      const session = await getSavedAuthSession();
      setAuthenticated(Boolean(session));
      setBooting(false);
    });

    requestNotificationPermissions();
    fetchCityWeather(41.5388, -8.6151).then(setWeather);

    const linkSub = Linking.addEventListener("url", ({ url }) => {
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
    let stop: (() => void) | undefined;
    let stopAlerts: (() => void) | undefined;
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
      const refreshCounts = (postId: string) => {
        fetchPostCounts(postId).then(c => {
          if (!c) return;
          setPosts(prev =>
            prev.map(p => (p.id === postId ? { ...p, likes: c.likes, commentsCount: c.comments } : p))
          );
        });
      };
      stopAlerts = subscribeMyAlerts((title, body, kind) => {
        sendLocalNotification(title, body);
        if (kind === "activity") setUnread(true);
        else setUnreadDm(n => n + 1);
      });
      stop = subscribeFeed({
        onNewPost: newPost =>
          setPosts(prev => (prev.some(p => p.id === newPost.id) ? prev : [newPost, ...prev])),
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

  const handlePublish = async (x: { image: string; caption: string }): Promise<boolean> => {
    if (publishing) return false;
    setPublishing(true);
    try {
      const p = await publishPost({
        image: x.image,
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

  if (booting) return <View style={[s.safe, { backgroundColor: colors.bg }]} />;

  if (!authenticated) return <AuthScreen onAuthenticated={() => setAuthenticated(true)} />;

  const search = (x: GlobeSearchSelection) => {
    setSelectedMarkerId(null);
    setLocation(`${x.label}${x.subtitle ? `, ${x.subtitle}` : ""}`);
    setFocus({ id: `${x.label}-${Date.now()}`, lat: x.lat, lon: x.lon });

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

  const openProfileObj = (p: UserProfile) => push({ name: "publicProfile", profile: p });
  const openPost = (postId: string) => push({ name: "post", postId });
  const openFollows = (p: UserProfile, kind: "followers" | "following") => push({ name: "follows", profile: p, kind });

  if (top) {
    let screen: React.ReactNode = null;
    switch (top.name) {
      case "direct":
        screen = (
          <DirectView
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
            onOpen={x => push({ name: "settingsPage", kind: x })}
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
      case "settingsPage":
        screen = <SimpleSettingsPage kind={top.kind} onBack={back} onOpenPost={openPost} />;
        break;
    }
    return <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>{screen}</SafeAreaView>;
  }

  const weatherText = weather ? `${weather.condition} ${weather.temperature}°C` : undefined;

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} backgroundColor={colors.bg} />
      {tab === "home" ? (
        <ScrollView
          ref={scroll}
          style={{ flex: 1, backgroundColor: colors.bg }}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!globeTouching}
        >
          <View style={[s.first, { minHeight: h - 40, backgroundColor: colors.bg }]}>
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
            <View style={s.globeContainer}>
              <Globe3D
                markers={globeMarkers}
                origin={place ? { lat: place.lat, lon: place.lng } : null}
                selectedId={selectedMarkerId}
                onSelectMarker={selectGlobeMarker}
                onClearSelection={clearGlobeSelection}
                focusTarget={focus}
                onInteractionChange={setGlobeTouching}
              />
            </View>
            <ScrollIndicator onPress={() => scroll.current?.scrollTo({ y: h - 60, animated: true })} />
          </View>
          <HomeFeed
            posts={posts}
            setPosts={handleUpdatePosts}
            countryFilter={filterCountry}
            cityFilter={filterCity}
            onAssembleWithWardrobe={() => setTab("wardrobe")}
            onOpenProfile={openName}
          />
        </ScrollView>
      ) : tab === "wardrobe" ? (
        <WardrobeView onAdd={() => setTab("add")} currentWeather={weather} />
      ) : tab === "search" ? (
        <SearchProfilesView onOpenProfile={openProfileObj} onOpenPost={openPost} />
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
  first: { width: "100%", justifyContent: "space-between", alignItems: "center", paddingBottom: 16 },
  globeContainer: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center", marginVertical: 8 }
});
