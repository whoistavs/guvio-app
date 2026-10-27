import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, PanResponder, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { Home, Search, Shirt, SquarePlus, User } from "lucide-react-native";
import { useAppTheme } from "../context/AppTheme";

const ITEMS = [
  { id: "home", label: "Home", icon: Home },
  { id: "wardrobe", label: "Guarda-roupa", icon: Shirt },
  { id: "add", label: "", icon: SquarePlus, center: true },
  { id: "search", label: "Buscar", icon: Search },
  { id: "profile", label: "Perfil", icon: User },
];

export function BottomNavLiquid({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
  const { dark, colors } = useAppTheme();
  const [width, setWidth] = useState(360);
  const bubbleX = useRef(new Animated.Value(0)).current;
  const scaleX = useRef(new Animated.Value(1)).current;
  const scaleY = useRef(new Animated.Value(1)).current;

  const activeIndex = Math.max(0, ITEMS.findIndex(i => i.id === activeTab));
  const itemWidth = width / ITEMS.length;
  const startXRef = useRef(0);

  const springTo = (index: number) => {
    Animated.spring(bubbleX, {
      toValue: index * itemWidth,
      damping: 14,
      stiffness: 180,
      mass: 0.65,
      useNativeDriver: true
    }).start();
  };

  useEffect(() => {
    springTo(activeIndex);
  }, [activeIndex, itemWidth]);

  const squeeze = (on: boolean) => {
    Animated.parallel([
      Animated.spring(scaleX, { toValue: on ? 1.22 : 1, damping: 14, stiffness: 220, useNativeDriver: true }),
      Animated.spring(scaleY, { toValue: on ? 0.84 : 1, damping: 14, stiffness: 220, useNativeDriver: true }),
    ]).start();
  };

  // Arrastar fluido e preciso sem saltos (usando delta dx do PanResponder)
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4,
        onPanResponderGrant: () => {
          squeeze(true);
          bubbleX.stopAnimation();
          startXRef.current = activeIndex * itemWidth;
        },
        onPanResponderMove: (_, g) => {
          const currentX = Math.max(0, Math.min(width - itemWidth, startXRef.current + g.dx));
          bubbleX.setValue(currentX);
        },
        onPanResponderRelease: (_, g) => {
          squeeze(false);
          const finalX = Math.max(0, Math.min(width - itemWidth, startXRef.current + g.dx));
          const targetIndex = Math.max(0, Math.min(ITEMS.length - 1, Math.round(finalX / itemWidth)));
          springTo(targetIndex);
          if (ITEMS[targetIndex]) {
            onTabChange(ITEMS[targetIndex].id);
          }
        },
        onPanResponderTerminate: () => {
          squeeze(false);
          springTo(activeIndex);
        },
      }),
    [width, itemWidth, activeIndex]
  );

  return (
    <View style={styles.fixed} pointerEvents="box-none">
      <View
        style={[
          styles.shell,
          {
            backgroundColor: dark ? "rgba(18,20,24,0.65)" : "rgba(255,255,255,0.68)",
            borderColor: dark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.92)"
          }
        ]}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      >
        <BlurView intensity={dark ? 42 : 72} tint={dark ? "dark" : "light"} style={styles.blur} {...responder.panHandlers}>
          {/* Bolha Fluida de Vidro (Liquid Glass) */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.bubbleSlot,
              {
                width: itemWidth,
                transform: [{ translateX: bubbleX }, { scaleX }, { scaleY }]
              }
            ]}
          >
            <View
              style={[
                styles.bubble,
                {
                  backgroundColor: dark ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.58)",
                  borderColor: dark ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.98)"
                }
              ]}
            >
              <View style={styles.highlight} />
              <View style={styles.refraction} />
            </View>
          </Animated.View>

          {/* Ícones e Etiquetas das Abas */}
          <View style={styles.row} pointerEvents="box-none">
            {ITEMS.map((it, idx) => {
              const Icon = it.icon;
              const active = idx === activeIndex;
              return (
                <Pressable
                  key={it.id}
                  onPress={() => onTabChange(it.id)}
                  onPressIn={() => squeeze(true)}
                  onPressOut={() => squeeze(false)}
                  style={[styles.item, { width: itemWidth }]}
                >
                  {it.center ? (
                    <View style={[styles.center, { backgroundColor: colors.text }]}>
                      <SquarePlus size={22} color={colors.bg} />
                    </View>
                  ) : (
                    <>
                      <Icon size={20} color={active ? colors.text : colors.muted} fill={active && it.id === "home" ? colors.text : "none"} />
                      <Text style={[styles.label, { color: active ? colors.text : colors.muted, fontWeight: active ? "800" : "600" }]}>
                        {it.label}
                      </Text>
                    </>
                  )}
                </Pressable>
              );
            })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fixed: {
    position: Platform.OS === "web" ? ("fixed" as any) : "absolute",
    bottom: Platform.OS === "ios" ? 24 : Platform.OS === "android" ? 38 : 16,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 999
  },
  shell: {
    width: "92%",
    maxWidth: 440,
    borderRadius: 36,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 26,
    elevation: 14
  },
  blur: { paddingVertical: 8, overflow: "hidden" },
  bubbleSlot: { position: "absolute", left: 0, top: 5, bottom: 5, paddingHorizontal: 5 },
  bubble: {
    flex: 1,
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14
  },
  highlight: {
    position: "absolute",
    top: 3,
    left: "18%",
    right: "18%",
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.8)"
  },
  refraction: {
    position: "absolute",
    bottom: -8,
    left: "8%",
    right: "8%",
    height: 20,
    borderRadius: 999,
    backgroundColor: "rgba(170,220,255,0.15)"
  },
  row: { flexDirection: "row", alignItems: "center", zIndex: 2 },
  item: { minHeight: 54, alignItems: "center", justifyContent: "center", gap: 3 },
  label: { fontSize: 9.5 },
  center: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }
});
