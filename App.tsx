import React, { useEffect, useRef, useState } from "react";
import { Dimensions, SafeAreaView, ScrollView, StatusBar, StyleSheet, View } from "react-native";
import { AppThemeProvider, useAppTheme } from "./src/context/AppTheme";
import { Header } from "./src/components/Header";
import { Globe3D, GlobeFocusTarget } from "./src/components/Globe3D";
import { GlobeLocationSearch, GlobeSearchSelection } from "./src/components/GlobeLocationSearch";
import { ScrollIndicator } from "./src/components/ScrollIndicator";
import { HomeFeed } from "./src/components/HomeFeed";
import { WardrobeView } from "./src/components/WardrobeView";
import { SearchProfilesView } from "./src/components/SearchProfilesView";
import { BottomNavLiquid } from "./src/components/BottomNavLiquid";
import { MOCK_FEED_POSTS, MOCK_PROFILES, FeedPost, UserProfile } from "./src/data/mockData";
import { MyProfileView, PublicProfileView, SettingsView, SimpleSettingsPage } from "./src/components/ProfileViews";
import { DirectView } from "./src/components/DirectView";
import { ActivityView } from "./src/components/ActivityView";
import { CreateHubView } from "./src/components/CreateHubView";
import { AuthScreen } from "./src/components/AuthScreen";
import { loadSavedPosts, savePosts, loadAllRegisteredProfiles } from "./src/services/storage";
import { fetchCityWeather, WeatherData } from "./src/services/weather";
import { requestNotificationPermissions, sendLocalNotification } from "./src/services/notifications";
import { syncPostToCloud } from "./src/services/supabaseSync";
import { getSavedAuthSession, signOut } from "./src/services/auth";
import { FastStorage } from "./src/services/FastStorage";
import { RealtimeSync } from "./src/services/realtimeSync";

type Route = "tabs" | "direct" | "activity" | "publicProfile" | "settings" | "settingsPage";

function Guvio() {
  const { colors, dark } = useAppTheme();
  const scroll = useRef<ScrollView>(null);
  const h = Dimensions.get("window").height;

  const [authenticated, setAuthenticated] = useState(false);
  const [tab, setTab] = useState("home");
  const [route, setRoute] = useState<Route>("tabs");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settingsPage, setSettingsPage] = useState("saved");
  const [posts, setPosts] = useState<FeedPost[]>(MOCK_FEED_POSTS);
  const [location, setLocation] = useState("Campinas, SP");
  const [filterCity, setFilterCity] = useState<string | null>(null);
  const [filterCountry, setFilterCountry] = useState<string | null>(null);
  const [focus, setFocus] = useState<GlobeFocusTarget | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    FastStorage.init().then(() => {
      loadSavedPosts().then(setPosts);
    });

    requestNotificationPermissions();
    fetchCityWeather(-22.9056, -47.0608).then(setWeather);

    // Check saved login session
    getSavedAuthSession().then(session => {
      if (session) {
        setAuthenticated(true);
      }
    });

    // Iniciar canal em tempo real do Feed Social do Supabase
    RealtimeSync.startSocialFeedChannel(
      newPost => {
        setPosts(prev => {
          if (prev.some(p => p.id === newPost.id)) return prev;
          const updated = [newPost, ...prev];
          savePosts(updated);
          return updated;
        });
      },
      (postId, newLikes) => {
        setPosts(prev =>
          prev.map(p => (p.id === postId ? { ...p, likes: newLikes } : p))
        );
      }
    );

    return () => {
      RealtimeSync.stop();
    };
  }, []);

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
    setRoute("tabs");
  };

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
    const allRegistered = await loadAllRegisteredProfiles();
    const p =
      allRegistered.find(
        x =>
          x.displayName.toLowerCase() === cleanName ||
          x.username.toLowerCase() === cleanName ||
          x.id === cleanName
      ) || {
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
        <DirectView onBack={() => setRoute("tabs")} />
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
          onMessage={() => setRoute("direct")}
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
              onOpenActivity={() => setRoute("activity")}
              hasUnreadActivity={true}
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
        <MyProfileView onSettings={() => setRoute("settings")} />
      ) : (
        <CreateHubView
          onWardrobe={() => setTab("wardrobe")}
          onPublish={x => {
            const p: FeedPost = {
              id: `post-${Date.now()}`,
              creatorName: "Você",
              creatorAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200",
              city: filterCity || "Campinas",
              country: filterCountry || "Brasil",
              styleTag: "Novo look",
              image: x.image,
              caption: x.caption,
              likes: 0,
              commentsCount: 0,
              timeAgo: "agora",
              isLiked: false,
              isSaved: false
            };
            handleUpdatePosts(v => [p, ...v]);
            syncPostToCloud(p);
            sendLocalNotification(
              "Novo look publicado! ✨",
              `Seu look em ${p.city} já está visível para a comunidade Guvio.`
            );
            setTab("home");
          }}
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
