import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight, Trophy } from "lucide-react-native";
import { useAppTheme } from "../context/AppTheme";
import { currentChallenge } from "../data/challenges";

/** Cartão do desafio da semana (Home) */
export function ChallengeCard({ onJoin, onOpenRanking }: { onJoin: (tag: string) => void; onOpenRanking: () => void }) {
  const { colors } = useAppTheme();
  const ch = currentChallenge();
  return (
    <Pressable onPress={onOpenRanking} style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={s.top}>
        <Text style={s.emoji}>{ch.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[s.kicker, { color: colors.muted }]}>
            DESAFIO DA SEMANA · {ch.daysLeft === 1 ? "último dia" : `faltam ${ch.daysLeft} dias`}
          </Text>
          <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>
            {ch.title}
          </Text>
          <Text style={{ color: "#4AA3FF", fontWeight: "800", fontSize: 12 }} numberOfLines={1}>
            #{ch.tag}
          </Text>
        </View>
        <ChevronRight size={18} color={colors.muted} />
      </View>
      <View style={s.actions}>
        <Pressable onPress={() => onJoin(ch.tag)} style={[s.btn, { backgroundColor: colors.text }]}>
          <Text style={{ color: colors.bg, fontWeight: "900", fontSize: 12 }}>Participar</Text>
        </Pressable>
        <Pressable onPress={onOpenRanking} style={[s.btn, { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border }]}>
          <Trophy size={14} color={colors.text} />
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>Ranking</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 4, marginBottom: 10, borderWidth: 1, borderRadius: 20, padding: 14, gap: 12 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  emoji: { fontSize: 28 },
  kicker: { fontSize: 9.5, fontWeight: "800", letterSpacing: 1 },
  title: { fontSize: 15, fontWeight: "900", marginTop: 2 },
  actions: { flexDirection: "row", gap: 8 },
  btn: { flex: 1, height: 36, borderRadius: 18, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" }
});
