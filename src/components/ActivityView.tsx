import React, { useState, useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Heart, MessageCircle, UserPlus, ArrowLeft } from "lucide-react-native";
import { ActivityItem, MOCK_ACTIVITIES } from "../data/mockData";
import { ScreenHeader } from "./ScreenHeader";
import { useAppTheme } from "../context/AppTheme";
import { FastImage } from "./FastImage";
import {
  loadActivities,
  loadFollowedUsers,
  saveFollowedUsers,
  answerFollowRequest,
  loadRequestedIds,
  loadFollowRequests,
  loadFollowList,
  loadSavedProfile,
  cancelFollowRequest
} from "../services/storage";
import { ActivityGroup, groupActivities, groupMessage } from "../utils/groupActivities";
import { tapFeedback } from "../utils/haptics";

type Filter = "all" | "following" | "comments" | "followers";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Tudo" },
  { id: "following", label: "Pessoas que você segue" },
  { id: "comments", label: "Comentários" },
  { id: "followers", label: "Seguidores" }
];
type Bucket = "today" | "yesterday" | "week" | "month" | "older";
const SECTIONS: { id: Bucket; title: string }[] = [
  { id: "today", title: "Hoje" },
  { id: "yesterday", title: "Ontem" },
  { id: "week", title: "Últimos 7 dias" },
  { id: "month", title: "Últimos 30 dias" },
  { id: "older", title: "Mais antigas" }
];
function bucketOf(a: ActivityItem): Bucket {
  if (!a.createdAt) return a.timeCategory === "today" ? "today" : a.timeCategory === "week" ? "week" : "older";
  const d = new Date(a.createdAt);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = 86400000;
  const t = d.getTime();
  if (t >= start.getTime()) return "today";
  if (t >= start.getTime() - day) return "yesterday";
  if (t >= start.getTime() - 7 * day) return "week";
  if (t >= start.getTime() - 30 * day) return "month";
  return "older";
}

export function ActivityView({
  onBack,
  onOpenProfile,
  onOpenPost
}: {
  onBack: () => void;
  onOpenProfile?: (username: string) => void;
  onOpenPost?: (postId: string) => void;
}) {
  const { colors } = useAppTheme();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [followedIds, setFollowedIds] = useState<string[]>([]);

  const [requestedIds, setRequestedIds] = useState<string[]>([]);
  // pedidos para seguir: quem ainda espera resposta e quem já me segue (aceitos)
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);
  const [followerIds, setFollowerIds] = useState<string[]>([]);

  useEffect(() => {
    loadActivities().then(setActivities);
    loadFollowedUsers().then(setFollowedIds);
    loadRequestedIds().then(setRequestedIds).catch(() => {});
    loadFollowRequests()
      .then(l => setPendingIds(l.map(p => p.id)))
      .catch(() => setPendingIds([]));
    loadSavedProfile()
      .then(me => loadFollowList(me, "followers"))
      .then(l => setFollowerIds(l.map(p => p.id)))
      .catch(() => {});
  }, []);

  const toggleFollow = async (userId: string) => {
    tapFeedback();
    if (requestedIds.includes(userId)) {
      // cancelar o pedido (perfil privado)
      setRequestedIds(prev => prev.filter(id => id !== userId));
      await cancelFollowRequest(userId).catch(() => setRequestedIds(prev => [...prev, userId]));
      return;
    }
    const on = !followedIds.includes(userId);
    const updated = on ? [...followedIds, userId] : followedIds.filter(id => id !== userId);
    setFollowedIds(updated);
    try {
      const requested = await saveFollowedUsers(updated);
      if (requested.includes(userId)) {
        setFollowedIds(prev => prev.filter(id => id !== userId));
        setRequestedIds(prev => [...prev, userId]);
      }
    } catch {
      setFollowedIds(followedIds);
    }
  };

  /** botão "Seguir de volta" / "Seguindo" / "Solicitado" */
  const followBackButton = (userId: string) => {
    const following = followedIds.includes(userId);
    const requested = requestedIds.includes(userId);
    const filled = !following && !requested;
    return (
      <Pressable onPress={() => toggleFollow(userId)} style={[s.followButton, { backgroundColor: filled ? "#0095F6" : colors.surface }]}>
        <Text style={[s.followButtonText, { color: filled ? "#FFF" : colors.text }]}>
          {following ? "Seguindo" : requested ? "Solicitado" : "Seguir de volta"}
        </Text>
      </Pressable>
    );
  };

  const [answered, setAnswered] = useState<Record<string, "ok" | "no">>({});
  const [filter, setFilter] = useState<Filter>("all");
  const shown = activities.filter(a =>
    filter === "all"
      ? true
      : filter === "following"
      ? followedIds.includes(a.userId)
      : filter === "comments"
      ? a.type === "comment" || a.type === "reply" || a.type === "comment_like"
      : a.type === "follow" || a.type === "follow_request" || a.type === "follow_accept"
  );
  // pedidos para seguir ficam num bloco próprio no topo (igual ao Instagram)
  const pendingReqs = shown.filter(a => a.type === "follow_request" && !answered[a.id] && (pendingIds === null || pendingIds.includes(a.userId)));
  const rest = shown.filter(a => !pendingReqs.includes(a));
  const buckets = SECTIONS.map(sec => ({ ...sec, groups: groupActivities(rest.filter(a => bucketOf(a) === sec.id)) })).filter(b => b.groups.length);

  const answer = async (item: ActivityItem, accept: boolean) => {
    setAnswered(prev => ({ ...prev, [item.id]: accept ? "ok" : "no" }));
    try {
      await answerFollowRequest(item.userId, accept);
    } catch {
      setAnswered(prev => {
        const n = { ...prev };
        delete n[item.id];
        return n;
      });
    }
  };

  const renderActivityRow = (g: ActivityGroup) => {
    const item = g.lead;
    // pedido para seguir: respondido agora, ainda esperando, ou já aceito antes
    const reqState: "ok" | "no" | "pending" | null =
      item.type !== "follow_request"
        ? null
        : answered[item.id] ||
          (pendingIds === null || pendingIds.includes(item.userId) ? "pending" : followerIds.includes(item.userId) ? "ok" : null);

    const openItem = () => {
      if (item.type !== "follow" && item.postId) onOpenPost?.(item.postId);
      else onOpenProfile?.(item.username);
    };

    return (
      <Pressable key={g.key} style={s.activityRow} onPress={openItem}>
        {/* User Avatar with Type Badge */}
        <Pressable onPress={() => onOpenProfile?.(item.username)} style={s.avatarContainer}>
          <FastImage source={item.userAvatar} style={s.avatar} contentFit="cover" />
          {g.others[0] ? (
            <FastImage source={g.others[0].userAvatar} style={[s.avatar2, { borderColor: colors.bg }]} contentFit="cover" />
          ) : null}
          <View
            style={[
              s.typeBadge,
              {
                backgroundColor:
                  item.type === "like" || item.type === "comment_like"
                    ? "#FF3040"
                    : item.type === "comment" || item.type === "reply"
                    ? "#168CFF"
                    : "#10B981"
              }
            ]}
          >
            {item.type === "like" || item.type === "comment_like" ? (
              <Heart size={9} color="#FFF" fill="#FFF" />
            ) : item.type === "comment" || item.type === "reply" ? (
              <MessageCircle size={9} color="#FFF" />
            ) : (
              <UserPlus size={9} color="#FFF" />
            )}
          </View>
        </Pressable>

        {/* Message and Time */}
        <View style={s.messageContainer}>
          <Text style={[s.activityText, { color: colors.text }]}>
            <Text
              style={{ fontWeight: "700" }}
              onPress={() => onOpenProfile?.(item.username)}
            >
              @{item.username}{" "}
            </Text>
            {reqState === "ok" ? "agora segue você." : groupMessage(g)}
          </Text>
          <Text style={[s.timeAgo, { color: colors.muted }]}>{item.timeAgo}</Text>
        </View>

        {/* Right side: Follow button OR Post thumbnail */}
        {item.type === "follow_request" ? (
          reqState === "ok" ? (
            followBackButton(item.userId)
          ) : reqState === "no" ? (
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Recusado</Text>
          ) : reqState === null ? null : (
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Pressable onPress={() => answer(item, true)} style={[s.followButton, { backgroundColor: "#0095F6", minWidth: 0 }]}>
                <Text style={[s.followButtonText, { color: "#FFF" }]}>Aceitar</Text>
              </Pressable>
              <Pressable onPress={() => answer(item, false)} style={[s.followButton, { backgroundColor: colors.surface, minWidth: 0 }]}>
                <Text style={[s.followButtonText, { color: colors.text }]}>Recusar</Text>
              </Pressable>
            </View>
          )
        ) : item.type === "follow" && !g.others.length ? (
          followBackButton(item.userId)
        ) : item.postImage ? (
          <FastImage source={item.postImage} style={s.postThumb} contentFit="cover" />
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={[s.container, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Notificações" onBack={onBack} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.chips}>
        {FILTERS.map(f => {
          const on = filter === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFilter(f.id)}
              style={[s.chip, { borderColor: on ? colors.text : colors.border, backgroundColor: on ? colors.text : "transparent" }]}
            >
              <Text style={{ color: on ? colors.bg : colors.text, fontWeight: "600", fontSize: 13 }}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <ScrollView contentContainerStyle={s.content}>
        {activities.length === 0 && (
          <View style={{ alignItems: "center", paddingTop: 60, gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: "600", fontSize: 16 }}>Nada por aqui ainda</Text>
            <Text style={{ color: colors.muted, textAlign: "center", fontSize: 12 }}>
              Curtidas, comentários e novos seguidores aparecerão aqui.
            </Text>
          </View>
        )}
        {pendingReqs.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>Pedidos para seguir</Text>
            {groupActivities(pendingReqs).map(renderActivityRow)}
          </View>
        )}
        {buckets.map(b => (
          <View key={b.id} style={[s.section, { borderTopColor: colors.border }]}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>{b.title}</Text>
            {b.groups.map(renderActivityRow)}
          </View>
        ))}
        {activities.length > 0 && !shown.length ? (
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}>Nada neste filtro ainda.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingBottom: 80 },
  content: { paddingHorizontal: 18, paddingTop: 10 },
  section: { marginBottom: 8, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "transparent" },
  chips: { gap: 8, paddingHorizontal: 18, paddingVertical: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 14, letterSpacing: -0.2 },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  avatarContainer: { position: "relative" },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatar2: { position: "absolute", left: 18, top: 16, width: 30, height: 30, borderRadius: 15, borderWidth: 2 },
  typeBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#000"
  },
  messageContainer: { flex: 1 },
  activityText: { fontSize: 13, lineHeight: 18 },
  timeAgo: { fontSize: 11, marginTop: 2 },
  followButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    minWidth: 90,
    alignItems: "center"
  },
  followButtonText: { fontSize: 11, fontWeight: "600" },
  postThumb: { width: 44, height: 44, borderRadius: 8 }
});
