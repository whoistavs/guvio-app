import React, { useState, useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Heart, MessageCircle, UserPlus, ArrowLeft } from "lucide-react-native";
import { ActivityItem, MOCK_ACTIVITIES } from "../data/mockData";
import { ScreenHeader } from "./ScreenHeader";
import { useAppTheme } from "../context/AppTheme";
import { FastImage } from "./FastImage";
import { loadActivities, saveActivities, loadFollowedUsers, saveFollowedUsers, answerFollowRequest } from "../services/storage";
import { ActivityGroup, groupActivities, groupMessage } from "../utils/groupActivities";

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

  useEffect(() => {
    loadActivities().then(setActivities);
    loadFollowedUsers().then(setFollowedIds);
  }, []);

  const toggleFollow = async (userId: string) => {
    const updated = followedIds.includes(userId)
      ? followedIds.filter(id => id !== userId)
      : [...followedIds, userId];
    setFollowedIds(updated);
    await saveFollowedUsers(updated);
  };

  const [answered, setAnswered] = useState<Record<string, "ok" | "no">>({});
  const todayActivities = groupActivities(activities.filter(a => a.timeCategory === "today"));
  const weekActivities = groupActivities(activities.filter(a => a.timeCategory === "week" || a.timeCategory === "earlier"));

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
    const isFollowing = followedIds.includes(item.userId);

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
            {groupMessage(g)}
          </Text>
          <Text style={[s.timeAgo, { color: colors.muted }]}>{item.timeAgo}</Text>
        </View>

        {/* Right side: Follow button OR Post thumbnail */}
        {item.type === "follow_request" ? (
          answered[item.id] ? (
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
              {answered[item.id] === "ok" ? "Aceito" : "Recusado"}
            </Text>
          ) : (
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
          <Pressable
            onPress={() => toggleFollow(item.userId)}
            style={[
              s.followButton,
              {
                backgroundColor: isFollowing ? colors.surface : "#0095F6"
              }
            ]}
          >
            <Text
              style={[
                s.followButtonText,
                { color: isFollowing ? colors.text : "#FFF" }
              ]}
            >
              {isFollowing ? "Seguindo" : "Seguir de volta"}
            </Text>
          </Pressable>
        ) : item.postImage ? (
          <FastImage source={item.postImage} style={s.postThumb} contentFit="cover" />
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={[s.container, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Notificações" onBack={onBack} />
      <ScrollView contentContainerStyle={s.content}>
        {activities.length === 0 && (
          <View style={{ alignItems: "center", paddingTop: 60, gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: "600", fontSize: 16 }}>Nada por aqui ainda</Text>
            <Text style={{ color: colors.muted, textAlign: "center", fontSize: 12 }}>
              Curtidas, comentários e novos seguidores aparecerão aqui.
            </Text>
          </View>
        )}
        {todayActivities.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>Hoje</Text>
            {todayActivities.map(renderActivityRow)}
          </View>
        )}

        {weekActivities.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: colors.text }]}>Esta semana</Text>
            {weekActivities.map(renderActivityRow)}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingBottom: 80 },
  content: { paddingHorizontal: 18, paddingTop: 10 },
  section: { marginBottom: 24 },
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
