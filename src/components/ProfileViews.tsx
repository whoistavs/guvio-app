import React, { useState, useEffect } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import {
  Bookmark,
  Camera,
  Archive,
  AtSign,
  Bell,
  BellOff,
  Gauge,
  Clock3,
  FileText,
  Globe,
  HelpCircle,
  Grid3X3,
  Heart,
  ImagePlus,
  Layers,
  Lock,
  LogOut,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Moon,
  Pin,
  Play,
  Repeat2,
  Settings,
  Star,
  Share2,
  Shield,
  Tag,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
  X
} from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { FeedPost, UserProfile, MOCK_FEED_POSTS, SavedCollection } from "../data/mockData";
import { ScreenHeader } from "./ScreenHeader";
import { Toggle } from "./Toggle";
import { useAppTheme } from "../context/AppTheme";
import {
  loadSavedProfile,
  saveProfile,
  INITIAL_USER_PROFILE,
  loadFollowedUsers,
  saveFollowedUsers,
  loadUserPosts,
  loadMyPosts,
  loadSavedOnlyPosts,
  getCachedMyProfile,
  getCachedMyPosts,
  loadBlocked,
  setBlocked,
  loadCollections,
  loadCollectionPosts,
  deleteCollection,
  loadRequestedIds,
  cancelFollowRequest,
  loadMutedIds,
  setMuted,
  loadTaggedPosts,
  loadFollowRequests,
  answerFollowRequest,
  loadArchivedPosts
} from "../services/storage";
import { getSavedAuthSession } from "../services/auth";
import { FastImage, preloadImages } from "./FastImage";
import { ShareProfileModal } from "./ShareProfileModal";
import { GridSkeleton, ProfileSkeleton } from "./SkeletonLoader";
import { HighlightsRow } from "./HighlightsRow";
import { CloseFriendsView } from "./CloseFriendsView";
import { BioLink } from "./BioExtras";
import { AchievementsRow } from "./AchievementsRow";
import { LEGAL_TEXTS } from "../data/legal";
import { getSettings, NotifKind, updateSettings } from "../services/settings";

function Grid({
  posts,
  colors,
  onSelectPost,
  emptyTitle = "Nenhuma publicação ainda",
  emptySubtitle = "Seus looks publicados no feed aparecerão aqui no estilo grade do Instagram."
}: {
  posts: FeedPost[];
  colors: any;
  onSelectPost?: (p: FeedPost) => void;
  emptyTitle?: string;
  emptySubtitle?: string;
}) {
  useEffect(() => {
    if (posts.length > 0) {
      preloadImages(posts.map(p => p.image));
    }
  }, [posts]);

  if (posts.length === 0) {
    return (
      <View style={s.emptyGrid}>
        <Grid3X3 size={32} color={colors.muted} />
        <Text style={{ color: colors.text, fontWeight: "800", marginTop: 8 }}>{emptyTitle}</Text>
        <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 4 }}>
          {emptySubtitle}
        </Text>
      </View>
    );
  }
  return (
    <View style={s.grid}>
      {posts.map(p => (
        <Pressable key={p.id} onPress={() => onSelectPost?.(p)} style={s.tileWrap}>
          <FastImage source={p.image} style={s.tile} contentFit="cover" transition={100} />
          {p.pinned ? (
            <View style={s.tileIcon}>
              <Pin size={13} color="#FFF" fill="#FFF" />
            </View>
          ) : p.videoUrl ? (
            <View style={s.tileIcon}>
              <Play size={13} color="#FFF" fill="#FFF" />
            </View>
          ) : p.kind === "poll" ? (
            <View style={s.tileIcon}>
              <Text style={{ fontSize: 11 }}>🗳️</Text>
            </View>
          ) : p.kind === "repost" ? (
            <View style={s.tileIcon}>
              <Repeat2 size={13} color="#FFF" />
            </View>
          ) : p.images && p.images.length > 1 ? (
            <View style={s.tileIcon}>
              <Layers size={13} color="#FFF" />
            </View>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

export function PublicProfileView({
  profile,
  onBack,
  onMessage,
  onOpenPost,
  onOpenFollows
}: {
  profile: UserProfile;
  onBack: () => void;
  onMessage: () => void;
  onOpenPost?: (postId: string) => void;
  onOpenFollows?: (kind: "followers" | "following") => void;
}) {
  const { colors } = useAppTheme();
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);

  const [initiallyFollowed, setInitiallyFollowed] = useState(false);
  const isFollowed = followedIds.includes(profile.id || profile.username);
  const [requested, setRequested] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [tab, setTab] = useState<"posts" | "tagged">("posts");
  const [tagged, setTagged] = useState<FeedPost[] | null>(null);
  const locked = !!profile.isPrivate && !isFollowed;

  useEffect(() => {
    loadFollowedUsers().then(ids => {
      setFollowedIds(ids);
      setInitiallyFollowed(ids.includes(profile.id || profile.username));
    });
    loadUserPosts(profile).then(setPosts);
    loadRequestedIds().then(ids => setRequested(ids.includes(profile.id)));
    loadMutedIds().then(ids => setMutedState(ids.includes(profile.id)));
    setTab("posts");
    setTagged(null);
  }, [profile]);

  useEffect(() => {
    if (tab === "tagged" && tagged === null) loadTaggedPosts(profile.username).then(setTagged);
  }, [tab]);

  const openMenu = () =>
    Alert.alert(`@${profile.username}`, undefined, [
      {
        text: muted ? "Reativar no feed" : "Silenciar",
        onPress: async () => {
          try {
            await setMuted(profile.id, !muted);
            setMutedState(!muted);
            Alert.alert(
              muted ? "Reativado" : "Silenciado",
              muted
                ? `Os looks de @${profile.username} voltam a aparecer no seu feed.`
                : `Os looks de @${profile.username} não aparecem mais no seu feed. Você continua seguindo e ela não fica sabendo.`
            );
          } catch (e: any) {
            Alert.alert("Erro", e?.message || "Tente novamente.");
          }
        }
      },
      { text: "Compartilhar perfil", onPress: () => setSharing(true) },
      { text: "Bloquear", style: "destructive", onPress: handleBlock },
      { text: "Cancelar", style: "cancel" }
    ]);

  const handleBlock = () => {
    Alert.alert(
      `Bloquear @${profile.username}?`,
      "Essa pessoa não poderá mais te enviar mensagens e você deixará de segui-la.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Bloquear",
          style: "destructive",
          onPress: async () => {
            try {
              await setBlocked(profile, true);
              setFollowedIds(prev => prev.filter(id => id !== profile.id));
              Alert.alert("Bloqueado", `@${profile.username} foi bloqueado.`);
              onBack();
            } catch (e: any) {
              Alert.alert("Erro", e?.message || "Não foi possível bloquear.");
            }
          }
        }
      ]
    );
  };

  const toggleFollow = async () => {
    const targetId = profile.id || profile.username;
    if (requested) {
      await cancelFollowRequest(targetId).catch(() => {});
      setRequested(false);
      return;
    }
    const doIt = async () => {
      const updated = isFollowed ? followedIds.filter(id => id !== targetId) : [...followedIds, targetId];
      setFollowedIds(updated);
      const asked = await saveFollowedUsers(updated);
      if (asked.includes(targetId)) {
        setFollowedIds(prev => prev.filter(id => id !== targetId));
        setRequested(true);
      }
    };
    if (isFollowed && profile.isPrivate) {
      Alert.alert("Deixar de seguir?", "Esta conta é privada: para ver os looks de novo, você vai precisar pedir outra vez.", [
        { text: "Cancelar", style: "cancel" },
        { text: "Deixar de seguir", style: "destructive", onPress: doIt }
      ]);
      return;
    }
    await doIt();
  };

  const [sharing, setSharing] = useState(false);
  const followersCount = Math.max(0, (profile.followers || 0) - (initiallyFollowed ? 1 : 0) + (isFollowed ? 1 : 0));

  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 110 }}>
        <ScreenHeader
          title={`@${profile.username}`}
          onBack={onBack}
          right={
            <Pressable onPress={openMenu} hitSlop={10}>
              <MoreHorizontal size={24} color={colors.icon} />
            </Pressable>
          }
        />
        <View style={s.top}>
          <FastImage
            source={profile.avatar}
            style={s.bigAvatar}
            contentFit="cover"
            transition={100}
          />
          <View style={s.stats}>
            <Stat v={(locked ? profile.postsCount || 0 : posts.length).toString()} l="posts" colors={colors} />
            <Stat
              v={followersCount.toLocaleString("pt-BR")}
              l="seguidores"
              colors={colors}
              onPress={onOpenFollows && !locked ? () => onOpenFollows("followers") : undefined}
            />
            <Stat
              v={(profile.following || 0).toString()}
              l="seguindo"
              colors={colors}
              onPress={onOpenFollows && !locked ? () => onOpenFollows("following") : undefined}
            />
          </View>
        </View>

        <View style={s.bio}>
          <Text style={[s.display, { color: colors.text }]}>
            {profile.displayName}
            {profile.pronouns ? <Text style={{ color: colors.muted, fontWeight: "500" }}>  {profile.pronouns}</Text> : null}
            {profile.isPrivate ? "  🔒" : ""}
          </Text>
          <Text style={{ color: colors.muted }}>{profile.location}</Text>
          {profile.bio ? <Text style={[s.bioText, { color: colors.text }]}>{profile.bio}</Text> : null}
          <BioLink url={profile.website} />
          {muted ? <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>🔕 Silenciado no seu feed</Text> : null}
        </View>

        <AchievementsRow profile={profile} posts={posts} />

        <View style={s.actions}>
          <Pressable
            onPress={toggleFollow}
            style={[
              s.btn,
              { backgroundColor: isFollowed || requested ? colors.surface : "#0095F6" }
            ]}
          >
            {requested ? (
              <Text style={{ color: colors.text, fontWeight: "800" }}>Solicitado</Text>
            ) : isFollowed ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <UserCheck size={16} color={colors.text} />
                <Text style={{ color: colors.text, fontWeight: "800" }}>Seguindo</Text>
              </View>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <UserPlus size={16} color="#FFF" />
                <Text style={{ color: "#FFF", fontWeight: "800" }}>{profile.isPrivate ? "Pedir para seguir" : "Seguir"}</Text>
              </View>
            )}
          </Pressable>

          <Pressable onPress={onMessage} style={[s.btn, { backgroundColor: colors.surface }]}>
            <MessageCircle size={17} color={colors.icon} />
            <Text style={{ color: colors.text, fontWeight: "800" }}>Mensagem</Text>
          </Pressable>
        </View>

        {locked ? (
          <View style={[s.lockBox, { borderTopColor: colors.border }]}>
            <View style={[s.lockIcon, { borderColor: colors.text }]}>
              <Lock size={26} color={colors.text} />
            </View>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>Esta conta é privada</Text>
            <Text style={{ color: colors.muted, textAlign: "center", fontSize: 12 }}>
              {requested ? "Pedido enviado. Quando aceitarem, os looks aparecem aqui." : "Peça para seguir e veja os looks de @" + profile.username + "."}
            </Text>
          </View>
        ) : (
          <>
            <HighlightsRow userId={profile.id} username={profile.username} avatar={profile.avatar} />
            <View style={[s.profileTabsBar, { borderTopColor: colors.border, borderBottomColor: colors.border, marginTop: 14 }]}>
              <Pressable onPress={() => setTab("posts")} style={[s.tabItem, tab === "posts" && { borderBottomColor: colors.text, borderBottomWidth: 2 }]}>
                <Grid3X3 size={20} color={tab === "posts" ? colors.text : colors.muted} />
              </Pressable>
              <Pressable onPress={() => setTab("tagged")} style={[s.tabItem, tab === "tagged" && { borderBottomColor: colors.text, borderBottomWidth: 2 }]}>
                <AtSign size={20} color={tab === "tagged" ? colors.text : colors.muted} />
              </Pressable>
            </View>
            {tab === "posts" ? (
              <Grid posts={posts} colors={colors} onSelectPost={p => (onOpenPost ? onOpenPost(p.id) : setSelectedPost(p))} />
            ) : tagged === null ? (
              <GridSkeleton count={6} />
            ) : (
              <Grid
                posts={tagged}
                colors={colors}
                onSelectPost={p => (onOpenPost ? onOpenPost(p.id) : setSelectedPost(p))}
                emptyTitle="Nenhuma marcação"
                emptySubtitle={`Looks em que marcarem @${profile.username} aparecem aqui.`}
              />
            )}
          </>
        )}
      </ScrollView>

      {/* Post Viewer Modal */}
      <Modal visible={!!selectedPost} transparent animationType="slide" onRequestClose={() => setSelectedPost(null)}>
        <View style={s.modalBack}>
          <View style={[s.postModal, { backgroundColor: colors.bg }]}>
            <View style={s.postHeader}>
              <FastImage source={profile.avatar} style={s.postAvatar} contentFit="cover" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "900", fontSize: 13 }}>@{profile.username}</Text>
                {selectedPost?.city ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <MapPin size={11} color={colors.muted} />
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {selectedPost.city}, {selectedPost.country}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Pressable onPress={() => setSelectedPost(null)} hitSlop={10}>
                <X size={24} color={colors.icon} />
              </Pressable>
            </View>

            {selectedPost && (
              <FastImage source={selectedPost.image} style={s.postImg} contentFit="cover" transition={120} />
            )}

            <View style={s.postBody}>
              <View style={{ flexDirection: "row", gap: 14, alignItems: "center", marginBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Heart size={20} color={colors.icon} />
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>
                    {selectedPost?.likes || 0}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <MessageCircle size={20} color={colors.icon} />
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>
                    {selectedPost?.commentsCount || 0}
                  </Text>
                </View>
              </View>
              {selectedPost?.caption ? (
                <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18 }}>
                  <Text style={{ fontWeight: "900" }}>@{profile.username} </Text>
                  {selectedPost.caption}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
      <ShareProfileModal
        visible={sharing}
        onClose={() => setSharing(false)}
        username={profile.username}
        displayName={profile.displayName}
        avatar={profile.avatar}
      />
    </>
  );
}

function Stat({ v, l, colors, onPress }: { v: string; l: string; colors: any; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} hitSlop={6} style={{ alignItems: "center" }}>
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>{v}</Text>
      <Text style={{ color: colors.muted, fontSize: 10 }}>{l}</Text>
    </Pressable>
  );
}

export function MyProfileView({
  onSettings,
  postsVersion = 0,
  onOpenPost,
  onOpenFollows
}: {
  onSettings: () => void;
  postsVersion?: number;
  onOpenPost?: (postId: string) => void;
  onOpenFollows?: (p: UserProfile, kind: "followers" | "following") => void;
}) {
  const { colors } = useAppTheme();
  // começa com o último perfil salvo (sem piscar a tela de exemplo)
  const [profile, setProfileState] = useState<UserProfile | null>(() => getCachedMyProfile());
  const [userPosts, setUserPosts] = useState<FeedPost[]>(() => getCachedMyPosts() || []);
  const [savedPosts, setSavedPosts] = useState<FeedPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [sharing, setSharing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "saved" | "tagged">("posts");
  const [followingCount, setFollowingCount] = useState(0);
  const [savingProfile, setSavingProfile] = useState(false);

  // Edit fields
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editPronouns, setEditPronouns] = useState("");
  const [editPrivate, setEditPrivate] = useState(false);
  const [tagged, setTagged] = useState<FeedPost[] | null>(null);
  const [requests, setRequests] = useState<UserProfile[]>([]);

  useEffect(() => {
    const p = getCachedMyProfile();
    if (!p) return;
    setEditName(p.displayName);
    setEditUsername(p.username);
    setEditBio(p.bio || "");
    setEditWebsite(p.website || "");
    setEditLocation(p.location);
    setEditAvatar(p.avatar);
    setEditPronouns(p.pronouns || "");
    setEditPrivate(!!p.isPrivate);
  }, []);

  useEffect(() => {
    if (activeTab === "tagged" && profile && tagged === null) loadTaggedPosts(profile.username).then(setTagged);
  }, [activeTab, profile?.username]);

  useEffect(() => {
    getSavedAuthSession().then(session => {
      const uId = session?.user?.email || session?.user?.id;
      setCurrentUserId(uId);
      loadSavedProfile(uId).then(p => {
        setProfileState(p);
        setEditName(p.displayName);
        setEditUsername(p.username);
        setEditBio(p.bio || "");
        setEditWebsite(p.website || "");
        setEditLocation(p.location);
        setEditAvatar(p.avatar);
        setEditPronouns(p.pronouns || "");
        setEditPrivate(!!p.isPrivate);
      });
    });
    loadFollowRequests().then(setRequests);

    loadFollowedUsers().then(ids => {
      setFollowingCount(ids.length);
    });
  }, []);

  useEffect(() => {
    loadMyPosts().then(setUserPosts).catch(() => {});
    loadSavedOnlyPosts().then(setSavedPosts).catch(() => {});
  }, [postsVersion]);

  const pickAvatar = async (useCamera: boolean) => {
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permissão", "Precisamos de acesso à câmera.");
          return;
        }
        const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
        if (!res.canceled && res.assets && res.assets.length > 0) {
          setEditAvatar(res.assets[0].uri);
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permissão", "Precisamos de acesso à galeria.");
          return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
        if (!res.canceled && res.assets && res.assets.length > 0) {
          setEditAvatar(res.assets[0].uri);
        }
      }
    } catch (e) {
      Alert.alert("Erro", "Falha ao carregar imagem.");
    }
  };

  const handleSaveProfile = async () => {
    if (savingProfile || !profile) return;
    const updated: UserProfile = {
      ...profile,
      displayName: editName.trim() || profile.displayName,
      username: editUsername.trim() || profile.username,
      bio: editBio.trim(),
      website: editWebsite.trim(),
      location: editLocation.trim() || profile.location,
      avatar: editAvatar || profile.avatar,
      pronouns: editPronouns.trim(),
      isPrivate: editPrivate
    };
    setSavingProfile(true);
    try {
      const saved = await saveProfile(updated, currentUserId);
      setProfileState(saved);
      setEditAvatar(saved.avatar);
      setEditUsername(saved.username);
      setEditModalVisible(false);
    } catch (e: any) {
      Alert.alert("Não foi possível salvar", e?.message || "Tente novamente.");
    } finally {
      setSavingProfile(false);
    }
  };

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ProfileSkeleton />
        <GridSkeleton count={9} />
      </View>
    );
  }

  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 110 }}>
        <ScreenHeader
          title={`@${profile.username}`}
          right={
            <Pressable onPress={onSettings}>
              <MoreHorizontal size={25} color={colors.icon} />
            </Pressable>
          }
        />
        <View style={s.top}>
          <FastImage source={profile.avatar} style={s.bigAvatar} contentFit="cover" transition={100} />
          <View style={s.stats}>
            <Stat v={userPosts.length.toString()} l="posts" colors={colors} />
            <Stat
              v={profile.followers.toString()}
              l="seguidores"
              colors={colors}
              onPress={onOpenFollows ? () => onOpenFollows(profile, "followers") : undefined}
            />
            <Stat
              v={followingCount.toString()}
              l="seguindo"
              colors={colors}
              onPress={onOpenFollows ? () => onOpenFollows(profile, "following") : undefined}
            />
          </View>
        </View>

        <View style={s.bio}>
          <Text style={[s.display, { color: colors.text }]}>
            {profile.displayName}
            {profile.pronouns ? <Text style={{ color: colors.muted, fontWeight: "500" }}>  {profile.pronouns}</Text> : null}
            {profile.isPrivate ? "  🔒" : ""}
          </Text>
          <Text style={{ color: colors.muted }}>{profile.location}</Text>
          {profile.bio ? <Text style={[s.bioText, { color: colors.text }]}>{profile.bio}</Text> : null}
          <BioLink url={profile.website} />
        </View>

        <AchievementsRow profile={profile} posts={userPosts} />

        {requests.length > 0 ? (
          <View style={[s.requests, { backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.text, fontWeight: "900", marginBottom: 8 }}>
              Pedidos para seguir ({requests.length})
            </Text>
            {requests.map(r => (
              <View key={r.id} style={s.requestRow}>
                <FastImage source={r.avatar} style={{ width: 36, height: 36, borderRadius: 18 }} />
                <Text style={{ color: colors.text, fontWeight: "800", flex: 1 }} numberOfLines={1}>
                  @{r.username}
                </Text>
                <Pressable
                  onPress={async () => {
                    await answerFollowRequest(r.id, true).catch(() => {});
                    setRequests(prev => prev.filter(x => x.id !== r.id));
                    setProfileState(p => (p ? { ...p, followers: p.followers + 1 } : p));
                  }}
                  style={[s.reqBtn, { backgroundColor: "#0095F6" }]}
                >
                  <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 12 }}>Aceitar</Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    await answerFollowRequest(r.id, false).catch(() => {});
                    setRequests(prev => prev.filter(x => x.id !== r.id));
                  }}
                  style={[s.reqBtn, { backgroundColor: colors.bg }]}
                >
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>Recusar</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <View style={s.editRow}>
          <Pressable onPress={() => setEditModalVisible(true)} style={[s.edit, s.editHalf, { backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.text, fontWeight: "800" }}>Editar perfil</Text>
          </Pressable>
          <Pressable onPress={() => setSharing(true)} style={[s.edit, s.editHalf, { backgroundColor: colors.surface }]}>
            <Text style={{ color: colors.text, fontWeight: "800" }}>Compartilhar perfil</Text>
          </Pressable>
        </View>

        <HighlightsRow userId={profile.id} username={profile.username} avatar={profile.avatar} isMe />

        {/* Instagram Profile Tabs: Posts | Saved | Tagged */}
        <View style={[s.profileTabsBar, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
          <Pressable
            onPress={() => setActiveTab("posts")}
            style={[s.tabItem, activeTab === "posts" && { borderBottomColor: colors.text, borderBottomWidth: 2 }]}
          >
            <Grid3X3 size={20} color={activeTab === "posts" ? colors.text : colors.muted} />
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("saved")}
            style={[s.tabItem, activeTab === "saved" && { borderBottomColor: colors.text, borderBottomWidth: 2 }]}
          >
            <Bookmark size={20} color={activeTab === "saved" ? colors.text : colors.muted} />
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("tagged")}
            style={[s.tabItem, activeTab === "tagged" && { borderBottomColor: colors.text, borderBottomWidth: 2 }]}
          >
            <Tag size={20} color={activeTab === "tagged" ? colors.text : colors.muted} />
          </Pressable>
        </View>

        {/* Tab Content */}
        {activeTab === "posts" && (
          <Grid
            posts={userPosts}
            colors={colors}
            onSelectPost={p => (onOpenPost ? onOpenPost(p.id) : setSelectedPost(p))}
            emptyTitle="Nenhum look postado"
            emptySubtitle="Seus looks publicados no feed aparecerão aqui no estilo grade do Instagram."
          />
        )}

        {activeTab === "saved" && (
          <Grid
            posts={savedPosts}
            colors={colors}
            onSelectPost={p => (onOpenPost ? onOpenPost(p.id) : setSelectedPost(p))}
            emptyTitle="Nenhum look salvo"
            emptySubtitle="Clique no ícone de salvar em qualquer look do feed para guardá-lo na sua coleção privada."
          />
        )}

        {activeTab === "tagged" && (
          tagged === null ? (
            <GridSkeleton count={6} />
          ) : (
            <Grid
              posts={tagged}
              colors={colors}
              onSelectPost={p => (onOpenPost ? onOpenPost(p.id) : setSelectedPost(p))}
              emptyTitle="Nenhuma marcação"
              emptySubtitle={`Looks em que alguém escrever @${profile.username} na legenda aparecem aqui.`}
            />
          )
        )}
      </ScrollView>

      {/* Post Viewer Modal */}
      <Modal visible={!!selectedPost} transparent animationType="slide" onRequestClose={() => setSelectedPost(null)}>
        <View style={s.modalBack}>
          <View style={[s.postModal, { backgroundColor: colors.bg }]}>
            <View style={s.postHeader}>
              <FastImage source={profile.avatar} style={s.postAvatar} contentFit="cover" transition={100} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "900", fontSize: 13 }}>@{profile.username}</Text>
                {selectedPost?.city ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <MapPin size={11} color={colors.muted} />
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {selectedPost.city}, {selectedPost.country}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Pressable onPress={() => setSelectedPost(null)}>
                <X size={24} color={colors.icon} />
              </Pressable>
            </View>

            {selectedPost ? (
              <FastImage source={selectedPost.image} style={s.postImg} contentFit="cover" transition={120} />
            ) : null}

            <View style={s.postBody}>
              <View style={{ flexDirection: "row", gap: 14, alignItems: "center", marginBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Heart size={20} color={colors.icon} />
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>
                    {selectedPost?.likes || 0}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <MessageCircle size={20} color={colors.icon} />
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>
                    {selectedPost?.commentsCount || 0}
                  </Text>
                </View>
              </View>
              {selectedPost?.caption ? (
                <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18 }}>
                  <Text style={{ fontWeight: "900" }}>@{profile.username} </Text>
                  {selectedPost.caption}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <View style={s.modalBack}>
          <View style={[s.modal, { backgroundColor: colors.bg }]}>
            <View style={{ width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[s.modalH, { color: colors.text }]}>Editar perfil</Text>
              <Pressable onPress={() => setEditModalVisible(false)}>
                <X size={22} color={colors.icon} />
              </Pressable>
            </View>

            <FastImage source={editAvatar} style={s.avatarEditImg} contentFit="cover" transition={100} />

            <View style={s.pickers}>
              <Pressable
                onPress={() => pickAvatar(true)}
                style={[s.pickerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Camera size={16} color={colors.icon} />
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 11 }}>Tirar foto</Text>
              </Pressable>
              <Pressable
                onPress={() => pickAvatar(false)}
                style={[s.pickerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <ImagePlus size={16} color={colors.icon} />
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 11 }}>Galeria</Text>
              </Pressable>
            </View>

            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Nome de exibição"
              placeholderTextColor={colors.muted}
              style={[s.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            />
            <TextInput
              value={editUsername}
              onChangeText={setEditUsername}
              placeholder="Nome de usuário (@)"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              style={[s.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            />
            <TextInput
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Bio (ex: Estilo minimalista & alfaiataria)"
              placeholderTextColor={colors.muted}
              style={[s.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            />
            <TextInput
              value={editWebsite}
              onChangeText={setEditWebsite}
              placeholder="Link / Website"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              style={[s.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            />
            <TextInput
              value={editLocation}
              onChangeText={setEditLocation}
              placeholder="Localização (ex: Campinas, Brasil)"
              placeholderTextColor={colors.muted}
              style={[s.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            />
            <TextInput
              value={editPronouns}
              onChangeText={setEditPronouns}
              maxLength={30}
              placeholder="Pronomes (ex: ele/dele, ela/dela)"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              style={[s.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            />
            <Pressable
              onPress={() => setEditPrivate(v => !v)}
              style={[s.privateRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Lock size={18} color={colors.icon} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "800" }}>Conta privada</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Só quem você aprovar vê seus looks e stories</Text>
              </View>
              <Toggle value={editPrivate} onValueChange={() => setEditPrivate(v => !v)} />
            </Pressable>

            <Pressable onPress={handleSaveProfile} style={[s.saveBtn, { backgroundColor: colors.text }]}>
              <Text style={{ color: colors.bg, fontWeight: "900" }}>Salvar alterações</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <ShareProfileModal
        visible={sharing}
        onClose={() => setSharing(false)}
        username={profile.username}
        displayName={profile.displayName}
        avatar={profile.avatar}
      />
    </>
  );
}

export function SettingsView({
  onBack,
  onOpen,
  onSignOut,
  onDeleteAccount
}: {
  onBack: () => void;
  onOpen: (x: string) => void;
  onSignOut?: () => void;
  onDeleteAccount?: () => Promise<void>;
}) {
  const { colors, pref, setPref } = useAppTheme();
  const [saver, setSaver] = useState(() => getSettings().dataSaver);
  const toggleSaver = () => setSaver(updateSettings({ dataSaver: !saver }).dataSaver);
  const rows = [
    { id: "saved", l: "Salvos", i: Bookmark },
    { id: "archived", l: "Arquivados", i: Archive },
    { id: "activity", l: "Sua atividade", i: Clock3 },
    { id: "blocked", l: "Bloqueados", i: UserX },
    { id: "closeFriends", l: "Melhores amigos", i: Star },
    { id: "notifications", l: "Notificações", i: Bell },
    { id: "feedback", l: "Enviar feedback / bug", i: MessageCircle },
    { id: "tutorial", l: "Ver tutorial de novo", i: HelpCircle },
    { id: "privacy", l: "Política de Privacidade", i: Shield },
    { id: "terms", l: "Termos de Uso", i: FileText }
  ];

  const handleConfirmSignOut = () => {
    Alert.alert("Sair da conta", "Deseja encerrar a sessão da sua conta no Guvio?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: onSignOut }
    ]);
  };

  const [deleting, setDeleting] = useState(false);

  const handleConfirmDelete = () => {
    Alert.alert(
      "Apagar sua conta?",
      "Seu perfil, posts, comentários, mensagens, stories e guarda-roupa serão apagados para sempre. Isso não pode ser desfeito.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Continuar",
          style: "destructive",
          onPress: () =>
            Alert.alert("Tem certeza absoluta?", "Última confirmação: sua conta será apagada agora.", [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Apagar minha conta",
                style: "destructive",
                onPress: async () => {
                  if (!onDeleteAccount) return;
                  setDeleting(true);
                  try {
                    await onDeleteAccount();
                  } catch (e: any) {
                    Alert.alert("Não foi possível apagar", e?.message || "Tente novamente.");
                  } finally {
                    setDeleting(false);
                  }
                }
              }
            ])
        }
      ]
    );
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 60 }}>
      <ScreenHeader title="Configurações" onBack={onBack} />
      {rows.map(r => {
        const I = r.i;
        return (
          <Pressable key={r.id} onPress={() => onOpen(r.id)} style={[s.setting, { borderBottomColor: colors.border }]}>
            <I size={21} color={colors.icon} />
            <Text style={[s.settingText, { color: colors.text }]}>{r.l}</Text>
          </Pressable>
        );
      })}
      <View style={[s.setting, { borderBottomColor: colors.border }]}>
        <Moon size={21} color={colors.icon} />
        <Text style={[s.settingText, { color: colors.text }]}>Tema</Text>
        <View style={{ flexDirection: "row", backgroundColor: colors.surface, borderRadius: 10, padding: 3 }}>
          {([
            ["system", "Auto"],
            ["light", "Claro"],
            ["dark", "Escuro"]
          ] as const).map(([k, l]) => (
            <Pressable
              key={k}
              onPress={() => setPref(k)}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: pref === k ? colors.text : "transparent" }}
            >
              <Text style={{ color: pref === k ? colors.bg : colors.text, fontSize: 12, fontWeight: "800" }}>{l}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Pressable onPress={toggleSaver} style={[s.setting, { borderBottomColor: colors.border }]}>
        <Gauge size={21} color={colors.icon} />
        <View style={{ flex: 1 }}>
          <Text style={[s.settingText, { color: colors.text }]}>Economia de dados</Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>Fotos mais leves ao publicar e sem pré-carregar imagens</Text>
        </View>
        <Toggle value={saver} onValueChange={toggleSaver} />
      </Pressable>
      {onSignOut ? (
        <Pressable onPress={handleConfirmSignOut} style={[s.setting, { borderBottomColor: colors.border, marginTop: 12 }]}>
          <LogOut size={21} color="#FF3B30" />
          <Text style={[s.settingText, { color: "#FF3B30", fontWeight: "800" }]}>Sair da conta</Text>
        </Pressable>
      ) : null}
      {onDeleteAccount ? (
        <Pressable
          onPress={handleConfirmDelete}
          disabled={deleting}
          style={[s.setting, { borderBottomColor: colors.border, opacity: deleting ? 0.5 : 1 }]}
        >
          <Trash2 size={21} color="#FF3B30" />
          <Text style={[s.settingText, { color: "#FF3B30" }]}>
            {deleting ? "Apagando conta..." : "Apagar minha conta"}
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

export function SimpleSettingsPage({
  kind,
  onBack,
  onOpenPost
}: {
  kind: string;
  onBack: () => void;
  onOpenPost?: (postId: string) => void;
}) {
  const { colors } = useAppTheme();
  const [savedPosts, setSavedPosts] = useState<FeedPost[]>([]);
  const [blocked, setBlockedList] = useState<UserProfile[]>([]);
  const [cols, setCols] = useState<SavedCollection[]>([]);
  const [archived, setArchived] = useState<FeedPost[] | null>(null);
  const [activeCol, setActiveCol] = useState<string | null>(null);
  const [colPosts, setColPosts] = useState<FeedPost[]>([]);

  useEffect(() => {
    if (kind === "archived") loadArchivedPosts().then(setArchived);
    if (kind === "saved") {
      loadSavedOnlyPosts().then(setSavedPosts);
      loadCollections().then(setCols);
    }
    if (kind === "blocked") loadBlocked().then(setBlockedList);
  }, [kind]);

  useEffect(() => {
    if (!activeCol) return;
    setColPosts([]);
    loadCollectionPosts(activeCol).then(setColPosts);
  }, [activeCol]);

  const manageCollection = (c: SavedCollection) => {
    Alert.alert(c.name, undefined, [
      {
        text: "Apagar coleção",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCollection(c.id);
            setCols(prev => prev.filter(x => x.id !== c.id));
            if (activeCol === c.id) setActiveCol(null);
          } catch (e: any) {
            Alert.alert("Erro", e?.message || "Não foi possível apagar.");
          }
        }
      },
      { text: "Cancelar", style: "cancel" }
    ]);
  };

  const unblock = async (p: UserProfile) => {
    try {
      await setBlocked(p, false);
      setBlockedList(prev => prev.filter(x => x.id !== p.id));
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Não foi possível desbloquear.");
    }
  };

  const legal = LEGAL_TEXTS[kind];
  const title = legal
    ? legal.title
    : kind === "archived"
      ? "Arquivados"
      : kind === "saved"
      ? "Salvos"
      : kind === "activity"
        ? "Sua atividade"
        : "Bloqueados";

  if (kind === "notifications") return <NotificationSettings onBack={onBack} />;
  if (kind === "closeFriends") return <CloseFriendsView onBack={onBack} />;

  if (legal) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }}>
        <ScreenHeader title={title} onBack={onBack} />
        <View style={s.legal}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Última atualização: {legal.updated}</Text>
          {legal.sections.map(sec => (
            <View key={sec.h}>
              <Text style={[s.legalH, { color: colors.text }]}>{sec.h}</Text>
              {sec.p.map((para, i) => (
                <Text key={i} style={[s.legalP, { color: colors.text, marginBottom: 8 }]}>
                  {para}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={title} onBack={onBack} />
      {kind === "archived" ? (
        archived === null ? (
          <GridSkeleton count={9} />
        ) : (
          <>
            <Text style={{ color: colors.muted, fontSize: 12, paddingHorizontal: 20, paddingVertical: 10 }}>
              Só você vê estes looks. Abra um e use o menu (…) para mostrar no perfil de novo.
            </Text>
            <Grid
              posts={archived}
              colors={colors}
              onSelectPost={p => onOpenPost?.(p.id)}
              emptyTitle="Nada arquivado"
              emptySubtitle="Use o menu (…) de um look seu e toque em Arquivar para tirá-lo do perfil sem apagar."
            />
          </>
        )
      ) : kind === "saved" ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.colRow}>
            {[{ id: "", name: "Todos", count: savedPosts.length, cover: savedPosts[0]?.image } as SavedCollection, ...cols].map(c => {
              const on = (activeCol || "") === c.id;
              return (
                <Pressable
                  key={c.id || "all"}
                  onPress={() => setActiveCol(c.id || null)}
                  onLongPress={c.id ? () => manageCollection(c) : undefined}
                  style={s.colItem}
                >
                  {c.cover ? (
                    <FastImage source={c.cover} style={[s.colCover, on && { borderColor: colors.text, borderWidth: 2 }]} contentFit="cover" />
                  ) : (
                    <View style={[s.colCover, { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }, on && { borderColor: colors.text, borderWidth: 2 }]}>
                      <Bookmark size={20} color={colors.muted} />
                    </View>
                  )}
                  <Text style={{ color: colors.text, fontSize: 11, fontWeight: on ? "900" : "600" }} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 10 }}>{c.count}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {cols.length === 0 ? (
            <Text style={{ color: colors.muted, fontSize: 12, paddingHorizontal: 20, marginBottom: 10 }}>
              Dica: segure o botão de salvar de um look para guardar numa coleção.
            </Text>
          ) : null}
          <Grid posts={activeCol ? colPosts : savedPosts} colors={colors} onSelectPost={p => onOpenPost?.(p.id)} />
        </>
      ) : kind === "activity" ? (
        <View style={s.info}>
          <Clock3 size={38} color={colors.icon} />
          <Text style={[s.infoBig, { color: colors.text }]}>0 min</Text>
          <Text style={{ color: colors.muted, textAlign: "center" }}>Sua atividade no Guvio iniciou agora</Text>
        </View>
      ) : blocked.length > 0 ? (
        <View style={{ paddingVertical: 8 }}>
          {blocked.map(p => (
            <View key={p.id} style={[s.setting, { borderBottomColor: colors.border }]}>
              <FastImage source={p.avatar} style={{ width: 40, height: 40, borderRadius: 20 }} contentFit="cover" />
              <Text style={[s.settingText, { color: colors.text }]}>@{p.username}</Text>
              <Pressable onPress={() => unblock(p)} style={[s.unblockBtn, { backgroundColor: colors.surface }]}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>Desbloquear</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <View style={s.info}>
          <UserX size={38} color={colors.icon} />
          <Text style={[s.infoBig, { color: colors.text }]}>Nenhum usuário bloqueado</Text>
          <Text style={{ color: colors.muted, textAlign: "center" }}>
            Para bloquear alguém, abra o perfil da pessoa e toque no ícone no canto superior.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function NotificationSettings({ onBack }: { onBack: () => void }) {
  const { colors } = useAppTheme();
  const [st, setSt] = useState(() => getSettings());
  const rows: { k: NotifKind; l: string; d: string }[] = [
    { k: "like", l: "Curtidas", d: "Em looks e comentários seus" },
    { k: "comment", l: "Comentários e respostas", d: "Quando comentam ou respondem você" },
    { k: "follow", l: "Seguidores", d: "Novos seguidores e pedidos para seguir" },
    { k: "message", l: "Mensagens do Direct", d: "Quando alguém te manda mensagem" }
  ];
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Notificações" onBack={onBack} />
      <Pressable onPress={() => setSt(updateSettings({ pauseAll: !st.pauseAll }))} style={[s.setting, { borderBottomColor: colors.border }]}>
        <BellOff size={21} color={colors.icon} />
        <View style={{ flex: 1 }}>
          <Text style={[s.settingText, { color: colors.text }]}>Pausar todas</Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>Os avisos continuam na tela de Notificações, só não aparecem no celular</Text>
        </View>
        <Toggle value={st.pauseAll} onValueChange={() => setSt(updateSettings({ pauseAll: !st.pauseAll }))} />
      </Pressable>
      {rows.map(r => {
        const on = st.notify[r.k] !== false;
        const flip = () => setSt(updateSettings({ notify: { ...st.notify, [r.k]: !on } }));
        return (
          <Pressable key={r.k} onPress={flip} disabled={st.pauseAll} style={[s.setting, { borderBottomColor: colors.border, opacity: st.pauseAll ? 0.45 : 1 }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.settingText, { color: colors.text }]}>{r.l}</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>{r.d}</Text>
            </View>
            <Toggle value={on} onValueChange={flip} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 22, paddingTop: 12 },
  bigAvatar: { width: 88, height: 88, borderRadius: 44 },
  stats: { flex: 1, flexDirection: "row", justifyContent: "space-around" },
  bio: { paddingHorizontal: 22, paddingTop: 14, gap: 4 },
  bioText: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  display: { fontSize: 14, fontWeight: "900" },
  actions: { flexDirection: "row", gap: 8, paddingHorizontal: 22, marginTop: 14 },
  btn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6
  },
  tileIcon: { position: "absolute", top: 6, right: 6, backgroundColor: "rgba(0,0,0,.35)", borderRadius: 8, padding: 3 },
  requests: { marginHorizontal: 22, marginTop: 14, borderRadius: 16, padding: 12 },
  requestRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
  reqBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  privateRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
  lockBox: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 18, paddingVertical: 40, paddingHorizontal: 30, alignItems: "center", gap: 8 },
  lockIcon: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  editRow: { flexDirection: "row", gap: 8, marginHorizontal: 22, marginTop: 14 },
  editHalf: { flex: 1, marginHorizontal: 0, marginTop: 0 },
  legal: { padding: 22, paddingBottom: 60 },
  colRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  colItem: { width: 76, alignItems: "center", gap: 3 },
  colCover: { width: 70, height: 70, borderRadius: 16 },
  legalH: { fontSize: 15, fontWeight: "900", marginTop: 18, marginBottom: 6 },
  legalP: { fontSize: 13, lineHeight: 20 },
  edit: {
    marginHorizontal: 22,
    marginTop: 14,
    minHeight: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  profileTabsBar: {
    flexDirection: "row",
    height: 48,
    marginTop: 18,
    borderTopWidth: 1,
    borderBottomWidth: 1
  },
  tabItem: { flex: 1, alignItems: "center", justifyContent: "center" },
  tab: { height: 52, marginTop: 18, borderTopWidth: 1, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  tileWrap: { width: "33.333%", aspectRatio: 1, borderWidth: 0.5, borderColor: "rgba(255,255,255,.2)" },
  tile: { width: "100%", height: "100%", backgroundColor: "#222" },
  emptyGrid: { alignItems: "center", justifyContent: "center", padding: 40, width: "100%" },
  setting: { minHeight: 58, flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10, gap: 14, borderBottomWidth: 1, flexShrink: 0 },
  settingText: { fontSize: 14, fontWeight: "700", flex: 1 },
  info: { alignItems: "center", padding: 40, gap: 12 },
  infoBig: { fontSize: 22, fontWeight: "900" },
  modalBack: { flex: 1, backgroundColor: "rgba(0,0,0,.65)", alignItems: "center", justifyContent: "center", padding: 18 },
  modal: { width: "100%", maxWidth: 380, borderRadius: 24, padding: 20, alignItems: "center", gap: 10 },
  postModal: { width: "100%", maxWidth: 420, borderRadius: 24, overflow: "hidden" },
  postHeader: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  postAvatar: { width: 36, height: 36, borderRadius: 18 },
  postImg: { width: "100%", aspectRatio: 1, backgroundColor: "#111" },
  postBody: { padding: 16 },
  modalH: { fontSize: 20, fontWeight: "900" },
  avatarEditImg: { width: 90, height: 90, borderRadius: 45, marginVertical: 6 },
  pickers: { flexDirection: "row", gap: 10, marginBottom: 8, width: "100%" },
  pickerBtn: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  input: {
    width: "100%",
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
    marginBottom: 4
  },
  unblockBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  saveBtn: { width: "100%", height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", marginTop: 8 }
});
