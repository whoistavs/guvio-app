import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Crown, Check } from "lucide-react-native";
import { useAppTheme } from "../context/AppTheme";
import { FastImage } from "./FastImage";
import { noSwipeBack } from "./gestures";
import { isCloud } from "../services/supabase";
import { fetchCityWeek, voteCityWeek, CityWeek } from "../services/cloud";
import { loadSavedProfile } from "../services/storage";
import { tapFeedback, successFeedback } from "../utils/haptics";

/** "Look da semana" de uma cidade: os looks dos últimos 7 dias e a votação (1 voto por semana) */
export function CityWeekCard({ city, onOpenPost }: { city: string; onOpenPost?: (id: string) => void }) {
  const { colors } = useAppTheme();
  const [data, setData] = useState<CityWeek | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [cloud, setCloud] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    isCloud().then(c => {
      if (!alive) return;
      setCloud(c);
      if (!c || !city) return;
      fetchCityWeek(city)
        .then(d => alive && setData(d))
        .catch(() => alive && setData({ posts: [], myVote: null }));
    });
    loadSavedProfile().then(p => alive && setMyId(p.id)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [city]);

  if (!cloud || !city) return null;

  const vote = async (postId: string, postCity: string) => {
    if (!data || data.myVote === postId) return;
    tapFeedback();
    setBusy(postId);
    const prev = data;
    // otimista: move o voto na hora
    setData({
      myVote: postId,
      posts: data.posts
        .map(p => ({
          ...p,
          votes: p.votes + (p.id === postId ? 1 : 0) - (p.id === data.myVote ? 1 : 0)
        }))
        .sort((a, b) => b.votes - a.votes || (b.likes || 0) - (a.likes || 0))
    });
    try {
      await voteCityWeek(postCity || city, postId);
      successFeedback();
    } catch (e: any) {
      setData(prev);
      Alert.alert("Não deu para votar", "Tente de novo daqui a pouco.");
    } finally {
      setBusy(null);
    }
  };

  const leader = data?.posts.find(p => p.votes > 0);

  return (
    <View style={[s.card, { borderColor: colors.border }]}>
      <View style={s.head}>
        <Crown size={18} color={colors.text} />
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.text }]} numberOfLines={1}>
            Look da semana · {city}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {leader ? `Liderando: @${leader.creatorUsername || leader.creatorName}` : "Vote no look mais bonito da cidade. 1 voto por semana."}
          </Text>
        </View>
      </View>

      {!data ? (
        <ActivityIndicator color={colors.muted} style={{ marginVertical: 18 }} />
      ) : data.posts.length === 0 ? (
        <Text style={{ color: colors.muted, fontSize: 12, paddingVertical: 10 }}>
          Ninguém publicou em {city} nos últimos 7 dias. Publique o primeiro!
        </Text>
      ) : (
        <ScrollView {...noSwipeBack} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {data.posts.map((p, i) => {
            const mine = p.userId === myId;
            const voted = data.myVote === p.id;
            return (
              <View key={p.id} style={{ width: 118 }}>
                <Pressable onPress={() => onOpenPost?.(p.id)}>
                  <FastImage source={p.image} style={s.img} contentFit="cover" />
                  {i === 0 && p.votes > 0 ? (
                    <View style={[s.crown, { backgroundColor: colors.text }]}>
                      <Crown size={12} color={colors.bg} />
                    </View>
                  ) : null}
                </Pressable>
                <Text style={{ color: colors.text, fontSize: 11, fontWeight: "600", marginTop: 4 }} numberOfLines={1}>
                  @{p.creatorUsername || p.creatorName}
                </Text>
                <Pressable
                  disabled={mine || !!busy}
                  onPress={() => vote(p.id, p.city)}
                  style={[
                    s.btn,
                    voted
                      ? { backgroundColor: colors.text }
                      : { borderWidth: 1, borderColor: colors.border, opacity: mine ? 0.5 : 1 }
                  ]}
                >
                  {voted ? <Check size={12} color={colors.bg} /> : null}
                  <Text style={{ color: voted ? colors.bg : colors.text, fontSize: 11, fontWeight: "700" }}>
                    {mine ? "Seu look" : voted ? "Seu voto" : "Votar"} · {p.votes}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 14, marginTop: 16, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 15, fontWeight: "700" },
  img: { width: 118, height: 148, borderRadius: 10 },
  crown: { position: "absolute", top: 6, left: 6, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  btn: { marginTop: 6, height: 28, borderRadius: 14, flexDirection: "row", gap: 4, alignItems: "center", justifyContent: "center" }
});
