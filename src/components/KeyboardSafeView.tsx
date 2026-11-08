import React, { useEffect, useRef, useState } from "react";
import { Keyboard, Platform, StyleProp, View, ViewStyle } from "react-native";

/**
 * Sobe o conteúdo exatamente o quanto o teclado cobre.
 * - iPhone (app): mede onde a tela termina e onde o teclado começa
 * - site (inclusive instalado na tela de início): usa o visualViewport do navegador
 * - Android: o próprio sistema já empurra a tela
 */
export function KeyboardSafeView({
  style,
  children,
  extra = 0
}: {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  /** espaço extra acima do teclado */
  extra?: number;
  behavior?: any;
  keyboardVerticalOffset?: number;
}) {
  const ref = useRef<View>(null);
  const [pad, setPad] = useState(0);

  useEffect(() => {
    if (Platform.OS === "ios") {
      const onShow = (e: any) => {
        const kbTop = e?.endCoordinates?.screenY;
        if (!ref.current || typeof kbTop !== "number") return;
        ref.current.measureInWindow((_x, y, _w, h) => setPad(Math.max(0, y + h - kbTop) + (y + h > kbTop ? extra : 0)));
      };
      const subs = [
        Keyboard.addListener("keyboardWillShow", onShow),
        Keyboard.addListener("keyboardWillChangeFrame", onShow),
        Keyboard.addListener("keyboardWillHide", () => setPad(0))
      ];
      return () => subs.forEach(s => s.remove());
    }
    if (Platform.OS === "web" && typeof window !== "undefined" && (window as any).visualViewport) {
      const vv = (window as any).visualViewport;
      const update = () => {
        const covered = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
        setPad(covered > 80 ? covered + extra : 0);
        // o iPhone às vezes rola a página inteira ao abrir o teclado; volta para o topo
        if (covered > 80 && window.scrollY) window.scrollTo(0, 0);
      };
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
      return () => {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      };
    }
  }, [extra]);

  return (
    <View ref={ref} style={[style, pad ? { paddingBottom: pad } : null]}>
      {children}
    </View>
  );
}
