import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Dimensions,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View
} from "react-native";
import { AppThemeProvider, useAppTheme } from "./src/context/AppTheme";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { UpdateBanner } from "./src/components/UpdateBanner";
import { InstallPrompt } from "./src/components/InstallPrompt";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebAlertHost, installWebAlert } from "./src/components/WebAlertHost";

installWebAlert();
import { Header } from "./src/components/Header";
import { Globe3D, GlobeMarker } from "./src/components/Globe3D";
import { GlobeLocationSearch, GlobeSearchSelection } from "./src/components/GlobeLocationSearch";
import { HomeFeed } from "./src/components/HomeFeed";
import { WardrobeView } from "./src/components/WardrobeView";
import { SearchProfilesView } from "./src/components/SearchProfilesView";
import { BottomNavLiquid } from "./src/components/BottomNavLiquid";
import { FeedPost, UserProfile, DirectThread, ClothingTag } from "./src/data/mockData";
import { MyProfileView, PublicProfileView, SimpleSettingsPage } from "./src/components/ProfileViews";
import { SettingsView } from "./src/components/SettingsHome";
import { DevToolsView } from "./src/components/DevToolsView";
import { DirectView } from "./src/components/DirectView";
import { ActivityView } from "./src/components/ActivityView";
import { CreateHubView } from "./src/components/CreateHubView";
import { AuthScreen, NewPasswordModal } from "./src/components/AuthScreen";
import { RecoverHost } from "./src/components/RecoverFlow";
import {
  loadSavedPosts,
  savePosts,
  publishPost,
  findProfile,
  hasUnreadActivity,
  markActivitySeen,
  threadForProfile,
  unreadMessages,
  loadMorePosts,
  getCachedFeed,
  subscribeOffline,
  loadSavedProfile
} from "./src/services/storage";
import { successFeedback, tapFeedback } from "./src/utils/haptics";
import { FadeIn, SlideInScreen, ToastHost, toast } from "./src/components/motion";
import { shouldNotify } from "./src/services/settings";
import { startUsageTracking } from "./src/services/usage";
import { getCurrentPlace, CurrentPlace, lastLocationError } from "./src/services/location";
import { PostDetailView } from "./src/components/PostDetailView";
import { ChallengeCard } from "./src/components/ChallengeCard";
import { OnboardingView, onboardingDone, resetOnboarding } from "./src/components/OnboardingView";
import { FeedbackView } from "./src/components/FeedbackView";
import { AdminView } from "./src/components/AdminView";
import { PostListView } from "./src/components/PostListView";
import { InspireLookModal, setInspireOpener } from "./src/components/InspireLookModal";
import { CameraHost, CameraResult, openCamera } from "./src/components/camera/GuvioCamera";
import { CreateSheet, CreateChoice } from "./src/components/camera/CreateSheet";
import { StoryEditorHost } from "./src/components/story/StoryEditor";
import { openNewHighlight } from "./src/components/HighlightsRow";
import { AccountSwitcherHost, setAppRestarter } from "./src/components/AccountSwitcher";
import { IntroSplash, markAppReady } from "./src/components/IntroSplash";
import { BETA, isDevMode, setDevMode, startDevLogCapture, useDevMode } from "./src/services/devMode";
import { currentUserId, forgetAccount, rememberCurrentAccount, updateStoredToken } from "./src/services/accounts";
import { PushPrompt } from "./src/components/PushPrompt";
import { forgetPushDevice, refreshPushRegistration } from "./src/services/push";
import { ChallengeView } from "./src/components/ChallengeView";
import { FollowListView } from "./src/components/FollowListView";
import { fetchCityWeather, WeatherData } from "./src/services/weather";
import { requestNotificationPermissions, sendLocalNotification } from "./src/services/notifications";
import { getSavedAuthSession, signOut, handleAuthRedirect, deleteAccount, recoverFlowActive } from "./src/services/auth";
import { parseInviteLink, parsePostLink, parseProfileLink } from "./src/utils/profileLink";
import { BetaWelcome } from "./src/components/BetaWelcome";
import { EdgeSwipe, PeekHost, PinchHost } from "./src/components/gestures";
import { shareInvite } from "./src/components/invite";
import { FastStorage } from "./src/services/FastStorage";
import { supabase, isCloud, openedFromRecoveryLink } from "./src/services/supabase";
import { subscribeFeed, fetchPostCounts, subscribeMyAlerts, startPresence, fixMyPlaceholderCity } from "./src/services/cloud";

type Screen =
  | { name: "direct"; thread?: DirectThread | null }
  | { name: "activity" }
  | { name: "publicProfile"; profile: UserProfile }
  | { name: "settings" }
  | { name: "settingsPage"; kind: string }
  | { name: "post"; postId: string }
  | { name: "postList"; posts: FeedPost[]; startId: string; title?: string }
  | { name: "challenge" }
  | { name: "follows"; profile: UserProfile; kind: "followers" | "following" };

function Guvio() {
  const { colors, dark } = useAppTheme();
  const scroll = useRef<ScrollView>(null);

  const [authenticated, setAuthenticated] = useState(false);
  const [booting, setBooting] = useState(true);
  // perfil aberto por link/QR (guvio://u/<username>), abre depois do login
  const [pendingProfile, setPendingProfile] = useState<string | null>(null);
  const [pendingPost, setPendingPost] = useState<string | null>(null);
  // convite (?convite=usuario): guarda até a pessoa criar a conta e depois abre o perfil de quem convidou
  const [inviter, setInviter] = useState<string | null>(() => FastStorage.getItemSync<string | null>("guvio_invite_v1", null));
  const takeInvite = (url?: string | null) => {
    const who = parseInviteLink(url);
    if (!who) return false;
    FastStorage.setItemSync("guvio_invite_v1", who);
    setInviter(who);
    setPendingProfile(who);
    return true;
  };
  const openNameRef = useRef<((name: string) => void) | null>(null);
  const openPostRef = useRef<((id: string) => void) | null>(null);
  const myProfileRef = useRef<UserProfile | null>(null);
  useEffect(() => {
    myProfileRef.current = null;
  }, [authenticated]);
  const [tab, setTab] = useState("home");
  // pilha de telas abertas por cima das abas (voltar = tirar a de cima)
  const [stack, setStack] = useState<Screen[]>([]);
  // sentido da animação: avançar entra pela direita, voltar entra pela esquerda
  const goingBack = useRef(false);
  const push = (sc: Screen) => {
    goingBack.current = false;
    setStack(prev => [...prev, sc]);
  };
  const back = () => {
    goingBack.current = true;
    setStack(prev => prev.slice(0, -1));
  };
  const top = stack[stack.length - 1];
  // botão "voltar" do Android: fecha a tela de cima; depois volta para a Home; só então sai do app
  useEffect(() => {
    startUsageTracking();
    startDevLogCapture();
  }, []);
  const devFlags = useDevMode();
  // abertura com o logo: sai quando já sabemos se a pessoa está logada
  useEffect(() => {
    if (!booting) markAppReady();
  }, [booting]);
  // Android: tocar no aviso (curtida, comentário...) abre o look direto no app
  useEffect(() => {
    if (Platform.OS !== "android") return;
    let sub: { remove: () => void } | null = null;
    import("expo-notifications")
      .then(N => {
        const open = (r: any) => {
          const url = r?.notification?.request?.content?.data?.url;
          const id = typeof url === "string" && !url.endsWith(".apk") ? parsePostLink(url) : null;
          if (id) setPendingPost(id);
        };
        N.getLastNotificationResponseAsync().then(open).catch(() => {});
        sub = N.addNotificationResponseReceivedListener(open);
      })
      .catch(() => {});
    return () => sub?.remove();
  }, []);
  const backNavRef = useRef<() => boolean>(() => false);
  backNavRef.current = () => {
    if (stack.length) {
      back();
      return true;
    }
    if (tab !== "home") {
      setTab("home");
      return true;
    }
    return false;
  };
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => backNavRef.current());
    return () => sub.remove();
  }, []);
  const [place, setPlace] = useState<CurrentPlace | null>(null);
  const [unreadDm, setUnreadDm] = useState(0);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [location, setLocation] = useState("Sua cidade");
  const [recovery, setRecovery] = useState(false);
  // "Montar parecido": look do feed usado como inspiração
  const [inspirePost, setInspirePost] = useState<FeedPost | null>(null);
  useEffect(() => setInspireOpener(setInspirePost), []);
  const applyPlaceRef = useRef<(force: boolean, explain?: boolean) => void>(() => {});
  applyPlaceRef.current = (force, explain) => {
    getCurrentPlace(force).then(pl => {
      if (!pl) {
        if (!explain) return;
        const err = lastLocationError();
        const iosWeb = Platform.OS === "web" && typeof navigator !== "undefined" && /iPhone|iPad/.test(navigator.userAgent);
        Alert.alert(
          "Localização desativada",
          err === "denied"
            ? iosWeb
              ? "Libere no iPhone:\n1. Ajustes > Privacidade e Segurança > Serviços de Localização: ativado.\n2. Na mesma tela, Sites do Safari > Ao Usar o App.\n3. Volte ao GUVIO e toque na cidade de novo."
              : "Libere a localização para este site/app nas configurações e toque na cidade de novo."
            : "Não consegui achar sua localização agora. Verifique se a localização do aparelho está ligada e tente de novo."
        );
        return;
      }
      setPlace(pl);
      if (pl.city) {
        setLocation([pl.city, pl.region || pl.country].filter(Boolean).join(", "));
        // posts antigos que saíram com "Sua cidade" passam a mostrar a cidade certa
        fixMyPlaceholderCity(pl.city, pl.country).then(n => {
          if (!n) return;
          setPosts(prev =>
            prev.map(x => (x.userId === myProfileRef.current?.id && !x.city ? { ...x, city: pl.city, country: pl.country } : x))
          );
        });
      }
      fetchCityWeather(pl.lat, pl.lng).then(setWeather);
    });
  };
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
  const postsRef = useRef<FeedPost[]>([]);
  postsRef.current = posts;
  const scrollY = useRef(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  // pedido de busca vindo de uma #hashtag
  const [searchRequest, setSearchRequest] = useState<{ text: string; id: number } | null>(null);
  // rascunho de post vindo do montador de looks
  const [draft, setDraft] = useState<{ images: string[]; tags: ClothingTag[]; caption: string; id: number; video?: string; aspect?: number } | null>(null);
  const [createSheet, setCreateSheet] = useState(false);
  const [clothingPhoto, setClothingPhoto] = useState<{ uri: string; id: number } | null>(null);
  // o que a câmera do app devolve: post/vídeo vai para "Nova publicação", roupa para o guarda-roupa
  const onCamera = (r: CameraResult) => {
    setStack([]);
    if (r.kind === "gallery-post") return setTab("add");
    if (r.kind === "clothing") {
      setClothingPhoto({ uri: r.image, id: Date.now() });
      return setTab("wardrobe");
    }
    setDraft({ images: r.images, tags: [], caption: "", id: Date.now(), video: r.video, aspect: r.aspect });
    setTab("add");
  };
  // 10 toques seguidos no logo da Home: liga/desliga o modo desenvolvedor (só no beta)
  const logoTaps = useRef<number[]>([]);
  const onLogoPress = () => {
    if (!BETA) return;
    const now = Date.now();
    logoTaps.current = [...logoTaps.current.filter(x => now - x < 4000), now];
    const n = logoTaps.current.length;
    if (n >= 10) {
      logoTaps.current = [];
      const on = !isDevMode();
      setDevMode(on);
      successFeedback();
      toast(on ? "Modo desenvolvedor ligado · veja em Configurações" : "Modo desenvolvedor desligado");
    } else if (n >= 6) toast(`Faltam ${10 - n} toques para o modo desenvolvedor`);
  };
  const onCreateChoice = (c: CreateChoice) => {
    if (c === "highlight") return openNewHighlight();
    openCamera(c);
  };

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
      // abriu o link de "Esqueci minha senha"
      if (openedFromRecoveryLink) {
        setRecovery(true);
      }
      await handleAuthRedirect(initialUrl).catch(() => false);
      const linkedUser = parseProfileLink(initialUrl);
      if (linkedUser) setPendingProfile(linkedUser);
      const linkedPost = parsePostLink(initialUrl);
      if (linkedPost) setPendingPost(linkedPost);
      if (!takeInvite(initialUrl)) {
        // voltou do login (Google etc.) ou reabriu o app: o convite ficou guardado
        const saved = FastStorage.getItemSync<string | null>("guvio_invite_v1", null);
        if (saved) {
          setInviter(saved);
          setPendingProfile(saved);
        }
      }
      const session = await getSavedAuthSession();
      setAuthenticated(Boolean(session));
      setBooting(false);
    });

    requestNotificationPermissions();
    fetchCityWeather(41.5388, -8.6151).then(setWeather);

    const linkSub = Linking.addEventListener("url", ({ url }) => {
      if (takeInvite(url)) return;
      const linkedUser = parseProfileLink(url);
      if (linkedUser) {
        setPendingProfile(linkedUser);
        return;
      }
      const linkedPost = parsePostLink(url);
      if (linkedPost) {
        setPendingPost(linkedPost);
        return;
      }
      handleAuthRedirect(url).then(ok => ok && setAuthenticated(true));
    });
    const authSub = supabase?.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        setAuthenticated(true);
        // guarda esta conta na lista "trocar de conta"
        setTimeout(() => rememberCurrentAccount().catch(() => {}), 1500);
      }
      if (event === "TOKEN_REFRESHED" && session) updateStoredToken(session.user.id, session.refresh_token).catch(() => {});
      if (event === "PASSWORD_RECOVERY") {
        setAuthenticated(true);
        // pelo código do "Esqueci minha senha" a senha nova é criada no próprio fluxo
        if (!recoverFlowActive()) setRecovery(true);
      }
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
    applyPlaceRef.current(false);

    isCloud().then(cloud => {
      if (!cloud) return;
      // avisos com o app fechado: confirma a inscrição deste aparelho na conta atual
      refreshPushRegistration();
      rememberCurrentAccount().catch(() => {});
      stopPresence = startPresence();
      // junta várias curtidas seguidas do mesmo post numa consulta só, e só para posts que estão na tela
      const pending = new Map<string, ReturnType<typeof setTimeout>>();
      const refreshCounts = (postId: string) => {
        if (!postsRef.current.some(p => p.id === postId)) return;
        const t = pending.get(postId);
        if (t) clearTimeout(t);
        pending.set(
          postId,
          setTimeout(() => {
            pending.delete(postId);
            fetchPostCounts(postId).then(c => {
              if (!c) return;
              setPosts(prev =>
                prev.map(p => (p.id === postId ? { ...p, likes: c.likes, commentsCount: c.comments } : p))
              );
            });
          }, 600)
        );
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
        onUpdatedPost: up =>
          setPosts(prev =>
            prev.map(p =>
              p.id === up.id
                ? // mantém o que é só meu (curti/salvei) e atualiza o resto
                  { ...up, isLiked: p.isLiked, isSaved: p.isSaved }
                : p
            )
          ),
        onDeletedPost: id => setPosts(prev => prev.filter(p => p.id !== id)),
        onLikesChanged: refreshCounts,
        onCommentsChanged: refreshCounts
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
    // este aparelho para de receber avisos da conta que saiu
    await forgetPushDevice().catch(() => {});
    // e ela sai da lista de contas salvas
    const uid = await currentUserId().catch(() => null);
    if (uid) await forgetAccount(uid);
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
    video?: string;
    pollOptions?: string[];
    aspect?: number;
  }): Promise<boolean> => {
    if (publishing) return false;
    setPublishing(true);
    try {
      const p = await publishPost({
        image: x.image,
        images: x.images,
        clothingTags: x.clothingTags,
        caption: x.caption,
        city: place?.city || (location === "Sua cidade" ? "" : location.split(",")[0]) || "",
        country: place?.country || filterCountry || "",
        styleTag: "Novo look",
        lat: place?.lat,
        lng: place?.lng,
        video: x.video,
        pollOptions: x.pollOptions,
        aspect: x.aspect,
        // clima de agora, para o filtro "looks para dias de chuva/frio/calor"
        tempC: weather?.kind && place ? weather.temperature : null,
        weather: weather?.kind && place ? weather.kind : null
      });
      setPosts(prev => {
        const updated = prev.some(v => v.id === p.id) ? prev : [p, ...prev];
        savePosts(updated);
        return updated;
      });
      successFeedback();
      setDraft(null);
      setTab("home");
      setTimeout(() => toast(p.city ? `Look publicado em ${p.city}!` : "Look publicado!", "✨"), 250);
      return true;
    } catch (e: any) {
      Alert.alert("Não foi possível publicar", e?.message || "Tente novamente.");
      return false;
    } finally {
      setPublishing(false);
    }
  };

  useEffect(() => {
    if (!pendingProfile || booting || !authenticated || showOnboarding) return;
    const name = pendingProfile;
    // espera as telas montarem antes de abrir o perfil
    const t = setTimeout(() => {
      setPendingProfile(null);
      // convite usado: não abre de novo nas próximas vezes
      if (FastStorage.getItemSync<string | null>("guvio_invite_v1", null) === name) FastStorage.setItemSync("guvio_invite_v1", null);
      openNameRef.current?.(name);
    }, 300);
    return () => clearTimeout(t);
  }, [pendingProfile, booting, authenticated, showOnboarding]);

  // link de post (guvio://p/<id> ou site ?p=<id>): abre o post depois do login
  useEffect(() => {
    if (!pendingPost || booting || !authenticated) return;
    const id = pendingPost;
    const t = setTimeout(() => {
      setPendingPost(null);
      openPostRef.current?.(id);
      if (Platform.OS === "web" && typeof window !== "undefined" && /[?&][pu]=/.test(window.location.search)) {
        try {
          window.history.replaceState(null, "", window.location.pathname);
        } catch {}
      }
    }, 300);
    return () => clearTimeout(t);
  }, [pendingPost, booting, authenticated]);

  if (booting) return <View style={[s.safe, { backgroundColor: colors.bg }]} />;

  if (!authenticated) return <AuthScreen inviter={inviter} onAuthenticated={() => setAuthenticated(true)} />;
  if (showOnboarding)
    return (
      <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
        <OnboardingView
          onDone={action => {
            setShowOnboarding(false);
            if (action === "publish") setTab("add");
          }}
        />
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
        location: "",
        followers: 0,
        following: 0,
        bio: ""
      };
    openProfileObj(p);
  };

  openNameRef.current = openName;

  // o meu próprio perfil abre na aba Perfil (com editar, configurações...), não como perfil de outra pessoa
  const openProfileObj = async (p: UserProfile) => {
    let mine = myProfileRef.current;
    if (!mine) {
      mine = await loadSavedProfile().catch(() => null);
      myProfileRef.current = mine;
    }
    const same =
      !!mine &&
      ((!!p.id && p.id === mine.id) || (!!p.username && !!mine.username && p.username.toLowerCase() === mine.username.toLowerCase()));
    if (same) {
      setStack([]);
      setTab("profile");
      return;
    }
    push({ name: "publicProfile", profile: p });
  };
  const openPost = (postId: string) => push({ name: "post", postId });
  // tocar numa foto da grade: abre a lista daquele perfil já no look tocado
  const openPostList = (list: FeedPost[], startId: string, title?: string) =>
    list.length > 1 ? push({ name: "postList", posts: list, startId, title }) : openPost(startId);
  openPostRef.current = openPost;

  /** abre "Nova publicação" já com a #hashtag do desafio na legenda */
  const joinChallenge = (tag: string) => {
    setDraft({ images: [], tags: [], caption: `#${tag} `, id: Date.now() });
    setStack([]);
    setTab("add");
  };
  const openFollows = (p: UserProfile, kind: "followers" | "following") => push({ name: "follows", profile: p, kind });

  const betaWelcome = (
    <BetaWelcome
      onFeedback={() => push({ name: "settingsPage", kind: "feedback" })}
      onInvite={() =>
        loadSavedProfile()
          .then(p => shareInvite(p.username))
          .catch(() => {})
      }
    />
  );

  const renderScreen = (top: NonNullable<typeof stack[number]>, isTop: boolean): React.ReactNode => {
    let screen: React.ReactNode = null;
    switch (top.name) {
      case "direct":
        screen = (
          <DirectView
            active={isTop}
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
            onOpenPostList={openPostList}
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
      case "postList":
        screen = (
          <PostListView
            posts={top.posts}
            startId={top.startId}
            title={top.title}
            onBack={back}
            onOpenProfile={openName}
            onOpenTag={openTag}
            onDeleted={id => setPosts(prev => prev.filter(p => p.id !== id))}
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
              if (x === "invite") {
                loadSavedProfile()
                  .then(p => shareInvite(p.username))
                  .catch(() => {});
                return;
              }
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
          ) : top.kind === "devtools" ? (
            <DevToolsView onBack={back} />
          ) : top.kind === "admin" ? (
            <AdminView onBack={back} onOpenPost={openPost} onOpenProfile={openName} />
          ) : (
            <SimpleSettingsPage kind={top.kind} onBack={back} onOpenPost={openPost} onOpenPostList={openPostList} />
          );
        break;
    }
    return screen;
  };

  // telas abertas por cima (direct, notificações, perfis...) ficam em camadas:
  // a Home e as telas de baixo continuam montadas, então ao voltar nada recarrega
  const stackLayer = stack.map((entry, i) => {
    const isTop = i === stack.length - 1;
    return (
      <SafeAreaView
        key={`${i}-${entry.name}`}
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, zIndex: 200 + i }]}
        pointerEvents={isTop ? "auto" : "none"}
      >
        <EdgeSwipe side="left" anywhere onSwipe={back} under={colors.surface2} enabled={isTop}>
          <SlideInScreen from={goingBack.current ? -60 : 60}>{renderScreen(entry, isTop)}</SlideInScreen>
        </EdgeSwipe>
      </SafeAreaView>
    );
  });

  const weatherText = weather ? `${weather.condition} ${weather.temperature}°C` : undefined;

  return (
    <View style={[s.safe, { backgroundColor: colors.bg }]}>
    <SafeAreaView style={s.safe} pointerEvents={top ? "none" : "auto"}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} backgroundColor={colors.bg} />
      {offline ? (
        <Pressable onPress={refreshFeed} style={[s.offline, { backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
            Sem conexão · mostrando looks salvos no aparelho. <Text style={{ color: "#0095F6" }}>Tentar de novo</Text>
          </Text>
        </Pressable>
      ) : null}
      {/* a Home fica sempre montada (só escondida), para manter a posição do feed */}
      <View style={tab === "home" ? s.safe : s.hidden} pointerEvents={tab === "home" ? "auto" : "none"}>
        {/* arrastar para a direita abre a câmera (story); para a esquerda, o Direct */}
        <EdgeSwipe side="left" anywhere interactive={false} onSwipe={() => openCamera("story")}>
        <EdgeSwipe side="right" anywhere interactive={false} onSwipe={() => push({ name: "direct" })}>
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
              onPressLocation={() => applyPlaceRef.current(true, true)}
              weatherText={weatherText}
              onOpenDirect={() => push({ name: "direct" })}
              onLogoPress={onLogoPress}
              onOpenBeta={() => push({ name: "settingsPage", kind: "feedback" })}
              onOpenActivity={() => {
                setUnread(false);
                markActivitySeen();
                push({ name: "activity" });
              }}
              hasUnreadActivity={unread}
              unreadMessages={unreadDm}
            />
            <GlobeLocationSearch onSelect={search} />
            {Platform.OS === "web" ? <PushPrompt /> : null}
          </View>
          <HomeFeed
            posts={posts}
            setPosts={handleUpdatePosts}
            countryFilter={filterCountry}
            cityFilter={filterCity}
            onClearFilter={clearGlobeSelection}
            onAssembleWithWardrobe={p => setInspirePost(p)}
            todayWeather={
              weather?.kind
                ? weather.kind === "chuva" || weather.kind === "neve"
                  ? "chuva"
                  : weather.temperature <= 15
                  ? "frio"
                  : weather.temperature >= 24
                  ? "calor"
                  : null
                : null
            }
            onOpenProfile={openName}
            onOpenTag={openTag}
            refreshKey={refreshKey}
            nearby={place ? { lat: place.lat, lng: place.lng } : null}
            belowStories={
              // desafio da semana: ideia futura (só aparece ligando no modo desenvolvedor)
              devFlags.flag("challenge") ? <ChallengeCard onJoin={joinChallenge} onOpenRanking={() => push({ name: "challenge" })} /> : undefined
            }
          />
          {loadingMore ? <ActivityIndicator color={colors.muted} style={{ marginVertical: 24 }} /> : null}
          {!hasMore && posts.length > 0 ? (
            <Text style={{ color: colors.muted, textAlign: "center", fontSize: 12, marginVertical: 24 }}>
              Você viu todos os looks ✨
            </Text>
          ) : null}
          <View style={{ height: 110 }} />
        </ScrollView>
        </EdgeSwipe>
        </EdgeSwipe>
      </View>
      {tab === "home" && newLooks > 0 ? (
        <Pressable
          onPress={() => {
            scroll.current?.scrollTo({ y: 0, animated: true });
            setNewLooks(0);
          }}
          style={s.newPill}
        >
          <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 13 }}>
            ↑ {newLooks === 1 ? "1 novo look" : `${newLooks} novos looks`}
          </Text>
        </Pressable>
      ) : null}
      {tab === "home" ? null : (
        <FadeIn key={tab} from={0} duration={220} style={{ flex: 1 }}>
      {tab === "wardrobe" ? (
        <WardrobeView
          onAdd={() => setTab("add")}
          addPhoto={clothingPhoto}
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
          myCity={place?.city || undefined}
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
          onOpenPostList={openPostList}
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
        </FadeIn>
      )}
      <BottomNavLiquid
        activeTab={tab}
        onTabChange={t => {
          // o + abre a câmera do app; no Perfil, abre o menu "Criar"
          if (t === "add") {
            tapFeedback();
            if (tab === "profile" && !stack.length) setCreateSheet(true);
            else openCamera("post");
            return;
          }
          if (t !== tab) tapFeedback();
          // tocar de novo na Home: sobe para o topo; se já estiver no topo, atualiza
          if (t === tab && t === "home" && !stack.length) {
            if (scrollY.current > 40) (scroll.current as any)?.scrollTo({ y: 0, animated: true });
            else refreshFeed();
            return;
          }
          setTab(t);
        }}
      />
    </SafeAreaView>
      {stackLayer}
      <ToastHost bottom={top ? 40 : undefined} />
      <UpdateBanner />
      {top ? null : <InstallPrompt />}
      <NewPasswordModal visible={recovery} onDone={() => setRecovery(false)} />
      <CameraHost onResult={onCamera} />
      <StoryEditorHost />
      <CreateSheet visible={createSheet} onClose={() => setCreateSheet(false)} onPick={onCreateChoice} />
      <InspireLookModal
        post={inspirePost}
        onClose={() => setInspirePost(null)}
        onOpenWardrobe={() => {
          setStack([]);
          setTab("wardrobe");
        }}
      />
      {betaWelcome}
      <PinchHost />
      <PeekHost />
    </View>
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
  // trocar de conta: remonta o app inteiro na conta nova
  const [appKey, setAppKey] = useState(0);
  useEffect(() => setAppRestarter(() => setAppKey(k => k + 1)), []);
  return (
    <AppThemeProvider>
      <ErrorBoundary>
        <SafeAreaProvider>
          <Guvio key={appKey} />
          <RecoverHost />
          <AccountSwitcherHost />
          <IntroSplash />
          <WebAlertHost />
        </SafeAreaProvider>
      </ErrorBoundary>
    </AppThemeProvider>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  hidden: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0, zIndex: -1 },
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
