import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Bookmark, Heart, MapPin, MessageCircle, MoreHorizontal, Send, Shirt } from "lucide-react-native";
import { FeedPost } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { ScreenHeader } from "./ScreenHeader";
import { FastImage } from "./FastImage";
import { CommentsModal } from "./CommentsModal";
import { askDelete, askReport, EditCaptionModal } from "./PostMenus";
import { PostMedia } from "./PostMedia";
import { SharePostModal } from "./SharePostModal";
import { CollectionPickerModal } from "./CollectionPickerModal";
import { ImageZoomModal } from "./ImageZoomModal";
import { RichCaption } from "./RichCaption";
import { likeFeedback, tapFeedback } from "../utils/haptics";
import { loadPost, loadSavedProfile, setPostLike, setPostSave } from "../services/storage";

const W = Dimensions.get("window").width;

export function PostDetailView({
  postId,
  onBack,
  onOpenProfile,
  onDeleted,
  onOpenTag
}: {
  postId: string;
  onBack: () => void;
  onOpenProfile?: (username: string) => void;
  onDeleted?: (postId: string) => void;
  onOpenTag?: (tag: string) => void;
}) {
  const { colors } = useAppTheme();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [editing, setEditing] = useState<FeedPost | null>(null);
  const [zoom, setZoom] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    setLoading(true);
    loadPost(postId)
      .then(setPost)
      .finally(() => setLoading(false));
    loadSavedProfile().then(p => setMyId(p.id));
  }, [postId]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title="Look" onBack={onBack} />
        <ActivityIndicator color={colors.muted} style={{ marginTop: 60 }} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title="Look" onBack={onBack} />
        <Text style={{ color: colors.muted, textAlign: "center", marginTop: 60 }}>
          Este look não existe mais.
        </Text>
      </View>
    );
  }

  const isMine = !!myId && post.userId === myId;

  const toggleLike = async (forceOn = false) => {
    if (forceOn && post.isLiked) {
      likeFeedback();
      return;
    }
    const on = !post.isLiked;
    if (on) likeFeedback();
    else tapFeedback();
    setPost({ ...post, isLiked: on, likes: Math.max(0, post.likes + (on ? 1 : -1)) });
    try {
      await setPostLike(post, on);
    } catch (e) {
      setPost(post);
    }
  };

  const toggleSave = async () => {
    const on = !post.isSaved;
    setPost({ ...post, isSaved: on });
    try {
      await setPostSave(post, on);
    } catch (e) {
      setPost(post);
    }
  };

  const openMenu = () => {
    if (isMine) {
      Alert.alert("Seu look", undefined, [
        { text: "Editar legenda", onPress: () => setEditing(post) },
        {
          text: "Apagar",
          style: "destructive",
          onPress: async () => {
            if (await askDelete(post)) onDeleted?.(post.id);
          }
        },
        { text: "Cancelar", style: "cancel" }
      ]);
    } else {
      Alert.alert(`@${post.creatorUsername || post.creatorName}`, undefined, [
        {
          text: "Denunciar",
          style: "destructive",
          onPress: async () => {
            if (await askReport(post)) onBack();
          }
        },
        { text: "Cancelar", style: "cancel" }
      ]);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader
        title="Look"
        onBack={onBack}
        right={
          <Pressable onPress={openMenu} hitSlop={10}>
            <MoreHorizontal size={22} color={colors.icon} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Pressable
          style={s.creator}
          onPress={() => onOpenProfile?.(post.creatorUsername || post.creatorName)}
        >
          <FastImage source={post.creatorAvatar} style={s.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={[s.name, { color: colors.text }]}>{post.creatorName}</Text>
            {post.city ? (
              <View style={s.place}>
                <MapPin size={11} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {[post.city, post.country].filter(Boolean).join(", ")}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>

        <PostMedia
          images={post.images && post.images.length ? post.images : [post.image]}
          onDoubleTap={() => toggleLike(true)}
          onOpenZoom={i => setZoom(i)}
        />

        <View style={s.actions}>
          <Pressable onPress={() => toggleLike()} hitSlop={8}>
            <Heart size={26} color={post.isLiked ? "#FF3B30" : colors.icon} fill={post.isLiked ? "#FF3B30" : "transparent"} />
          </Pressable>
          <Pressable onPress={() => setShowComments(true)} hitSlop={8}>
            <MessageCircle size={25} color={colors.icon} />
          </Pressable>
          <Pressable onPress={() => setSharing(true)} hitSlop={8}>
            <Send size={23} color={colors.icon} style={{ transform: [{ rotate: "-22deg" }] }} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={toggleSave} onLongPress={() => setPicking(true)} delayLongPress={350} hitSlop={8}>
            <Bookmark size={25} color={colors.icon} fill={post.isSaved ? colors.icon : "transparent"} />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 6 }}>
          <Text style={{ color: colors.text, fontWeight: "800" }}>
            {post.likes} {post.likes === 1 ? "curtida" : "curtidas"}
          </Text>
          {post.caption ? (
            <RichCaption
              text={post.caption}
              style={{ color: colors.text, lineHeight: 20 }}
              prefix={<Text style={{ fontWeight: "800" }}>@{post.creatorUsername || post.creatorName} </Text>}
              onTag={onOpenTag}
              onMention={u => onOpenProfile?.(u)}
            />
          ) : null}
          {post.clothingTags && post.clothingTags.length > 0 ? (
            <View style={{ marginTop: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 8 }}>
                PEÇAS DO LOOK
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {post.clothingTags.map(t => (
                  <View key={t.id} style={[s.piece, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {t.image ? (
                      <FastImage source={t.image} style={s.pieceImg} contentFit="cover" />
                    ) : (
                      <View style={[s.pieceImg, { alignItems: "center", justifyContent: "center" }]}>
                        <Shirt size={18} color={colors.muted} />
                      </View>
                    )}
                    <Text style={{ color: colors.text, fontSize: 11, fontWeight: "800" }} numberOfLines={1}>{t.name}</Text>
                    {t.brand ? <Text style={{ color: colors.muted, fontSize: 10 }} numberOfLines={1}>{t.brand}</Text> : null}
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}
          {post.commentsCount > 0 ? (
            <Pressable onPress={() => setShowComments(true)}>
              <Text style={{ color: colors.muted }}>Ver {post.commentsCount} comentários</Text>
            </Pressable>
          ) : null}
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            {post.styleTag} · {post.timeAgo}
          </Text>
        </View>
      </ScrollView>

      <CommentsModal
        post={showComments ? post : null}
        visible={showComments}
        onClose={() => setShowComments(false)}
        onOpenProfile={u => {
          setShowComments(false);
          onOpenProfile?.(u);
        }}
        onOpenTag={t => {
          setShowComments(false);
          onOpenTag?.(t);
        }}
        onCommented={(_, total) => setPost(p => (p ? { ...p, commentsCount: total } : p))}
      />
      <SharePostModal post={post} visible={sharing} onClose={() => setSharing(false)} />
      <CollectionPickerModal
        post={picking ? post : null}
        onClose={() => setPicking(false)}
        onSaved={() => setPost(p => (p ? { ...p, isSaved: true } : p))}
      />
      <ImageZoomModal
        images={zoom === null ? null : post.images && post.images.length ? post.images : [post.image]}
        index={zoom ?? 0}
        onClose={() => setZoom(null)}
      />
      <EditCaptionModal
        post={editing}
        onClose={() => setEditing(null)}
        onSaved={(_, caption) => setPost(p => (p ? { ...p, caption } : p))}
      />
    </View>
  );
}

const s = StyleSheet.create({
  creator: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  name: { fontWeight: "800", fontSize: 14 },
  place: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  piece: { width: 96, borderWidth: 1, borderRadius: 14, padding: 6, gap: 2 },
  pieceImg: { width: "100%", height: 96, borderRadius: 10, marginBottom: 4 },
  actions: { flexDirection: "row", alignItems: "center", gap: 18, paddingHorizontal: 16, paddingVertical: 12 }
});
