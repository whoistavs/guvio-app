import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { UserProfile } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { ListSkeleton } from "./SkeletonLoader";
import { ScreenHeader } from "./ScreenHeader";
import { FastImage } from "./FastImage";
import { loadFollowList, loadFollowedUsers, saveFollowedUsers, loadSavedProfile } from "../services/storage";

export function FollowListView({
  profile,
  kind,
  onBack,
  onOpenProfile
}: {
  profile: UserProfile;
  kind: "followers" | "following";
  onBack: () => void;
  onOpenProfile: (p: UserProfile) => void;
}) {
  const { colors } = useAppTheme();
  const [list, setList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState<string[]>([]);
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    loadFollowList(profile, kind)
      .then(setList)
      .finally(() => setLoading(false));
    loadFollowedUsers().then(setFollowing);
    loadSavedProfile().then(p => setMyId(p.id));
  }, [profile.id, kind]);

  const toggle = async (id: string) => {
    const next = following.includes(id) ? following.filter(x => x !== id) : [...following, id];
    setFollowing(next);
    await saveFollowedUsers(next);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={kind === "followers" ? "Seguidores" : "Seguindo"} onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {loading ? (
          <ListSkeleton rows={8} avatar={50} style={{ paddingHorizontal: 18 }} />
        ) : list.length === 0 ? (
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}>
            {kind === "followers" ? "Ninguém segue este perfil ainda." : "Este perfil ainda não segue ninguém."}
          </Text>
        ) : (
          list.map(p => {
            const isFollowing = following.includes(p.id);
            return (
              <Pressable key={p.id} onPress={() => onOpenProfile(p)} style={[s.row, { borderBottomColor: colors.border }]}>
                <FastImage source={p.avatar} style={s.avatar} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "600" }}>@{p.username}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{p.displayName}</Text>
                </View>
                {p.id !== myId ? (
                  <Pressable
                    onPress={() => toggle(p.id)}
                    style={[s.btn, { backgroundColor: isFollowing ? colors.surface : "#0095F6" }]}
                  >
                    <Text style={{ color: isFollowing ? colors.text : "#FFF", fontWeight: "600", fontSize: 12 }}>
                      {isFollowing ? "Seguindo" : "Seguir"}
                    </Text>
                  </Pressable>
                ) : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }
});
