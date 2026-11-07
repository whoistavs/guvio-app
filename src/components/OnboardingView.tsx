import React, { useRef, useState } from "react";
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Globe2, Images, Shirt, Sparkles, Trophy } from "lucide-react-native";
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
  { icon: Sparkles, title: "Bem-vindo ao Guvio", text: "A rede social de moda onde o seu guarda-roupa encontra o estilo do mundo inteiro." },
  { icon: Images, title: "Publique seus looks", text: "Até 10 fotos por post, marque as peças do seu guarda-roupa e use #hashtags e @menções." },
  { icon: Shirt, title: "Guarda-roupa inteligente", text: "Cadastre suas peças, monte looks e receba todo dia uma sugestão pensada no clima da sua cidade." },
  { icon: Globe2, title: "Explore o mundo", text: "Gire o globo no Buscar e veja os looks mais curtidos de cada cidade." },
  { icon: Trophy, title: "Desafio da semana", text: "Toda segunda tem tema novo. Publique com a #hashtag e dispute o pódio. Bora começar?" }
];

export function OnboardingView({ onDone }: { onDone: () => void }) {
  const { colors } = useAppTheme();
  const [page, setPage] = useState(0);
  const ref = useRef<ScrollView>(null);
  const last = page === SLIDES.length - 1;

  const finish = () => {
    FastStorage.setItemSync(KEY, true);
    onDone();
  };

  const next = () => {
    tapFeedback();
    if (last) return finish();
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
          <Pressable onPress={finish} hitSlop={12}>
            <Text style={{ color: colors.muted, fontWeight: "800" }}>Pular</Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>
      <ScrollView
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
        <Text style={{ color: colors.bg, fontWeight: "900", fontSize: 15 }}>{last ? "Começar" : "Próximo"}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  full: { flex: 1, paddingBottom: 40 },
  top: { height: 56, paddingHorizontal: 24, alignItems: "flex-end", justifyContent: "center" },
  slide: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36 },
  iconWrap: { width: 140, height: 140, borderRadius: 40, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 34 },
  title: { fontSize: 26, fontWeight: "900", textAlign: "center", letterSpacing: -0.5 },
  text: { fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 12 },
  dots: { flexDirection: "row", gap: 6, justifyContent: "center", marginBottom: 24 },
  dot: { height: 8, borderRadius: 4 },
  btn: { marginHorizontal: 24, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" }
});
