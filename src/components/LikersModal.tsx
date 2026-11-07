import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { X } from "lucide-react-native";
import { UserProfile } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { FastImage } from "./FastImage";
import { loadLikers } from "../services/storage";

/** Quem curtiu o look */
export function LikersModal({
  postId,
  onClose,
  onOpenProfile
}: {
  postId: string | null;
  onClose: () => void;
  onOpenProfile?: (username: string) => void;
}) {
  const { colors } = useAppTheme();
  const [list, setList] = useState<UserProfile[] | null>(null);

  useEffect(() => {
    if (!postId) return;
    setList(null);
    loadLikers(postId).then(setList);
  }, [postId]);

  return (
    <Modal visible={!!postId} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.back}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <View style={s.head}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>Curtidas</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={22} color={colors.icon} />
            </Pressable>
          </View>
          {list === null ? (
            <ActivityIndicator color={colors.muted} style={{ margin: 30 }} />
          ) : list.length === 0 ? (
            <Text style={{ color: colors.muted, textAlign: "center", margin: 30 }}>Ninguém curtiu ainda.</Text>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
              {list.map(p => (
                <Pressable key={p.id} onPress={() => onOpenProfile?.(p.username)} style={s.row}>
                  <FastImage source={p.avatar} style={s.avatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "800" }}>@{p.username}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
                      {p.displayName}
                    </Text>
                  </View>
                  {p.isFollowing ? <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>Seguindo</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  back: { flex: 1, backgroundColor: "rgba(0,0,0,.5)" },
  sheet: { maxHeight: "70%", borderTopLeftRadius: 26, borderTopRightRadius: 26, borderTopWidth: 1 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 9 },
  avatar: { width: 44, height: 44, borderRadius: 22 }
});
