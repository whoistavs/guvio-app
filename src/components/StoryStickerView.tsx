import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Send } from "lucide-react-native";
import { StoryItem, StorySticker } from "../data/mockData";
import { loadStoryResponses, respondStory } from "../services/storage";
import { tapFeedback } from "../utils/haptics";

/**
 * Sticker do story (enquete ou caixinha de pergunta).
 * - preview: só desenha (na tela de criar)
 * - no visualizador: quem vê vota/responde; o dono vê o resultado
 */
export function StoryStickerView({
  sticker,
  story,
  isMe,
  onPause,
  preview
}: {
  sticker: StorySticker;
  story?: StoryItem;
  isMe?: boolean;
  onPause?: (paused: boolean) => void;
  preview?: boolean;
}) {
  const [votes, setVotes] = useState<number[] | null>(null);
  const [myVote, setMyVote] = useState<number | null>(null);
  const [answer, setAnswer] = useState("");
  const [sent, setSent] = useState(false);

  const loadVotes = async () => {
    if (!story || sticker.type !== "poll") return;
    const rows = (await loadStoryResponses(story.id)) as any[];
    const v = sticker.options.map((_, i) => rows.filter(r => r.kind === "vote" && String(r.value) === String(i)).length);
    if (rows.some(r => r.kind === "vote")) setVotes(v);
  };

  useEffect(() => {
    setVotes(null);
    setMyVote(null);
    setSent(false);
    setAnswer("");
    if (!preview && (isMe || sticker.type === "poll")) loadVotes().catch(() => {});
  }, [story?.id]);

  if (sticker.type === "poll") {
    const total = votes ? votes.reduce((a, b) => a + b, 0) : 0;
    const showResults = preview ? false : isMe || myVote !== null || (votes !== null && total > 0 && myVote !== null);
    return (
      <View style={s.card} pointerEvents={preview ? "none" : "auto"}>
        <Text style={s.question}>{sticker.question || "Enquete"}</Text>
        {sticker.options.map((o, i) => {
          const pct = total && votes ? Math.round((votes[i] / total) * 100) : 0;
          return (
            <Pressable
              key={i}
              disabled={isMe || myVote !== null || preview}
              onPress={async () => {
                if (!story) return;
                tapFeedback();
                setMyVote(i);
                setVotes(prev => {
                  const base = prev || sticker.options.map(() => 0);
                  const n = [...base];
                  n[i] += 1;
                  return n;
                });
                await respondStory(story.id, "vote", String(i)).catch(() => {});
                loadVotes().catch(() => {});
              }}
              style={[s.option, myVote === i && { borderColor: "#0095F6" }]}
            >
              {showResults ? <View style={[s.fill, { width: `${pct}%` }]} /> : null}
              <Text style={s.optionText} numberOfLines={1}>
                {o}
              </Text>
              {showResults ? <Text style={s.pct}>{pct}%</Text> : null}
            </Pressable>
          );
        })}
        {isMe && !preview ? <Text style={s.hint}>{total} {total === 1 ? "voto" : "votos"} · veja quem votou em "Quem viu"</Text> : null}
      </View>
    );
  }

  // caixinha de pergunta
  return (
    <View style={s.card} pointerEvents={preview ? "none" : "auto"}>
      <Text style={s.question}>{sticker.prompt || "Me pergunte algo"}</Text>
      {isMe && !preview ? (
        <Text style={s.hint}>As respostas aparecem em "Quem viu"</Text>
      ) : sent ? (
        <Text style={[s.hint, { color: "#111" }]}>Resposta enviada ✓</Text>
      ) : (
        <View style={s.answerRow}>
          <TextInput
            value={answer}
            onChangeText={setAnswer}
            editable={!preview}
            onFocus={() => onPause?.(true)}
            onBlur={() => onPause?.(false)}
            placeholder="Escreva sua resposta..."
            placeholderTextColor="#888"
            maxLength={300}
            style={s.answerInput}
          />
          <Pressable
            disabled={!answer.trim() || preview}
            onPress={async () => {
              if (!story || !answer.trim()) return;
              tapFeedback();
              await respondStory(story.id, "answer", answer.trim()).catch(() => {});
              setSent(true);
              onPause?.(false);
            }}
            hitSlop={8}
          >
            <Send size={18} color={answer.trim() ? "#0095F6" : "#BBB"} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { alignSelf: "center", width: "78%", backgroundColor: "#FFF", borderRadius: 20, padding: 14, gap: 8, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  question: { color: "#111", fontWeight: "900", fontSize: 16, textAlign: "center" },
  option: { height: 42, borderRadius: 12, borderWidth: 2, borderColor: "#E6E6E6", justifyContent: "center", paddingHorizontal: 12, overflow: "hidden", flexDirection: "row", alignItems: "center" },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,149,246,.22)" },
  optionText: { color: "#111", fontWeight: "800", flex: 1, textAlign: "center" },
  pct: { color: "#111", fontWeight: "900" },
  hint: { color: "#777", fontSize: 11, textAlign: "center" },
  answerRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F2F2F2", borderRadius: 12, paddingHorizontal: 10 },
  answerInput: { flex: 1, height: 40, color: "#111" }
});
