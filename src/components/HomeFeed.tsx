import React, { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Bookmark, Heart, MapPin, MessageCircle, Plus, Send, Shirt, Trash2 } from "lucide-react-native";
import { FeedPost } from "../data/mockData";
import { CommentsModal } from "./CommentsModal";
import { useAppTheme } from "../context/AppTheme";
import { FastImage, preloadImages } from "./FastImage";

const STORIES = [
  { id: "me", name: "Seu story", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200", isMe: true },
  { id: "paris", name: "Paris", avatar: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=200", flag: "🇫🇷" },
  { id: "tokyo", name: "Tóquio", avatar: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=200", flag: "🇯🇵" },
  { id: "milan", name: "Milão", avatar: "https://images.unsplash.com/photo-1513584684374-8bab748fbf90?q=80&w=200", flag: "🇮🇹" },
  { id: "ny", name: "Nova York", avatar: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?q=80&w=200", flag: "🇺🇸" },
  { id: "sp", name: "São Paulo", avatar: "https://images.unsplash.com/photo-1543059080-f9b1272213d5?q=80&w=200", flag: "🇧🇷" },
];

export function HomeFeed({
  posts,
  setPosts,
  onAssembleWithWardrobe,
  countryFilter,
  cityFilter,
  onOpenProfile,
  onShare
}: {
  posts: FeedPost[];
  setPosts: React.Dispatch<React.SetStateAction<FeedPost[]>>;
  onAssembleWithWardrobe?: (p: FeedPost) => void;
  countryFilter?: string | null;
  cityFilter?: string | null;
  onOpenProfile?: (name: string) => void;
  onShare?: (p: FeedPost) => void;
}) {
  const { colors, dark } = useAppTheme();
  const [commentPost, setCommentPost] = useState<FeedPost | null>(null);
  const lastTap = useRef(0);

  useEffect(() => {
    // Pré-carregamento nativo no SDWebImage / Glide
    const urls = [...STORIES.map(s => s.avatar), ...posts.map(p => p.image), ...posts.map(p => p.creatorAvatar)];
    preloadImages(urls);
  }, [posts]);

  const visible = cityFilter
    ? posts.filter(p => p.city === cityFilter)
    : countryFilter
    ? posts.filter(p => p.country === countryFilter)
    : posts;

  const toggle = (id: string, key: "isLiked" | "isSaved") =>
    setPosts(v =>
      v.map(p => (p.id === id ? { ...p, [key]: !p[key], likes: key === "isLiked" ? p.likes + (!p.isLiked ? 1 : -1) : p.likes } : p))
    );

  const dbl = (p: FeedPost) => {
    const now = Date.now();
    if (now - lastTap.current < 320 && !p.isLiked) toggle(p.id, "isLiked");
    lastTap.current = now;
  };

  const handleDeletePost = (id: string) => {
    Alert.alert("Excluir publicação", "Tem certeza que deseja apagar este look do feed?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          setPosts(v => v.filter(p => p.id !== id));
        }
      }
    ]);
  };

  return (
    <View style={[s.c, { backgroundColor: colors.bg }]}>
      {/* Instagram Stories Carousel */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.storiesScroll}>
        {STORIES.map(st => (
          <Pressable key={st.id} style={s.storyItem}>
            <View style={[s.storyRing, { borderColor: st.isMe ? colors.border : "#FF2D55" }]}>
              <FastImage source={st.avatar} style={s.storyImg} contentFit="cover" transition={100} />
              {st.isMe ? (
                <View style={[s.addStoryBadge, { backgroundColor: colors.text }]}>
                  <Plus size={11} color={colors.bg} />
                </View>
              ) : null}
            </View>
            <Text numberOfLines={1} style={[s.storyName, { color: colors.text }]}>
              {st.name} {st.flag || ""}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={s.heading}>
        <Text style={[s.badge, { color: colors.muted }]}>
          {cityFilter ? `EXPLORAR ${cityFilter.toUpperCase()}` : countryFilter ? `EXPLORAR ${countryFilter.toUpperCase()}` : "FEED DE INSPIRAÇÃO"}
        </Text>
        <Text style={[s.h, { color: colors.text }]}>
          {cityFilter ? `Looks de ${cityFilter}` : countryFilter ? `Looks de ${countryFilter}` : "Destaques do Mundo"}
        </Text>
      </View>

      {visible.length === 0 ? (
        <View style={[s.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>Novos looks chegando</Text>
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: 6, fontSize: 12, lineHeight: 18 }}>
            Ainda não temos publicações desse destino no feed. Publique o primeiro look para inaugurar!
          </Text>
        </View>
      ) : (
        visible.map(p => (
          <View key={p.id} style={[s.post, { borderBottomColor: colors.border }]}>
            {/* Post Header */}
            <View style={s.ph}>
              <Pressable onPress={() => onOpenProfile?.(p.creatorName)} style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <View style={s.avatarStoryRing}>
                  <FastImage source={p.creatorAvatar} style={s.avatar} contentFit="cover" transition={100} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.creator, { color: colors.text }]}>{p.creatorName}</Text>
                  <View style={s.loc}>
                    <MapPin size={11} color={colors.muted} />
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "500" }}>
                      {p.city}, {p.country}
                    </Text>
                  </View>
                </View>
              </Pressable>
              
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={[s.styleTag, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={{ color: colors.text, fontSize: 10, fontWeight: "800" }}>{p.styleTag}</Text>
                </View>
                {p.creatorName === "Você" ? (
                  <Pressable onPress={() => handleDeletePost(p.id)} hitSlop={10}>
                    <Trash2 size={16} color={colors.muted} />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {/* Post Image with FastImage */}
            <Pressable onPress={() => dbl(p)}>
              <FastImage source={p.image} style={s.image} contentFit="cover" transition={120} />
              {p.isLiked ? (
                <View pointerEvents="none" style={s.heartGhost}>
                  <Heart size={72} color="rgba(255,255,255,.24)" fill="rgba(255,255,255,.2)" />
                </View>
              ) : null}
            </Pressable>

            {/* Instagram Action Icons Bar */}
            <View style={s.actions}>
              <View style={s.leftActions}>
                <Pressable onPress={() => toggle(p.id, "isLiked")}>
                  <Heart size={24} color={p.isLiked ? "#FF3040" : colors.icon} fill={p.isLiked ? "#FF3040" : "none"} />
                </Pressable>
                <Pressable onPress={() => setCommentPost(p)}>
                  <MessageCircle size={23} color={colors.icon} />
                </Pressable>
                <Pressable onPress={() => onShare?.(p)}>
                  <Send size={22} color={colors.icon} style={{ transform: [{ rotate: "-22deg" }] }} />
                </Pressable>
              </View>
              <Pressable onPress={() => toggle(p.id, "isSaved")}>
                <Bookmark size={23} color={colors.icon} fill={p.isSaved ? colors.icon : "none"} />
              </Pressable>
            </View>

            {/* Post Body (Likes, Caption, Comments, CTA) */}
            <View style={s.body}>
              <Text style={[s.likes, { color: colors.text }]}>{p.likes.toLocaleString("pt-BR")} curtidas</Text>
              <Text style={[s.caption, { color: colors.text }]}>
                <Text style={{ fontWeight: "900" }}>{p.creatorName} </Text>
                {p.caption}
              </Text>
              <Pressable onPress={() => setCommentPost(p)}>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6, fontWeight: "500" }}>
                  Ver todos os {p.commentsCount} comentários
                </Text>
              </Pressable>
              <Text style={{ color: colors.muted, fontSize: 10, marginTop: 4 }}>{p.timeAgo}</Text>

              <Pressable onPress={() => onAssembleWithWardrobe?.(p)} style={[s.cta, { backgroundColor: colors.text }]}>
                <Shirt size={17} color={colors.bg} />
                <Text style={{ color: colors.bg, fontWeight: "900", fontSize: 12 }}>Montar com meu guarda-roupa</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
      <CommentsModal post={commentPost} visible={!!commentPost} onClose={() => setCommentPost(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  c: { width: "100%", paddingTop: 10, paddingBottom: 110 },
  storiesScroll: { paddingHorizontal: 16, paddingBottom: 16, gap: 14 },
  storyItem: { alignItems: "center", width: 68 },
  storyRing: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, padding: 2, alignItems: "center", justifyContent: "center", position: "relative" },
  storyImg: { width: 56, height: 56, borderRadius: 28 },
  addStoryBadge: { position: "absolute", bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#FFF", alignItems: "center", justifyContent: "center" },
  storyName: { fontSize: 10, fontWeight: "600", marginTop: 5, textAlign: "center" },
  heading: { paddingHorizontal: 20, marginVertical: 8 },
  badge: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  h: { fontSize: 22, fontWeight: "900", letterSpacing: -0.4, marginTop: 3 },
  empty: { margin: 20, padding: 36, borderRadius: 22, borderWidth: 1, alignItems: "center" },
  post: { marginBottom: 24, borderBottomWidth: 1, paddingBottom: 18 },
  ph: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 11 },
  avatarStoryRing: { width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, borderColor: "#FF2D55", padding: 1.5, marginRight: 10, alignItems: "center", justifyContent: "center" },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  creator: { fontSize: 13, fontWeight: "900" },
  loc: { flexDirection: "row", gap: 3, alignItems: "center", marginTop: 1 },
  styleTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
  image: { width: "100%", aspectRatio: 1, backgroundColor: "#111" },
  heartGhost: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 12 },
  leftActions: { flexDirection: "row", gap: 18, alignItems: "center" },
  body: { paddingHorizontal: 20, paddingTop: 8 },
  likes: { fontSize: 13, fontWeight: "900" },
  caption: { fontSize: 13, lineHeight: 19, marginTop: 5 },
  cta: { height: 44, borderRadius: 22, marginTop: 14, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" }
});
