import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, Platform, StyleSheet, Text, View } from "react-native";

/**
 * Abertura do app (igual à do Instagram): o cabide do GUVIO no centro,
 * um leve "pulso" e some quando o app terminou de carregar.
 * Continua a tela de abertura do sistema (mesma cor e mesmo tamanho), então não pisca.
 */
const BG = "#050608";
const MIN_MS = 650;
const MAX_MS = 3000;

let readyFn: (() => void) | null = null;
let readyEarly = false;
/** o app chama quando já sabe se a pessoa está logada (a abertura pode sair) */
export function markAppReady() {
  if (readyFn) readyFn();
  else readyEarly = true;
}

export function IntroSplash() {
  const [gone, setGone] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const started = useRef(Date.now());

  useEffect(() => {
    // site: tira a abertura em HTML (a versão daqui é idêntica)
    if (Platform.OS === "web" && typeof document !== "undefined") document.getElementById("guvio-splash")?.remove();

    // pulso suave enquanto carrega
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.06, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
      ])
    );
    pulse.start();

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const wait = Math.max(0, MIN_MS - (Date.now() - started.current));
      setTimeout(() => {
        pulse.stop();
        Animated.parallel([
          Animated.timing(fade, { toValue: 0, duration: 260, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.35, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true })
        ]).start(() => setGone(true));
      }, wait);
    };
    readyFn = finish;
    if (readyEarly) finish();
    const safety = setTimeout(finish, MAX_MS);
    return () => {
      readyFn = null;
      clearTimeout(safety);
      pulse.stop();
    };
  }, [fade, scale]);

  if (gone) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.wrap, { opacity: fade }]} pointerEvents="none">
      <Animated.View style={{ transform: [{ scale }] }}>
        <Image source={require("../../assets/splash-icon.png")} style={s.logo} resizeMode="contain" />
      </Animated.View>
      <View style={s.bottom}>
        <Text style={s.brand}>GUVIO</Text>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: BG, alignItems: "center", justifyContent: "center", zIndex: 100000 },
  logo: { width: 180, height: 180 },
  bottom: { position: "absolute", bottom: 54, alignItems: "center" },
  brand: { color: "#9AA4B2", fontSize: 13, fontWeight: "700", letterSpacing: 5 }
});
