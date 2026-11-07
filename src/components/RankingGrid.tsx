import React from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { Heart } from "lucide-react-native";
import { FeedPost } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { FastImage } from "./FastImage";

const W = Math.min(Dimensions.get("window").width, 700);
const MEDALS = ["🥇", "🥈", "🥉"];

/** Pódio (3 primeiros) + grade com a posição de cada look */
export function RankingGrid({
  posts,
  onOpenPost,
  padding = 20
}: {
  posts: FeedPost[];
  onOpenPost?: (id: string) => void;
  padding?: number;
}) {
  const { colors } = useAppTheme();
  const podium = posts.slice(0, 3);
  const rest = posts.slice(3);
  const tile = (W - padding * 2 - 4) / 3;
  const big = (W - padding * 2 - 8) / 3;
  return (
    <View>
      <View style={s.podium}>
        {podium.map((p, i) => (
          <Pressable key={p.id} onPress={() => onOpenPost?.(p.id)} style={{ width: big }}>
            <FastImage source={p.image} style={{ width: big, height: big * 1.3, borderRadius: 14 }} contentFit="cover" />
            <Text style={s.medal}>{MEDALS[i]}</Text>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 11, marginTop: 5 }} numberOfLines={1}>
              @{p.creatorUsername || p.creatorName}
            </Text>
            <View style={s.likes}>
              <Heart size={11} color="#FF3B30" fill="#FF3B30" />
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>{p.likes}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      <View style={s.grid}>
        {rest.map((p, i) => (
          <Pressable key={p.id} onPress={() => onOpenPost?.(p.id)} style={{ width: tile, height: tile * 1.25 }}>
            <FastImage source={p.image} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            <View style={[s.rank, s.rankLeft]}>
              <Text style={s.rankText}>#{i + 4}</Text>
            </View>
            <View style={[s.rank, s.rankRight]}>
              <Heart size={9} color="#FFF" fill="#FFF" />
              <Text style={s.rankText}>{p.likes}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  podium: { flexDirection: "row", gap: 4, marginBottom: 14 },
  medal: { position: "absolute", top: 6, left: 6, fontSize: 22 },
  likes: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 2 },
  rank: { position: "absolute", top: 5, backgroundColor: "rgba(0,0,0,.6)", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  rankLeft: { left: 5 },
  rankRight: { right: 5, flexDirection: "row", gap: 3, alignItems: "center" },
  rankText: { color: "#FFF", fontSize: 10, fontWeight: "900" }
});
