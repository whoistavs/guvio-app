import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { ChevronRight, Trophy } from "lucide-react-native";
import { useAppTheme } from "../context/AppTheme";
import { PressableScale } from "./motion";
import { AppIcon } from "./AppIcon";
import { currentChallenge } from "../data/challenges";

/** Cartão do desafio da semana (Home) */
export function ChallengeCard({ onJoin, onOpenRanking }: { onJoin: (tag: string) => void; onOpenRanking: () => void }) {
  const { colors } = useAppTheme();
  const ch = currentChallenge();
  return (
    <PressableScale scaleTo={0.98} onPress={onOpenRanking} style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={s.top}>
        <View style={[s.emoji, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <AppIcon name={ch.icon} size={22} color={colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.kicker, { color: colors.muted }]}>
            Desafio da semana · {ch.daysLeft === 1 ? "último dia" : `faltam ${ch.daysLeft} dias`}
          </Text>
          <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>
            {ch.title}
          </Text>
          <Text style={{ color: "#4AA3FF", fontWeight: "600", fontSize: 12 }} numberOfLines={1}>
            #{ch.tag}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.muted} />
      </View>
      <View style={s.actions}>
        <PressableScale onPress={() => onJoin(ch.tag)} style={[s.btn, { backgroundColor: colors.text }]}>
          <Text style={{ color: colors.bg, fontWeight: "700", fontSize: 12 }}>Participar</Text>
        </PressableScale>
        <PressableScale onPress={onOpenRanking} style={[s.btn, { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border }]}>
          <Trophy size={14} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Ranking</Text>
        </PressableScale>
      </View>
    </PressableScale>
  );
}

const s = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 4, marginBottom: 10, borderWidth: 1, borderRadius: 20, padding: 14, gap: 12 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  emoji: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  kicker: { fontSize: 12, fontWeight: "500" },
  title: { fontSize: 15, fontWeight: "700", marginTop: 2 },
  actions: { flexDirection: "row", gap: 8 },
  btn: { flex: 1, height: 36, borderRadius: 18, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" }
});
