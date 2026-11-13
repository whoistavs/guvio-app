import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowLeft, ChevronDown } from "lucide-react-native";
import { useAppTheme } from "../context/AppTheme";

export function ScreenHeader({
  title,
  onBack,
  right,
  onTitlePress
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  /** tocar no título (ex.: @ do perfil para trocar de conta) */
  onTitlePress?: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={s.c}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={10}>
          <ArrowLeft size={24} color={colors.icon} />
        </Pressable>
      ) : (
        <View style={{ width: 24 }} />
      )}
      {onTitlePress ? (
        <Pressable onPress={onTitlePress} hitSlop={10} style={s.tp}>
          <Text style={[s.t, { color: colors.text }]}>{title}</Text>
          <ChevronDown size={16} color={colors.text} />
        </Pressable>
      ) : (
        <Text style={[s.t, { color: colors.text }]}>{title}</Text>
      )}
      <View style={{ width: 28, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}

const s = StyleSheet.create({
  c: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18 },
  t: { fontSize: 17, fontWeight: "600" },
  tp: { flexDirection: "row", alignItems: "center", gap: 4 }
});
