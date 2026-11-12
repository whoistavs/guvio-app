import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../context/AppTheme";
import { ScreenHeader } from "./ScreenHeader";
import { FastImage } from "./FastImage";
import { adminDeletePost, adminDismissReports, adminOverview, AdminOverview, timeAgo } from "../services/cloud";

type Tab = "reports" | "feedback" | "users" | "posts";

/** Painel do criador: números do beta, denúncias, feedbacks, quem entrou e looks recentes */
export function AdminView({ onBack, onOpenPost, onOpenProfile }: { onBack: () => void; onOpenPost?: (id: string) => void; onOpenProfile?: (username: string) => void }) {
  const { colors } = useAppTheme();
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("reports");

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await adminOverview());
    } catch (e: any) {
      setError(/permiss/i.test(e?.message || "") ? "Sua conta não é administradora." : "Não foi possível carregar. Rode a migração 012 no Supabase.");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const removePost = (postId: string) =>
    Alert.alert("Apagar este look?", "Ele some para todo mundo. Não dá para desfazer.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          try {
            await adminDeletePost(postId);
            await load();
          } catch (e: any) {
            Alert.alert("Erro", e?.message || "Tente de novo.");
          }
        }
      }
    ]);

  const keepPost = async (postId: string) => {
    try {
      await adminDismissReports(postId);
      await load();
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Tente de novo.");
    }
  };

  const stats = data
    ? [
        { n: data.users, l: "pessoas", sub: `+${data.users_7d} na semana` },
        { n: data.posts, l: "looks", sub: `+${data.posts_7d} na semana` },
        { n: data.comments_7d, l: "comentários", sub: "nos últimos 7 dias" },
        { n: data.messages_7d, l: "mensagens", sub: "nos últimos 7 dias" },
        { n: data.reports_open, l: "denúncias", sub: "abertas" },
        { n: data.feedback_7d, l: "feedbacks", sub: "nos últimos 7 dias" }
      ]
    : [];

  const tabs: [Tab, string][] = [
    ["reports", `Denúncias${data?.reports.length ? ` (${data.reports.length})` : ""}`],
    ["feedback", "Feedbacks"],
    ["users", "Quem entrou"],
    ["posts", "Looks"]
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Painel do criador" onBack={onBack} />
      {error ? (
        <Text style={{ color: colors.muted, textAlign: "center", padding: 30 }}>{error}</Text>
      ) : !data ? (
        <ActivityIndicator color={colors.muted} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 50 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.muted} />}
        >
          <View style={s.stats}>
            {stats.map(x => (
              <View key={x.l} style={[s.stat, { backgroundColor: colors.surface }]}>
                <Text style={[s.statN, { color: colors.text }]}>{x.n}</Text>
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{x.l}</Text>
                <Text style={{ color: colors.muted, fontSize: 10 }}>{x.sub}</Text>
              </View>
            ))}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
            {tabs.map(([id, l]) => (
              <Pressable
                key={id}
                onPress={() => setTab(id)}
                style={[s.tab, { borderColor: tab === id ? colors.text : colors.border, backgroundColor: tab === id ? colors.text : "transparent" }]}
              >
                <Text style={{ color: tab === id ? colors.bg : colors.text, fontSize: 12, fontWeight: "600" }}>{l}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {tab === "reports" ? (
            data.reports.length === 0 ? (
              <Empty text="Nenhuma denúncia. Tudo tranquilo." />
            ) : (
              data.reports.map(r => (
                <View key={r.post_id} style={[s.row, { borderBottomColor: colors.border }]}>
                  <Pressable onPress={() => onOpenPost?.(r.post_id)}>
                    <FastImage source={r.image_url} style={s.thumb} contentFit="cover" />
                  </Pressable>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>
                      @{r.username} · {r.total} {r.total === 1 ? "denúncia" : "denúncias"}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={2}>
                      {r.reasons}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{timeAgo(r.last_at)}</Text>
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                      <Pressable onPress={() => removePost(r.post_id)} style={[s.btn, { backgroundColor: "#ED4956" }]}>
                        <Text style={s.btnText}>Apagar look</Text>
                      </Pressable>
                      <Pressable onPress={() => keepPost(r.post_id)} style={[s.btn, { backgroundColor: colors.surface }]}>
                        <Text style={[s.btnText, { color: colors.text }]}>Manter</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))
            )
          ) : tab === "feedback" ? (
            data.feedback.length === 0 ? (
              <Empty text="Nenhum feedback ainda." />
            ) : (
              data.feedback.map(f => (
                <View key={f.id} style={[s.row, { borderBottomColor: colors.border, alignItems: "flex-start" }]}>
                  {f.screenshot_url ? <FastImage source={f.screenshot_url} style={s.thumb} contentFit="cover" /> : null}
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {f.kind.toUpperCase()} · {f.username ? `@${f.username}` : "anônimo"} · {timeAgo(f.created_at)}
                      {f.platform ? ` · ${f.platform}` : ""}
                      {f.app_version ? ` · ${f.app_version}` : ""}
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 14 }}>{f.text}</Text>
                  </View>
                </View>
              ))
            )
          ) : tab === "users" ? (
            data.new_users.map(u => (
              <Pressable key={u.id} onPress={() => onOpenProfile?.(u.username)} style={[s.row, { borderBottomColor: colors.border }]}>
                <FastImage source={u.avatar_url} style={s.avatar} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>@{u.username}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {u.display_name} · {u.posts} {u.posts === 1 ? "look" : "looks"}
                  </Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{timeAgo(u.created_at)}</Text>
              </Pressable>
            ))
          ) : (
            data.recent_posts.map(p => (
              <Pressable key={p.id} onPress={() => onOpenPost?.(p.id)} style={[s.row, { borderBottomColor: colors.border }]}>
                <FastImage source={p.image_url} style={s.thumb} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>@{p.username}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={2}>
                    {p.caption || "sem legenda"}
                  </Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{timeAgo(p.created_at)}</Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );

  function Empty({ text }: { text: string }) {
    return <Text style={{ color: colors.muted, textAlign: "center", padding: 30 }}>{text}</Text>;
  }
}

const s = StyleSheet.create({
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 16 },
  stat: { width: "31%", flexGrow: 1, borderRadius: 14, padding: 12, gap: 1 },
  statN: { fontSize: 22, fontWeight: "700" },
  tabs: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  thumb: { width: 56, height: 70, borderRadius: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  btn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  btnText: { color: "#FFF", fontWeight: "700", fontSize: 12 }
});
