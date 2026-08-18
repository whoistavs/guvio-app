import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Heart, MapPin, Send } from "lucide-react-native";
import { useAppTheme } from "../context/AppTheme";

export function Header({
  locationText = "Campinas, SP",
  weatherText,
  onOpenDirect
}: {
  locationText?: string;
  weatherText?: string;
  onOpenDirect?: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.c}>
      <View style={styles.left}>
        <Image
          source={require("../assets/logo.png")}
          style={styles.logoBadge}
        />
        <Text style={[styles.title, { color: colors.text }]}>GUVIO</Text>
      </View>

      <View style={styles.right}>
        <View style={styles.loc}>
          <MapPin size={13} color={colors.icon} />
          <Text style={[styles.lt, { color: colors.muted }]}>
            {locationText} {weatherText ? `· ${weatherText}` : ""}
          </Text>
        </View>

        <Pressable onPress={onOpenDirect} hitSlop={10}>
          <Heart size={22} color={colors.icon} />
        </Pressable>

        <Pressable onPress={onOpenDirect} hitSlop={10}>
          <Send size={21} color={colors.icon} style={{ transform: [{ rotate: "-22deg" }] }} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 28, paddingBottom: 12, zIndex: 10 },
  left: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoBadge: { width: 34, height: 34, borderRadius: 10 },
  title: { fontSize: 24, fontWeight: "900", letterSpacing: 2 },
  right: { flexDirection: "row", alignItems: "center", gap: 12 },
  loc: { flexDirection: "row", alignItems: "center", gap: 4 },
  lt: { fontSize: 11, fontWeight: "600" }
});
