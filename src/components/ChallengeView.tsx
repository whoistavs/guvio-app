import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { FeedPost } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { GridSkeleton } from "./SkeletonLoader";
import { ScreenHeader } from "./ScreenHeader";
import { RankingGrid } from "./RankingGrid";
import { currentChallenge } from "../data/challenges";
import { loadChallengePosts } from "../services/storage";

export function ChallengeView({
  onBack,
  onJoin,
  onOpenPost
}: {
  onBack: () => void;
  onJoin: (tag: string) => void;
  onOpenPost: (id: string) => void;
}) {
  const { colors } = useAppTheme();
  const ch = currentChallenge();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChallengePosts(ch.tag, ch.start.toISOString())
      .then(setPosts)
      .finally(() => setLoading(false));
  }, [ch.tag]);

  const ends = ch.end.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Desafio da semana" onBack={onBack} />
      <ScrollView contentContainerStyle={s.c}>
        <Text style={s.emoji}>{ch.emoji}</Text>
        <Text style={[s.title, { color: colors.text }]}>{ch.title}</Text>
        <Text style={{ color: "#4AA3FF", fontWeight: "900", textAlign: "center", marginTop: 4 }}>#{ch.tag}</Text>
        <Text style={[s.desc, { color: colors.muted }]}>{ch.description}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}>
          Termina na segunda ({ends}) · os mais curtidos ganham o pódio
        </Text>
        <Pressable onPress={() => onJoin(ch.tag)} style={[s.join, { backgroundColor: colors.text }]}>
          <Text style={{ color: colors.bg, fontWeight: "900" }}>Participar com um look</Text>
        </Pressable>

        <Text style={[s.label, { color: colors.muted }]}>RANKING ({posts.length})</Text>
        {loading ? (
          <GridSkeleton count={6} />
        ) : posts.length === 0 ? (
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: 10 }}>
            Ninguém participou ainda. Seja o primeiro e garanta o 🥇!
          </Text>
        ) : (
          <RankingGrid posts={posts} onOpenPost={onOpenPost} />
        )}

        <View style={[s.next, { backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>PRÓXIMA SEMANA</Text>
          <Text style={{ color: colors.text, fontWeight: "800", marginTop: 3 }}>
            {ch.next.emoji} {ch.next.title}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  c: { padding: 20, paddingBottom: 60 },
  emoji: { fontSize: 52, textAlign: "center", marginTop: 6 },
  title: { fontSize: 24, fontWeight: "900", textAlign: "center", marginTop: 6 },
  desc: { fontSize: 14, lineHeight: 20, textAlign: "center", marginVertical: 12 },
  join: { height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginTop: 16 },
  label: { fontSize: 10, fontWeight: "800", letterSpacing: 1.3, marginTop: 26, marginBottom: 12 },
  next: { borderRadius: 16, padding: 14, marginTop: 26 }
});
