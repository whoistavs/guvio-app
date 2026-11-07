import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { StoryOverlay } from "../data/mockData";

export const OVERLAY_COLORS = ["#FFFFFF", "#111111", "#FF3B5C", "#FFD60A", "#34C759", "#0A84FF", "#BF5AF2"];

/** Texto escrito por cima da foto do story */
export function StoryOverlayText({ overlay }: { overlay?: StoryOverlay | null }) {
  if (!overlay?.text) return null;
  const color = overlay.color || "#FFFFFF";
  const dark = ["#FFFFFF", "#FFD60A", "#34C759"].includes(color);
  return (
    <View pointerEvents="none" style={[s.wrap, { top: `${Math.round((overlay.y ?? 0.45) * 100)}%` }]}>
      <Text
        style={[
          s.text,
          { color },
          overlay.boxed ? { backgroundColor: dark ? "rgba(0,0,0,.72)" : "rgba(255,255,255,.92)" } : s.shadow
        ]}
      >
        {overlay.text}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: "absolute", left: 24, right: 24, alignItems: "center", zIndex: 5 },
  text: { fontSize: 26, fontWeight: "900", textAlign: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, overflow: "hidden" },
  shadow: { textShadowColor: "rgba(0,0,0,.6)", textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } }
});
