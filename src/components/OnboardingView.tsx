import React, { useEffect, useRef, useState } from "react";
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { noSwipeBack } from "./gestures";
import { Camera, Globe2, Images, Shirt, Trophy } from "lucide-react-native";
import { FastImage } from "./FastImage";
import { loadFollowedUsers, loadSuggestions, saveFollowedUsers } from "../services/storage";
import { UserProfile } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { FastStorage } from "../services/FastStorage";
import { tapFeedback } from "../utils/haptics";

const KEY = "guvio_onboarding_done_v1";
const W = Dimensions.get("window").width;

export function onboardingDone(): boolean {
  return !!FastStorage.getItemSync(KEY, false);
}
export function resetOnboarding() {
  FastStorage.setItemSync(KEY, false);
}

const SLIDES = [
  { icon: Shirt, title: "Bem-vindo ao Guvio", text: "A rede social de moda onde o seu guarda-roupa encontra o estilo do mundo inteiro." },
  { icon: Images, title: "Publique seus looks", text: "Até 10 fotos por post, marque as peças do seu guarda-roupa e use #hashtags e @menções." },
  { icon: Shirt, title: "Seu guarda-roupa", text: "Cadastre suas peças, monte looks e receba todo dia uma sugestão pensada no clima da sua cidade." },
  { icon: Globe2, title: "Explore o mundo", text: "Gire o globo no Buscar e veja os looks mais curtidos de cada cidade." },
  { icon: Trophy, title: "Desafio da semana", text: "Toda segunda tem tema novo. Publique com a #hashtag e dispute o pódio. Bora começar?" }
];

/** Primeiro acesso: slides → seguir pessoas → primeiro look */
export function OnboardingView({ onDone }: { onDone: (action?: "publish") => void }) {
  const { colors } = useAppTheme();
  const [page, setPage] = useState(0);
  const [stage, setStage] = useState<"slides" | "follow" | "first">("slides");
  const ref = useRef<ScrollView>(null);
  const last = page === SLIDES.length - 1;

  const finish = (action?: "publish") => {
    FastStorage.setItemSync(KEY, true);
    onDone(action);
  };

  if (stage === "follow") return <FollowStep onNext={() => setStage("first")} />;
  if (stage === "first") {
    return (
      <View style={[s.full, { backgroundColor: colors.bg, justifyContent: "center" }]}>
        <View style={s.slide}>
          <View style={[s.iconWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Camera size={58} color={colors.text} strokeWidth={1.6} />
          </View>
          <Text style={[s.title, { color: colors.text }]}>Seu primeiro look</Text>
          <Text style={[s.text, { color: colors.muted }]}>
            Mostre o que você está vestindo hoje. Pode ser uma foto no espelho, sem produção.
          </Text>
        </View>
        <Pressable onPress={() => finish("publish")} style={[s.btn, { backgroundColor: colors.text }]}>
          <Text style={{ color: colors.bg, fontWeight: "700", fontSize: 15 }}>Publicar agora</Text>
        </Pressable>
        <Pressable onPress={() => finish()} hitSlop={10} style={{ alignSelf: "center", marginTop: 16 }}>
          <Text style={{ color: colors.muted, fontWeight: "600" }}>Depois</Text>
        </Pressable>
      </View>
    );
  }

  const next = () => {
    tapFeedback();
    if (last) return setStage("follow");
    ref.current?.scrollTo({ x: (page + 1) * W, animated: true });
    setPage(page + 1);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / W);
    if (p !== page) setPage(p);
  };

  return (
    <View style={[s.full, { backgroundColor: colors.bg }]}>
      <View style={s.top}>
        {!last ? (
          <Pressable onPress={() => setStage("follow")} hitSlop={12}>
            <Text style={{ color: colors.muted, fontWeight: "600" }}>Pular</Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>
      <ScrollView {...noSwipeBack}
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}
      >
        {SLIDES.map((sl, i) => {
          const I = sl.icon;
          return (
            <View key={i} style={[s.slide, { width: W }]}>
              <View style={[s.iconWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <I size={58} color={colors.text} strokeWidth={1.6} />
              </View>
              <Text style={[s.title, { color: colors.text }]}>{sl.title}</Text>
              <Text style={[s.text, { color: colors.muted }]}>{sl.text}</Text>
            </View>
          );
        })}
      </ScrollView>
      <View style={s.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[s.dot, { backgroundColor: i === page ? colors.text : colors.border, width: i === page ? 22 : 8 }]} />
        ))}
      </View>
      <Pressable onPress={next} style={[s.btn, { backgroundColor: colors.text }]}>
        <Text style={{ color: colors.bg, fontWeight: "700", fontSize: 15 }}>{last ? "Começar" : "Próximo"}</Text>
      </Pressable>
    </View>
  );
}

function FollowStep({ onNext }: { onNext: () => void }) {
  const { colors } = useAppTheme();
  const [list, setList] = useState<UserProfile[] | null>(null);
  const [following, setFollowing] = useState<string[]>([]);
  useEffect(() => {
    loadSuggestions(20)
      .then(l => setList(l))
      .catch(() => setList([]));
    loadFollowedUsers().then(setFollowing).catch(() => {});
  }, []);
  useEffect(() => {
    // ninguém para sugerir ainda: pula direto
    if (list && list.length === 0) onNext();
  }, [list, onNext]);

  const toggle = async (p: UserProfile) => {
    tapFeedback();
    const id = p.id || p.username;
    const on = following.includes(id) || following.includes(p.username);
    const updated = on ? following.filter(x => x !== id && x !== p.username) : [...following, id];
    setFollowing(updated);
    try {
      await saveFollowedUsers(updated);
    } catch {
      setFollowing(following);
    }
  };
  const count = (list || []).filter(p => following.includes(p.id) || following.includes(p.username)).length;

  return (
    <View style={[s.full, { backgroundColor: colors.bg }]}>
      <View style={{ paddingHorizontal: 24, paddingTop: 56, paddingBottom: 12 }}>
        <Text style={[s.title, { color: colors.text, textAlign: "left" }]}>Siga quem te inspira</Text>
        <Text style={[s.text, { color: colors.muted, textAlign: "left", marginTop: 6 }]}>
          Assim seu feed já começa com looks. Dá para mudar depois.
        </Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}>
        {(list || []).map(p => {
          const on = following.includes(p.id) || following.includes(p.username);
          return (
            <View key={p.id || p.username} style={[s.person, { borderBottomColor: colors.border }]}>
              <FastImage source={p.avatar} style={s.avatar} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }} numberOfLines={1}>@{p.username}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
                  {[p.displayName, p.location].filter(Boolean).join(" · ")}
                </Text>
              </View>
              <Pressable
                onPress={() => toggle(p)}
                style={[s.follow, on ? { backgroundColor: colors.surface } : { backgroundColor: "#0095F6" }]}
              >
                <Text style={{ color: on ? colors.text : "#FFF", fontWeight: "700", fontSize: 12 }}>{on ? "Seguindo" : "Seguir"}</Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
      <Pressable onPress={onNext} style={[s.btn, { backgroundColor: colors.text }]}>
        <Text style={{ color: colors.bg, fontWeight: "700", fontSize: 15 }}>
          {count > 0 ? `Continuar (${count} seguindo)` : "Continuar"}
        </Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  person: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  follow: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, minWidth: 92, alignItems: "center" },
  full: { flex: 1, paddingBottom: 40 },
  top: { height: 56, paddingHorizontal: 24, alignItems: "flex-end", justifyContent: "center" },
  slide: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36 },
  iconWrap: { width: 140, height: 140, borderRadius: 40, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 34 },
  title: { fontSize: 26, fontWeight: "700", textAlign: "center", letterSpacing: -0.5 },
  text: { fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 12 },
  dots: { flexDirection: "row", gap: 6, justifyContent: "center", marginBottom: 24 },
  dot: { height: 8, borderRadius: 4 },
  btn: { marginHorizontal: 24, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" }
});
