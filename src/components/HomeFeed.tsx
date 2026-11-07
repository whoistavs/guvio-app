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
  MoreHorizontal,
  X,
  UserPlus
} from "lucide-react-native";
import { FeedPost, UserStoryGroup, MOCK_PROFILES, UserProfile, ClothingTag, StoryOverlay, StorySticker } from "../data/mockData";
import { loadAllRegisteredProfiles, loadSavedProfile } from "../services/storage";
import { askReport, EditPostModal, openOwnPostMenu } from "./PostMenus";
import { PostMedia } from "./PostMedia";
import { ImageZoomModal } from "./ImageZoomModal";
import { RichCaption } from "./RichCaption";
import { likeFeedback, tapFeedback } from "../utils/haptics";
import { isCloud } from "../services/supabase";
import { CommentsModal } from "./CommentsModal";
import { StoryViewerModal, CreateStoryModal } from "./StoryViewerModal";
import { CollectionPickerModal } from "./CollectionPickerModal";
import { SuggestionsRow } from "./SuggestionsRow";
import { LikersModal } from "./LikersModal";
import { PollBar, RatingBar, RepostLine } from "./PostExtras";
import { RepostModal } from "./RepostModal";
import { FastStorage } from "../services/FastStorage";
import { FadeIn, PopOnActive, toast } from "./motion";
import { SharePostModal } from "./SharePostModal";
import { useAppTheme } from "../context/AppTheme";
import { FastImage, preloadImages } from "./FastImage";
import {
  loadStories,
  saveStories,
  loadFollowedUsers,
  saveFollowedUsers,
  getCachedStories,
  setMuted,
  loadNotInterested,
  markNotInterested,
  applyNotInterested,
  loadNearby
} from "../services/storage";

const SEEN_KEY = "guvio_feed_seen_until_v1";
import { FeedPostSkeleton } from "./SkeletonLoader";

/** desenha de novo só quando algum item de "deps" mudar */
const MemoRow = React.memo(
  function MemoRow({ render }: { render: () => React.ReactNode; deps: unknown[] }) {
    return <>{render()}</>;
  },
  (a, b) => a.deps.length === b.deps.length && a.deps.every((d, i) => Object.is(d, b.deps[i]))
);

export function HomeFeed({
  posts,
  setPosts,
  onAssembleWithWardrobe,
  countryFilter,
  cityFilter,
  onClearFilter,
  onOpenProfile,
  onOpenTag,
  refreshKey = 0,
  belowStories,
  nearby
}: {
  posts: FeedPost[];
  setPosts: React.Dispatch<React.SetStateAction<FeedPost[]>>;
  onAssembleWithWardrobe?: (p: FeedPost) => void;
  countryFilter?: string | null;
  cityFilter?: string | null;
  onClearFilter?: () => void;
  onOpenProfile?: (name: string) => void;
  onOpenTag?: (tag: string) => void;
  /** muda quando o usuário puxa para atualizar: recarrega os stories */
  refreshKey?: number;
  /** algo entre os stories e o feed (ex.: desafio da semana) */
  belowStories?: React.ReactNode;
  /** sua localização, para a aba "Perto" */
  nearby?: { lat: number; lng: number } | null;
}) {
  const { colors } = useAppTheme();
  const [isLoading, setIsLoading] = useState(true);

  // Social feed states
  const [feedTab, setFeedTab] = useState<"forYou" | "following" | "nearby">("forYou");
  const [commentPost, setCommentPost] = useState<FeedPost | null>(null);
  const [sharePost, setSharePost] = useState<FeedPost | null>(null);
  const [collectionPost, setCollectionPost] = useState<FeedPost | null>(null);
  const [likersPost, setLikersPost] = useState<string | null>(null);
  const [repostPost, setRepostPost] = useState<FeedPost | null>(null);
  const [ni, setNi] = useState<Awaited<ReturnType<typeof loadNotInterested>> | null>(null);
  const [nearbyPosts, setNearbyPosts] = useState<FeedPost[] | null>(null);
  // "você está em dia": o post mais novo que você já tinha visto na última vez
  const [seenUntil] = useState<string | null>(() => FastStorage.getItemSync(SEEN_KEY, null));

  useEffect(() => {
    loadNotInterested().then(setNi).catch(() => {});
  }, []);

  useEffect(() => {
    const newest = posts.reduce<string | null>((m, p) => (p.createdAt && (!m || p.createdAt > m) ? p.createdAt : m), null);
    if (newest) FastStorage.setItemSync(SEEN_KEY, newest);
  }, [posts.length]);

  useEffect(() => {
    if (feedTab !== "nearby" || !nearby) return;
    setNearbyPosts(null);
    loadNearby(nearby.lat, nearby.lng, 60).then(setNearbyPosts);
  }, [feedTab, nearby?.lat, nearby?.lng, refreshKey]);
  const [stories, setStories] = useState<UserStoryGroup[]>(() => getCachedStories());

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

  const [myId, setMyId] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<UserProfile[]>(MOCK_PROFILES);

  useEffect(() => {
    if (refreshKey > 0) loadStories().then(setStories);
  }, [refreshKey]);

  const [zoom, setZoom] = useState<{ images: string[]; index: number } | null>(null);

  useEffect(() => {
    loadStories().then(setStories);
    loadFollowedUsers().then(setFollowedUserIds);
    loadSavedProfile().then(p => setMyId(p.id));
    isCloud().then(cloud => {
      if (cloud) loadAllRegisteredProfiles().then(list => setSuggested(list.slice(0, 15)));
    });
  }, []);

  const isMine = (p: FeedPost) => p.creatorName === "Você" || (!!myId && p.userId === myId);

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
    if (key === "isLiked") likeFeedback();
    else tapFeedback();
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

  const triggerDoubleTap = (p: FeedPost, confirmed = false) => {
    const now = Date.now();
    const prev = lastTap.current[p.id] || 0;
    if (confirmed || now - prev < 350) {
      likeFeedback();
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

  const handlePublishStory = async (
    imageUri: string,
    caption?: string,
    overlay?: StoryOverlay | null,
    extra?: { closeFriends?: boolean; sticker?: StorySticker | null }
  ) => {
    const newStory = {
      id: `my-st-${Date.now()}`,
      image: imageUri,
      timestamp: "Agora",
      caption,
      overlay: overlay || null,
      closeFriends: !!extra?.closeFriends,
      sticker: extra?.sticker || null
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
    try {
      await saveStories(updatedStories);
      if (await isCloud()) loadStories().then(setStories);
      Alert.alert("Story Publicado! ✨", "Seu look agora está visível no carrossel de stories.");
    } catch (e: any) {
      setStories(stories);
      Alert.alert("Story não publicado", e?.message || "Tente novamente.");
    }
  };

  const [editingPost, setEditingPost] = useState<FeedPost | null>(null);
  // atualiza um post na lista (já salvo no servidor)
  const setPostsSilently = (u: FeedPost) => setPosts(v => v.map(x => (x.id === u.id ? { ...x, ...u } : x)));

  const openPostMenu = (p: FeedPost) => {
    if (isMine(p)) {
      openOwnPostMenu(p, {
        onEdit: () => setEditingPost(p),
        onChanged: u => setPostsSilently(u),
        onRemoved: id => setPosts(v => v.filter(x => x.id !== id))
      });
    } else {
      Alert.alert(`@${p.creatorUsername || p.creatorName}`, undefined, [
        { text: "Repostar no meu perfil", onPress: () => setRepostPost(p) },
        {
          text: "Não tenho interesse",
          onPress: async () => {
            try {
              setNi(await markNotInterested(p));
              toast("Ok! Vamos mostrar menos looks assim", "👋");
            } catch {}
          }
        },
        {
          text: "Silenciar",
          onPress: async () => {
            if (!p.userId) return;
            try {
              await setMuted(p.userId, true);
              setPosts(v => v.filter(x => x.userId !== p.userId));
              toast(`@${p.creatorUsername || p.creatorName} silenciado no seu feed`, "🔕");
            } catch (e: any) {
              Alert.alert("Erro", e?.message || "Tente novamente.");
            }
          }
        },
        {
          text: "Denunciar",
          style: "destructive",
          onPress: async () => {
            if (await askReport(p)) setPosts(v => v.filter(x => x.id !== p.id));
          }
        },
        { text: "Cancelar", style: "cancel" }
      ]);
    }
  };

  // Filter posts according to Feed Tab, City, or Country
  let visiblePosts = posts.filter(p => !p.archived);
  if (cityFilter) {
    visiblePosts = visiblePosts.filter(p => p.city === cityFilter);
  } else if (countryFilter) {
    visiblePosts = visiblePosts.filter(p => p.country === countryFilter);
  } else if (feedTab === "following") {
    visiblePosts = visiblePosts.filter(
      p => followedUserIds.includes(p.userId || "") || isMine(p)
    );
  } else if (feedTab === "nearby") {
    visiblePosts = (nearbyPosts || []).filter(p => !p.archived);
  } else {
    visiblePosts = applyNotInterested(visiblePosts, ni);
  }
  // "Você está em dia": aparece antes do primeiro post que você já tinha visto
  const caughtUpAt =
    feedTab === "forYou" && seenUntil && visiblePosts[0]?.createdAt && visiblePosts[0].createdAt > seenUntil
      ? visiblePosts.findIndex(p => !!p.createdAt && p.createdAt <= seenUntil)
      : -1;

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
                  // o visualizador só conta grupos que têm stories
                  setActiveStoryIdx(stories.filter(g => g.stories.length > 0).findIndex(g => g.id === st.id));
                }
              }}
            >
              <View
                style={[
                  s.storyRing,
                  {
                    borderColor: st.isMe && !hasStories
                      ? colors.border
                      : st.hasClose || (st.isMe && st.stories.some(x => x.closeFriends))
                      ? "#22C55E"
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

      {!cityFilter && !countryFilter && belowStories ? belowStories : null}

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

          {nearby ? (
            <Pressable
              onPress={() => setFeedTab("nearby")}
              style={[s.feedTabBtn, feedTab === "nearby" && [s.feedTabBtnActive, { borderBottomColor: colors.text }]]}
            >
              <Text style={[s.feedTabText, { color: feedTab === "nearby" ? colors.text : colors.muted }]}>Perto</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {/* Location Filter Header (when globe active) */}
      {(cityFilter || countryFilter) && (
        <View style={[s.heading, { flexDirection: "row", alignItems: "center" }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.badge, { color: colors.muted }]}>
              {cityFilter ? `EXPLORAR ${cityFilter.toUpperCase()}` : `EXPLORAR ${countryFilter!.toUpperCase()}`}
            </Text>
            <Text style={[s.h, { color: colors.text }]}>
              {cityFilter ? `Looks de ${cityFilter}` : `Looks de ${countryFilter}`}
            </Text>
          </View>
          {onClearFilter ? (
            <Pressable
              onPress={onClearFilter}
              hitSlop={10}
              style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <X size={14} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>Limpar</Text>
            </Pressable>
          ) : null}
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
            {feedTab === "following"
              ? "Nenhum look de quem você segue"
              : feedTab === "nearby"
              ? nearbyPosts === null
                ? "Procurando looks perto de você..."
                : "Nenhum look perto de você ainda"
              : "Novos looks chegando"}
          </Text>
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: 6, fontSize: 12, lineHeight: 18 }}>
            {feedTab === "nearby"
              ? "Mostramos looks publicados a até 60 km de você. Publique o primeiro da sua região!"
              : feedTab === "following"
              ? "Siga criadores de moda no feed ou na busca para ver publicações deles aqui."
              : "Ainda não temos publicações desse destino no feed. Publique o primeiro look para inaugurar!"}
          </Text>
          {feedTab === "following" ? (
            <View style={{ alignSelf: "stretch", marginTop: 8 }}>
              <SuggestionsRow onOpenProfile={prof => onOpenProfile?.(prof.username)} title="Quem seguir" reloadKey={refreshKey} />
            </View>
          ) : null}
        </View>
      ) : (
        visiblePosts.map((p, pIdx) => {
          const isTagsVisible = visibleTagsPostId === p.id;
          // Só redesenha este post quando algo dele mudou (curtir um look não redesenha o feed inteiro).
          // Os handlers usados aqui leem o estado mais recente (setPosts(prev => ...)), então pular é seguro.
          return (
            <React.Fragment key={p.id}>
            {pIdx === caughtUpAt && pIdx > 0 ? (
              <View style={s.caughtUp}>
                <View style={[s.caughtLine, { backgroundColor: colors.border }]} />
                <View style={s.caughtIcon}>
                  <Text style={{ color: "#FFF", fontWeight: "900" }}>✓</Text>
                </View>
                <Text style={{ color: colors.text, fontWeight: "900", marginTop: 8 }}>Você está em dia</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Você já viu os looks novos. Abaixo, os anteriores.</Text>
                <View style={[s.caughtLine, { backgroundColor: colors.border, marginTop: 14 }]} />
              </View>
            ) : null}
            <MemoRow
              key={p.id}
              deps={[p, isTagsVisible, heartAnimPostId === p.id, colors, myId, pIdx === 1 ? refreshKey : 0, pIdx < 4]}
              render={() => (
            <FadeIn delay={pIdx < 4 ? pIdx * 70 : 0} from={14}>
            <React.Fragment key={p.id}>
              <View style={[s.post, { borderBottomColor: colors.border }]}>
                {/* Post Header */}
                <View style={s.ph}>
                  <Pressable
                    onPress={() => onOpenProfile?.(p.creatorUsername || p.creatorName)}
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
                    <Pressable onPress={() => openPostMenu(p)} hitSlop={10}>
                      <MoreHorizontal size={18} color={colors.muted} />
                    </Pressable>
                  </View>
                </View>

                {/* Foto(s) do post: carrossel, dois toques para curtir, segurar para zoom */}
                <RepostLine post={p} onOpenProfile={onOpenProfile} />
                <PostMedia
                  images={p.images && p.images.length ? p.images : [p.image]}
                  video={p.videoUrl}
                  labels={p.kind === "poll" ? p.poll?.options : undefined}
                  onDoubleTap={() => triggerDoubleTap(p, true)}
                  onOpenZoom={i => setZoom({ images: p.images && p.images.length ? p.images : [p.image], index: i })}
                >

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
                </PostMedia>

                {/* Action Icons Bar */}
                <View style={s.actions}>
                  <View style={s.leftActions}>
                    <Pressable onPress={() => toggleLikeOrSave(p.id, "isLiked")} hitSlop={8}>
                      <PopOnActive active={!!p.isLiked}>
                        <Heart
                          size={25}
                          color={p.isLiked ? "#FF3040" : colors.icon}
                          fill={p.isLiked ? "#FF3040" : "none"}
                        />
                      </PopOnActive>
                    </Pressable>
                    <Pressable onPress={() => setCommentPost(p)} hitSlop={8}>
                      <MessageCircle size={24} color={colors.icon} />
                    </Pressable>
                    <Pressable onPress={() => setSharePost(p)} hitSlop={8}>
                      <View style={{ transform: [{ rotate: "-22deg" }] }}>
            <Send size={23} color={colors.icon} />
          </View>
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() => toggleLikeOrSave(p.id, "isSaved")}
                    onLongPress={() => {
                      tapFeedback();
                      setCollectionPost(p);
                    }}
                    delayLongPress={350}
                    hitSlop={8}
                  >
                    <PopOnActive active={!!p.isSaved}>
                      <Bookmark size={24} color={colors.icon} fill={p.isSaved ? colors.icon : "none"} />
                    </PopOnActive>
                  </Pressable>
                </View>

                <PollBar post={p} isMine={isMine(p)} onChange={u => setPostsSilently(u)} />

                {/* Post Body (Likes, Caption, Comments, Wardrobe CTA) */}
                <View style={s.body}>
                  <View style={{ marginBottom: 6 }}>
                    <RatingBar post={p} onChange={u => setPostsSilently(u)} />
                  </View>
                  {p.hideLikes && !isMine(p) ? (
                    <Text style={[s.likes, { color: colors.text }]}>
                      {p.isLiked ? "Você e outras pessoas curtiram" : "Curtido por outras pessoas"}
                    </Text>
                  ) : (
                    <Pressable onPress={() => p.likes > 0 && setLikersPost(p.id)} hitSlop={6}>
                      <Text style={[s.likes, { color: colors.text }]}>
                        {p.likes.toLocaleString("pt-BR")} {p.likes === 1 ? "curtida" : "curtidas"}
                        {p.hideLikes ? <Text style={{ color: colors.muted, fontWeight: "600" }}> · só você vê</Text> : null}
                      </Text>
                    </Pressable>
                  )}
                  <RichCaption
                    text={p.caption}
                    style={[s.caption, { color: colors.text }]}
                    prefix={<Text style={{ fontWeight: "900" }}>{p.creatorName} </Text>}
                    onTag={onOpenTag}
                    onMention={u => onOpenProfile?.(u)}
                  />
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

              {pIdx === 1 ? (
                <View style={[s.suggestionsSection, { backgroundColor: colors.surface, borderColor: colors.border, paddingHorizontal: 0, paddingVertical: 0 }]}>
                  <SuggestionsRow onOpenProfile={prof => onOpenProfile?.(prof.username)} reloadKey={refreshKey} />
                </View>
              ) : null}
            </React.Fragment>
            </FadeIn>
              )}
            />
            </React.Fragment>
          );
        })
      )}

      {/* Modals */}
      <ImageZoomModal images={zoom?.images || null} index={zoom?.index || 0} onClose={() => setZoom(null)} />
      <RepostModal post={repostPost} onClose={() => setRepostPost(null)} onDone={np => setPosts(v => [np, ...v])} />
      <LikersModal
        postId={likersPost}
        onClose={() => setLikersPost(null)}
        onOpenProfile={u => {
          setLikersPost(null);
          onOpenProfile?.(u);
        }}
      />
      <EditPostModal post={editingPost} onClose={() => setEditingPost(null)} onSaved={u => setPostsSilently(u)} />
      <CommentsModal
        isOwner={!!commentPost && isMine(commentPost)}
        onPostChange={u => setPostsSilently(u)}
        post={commentPost}
        visible={!!commentPost}
        onClose={() => setCommentPost(null)}
        onOpenProfile={u => {
          setCommentPost(null);
          onOpenProfile?.(u);
        }}
        onOpenTag={t => {
          setCommentPost(null);
          onOpenTag?.(t);
        }}
        onCommented={(postId, total) =>
          setPosts(prev => prev.map(p => (p.id === postId ? { ...p, commentsCount: total } : p)))
        }
      />
      <SharePostModal post={sharePost} visible={!!sharePost} onClose={() => setSharePost(null)} />
      <CollectionPickerModal
        post={collectionPost}
        onClose={() => setCollectionPost(null)}
        onSaved={id => setPosts(prev => prev.map(x => (x.id === id ? { ...x, isSaved: true } : x)))}
      />
      <StoryViewerModal
        visible={activeStoryIdx !== null}
        onClose={() => setActiveStoryIdx(null)}
        storyGroups={stories}
        initialGroupIndex={activeStoryIdx || 0}
        onStorySeen={id =>
          setStories(prev =>
            prev.map(g => {
              if (!g.stories.some(st => st.id === id)) return g;
              const list = g.stories.map(st => (st.id === id ? { ...st, seen: true } : st));
              return { ...g, stories: list, hasUnseen: list.some(st => !st.seen) };
            })
          )
        }
        onStoryDeleted={id =>
          setStories(prev => prev.map(g => ({ ...g, stories: g.stories.filter(st => st.id !== id) })))
        }
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
  caughtUp: { alignItems: "center", paddingVertical: 22, paddingHorizontal: 30 },
  caughtLine: { height: StyleSheet.hairlineWidth, alignSelf: "stretch" },
  caughtIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#22C55E", alignItems: "center", justifyContent: "center", marginTop: 14 },
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
