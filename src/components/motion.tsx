import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, PressableProps, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { tapFeedback } from "../utils/haptics";

// No navegador a animação nativa não existe; o RN cai para JS sozinho, mas avisa.
const ND = Platform.OS !== "web";

/**
 * Botão que "afunda" um pouquinho ao tocar (como no Instagram/TikTok).
 * Use no lugar de Pressable em botões e cartões.
 */
export function PressableScale({
  children,
  style,
  scaleTo = 0.96,
  haptic = false,
  onPressIn,
  onPressOut,
  onPress,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number; haptic?: boolean; children?: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: ND, speed: 40, bounciness: v === 1 ? 8 : 0 }).start();
  return (
    <AnimatedPressable
      {...(rest as any)}
      style={[style as any, { transform: [{ scale }] }]}
      onPressIn={(e: any) => {
        to(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e: any) => {
        to(1);
        onPressOut?.(e);
      }}
      onPress={(e: any) => {
        if (haptic) tapFeedback();
        onPress?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}

// o próprio botão encolhe (mantém flex/largura do estilo, sem quebrar o layout)
const AnimatedPressable: any = Animated.createAnimatedComponent(Pressable);

/** Aparece suavemente (sobe um pouco e ganha opacidade) quando monta */
export function FadeIn({
  children,
  delay = 0,
  duration = 320,
  from = 10,
  style
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  /** quantos px sobe ao aparecer */
  from?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: ND }).start();
  }, []);
  return (
    <Animated.View
      style={[
        style,
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] }
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Tela que entra deslizando da direita (telas abertas por cima: perfil, post, Direct...) */
export function SlideInScreen({ children, from = 60 }: { children: React.ReactNode; from?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: ND }).start();
  }, []);
  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
        transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }]
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Pulinho: chama bump() e o conteúdo cresce e volta (coração, salvar) */
export function useBump(): [Animated.Value, () => void] {
  const s = useRef(new Animated.Value(1)).current;
  const bump = () => {
    s.setValue(0.7);
    Animated.spring(s, { toValue: 1, friction: 3, tension: 180, useNativeDriver: ND }).start();
  };
  return [s, bump];
}

export function Bump({ value, children }: { value: Animated.Value; children: React.ReactNode }) {
  return <Animated.View style={{ transform: [{ scale: value }] }}>{children}</Animated.View>;
}

// ---------------------------------------------------------------------
// Avisos rápidos ("Salvo ✓") que somem sozinhos, sem precisar tocar em OK
// ---------------------------------------------------------------------
type ToastMsg = { id: number; text: string; icon?: string };
let listener: ((m: ToastMsg) => void) | null = null;
let seq = 0;

export function toast(text: string, icon?: string) {
  listener?.({ id: ++seq, text, icon });
}

/** Coloque uma vez no app (em cima de tudo) */
export function ToastHost({ bottom = 110 }: { bottom?: number }) {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const v = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    listener = m => {
      if (timer.current) clearTimeout(timer.current);
      setMsg(m);
      v.setValue(0);
      Animated.spring(v, { toValue: 1, useNativeDriver: ND, speed: 18, bounciness: 6 }).start();
      timer.current = setTimeout(() => {
        Animated.timing(v, { toValue: 0, duration: 220, useNativeDriver: ND }).start(() => setMsg(null));
      }, 2300);
    };
    return () => {
      listener = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!msg) return null;
  return (
    <View pointerEvents="none" style={[st.wrap, { bottom }]}>
      <Animated.View
        style={[
          st.toast,
          { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }
        ]}
      >
        {msg.icon ? <Text style={{ fontSize: 15 }}>{msg.icon}</Text> : null}
        <Text style={st.text} numberOfLines={2}>
          {msg.text}
        </Text>
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 999, elevation: 30 },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "88%",
    backgroundColor: "rgba(20,21,25,.96)",
    borderColor: "rgba(255,255,255,.12)",
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 22,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }
  },
  text: { color: "#FFF", fontWeight: "800", fontSize: 13 }
});

/** Pula sozinho quando "active" vira true (coração ao curtir, salvar...) */
export function PopOnActive({ active, children }: { active: boolean; children: React.ReactNode }) {
  const s = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (active) {
      s.setValue(0.6);
      Animated.spring(s, { toValue: 1, friction: 3, tension: 200, useNativeDriver: ND }).start();
    } else {
      Animated.sequence([
        Animated.timing(s, { toValue: 0.85, duration: 80, useNativeDriver: ND }),
        Animated.spring(s, { toValue: 1, friction: 5, useNativeDriver: ND })
      ]).start();
    }
  }, [active]);
  return <Animated.View style={{ transform: [{ scale: s }] }}>{children}</Animated.View>;
}
