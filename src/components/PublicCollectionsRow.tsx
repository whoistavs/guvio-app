import React, { useEffect, useState } from "react";
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Bookmark, X } from "lucide-react-native";
import { FeedPost, SavedCollection } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { FastImage } from "./FastImage";
import { GridSkeleton } from "./SkeletonLoader";
import { noSwipeBack } from "./gestures";
import { topPad } from "../utils/insets";
import { loadCollectionPosts, loadPublicCollections } from "../services/storage";

const TILE = (Math.min(Dimensions.get("window").width, 600) - 4) / 3;

/** Coleções públicas no perfil: capas lado a lado; tocar abre os looks da coleção */
export function PublicCollectionsRow({
  userId,
  onOpenPost,
  reloadKey = 0
}: {
  userId: string;
  onOpenPost?: (id: string) => void;
  reloadKey?: number;
}) {
  const { colors } = useAppTheme();
  const [list, setList] = useState<SavedCollection[]>([]);
  const [open, setOpen] = useState<SavedCollection | null>(null);
  const [posts, setPosts] = useState<FeedPost[] | null>(null);

  useEffect(() => {
    if (!userId) return;
    loadPublicCollections(userId).then(setList).catch(() => setList([]));
  }, [userId, reloadKey]);

  useEffect(() => {
    if (!open) return;
    setPosts(null);
    loadCollectionPosts(open.id).then(setPosts).catch(() => setPosts([]));
  }, [open]);

  if (list.length === 0) return null;

  return (
    <View style={{ marginTop: 12 }}>
      <Text style={[s.title, { color: colors.text }]}>Coleções</Text>
      <ScrollView {...noSwipeBack} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        {list.map(c => (
          <Pressable key={c.id} onPress={() => setOpen(c)} style={s.item}>
            {c.cover ? (
              <FastImage source={c.cover} style={s.cover} contentFit="cover" />
            ) : (
              <View style={[s.cover, { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }]}>
                <Bookmark size={20} color={colors.muted} />
              </View>
            )}
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
              {c.name}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 10 }}>{c.count === 1 ? "1 look" : `${c.count} looks`}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={!!open} animationType="slide" onRequestClose={() => setOpen(null)}>
        <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: topPad(0) }}>
          <View style={s.head}>
            <View style={{ width: 24 }} />
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }} numberOfLines={1}>
              {open?.name}
            </Text>
            <Pressable onPress={() => setOpen(null)} hitSlop={10}>
              <X size={24} color={colors.icon} />
            </Pressable>
          </View>
          {posts === null ? (
            <GridSkeleton count={9} />
          ) : (
            <ScrollView contentContainerStyle={s.grid}>
              {posts.map(p => (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    setOpen(null);
                    onOpenPost?.(p.id);
                  }}
                >
                  <FastImage source={p.image} style={{ width: TILE, height: TILE * 1.25 }} contentFit="cover" />
                </Pressable>
              ))}
              {posts.length === 0 ? (
                <Text style={{ color: colors.muted, padding: 30, textAlign: "center", width: "100%" }}>Coleção vazia.</Text>
              ) : null}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 13, fontWeight: "700", paddingHorizontal: 16, marginBottom: 8 },
  row: { paddingHorizontal: 16, gap: 10 },
  item: { width: 96, gap: 3 },
  cover: { width: 96, height: 120, borderRadius: 10 },
  head: { height: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 2, paddingBottom: 40 }
});
