import React, { useEffect, useRef, useState } from "react";
import { Alert, Dimensions, Linking, SafeAreaView, ScrollView, StatusBar, StyleSheet, View } from "react-native";
import { AppThemeProvider, useAppTheme } from "./src/context/AppTheme";
import { Header } from "./src/components/Header";
import { Globe3D, GlobeFocusTarget } from "./src/components/Globe3D";
import { GlobeLocationSearch, GlobeSearchSelection } from "./src/components/GlobeLocationSearch";
import { ScrollIndicator } from "./src/components/ScrollIndicator";
import { HomeFeed } from "./src/components/HomeFeed";
import { WardrobeView } from "./src/components/WardrobeView";
import { SearchProfilesView } from "./src/components/SearchProfilesView";
import { BottomNavLiquid } from "./src/components/BottomNavLiquid";
import { MOCK_FEED_POSTS, FeedPost, UserProfile, DirectThread } from "./src/data/mockData";
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
  threadForProfile
} from "./src/services/storage";
import { fetchCityWeather, WeatherData } from "./src/services/weather";
import { requestNotificationPermissions, sendLocalNotification } from "./src/services/notifications";
import { getSavedAuthSession, signOut, handleAuthRedirect, deleteAccount } from "./src/services/auth";
import { FastStorage } from "./src/services/FastStorage";
import { supabase, isCloud } from "./src/services/supabase";
import { subscribeFeed, fetchPostCounts, subscribeMyAlerts } from "./src/services/cloud";

type Route = "tabs" | "direct" | "activity" | "publicProfile" | "settings" | "settingsPage";

function Guvio() {
  const { colors, dark } = useAppTheme();
  const scroll = useRef<ScrollView>(null);
  const h = Dimensions.get("window").height;

  const [authenticated, setAuthenticated] = useState(false);
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState("home");
  const [route, setRoute] = useState<Route>("tabs");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [directTarget, setDirectTarget] = useState<DirectThread | null>(null);
  const [settingsPage, setSettingsPage] = useState("saved");
  const [posts, setPosts] = useState<FeedPost[]>(MOCK_FEED_POSTS);
  const [location, setLocation] = useState("Campinas, SP");
  const [filterCity, setFilterCity] = useState<string | null>(null);
  const [filterCountry, setFilterCountry] = useState<string | null>(null);
  const [focus, setFocus] = useState<GlobeFocusTarget | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [unread, setUnread] = useState(false);
  const [publishing, setPublishing] = useState(false);

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
    fetchCityWeather(-22.9056, -47.0608).then(setWeather);

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
    setRoute("tabs");
    setTab("home");
  };

  const handlePublish = async (x: { image: string; caption: string }): Promise<boolean> => {
    if (publishing) return false;
    setPublishing(true);
    try {
      const p = await publishPost({
        image: x.image,
        caption: x.caption,
        city: filterCity || location.split(",")[0] || "Campinas",
        country: filterCountry || "Brasil",
        styleTag: "Novo look"
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
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300",
        location: location || "Brasil",
        followers: 0,
        following: 0,
        bio: `Criador(a) de estilo explorando tendências de moda no Guvio.`
      };
    setProfile(p);
    setRoute("publicProfile");
  };

  if (route === "direct")
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
        <DirectView
          initialThread={directTarget}
          onBack={() => {
            setDirectTarget(null);
            setRoute("tabs");
          }}
        />
      </SafeAreaView>
    );

  if (route === "activity")
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
        <ActivityView
          onBack={() => setRoute("tabs")}
          onOpenProfile={openName}
        />
      </SafeAreaView>
    );

  if (route === "publicProfile" && profile)
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
        <PublicProfileView
          profile={profile}
          onBack={() => setRoute("tabs")}
          onMessage={() => {
            setDirectTarget(threadForProfile(profile));
            setRoute("direct");
          }}
        />
      </SafeAreaView>
    );

  if (route === "settings")
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
        <SettingsView
          onBack={() => setRoute("tabs")}
          onOpen={x => {
            setSettingsPage(x);
            setRoute("settingsPage");
          }}
          onSignOut={handleSignOut}
          onDeleteAccount={async () => {
            await deleteAccount();
            setAuthenticated(false);
            setPosts([]);
            setRoute("tabs");
            setTab("home");
            Alert.alert("Conta apagada", "Sua conta e seus dados foram removidos do Guvio.");
          }}
        />
      </SafeAreaView>
    );

  if (route === "settingsPage")
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
        <SimpleSettingsPage kind={settingsPage} onBack={() => setRoute("settings")} />
      </SafeAreaView>
    );

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
        >
          <View style={[s.first, { minHeight: h - 40, backgroundColor: colors.bg }]}>
            <Header
              locationText={location}
              weatherText={weatherText}
              onOpenDirect={() => setRoute("direct")}
              onOpenActivity={() => {
                setUnread(false);
                setRoute("activity");
              }}
              hasUnreadActivity={unread}
            />
            <GlobeLocationSearch onSelect={search} />
            <View style={s.globeContainer}>
              <Globe3D
                selectedCountry={null}
                onSelectCountry={c =>
                  search({ type: "country", label: c.name, lat: c.lat, lon: c.lon })
                }
                focusTarget={focus}
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
        <SearchProfilesView
          onOpenProfile={p => {
            setProfile(p);
            setRoute("publicProfile");
          }}
        />
      ) : tab === "profile" ? (
        <MyProfileView onSettings={() => setRoute("settings")} postsVersion={posts.length} />
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

export default function App() {
  return (
    <AppThemeProvider>
      <Guvio />
    </AppThemeProvider>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  first: { width: "100%", justifyContent: "space-between", alignItems: "center", paddingBottom: 16 },
  globeContainer: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center", marginVertical: 8 }
});
