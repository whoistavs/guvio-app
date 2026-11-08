import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check, Flame, Repeat2, Snowflake } from "lucide-react-native";
import { FeedPost } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { ratePost, votePoll } from "../services/storage";
import { likeFeedback, tapFeedback } from "../utils/haptics";
import { PressableScale } from "./motion";

/** "repost de @ana" acima da foto */
export function RepostLine({ post, onOpenProfile }: { post: FeedPost; onOpenProfile?: (u: string) => void }) {
  const { colors } = useAppTheme();
  if (post.kind !== "repost" || !post.originalUsername) return null;
  return (
    <Pressable onPress={() => onOpenProfile?.(post.originalUsername!)} style={s.repost} hitSlop={6}>
      <Repeat2 size={14} color={colors.muted} />
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
        repost de <Text style={{ color: colors.text, fontWeight: "700" }}>@{post.originalUsername}</Text>
      </Text>
    </Pressable>
  );
}

/** Enquete "Qual look?": vota e mostra a porcentagem de cada opção */
export function PollBar({ post, onChange, isMine }: { post: FeedPost; onChange: (p: FeedPost) => void; isMine?: boolean }) {
  const { colors } = useAppTheme();
  const [busy, setBusy] = useState(false);
  if (post.kind !== "poll" || !post.poll) return null;
  const { options, votes, myVote } = post.poll;
  const total = votes.reduce((a, b) => a + b, 0);
  const showResults = myVote !== null || isMine;

  const vote = async (i: number) => {
    if (busy || myVote === i) return;
    tapFeedback();
    setBusy(true);
    try {
      onChange(await votePoll(post, i));
    } catch {
      /* fica como estava */
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.poll}>
      <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 8 }}>
        Qual look? <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 12 }}>· {total} {total === 1 ? "voto" : "votos"}</Text>
      </Text>
      {options.map((o, i) => {
        const pct = total ? Math.round((votes[i] / total) * 100) : 0;
        const mine = myVote === i;
        const leader = showResults && total > 0 && votes[i] === Math.max(...votes);
        return (
          <PressableScale key={i} onPress={() => vote(i)} style={[s.option, { borderColor: mine ? colors.text : colors.border, backgroundColor: colors.surface }]}>
            {showResults ? <View style={[s.fill, { width: `${pct}%`, backgroundColor: leader ? "rgba(0,149,246,.28)" : "rgba(127,127,127,.18)" }]} /> : null}
            <Text style={{ color: colors.text, fontWeight: "700", width: 22 }}>{i + 1}</Text>
            <Text style={{ color: colors.text, fontWeight: mine ? "700" : "700", flex: 1 }} numberOfLines={1}>
              {o}
            </Text>
            {mine ? <Check size={15} color={colors.text} /> : null}
            {showResults ? <Text style={{ color: colors.text, fontWeight: "700" }}>{pct}%</Text> : null}
          </PressableScale>
        );
      })}
      {!showResults ? <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>Vote para ver o resultado</Text> : null}
    </View>
  );
}

/** Avaliação: aprovado ou não curti */
export function RatingBar({ post, onChange }: { post: FeedPost; onChange: (p: FeedPost) => void }) {
  const { colors } = useAppTheme();
  const r = post.rating || { fire: 0, ice: 0, mine: 0 };
  const total = r.fire + r.ice;
  const pct = total ? Math.round((r.fire / total) * 100) : 0;

  const rate = async (v: 1 | -1) => {
    if (v === 1) likeFeedback();
    else tapFeedback();
    const optimistic = {
      ...post,
      rating: {
        fire: r.fire - (r.mine === 1 ? 1 : 0) + (r.mine !== 1 && v === 1 ? 1 : 0),
        ice: r.ice - (r.mine === -1 ? 1 : 0) + (r.mine !== -1 && v === -1 ? 1 : 0),
        mine: (r.mine === v ? 0 : v) as 1 | -1 | 0
      }
    };
    onChange(optimistic);
    try {
      await ratePost(post, v);
    } catch {
      onChange(post);
    }
  };

  return (
    <View style={s.rating}>
      <PressableScale onPress={() => rate(1)} style={[s.rateBtn, { borderColor: r.mine === 1 ? "#FF6B2C" : colors.border, backgroundColor: r.mine === 1 ? "rgba(255,107,44,.15)" : "transparent" }]}>
        <Flame size={15} color={r.mine === 1 ? "#FF6B2C" : colors.icon} fill={r.mine === 1 ? "#FF6B2C" : "none"} />
        <Text style={{ color: colors.text, fontWeight: "600", fontSize: 12 }}>{r.fire}</Text>
      </PressableScale>
      <PressableScale onPress={() => rate(-1)} style={[s.rateBtn, { borderColor: r.mine === -1 ? "#4AA3FF" : colors.border, backgroundColor: r.mine === -1 ? "rgba(74,163,255,.15)" : "transparent" }]}>
        <Snowflake size={15} color={r.mine === -1 ? "#4AA3FF" : colors.icon} />
        <Text style={{ color: colors.text, fontWeight: "600", fontSize: 12 }}>{r.ice}</Text>
      </PressableScale>
      {total >= 3 ? (
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{pct}% aprovam</Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  repost: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingBottom: 6 },
  poll: { paddingHorizontal: 14, paddingTop: 10, gap: 6 },
  option: { flexDirection: "row", alignItems: "center", gap: 8, height: 42, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 12, overflow: "hidden" },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0 },
  rating: { flexDirection: "row", alignItems: "center", gap: 8 },
  rateBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, height: 28 }
});
