import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { FeedPost, UserProfile } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { computeAchievements } from "../utils/achievements";
import { CHALLENGES, weekIndex, weekStart } from "../data/challenges";
import { loadChallengePosts } from "../services/storage";

const DAY = 86400000;

/** foi 1º lugar em algum dos últimos desafios já encerrados? (só consulta se a pessoa participou) */
async function wonRecentChallenge(profile: UserProfile, posts: FeedPost[]): Promise<boolean> {
  const now = new Date();
  for (let back = 1; back <= 4; back++) {
    const ref = new Date(now.getTime() - back * 7 * DAY);
    const start = weekStart(ref);
    const end = new Date(start.getTime() + 7 * DAY);
    const idx = weekIndex(ref);
    const ch = CHALLENGES[((idx % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length];
    const participated = posts.some(
      p => (p.caption || "").toLowerCase().includes(`#${ch.tag}`) && (!p.createdAt || (new Date(p.createdAt) >= start && new Date(p.createdAt) < end))
    );
    if (!participated) continue;
    const ranking = (await loadChallengePosts(ch.tag, start.toISOString())).filter(
      p => !p.createdAt || new Date(p.createdAt) < end
    );
    const top = ranking.sort((a, b) => (b.likes || 0) - (a.likes || 0))[0];
    if (top && (top.userId === profile.id || top.creatorUsername === profile.username)) return true;
  }
  return false;
}

/** Insígnias conquistadas, abaixo da bio */
export function AchievementsRow({ profile, posts }: { profile: UserProfile; posts: FeedPost[] }) {
  const { colors } = useAppTheme();
  const [champion, setChampion] = useState(false);

  useEffect(() => {
    let alive = true;
    wonRecentChallenge(profile, posts)
      .then(v => alive && setChampion(v))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [profile.id, posts.length]);

  const list = useMemo(() => computeAchievements(profile, posts, { champion }), [profile, posts, champion]);
  if (!list.length) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
      {list.map(a => (
        <Pressable
          key={a.id}
          onPress={() => Alert.alert(`${a.emoji} ${a.title}`, a.description)}
          style={[s.badge, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={{ fontSize: 13 }}>{a.emoji}</Text>
          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "800" }}>{a.title}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: { paddingHorizontal: 22, paddingTop: 12, gap: 6 },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 14, paddingHorizontal: 9, paddingVertical: 5 }
});
