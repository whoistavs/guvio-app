import React, { useEffect, useRef, useState } from "react";
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  Bookmark,
  Check,
  Heart,
  MapPin,
  MessageCircle,
  Plus,
  Send,
  Shirt,
  Tag,
  Trash2,
  UserPlus
} from "lucide-react-native";
import { FeedPost, UserStoryGroup, MOCK_PROFILES, UserProfile, ClothingTag } from "../data/mockData";
import { CommentsModal } from "./CommentsModal";
import { StoryViewerModal, CreateStoryModal } from "./StoryViewerModal";
import { SharePostModal } from "./SharePostModal";
import { useAppTheme } from "../context/AppTheme";
import { FastImage, preloadImages } from "./FastImage";
import { loadStories, saveStories, loadFollowedUsers, saveFollowedUsers } from "../services/storage";
import { FeedPostSkeleton } from "./SkeletonLoader";

export function HomeFeed({
  posts,
  setPosts,
  onAssembleWithWardrobe,
  countryFilter,
  cityFilter,
  onOpenProfile
}: {
  posts: FeedPost[];
  setPosts: React.Dispatch<React.SetStateAction<FeedPost[]>>;
  onAssembleWithWardrobe?: (p: FeedPost) => void;
  countryFilter?: string | null;
  cityFilter?: string | null;
  onOpenProfile?: (name: string) => void;
}) {
  const { colors } = useAppTheme();
  const [isLoading, setIsLoading] = useState(true);

  // Social feed states
  const [feedTab, setFeedTab] = useState<"forYou" | "following">("forYou");
  const [commentPost, setCommentPost] = useState<FeedPost | null>(null);
  const [sharePost, setSharePost] = useState<FeedPost | null>(null);
  const [stories, setStories] = useState<UserStoryGroup[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);
  const [activeStoryIdx, setActiveStoryIdx] = useState<number | null>(null);
  const [createStoryOpen, setCreateStoryOpen] = useState(false);
  const [followedUserIds, setFollowedUserIds] = useState<string[]>([]);
  const [visibleTagsPostId, setVisibleTagsPostId] = useState<string | null>(null);

  // Animated double tap heart state
  const [heartAnimPostId, setHeartAnimPostId] = useState<string | null>(null);
  const heartScale = useRef(new Animated.Value(0)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const lastTap = useRef<Record<string, number>>({});

  useEffect(() => {
    loadStories().then(setStories);
    loadFollowedUsers().then(setFollowedUserIds);
  }, []);

  useEffect(() => {
    // Native image prefetching
    const urls = [
      ...stories.map(s => s.avatar),
      ...posts.map(p => p.image),
      ...posts.map(p => p.creatorAvatar)
    ];
    preloadImages(urls);
  }, [posts, stories]);

  const toggleLikeOrSave = (id: string, key: "isLiked" | "isSaved") => {
    setPosts(prev =>
      prev.map(p => {
        if (p.id === id) {
          const nextVal = !p[key];
          return {
            ...p,
            [key]: nextVal,
            likes: key === "isLiked" ? p.likes + (nextVal ? 1 : -1) : p.likes
          };
        }
        return p;
      })
    );
  };

  const triggerDoubleTap = (p: FeedPost) => {
    const now = Date.now();
    const prev = lastTap.current[p.id] || 0;
    if (now - prev < 350) {
      if (!p.isLiked) {
        toggleLikeOrSave(p.id, "isLiked");
      }
      // Trigger heart pop animation
      setHeartAnimPostId(p.id);
      heartScale.setValue(0);
      heartOpacity.setValue(1);

      Animated.parallel([
        Animated.spring(heartScale, { toValue: 1.2, friction: 3, useNativeDriver: true }),
        Animated.timing(heartOpacity, { toValue: 0, duration: 800, delay: 300, useNativeDriver: true })
      ]).start(() => {
        setHeartAnimPostId(null);
      });
    }
    lastTap.current[p.id] = now;
  };

  const handleToggleFollow = async (userId: string) => {
    const updated = followedUserIds.includes(userId)
      ? followedUserIds.filter(id => id !== userId)
      : [...followedUserIds, userId];
    setFollowedUserIds(updated);
    await saveFollowedUsers(updated);
  };

  const handlePublishStory = async (imageUri: string, caption?: string) => {
    const newStory = {
      id: `my-st-${Date.now()}`,
      image: imageUri,
      timestamp: "Agora",
      caption
    };

    const updatedStories = stories.map(g => {
      if (g.isMe) {
        return {
          ...g,
          hasUnseen: true,
          stories: [...g.stories, newStory]
        };
      }
      return g;
    });

    setStories(updatedStories);
    await saveStories(updatedStories);
    Alert.alert("Story Publicado! ✨", "Seu look agora está visível no carrossel de stories.");
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

  // Filter posts according to Feed Tab, City, or Country
  let visiblePosts = posts;
  if (cityFilter) {
    visiblePosts = visiblePosts.filter(p => p.city === cityFilter);
  } else if (countryFilter) {
    visiblePosts = visiblePosts.filter(p => p.country === countryFilter);
  } else if (feedTab === "following") {
    visiblePosts = visiblePosts.filter(
      p => followedUserIds.includes(p.userId || "") || p.creatorName === "Você"
    );
  }

  return (
    <View style={[s.c, { backgroundColor: colors.bg }]}>
      {/* Instagram Stories Carousel */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.storiesScroll}>
        {stories.map((st, idx) => {
          const hasStories = st.stories && st.stories.length > 0;
          return (
            <Pressable
              key={st.id}
              style={s.storyItem}
              onPress={() => {
                if (st.isMe && !hasStories) {
                  setCreateStoryOpen(true);
                } else if (hasStories) {
                  setActiveStoryIdx(idx);
                }
              }}
            >
              <View
                style={[
                  s.storyRing,
                  {
                    borderColor: st.isMe && !hasStories
                      ? colors.border
                      : st.hasUnseen
                      ? "#FF2D55"
                      : colors.muted
                  }
                ]}
              >
                <FastImage source={st.avatar} style={s.storyImg} contentFit="cover" transition={100} />
                {st.isMe && (
                  <Pressable
                    onPress={() => setCreateStoryOpen(true)}
                    style={[s.addStoryBadge, { backgroundColor: colors.text }]}
                  >
                    <Plus size={11} color={colors.bg} />
                  </Pressable>
                )}
              </View>
              <Text numberOfLines={1} style={[s.storyName, { color: colors.text }]}>
                {st.displayName} {st.flag || ""}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* For You / Following Tab Switcher */}
      {!cityFilter && !countryFilter && (
        <View style={[s.feedTabsContainer, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={() => setFeedTab("forYou")}
            style={[
              s.feedTabBtn,
              feedTab === "forYou" && [s.feedTabBtnActive, { borderBottomColor: colors.text }]
            ]}
          >
            <Text
              style={[
                s.feedTabText,
                { color: feedTab === "forYou" ? colors.text : colors.muted }
              ]}
            >
              Para Você
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setFeedTab("following")}
            style={[
              s.feedTabBtn,
              feedTab === "following" && [s.feedTabBtnActive, { borderBottomColor: colors.text }]
            ]}
          >
            <Text
              style={[
                s.feedTabText,
                { color: feedTab === "following" ? colors.text : colors.muted }
              ]}
            >
              Seguindo
            </Text>
          </Pressable>
        </View>
      )}

      {/* Location Filter Header (when globe active) */}
      {(cityFilter || countryFilter) && (
        <View style={s.heading}>
          <Text style={[s.badge, { color: colors.muted }]}>
            {cityFilter ? `EXPLORAR ${cityFilter.toUpperCase()}` : `EXPLORAR ${countryFilter!.toUpperCase()}`}
          </Text>
          <Text style={[s.h, { color: colors.text }]}>
            {cityFilter ? `Looks de ${cityFilter}` : `Looks de ${countryFilter}`}
          </Text>
        </View>
      )}

      {/* Empty State ou Skeletons */}
      {isLoading ? (
        <View style={{ gap: 12 }}>
          <FeedPostSkeleton />
          <FeedPostSkeleton />
        </View>
      ) : visiblePosts.length === 0 ? (
        <View style={[s.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
            {feedTab === "following" ? "Nenhum look de quem você segue" : "Novos looks chegando"}
          </Text>
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: 6, fontSize: 12, lineHeight: 18 }}>
            {feedTab === "following"
              ? "Siga criadores de moda no feed ou na busca para ver publicações deles aqui."
              : "Ainda não temos publicações desse destino no feed. Publique o primeiro look para inaugurar!"}
          </Text>
        </View>
      ) : (
        visiblePosts.map((p, pIdx) => {
          const isTagsVisible = visibleTagsPostId === p.id;
          return (
            <React.Fragment key={p.id}>
              <View style={[s.post, { borderBottomColor: colors.border }]}>
                {/* Post Header */}
                <View style={s.ph}>
                  <Pressable
                    onPress={() => onOpenProfile?.(p.creatorName)}
                    style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
                  >
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

                {/* Post Image with Double-Tap to Like & Clothing Tags */}
                <Pressable onPress={() => triggerDoubleTap(p)} style={s.imageWrapper}>
                  <FastImage source={p.image} style={s.image} contentFit="cover" transition={120} />

                  {/* Animated Pop Heart on Double Tap */}
                  {heartAnimPostId === p.id && (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        s.animatedHeartOverlay,
                        {
                          transform: [{ scale: heartScale }],
                          opacity: heartOpacity
                        }
                      ]}
                    >
                      <Heart size={95} color="#FF3040" fill="#FF3040" />
                    </Animated.View>
                  )}

                  {/* Shopping / Clothing Tags Overlay */}
                  {p.clothingTags && p.clothingTags.length > 0 && (
                    <>
                      <Pressable
                        onPress={() => setVisibleTagsPostId(isTagsVisible ? null : p.id)}
                        style={[s.tagToggleBtn, { backgroundColor: "rgba(0,0,0,0.65)" }]}
                      >
                        <Tag size={13} color="#FFF" />
                      </Pressable>

                      {isTagsVisible &&
                        p.clothingTags.map(tag => (
                          <View
                            key={tag.id}
                            style={[
                              s.clothingTagPin,
                              {
                                top: `${tag.y}%`,
                                left: `${tag.x}%`
                              }
                            ]}
                          >
                            <View style={s.tagDot} />
                            <View style={s.tagBadgeBox}>
                              <Text style={s.tagNameText}>{tag.name}</Text>
                              <Text style={s.tagBrandText}>
                                {tag.brand} {tag.price ? `· ${tag.price}` : ""}
                              </Text>
                            </View>
                          </View>
                        ))}
                    </>
                  )}
                </Pressable>

                {/* Action Icons Bar */}
                <View style={s.actions}>
                  <View style={s.leftActions}>
                    <Pressable onPress={() => toggleLikeOrSave(p.id, "isLiked")} hitSlop={8}>
                      <Heart
                        size={25}
                        color={p.isLiked ? "#FF3040" : colors.icon}
                        fill={p.isLiked ? "#FF3040" : "none"}
                      />
                    </Pressable>
                    <Pressable onPress={() => setCommentPost(p)} hitSlop={8}>
                      <MessageCircle size={24} color={colors.icon} />
                    </Pressable>
                    <Pressable onPress={() => setSharePost(p)} hitSlop={8}>
                      <Send size={23} color={colors.icon} style={{ transform: [{ rotate: "-22deg" }] }} />
                    </Pressable>
                  </View>
                  <Pressable onPress={() => toggleLikeOrSave(p.id, "isSaved")} hitSlop={8}>
                    <Bookmark size={24} color={colors.icon} fill={p.isSaved ? colors.icon : "none"} />
                  </Pressable>
                </View>

                {/* Post Body (Likes, Caption, Comments, Wardrobe CTA) */}
                <View style={s.body}>
                  <Text style={[s.likes, { color: colors.text }]}>
                    {p.likes.toLocaleString("pt-BR")} curtidas
                  </Text>
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

                  <Pressable
                    onPress={() => onAssembleWithWardrobe?.(p)}
                    style={[s.cta, { backgroundColor: colors.text }]}
                  >
                    <Shirt size={17} color={colors.bg} />
                    <Text style={{ color: colors.bg, fontWeight: "900", fontSize: 12 }}>
                      Montar com meu guarda-roupa
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Instagram Style: Suggested Accounts Carousel after 2nd post */}
              {pIdx === 1 && (
                <View style={[s.suggestionsSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[s.suggestionsTitle, { color: colors.text }]}>Sugestões para você seguir</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.suggestionsScroll}>
                    {MOCK_PROFILES.map(prof => {
                      const isF = followedUserIds.includes(prof.id);
                      return (
                        <View key={prof.id} style={[s.suggestedCard, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                          <FastImage source={prof.avatar} style={s.suggestedAvatar} contentFit="cover" />
                          <Text numberOfLines={1} style={[s.suggestedName, { color: colors.text }]}>
                            {prof.displayName}
                          </Text>
                          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10 }}>
                            {prof.location}
                          </Text>
                          <Pressable
                            onPress={() => handleToggleFollow(prof.id)}
                            style={[
                              s.suggestedFollowBtn,
                              { backgroundColor: isF ? colors.surface : "#0095F6" }
                            ]}
                          >
                            <Text style={[s.suggestedFollowText, { color: isF ? colors.text : "#FFF" }]}>
                              {isF ? "Seguindo" : "Seguir"}
                            </Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </React.Fragment>
          );
        })
      )}

      {/* Modals */}
      <CommentsModal post={commentPost} visible={!!commentPost} onClose={() => setCommentPost(null)} />
      <SharePostModal post={sharePost} visible={!!sharePost} onClose={() => setSharePost(null)} />
      <StoryViewerModal
        visible={activeStoryIdx !== null}
        onClose={() => setActiveStoryIdx(null)}
        storyGroups={stories}
        initialGroupIndex={activeStoryIdx || 0}
      />
      <CreateStoryModal
        visible={createStoryOpen}
        onClose={() => setCreateStoryOpen(false)}
        onPublish={handlePublishStory}
      />
    </View>
  );
}

const s = StyleSheet.create({
  c: { width: "100%", paddingTop: 6, paddingBottom: 110 },
  storiesScroll: { paddingHorizontal: 16, paddingBottom: 12, gap: 14 },
  storyItem: { alignItems: "center", width: 68 },
  storyRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2.2,
    padding: 2.5,
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  storyImg: { width: 56, height: 56, borderRadius: 28 },
  addStoryBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center"
  },
  storyName: { fontSize: 10, fontWeight: "600", marginTop: 5, textAlign: "center" },

  // Feed Tabs (Para Você / Seguindo)
  feedTabsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 36,
    borderBottomWidth: 1,
    paddingBottom: 2,
    marginBottom: 8
  },
  feedTabBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  feedTabBtnActive: { borderBottomWidth: 2 },
  feedTabText: { fontSize: 13, fontWeight: "800", letterSpacing: -0.2 },

  heading: { paddingHorizontal: 20, marginVertical: 8 },
  badge: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  h: { fontSize: 22, fontWeight: "900", letterSpacing: -0.4, marginTop: 3 },
  empty: { margin: 20, padding: 36, borderRadius: 22, borderWidth: 1, alignItems: "center" },

  post: { marginBottom: 24, borderBottomWidth: 1, paddingBottom: 18 },
  ph: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 11 },
  avatarStoryRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: "#FF2D55",
    padding: 1.5,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  creator: { fontSize: 13, fontWeight: "900" },
  loc: { flexDirection: "row", gap: 3, alignItems: "center", marginTop: 1 },
  styleTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },

  imageWrapper: { position: "relative" },
  image: { width: "100%", aspectRatio: 1, backgroundColor: "#111" },
  animatedHeartOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 15
  },
  tagToggleBtn: {
    position: "absolute",
    bottom: 12,
    left: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10
  },
  clothingTagPin: {
    position: "absolute",
    alignItems: "center",
    zIndex: 12
  },
  tagDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#FFF", borderWidth: 2, borderColor: "#000" },
  tagBadgeBox: {
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4
  },
  tagNameText: { color: "#FFF", fontSize: 10, fontWeight: "800" },
  tagBrandText: { color: "rgba(255,255,255,0.75)", fontSize: 9 },

  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12
  },
  leftActions: { flexDirection: "row", gap: 18, alignItems: "center" },
  body: { paddingHorizontal: 20, paddingTop: 8 },
  likes: { fontSize: 13, fontWeight: "900" },
  caption: { fontSize: 13, lineHeight: 19, marginTop: 5 },
  cta: {
    height: 44,
    borderRadius: 22,
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center"
  },

  // Suggested Follow Cards
  suggestionsSection: {
    marginVertical: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1
  },
  suggestionsTitle: { fontSize: 13, fontWeight: "800", paddingHorizontal: 20, marginBottom: 10 },
  suggestionsScroll: { paddingHorizontal: 16, gap: 12 },
  suggestedCard: {
    width: 130,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    gap: 6
  },
  suggestedAvatar: { width: 50, height: 50, borderRadius: 25 },
  suggestedName: { fontSize: 12, fontWeight: "800" },
  suggestedFollowBtn: {
    width: "100%",
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4
  },
  suggestedFollowText: { fontSize: 11, fontWeight: "800" }
});
