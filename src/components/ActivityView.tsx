import React, { useState, useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Heart, MessageCircle, UserPlus, ArrowLeft } from "lucide-react-native";
import { ActivityItem, MOCK_ACTIVITIES } from "../data/mockData";
import { ScreenHeader } from "./ScreenHeader";
import { useAppTheme } from "../context/AppTheme";
import { FastImage } from "./FastImage";
import { loadActivities, saveActivities, loadFollowedUsers, saveFollowedUsers } from "../services/storage";

export function ActivityView({
  onBack,
  onOpenProfile
}: {
  onBack: () => void;
  onOpenProfile?: (username: string) => void;
}) {
  const { colors } = useAppTheme();
  const [activities, setActivities] = useState<ActivityItem[]>(MOCK_ACTIVITIES);
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

  const todayActivities = activities.filter(a => a.timeCategory === "today");
  const weekActivities = activities.filter(a => a.timeCategory === "week" || a.timeCategory === "earlier");

  const renderActivityRow = (item: ActivityItem) => {
    const isFollowing = followedIds.includes(item.userId);

    return (
      <View key={item.id} style={s.activityRow}>
        {/* User Avatar with Type Badge */}
        <Pressable onPress={() => onOpenProfile?.(item.username)} style={s.avatarContainer}>
          <FastImage source={item.userAvatar} style={s.avatar} contentFit="cover" />
          <View
            style={[
              s.typeBadge,
              {
                backgroundColor:
                  item.type === "like" ? "#FF3040" : item.type === "comment" ? "#168CFF" : "#10B981"
              }
            ]}
          >
            {item.type === "like" ? (
              <Heart size={9} color="#FFF" fill="#FFF" />
            ) : item.type === "comment" ? (
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
              style={{ fontWeight: "900" }}
              onPress={() => onOpenProfile?.(item.username)}
            >
              @{item.username}{" "}
            </Text>
            {item.message}
          </Text>
          <Text style={[s.timeAgo, { color: colors.muted }]}>{item.timeAgo}</Text>
        </View>

        {/* Right side: Follow button OR Post thumbnail */}
        {item.type === "follow" ? (
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
      </View>
    );
  };

  return (
    <View style={[s.container, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Notificações" onBack={onBack} />
      <ScrollView contentContainerStyle={s.content}>
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
  sectionTitle: { fontSize: 15, fontWeight: "900", marginBottom: 14, letterSpacing: -0.2 },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  avatarContainer: { position: "relative" },
  avatar: { width: 44, height: 44, borderRadius: 22 },
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
  followButtonText: { fontSize: 11, fontWeight: "800" },
  postThumb: { width: 44, height: 44, borderRadius: 8 }
});
