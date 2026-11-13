import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Heart, MapPin, Send } from "lucide-react-native";
import { useAppTheme } from "../context/AppTheme";

export function Header({
  locationText = "Campinas, SP",
  weatherText,
  onOpenDirect,
  onPressLocation,
  onOpenBeta,
  onOpenActivity,
  onLogoPress,
  hasUnreadActivity = true,
  unreadMessages = 0
}: {
  locationText?: string;
  weatherText?: string;
  onOpenDirect?: () => void;
  /** toque na cidade: pede a localização de novo */
  onPressLocation?: () => void;
  /** selo BETA: abre o feedback */
  onOpenBeta?: () => void;
  onOpenActivity?: () => void;
  /** toques no logo (10 seguidos liga o modo desenvolvedor no beta) */
  onLogoPress?: () => void;
  hasUnreadActivity?: boolean;
  unreadMessages?: number;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.c}>
      <View style={styles.left}>
        <Pressable onPress={onLogoPress} style={styles.left} accessibilityLabel="GUVIO">
          <Image source={require("../assets/logo.png")} style={styles.logoBadge} />
          <Text style={[styles.title, { color: colors.text }]}>GUVIO</Text>
        </Pressable>
        {onOpenBeta ? (
          <Pressable onPress={onOpenBeta} hitSlop={8} style={[styles.beta, { borderColor: colors.border }]}>
            <Text style={[styles.betaText, { color: colors.muted }]}>BETA</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.right}>
        <Pressable onPress={onPressLocation} hitSlop={8} style={styles.loc}>
          <MapPin size={13} color={colors.icon} />
          <Text numberOfLines={1} style={[styles.lt, { color: colors.muted }]}>
            {locationText} {weatherText ? `· ${weatherText}` : ""}
          </Text>
        </Pressable>

        <Pressable onPress={onOpenActivity} hitSlop={10} style={styles.iconBtn}>
          <Heart size={22} color={colors.icon} />
          {hasUnreadActivity && <View style={styles.activityBadgeDot} />}
        </Pressable>

        <Pressable onPress={onOpenDirect} hitSlop={10} style={styles.iconBtn}>
          <View style={{ transform: [{ rotate: "-22deg" }] }}>
            <Send size={21} color={colors.icon} />
          </View>
          {unreadMessages > 0 && (
            <View style={styles.dmBadge}>
              <Text style={styles.dmBadgeText}>{unreadMessages > 9 ? "9+" : unreadMessages}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 28, paddingBottom: 12, zIndex: 10 },
  left: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoBadge: { width: 34, height: 34, borderRadius: 10 },
  title: { fontSize: 24, fontWeight: "700", letterSpacing: 2 },
  beta: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 2 },
  betaText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.8 },
  right: { flexDirection: "row", alignItems: "center", gap: 14, flexShrink: 1, marginLeft: 12 },
  loc: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  lt: { fontSize: 11, fontWeight: "600", flexShrink: 1 },
  iconBtn: { position: "relative", padding: 2 },
  dmBadge: {
    position: "absolute",
    top: -6,
    right: -9,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: "#FF3040",
    alignItems: "center",
    justifyContent: "center"
  },
  dmBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "700" },
  activityBadgeDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF3040"
  }
});
