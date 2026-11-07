import {
  FeedPost,
  WardrobeItem,
  UserProfile,
  UserStoryGroup,
  ActivityItem,
  CommentItem,
  DirectThread,
  INITIAL_STORIES,
  MOCK_ACTIVITIES,
  MOCK_PROFILES,
  MOCK_COMMENTS,
  MOCK_DIRECTS
} from "../data/mockData";
import { FastStorage } from "./FastStorage";
import { isCloud, cloudUserId, supabaseConfigured } from "./supabase";
import * as cloud from "./cloud";

/*
 * Camada de dados do app. Quando o Supabase está configurado e o usuário está
 * logado, tudo vai para o backend real (cloud.ts). Sem Supabase, o app roda em
 * modo demo e guarda tudo só no aparelho, como antes.
 */

// Último estado conhecido da nuvem, para descobrir o que mudou em cada "save"
let postSnapshot = new Map<string, { isLiked: boolean; isSaved: boolean; userId?: string }>();
let followingSnapshot = new Set<string>();
let storySnapshot = new Set<string>();

function snapshotPosts(posts: FeedPost[]) {
  postSnapshot = new Map(posts.map(p => [p.id, { isLiked: !!p.isLiked, isSaved: !!p.isSaved, userId: p.userId }]));
}

const KEYS = {
  POSTS: "guvio_posts_v4",
  WARDROBE: "guvio_wardrobe_v4",
  PROFILE: "guvio_profile_v4",
  DIRECT_MSGS: "guvio_direct_msgs_v4",
  FOLLOWED_USERS: "guvio_followed_users_v4",
  STORIES: "guvio_stories_v4",
  ACTIVITIES: "guvio_activities_v4",
  SAVED_POST_IDS: "guvio_saved_post_ids_v4",
  REGISTERED_USERS: "guvio_registered_users_v4",
  COMMENTS: "guvio_comments_v4",
  BLOCKED: "guvio_blocked_v4"
};

export const INITIAL_USER_PROFILE: UserProfile = {
  id: "my-profile",
  username: "usuario",
  displayName: "Seu Perfil",
  avatar: "",
  location: "São Paulo, Brasil",
  followers: 142,
  following: 89,
  postsCount: 0,
  bio: "",
  website: "guvio.app/@usuario"
};

export async function loadSavedPosts(): Promise<FeedPost[]> {
  if (await isCloud()) {
    try {
      const posts = await cloud.fetchFeed();
      snapshotPosts(posts);
      FastStorage.setItemSync(KEYS.POSTS, posts); // cache para abrir rápido offline
      return posts;
    } catch (e) {
      return FastStorage.getItemSync(KEYS.POSTS, []);
    }
  }
  return FastStorage.getItemSync(KEYS.POSTS, []);
}

/** Salva o feed. Na nuvem, envia só o que mudou: curtidas, salvos e posts apagados. */
export async function savePosts(posts: FeedPost[]): Promise<void> {
  FastStorage.setItemSync(KEYS.POSTS, posts);
  if (!(await isCloud())) return;

  const myId = await cloudUserId();
  const current = new Set(posts.map(p => p.id));
  const jobs: Promise<any>[] = [];

  for (const p of posts) {
    // post que chegou em tempo real e ainda não estava no snapshot começa "sem curtida"
    const before = postSnapshot.get(p.id) || { isLiked: false, isSaved: false };
    if (before.isLiked !== !!p.isLiked) jobs.push(cloud.setLike(p.id, !!p.isLiked));
    if (before.isSaved !== !!p.isSaved) jobs.push(cloud.setSave(p.id, !!p.isSaved));
  }
  postSnapshot.forEach((before, id) => {
    if (!current.has(id) && before.userId && before.userId === myId) jobs.push(cloud.deletePost(id));
  });
  snapshotPosts(posts);
  await Promise.all(jobs.map(j => j.catch(() => {})));
}

/** Publica um look novo (sobe a foto e cria o post). */
export async function publishPost(input: {
  image: string;
  caption: string;
  city: string;
  country: string;
  styleTag: string;
  lat?: number;
  lng?: number;
}): Promise<FeedPost> {
  if (await isCloud()) {
    const post = await cloud.createPost(input);
    postSnapshot.set(post.id, { isLiked: false, isSaved: false, userId: post.userId });
    return post;
  }
  const me = await loadSavedProfile();
  return {
    id: `post-${Date.now()}`,
    userId: me.id,
    creatorName: "Você",
    creatorUsername: me.username,
    creatorAvatar: me.avatar,
    city: input.city,
    country: input.country,
    styleTag: input.styleTag,
    image: input.image,
    caption: input.caption,
    likes: 0,
    commentsCount: 0,
    timeAgo: "agora",
    createdAt: new Date().toISOString(),
    lat: input.lat,
    lng: input.lng,
    isLiked: false,
    isSaved: false
  };
}

// ---------------------------------------------------------------------
// Post único, Explorar, busca, edição e denúncia
// ---------------------------------------------------------------------
function localPosts(): FeedPost[] {
  return FastStorage.getItemSync(KEYS.POSTS, []);
}

export async function loadPost(id: string): Promise<FeedPost | null> {
  if (await isCloud()) return cloud.fetchPost(id).catch(() => null);
  return localPosts().find(p => p.id === id) || null;
}

export async function loadExplore(): Promise<FeedPost[]> {
  if (await isCloud()) return cloud.fetchExplore().catch(() => []);
  return [...localPosts()].sort((a, b) => b.likes - a.likes);
}

export async function searchLooks(query: string): Promise<FeedPost[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  if (await isCloud()) return cloud.searchPosts(q).catch(() => []);
  return localPosts().filter(p =>
    [p.city, p.country, p.styleTag, p.caption].some(v => (v || "").toLowerCase().includes(q))
  );
}

export async function editCaption(postId: string, caption: string): Promise<void> {
  if (await isCloud()) return cloud.updateCaption(postId, caption);
  FastStorage.setItemSync(
    KEYS.POSTS,
    localPosts().map(p => (p.id === postId ? { ...p, caption } : p))
  );
}

export async function setPostLike(post: FeedPost, on: boolean): Promise<void> {
  if (await isCloud()) {
    await cloud.setLike(post.id, on);
    postSnapshot.set(post.id, { ...(postSnapshot.get(post.id) || { isSaved: !!post.isSaved }), isLiked: on, userId: post.userId });
    return;
  }
  FastStorage.setItemSync(
    KEYS.POSTS,
    localPosts().map(p => (p.id === post.id ? { ...p, isLiked: on, likes: Math.max(0, p.likes + (on ? 1 : -1)) } : p))
  );
}

export async function setPostSave(post: FeedPost, on: boolean): Promise<void> {
  if (await isCloud()) {
    await cloud.setSave(post.id, on);
    postSnapshot.set(post.id, { ...(postSnapshot.get(post.id) || { isLiked: !!post.isLiked }), isSaved: on, userId: post.userId });
    return;
  }
  FastStorage.setItemSync(KEYS.POSTS, localPosts().map(p => (p.id === post.id ? { ...p, isSaved: on } : p)));
}

export async function removePost(post: FeedPost): Promise<void> {
  if (await isCloud()) {
    await cloud.deletePost(post.id);
    postSnapshot.delete(post.id);
    return;
  }
  FastStorage.setItemSync(KEYS.POSTS, localPosts().filter(p => p.id !== post.id));
}

export async function reportPost(postId: string, reason: string): Promise<void> {
  if (await isCloud()) return cloud.reportPost(postId, reason);
}

/** Posts de um perfil específico */
export async function loadUserPosts(profile: UserProfile): Promise<FeedPost[]> {
  if (await isCloud()) return cloud.fetchUserPosts(profile.id).catch(() => []);
  const all: FeedPost[] = FastStorage.getItemSync(KEYS.POSTS, []);
  return all.filter(
    p =>
      p.userId === profile.id ||
      p.creatorUsername === profile.username ||
      p.creatorName === profile.displayName ||
      p.creatorName === profile.username
  );
}

/** Meus posts */
export async function loadMyPosts(): Promise<FeedPost[]> {
  if (await isCloud()) {
    const me = await cloud.getMyProfile();
    myPostsCache = await cloud.fetchUserPosts(me.id);
    return myPostsCache;
  }
  const all: FeedPost[] = FastStorage.getItemSync(KEYS.POSTS, []);
  return all.filter(p => p.creatorName === "Você" || p.userId === "my-profile" || p.userId?.startsWith("user-"));
}

/** Posts que eu salvei */
export async function loadSavedOnlyPosts(): Promise<FeedPost[]> {
  if (await isCloud()) return cloud.fetchSavedPosts().catch(() => []);
  const all: FeedPost[] = FastStorage.getItemSync(KEYS.POSTS, []);
  return all.filter(p => p.isSaved);
}

export async function loadSavedWardrobe(userId?: string): Promise<WardrobeItem[]> {
  if (await isCloud()) return cloud.fetchWardrobe().catch(() => []);
  const key = userId ? `${KEYS.WARDROBE}_${userId}` : KEYS.WARDROBE;
  return FastStorage.getItemSync(key, []);
}

export async function saveWardrobe(items: WardrobeItem[], userId?: string): Promise<void> {
  const key = userId ? `${KEYS.WARDROBE}_${userId}` : KEYS.WARDROBE;
  FastStorage.setItemSync(key, items);
}

/** Adiciona uma peça (na nuvem sobe a foto) e devolve a peça salva */
export async function addWardrobeItem(item: WardrobeItem, current: WardrobeItem[], userId?: string): Promise<WardrobeItem[]> {
  if (await isCloud()) {
    const saved = await cloud.addWardrobeItem(item);
    return [saved, ...current];
  }
  const updated = [item, ...current];
  await saveWardrobe(updated, userId);
  return updated;
}

export async function removeWardrobeItem(id: string, current: WardrobeItem[], userId?: string): Promise<WardrobeItem[]> {
  const updated = current.filter(i => i.id !== id);
  if (await isCloud()) {
    await cloud.deleteWardrobeItem(id);
    return updated;
  }
  await saveWardrobe(updated, userId);
  return updated;
}

// All Community Profiles (Mocks + Registered Users)
export async function loadAllRegisteredProfiles(): Promise<UserProfile[]> {
  if (await isCloud()) return cloud.listProfiles().catch(() => []);
  const customUsers: UserProfile[] = FastStorage.getItemSync(KEYS.REGISTERED_USERS, []);
  
  // Merge custom users with base community profiles ensuring no duplicates by username
  const map = new Map<string, UserProfile>();
  
  MOCK_PROFILES.forEach(p => {
    map.set(p.username.toLowerCase(), p);
  });
  
  customUsers.forEach(p => {
    map.set(p.username.toLowerCase(), p);
  });

  return Array.from(map.values());
}

export async function isUsernameTaken(username: string, excludeUserId?: string): Promise<boolean> {
  const clean = username.trim().toLowerCase().replace(/^@/, "");
  if (supabaseConfigured) {
    if (excludeUserId && (await isCloud())) {
      const me = await cloud.getMyProfile().catch(() => null);
      if (me && me.username === clean) return false;
    }
    return !(await cloud.usernameAvailable(clean));
  }
  const allProfiles = await loadAllRegisteredProfiles();
  return allProfiles.some(
    p => p.username.toLowerCase() === clean && (!excludeUserId || p.id !== excludeUserId)
  );
}

export async function registerNewProfile(profile: UserProfile): Promise<void> {
  const customUsers: UserProfile[] = FastStorage.getItemSync(KEYS.REGISTERED_USERS, []);
  const cleanUsername = profile.username.trim().toLowerCase().replace(/^@/, "");
  
  const formattedProfile: UserProfile = {
    ...profile,
    username: cleanUsername,
    website: profile.website || `guvio.app/@${cleanUsername}`
  };

  const filtered = customUsers.filter(u => u.id !== profile.id && u.username.toLowerCase() !== cleanUsername);
  const updatedList = [formattedProfile, ...filtered];
  
  FastStorage.setItemSync(KEYS.REGISTERED_USERS, updatedList);
  
  // Also set as user active profile
  const key = profile.id ? `${KEYS.PROFILE}_${profile.id}` : KEYS.PROFILE;
  FastStorage.setItemSync(key, formattedProfile);
  FastStorage.setItemSync(KEYS.PROFILE, formattedProfile);
}

/** Seguidores ou seguindo de um perfil */
export async function loadFollowList(profile: UserProfile, kind: "followers" | "following"): Promise<UserProfile[]> {
  if (await isCloud()) return cloud.fetchFollowList(profile.id, kind).catch(() => []);
  const all = await loadAllRegisteredProfiles();
  if (kind === "following") {
    const ids = await loadFollowedUsers();
    return all.filter(p => ids.includes(p.id));
  }
  return [];
}

/** Busca um perfil público pelo id ou @username */
export async function findProfile(idOrUsername: string): Promise<UserProfile | null> {
  const clean = idOrUsername.replace(/^@/, "").toLowerCase();
  if (await isCloud()) return cloud.getProfile(clean).catch(() => null);
  const all = await loadAllRegisteredProfiles();
  return all.find(p => p.id === idOrUsername || p.username.toLowerCase() === clean || p.displayName.toLowerCase() === clean) || null;
}

// Último perfil carregado: abre o Perfil na hora, sem piscar dados de exemplo
const ME_CACHE_KEY = "guvio_me_cache_v1";
let myPostsCache: FeedPost[] | null = null;

export function getCachedMyProfile(): UserProfile | null {
  return FastStorage.getItemSync<UserProfile | null>(ME_CACHE_KEY, null);
}

export function getCachedMyPosts(): FeedPost[] | null {
  return myPostsCache;
}

export function clearMyCache() {
  FastStorage.setItemSync(ME_CACHE_KEY, null);
  myPostsCache = null;
}

export async function loadSavedProfile(userId?: string): Promise<UserProfile> {
  if (await isCloud()) {
    try {
      const me = await cloud.getMyProfile();
      FastStorage.setItemSync(ME_CACHE_KEY, me);
      return me;
    } catch (e) {
      const cached = getCachedMyProfile();
      if (cached) return cached;
    }
  }
  const key = userId ? `${KEYS.PROFILE}_${userId}` : KEYS.PROFILE;
  const customUsers: UserProfile[] = FastStorage.getItemSync(KEYS.REGISTERED_USERS, []);
  const foundInRegistry = customUsers.find(u => u.id === userId || (userId && u.username.toLowerCase() === userId.toLowerCase()));
  
  if (foundInRegistry) {
    return foundInRegistry;
  }

  const fallback = {
    ...INITIAL_USER_PROFILE,
    id: userId || "my-profile",
    username: userId ? userId.split("@")[0].replace(/[^a-zA-Z0-9._]/g, "") : "usuario"
  };
  return FastStorage.getItemSync(key, fallback);
}

export async function saveProfile(profile: UserProfile, userId?: string): Promise<UserProfile> {
  if (await isCloud()) {
    const saved = await cloud.updateMyProfile(profile); // lança erro se o @ já existir
    FastStorage.setItemSync(ME_CACHE_KEY, saved);
    return saved;
  }
  const cleanUsername = profile.username.trim().toLowerCase().replace(/^@/, "");
  const formatted: UserProfile = {
    ...profile,
    username: cleanUsername
  };

  const key = userId ? `${KEYS.PROFILE}_${userId}` : KEYS.PROFILE;
  FastStorage.setItemSync(key, formatted);
  FastStorage.setItemSync(KEYS.PROFILE, formatted);

  // Update in registered community list
  const customUsers: UserProfile[] = FastStorage.getItemSync(KEYS.REGISTERED_USERS, []);
  const filtered = customUsers.filter(u => u.id !== formatted.id && u.username.toLowerCase() !== cleanUsername);
  FastStorage.setItemSync(KEYS.REGISTERED_USERS, [formatted, ...filtered]);
  return formatted;
}

export async function loadDirectMessages(threadId: string): Promise<string[]> {
  return FastStorage.getItemSync(`${KEYS.DIRECT_MSGS}_${threadId}`, []);
}

export async function saveDirectMessages(threadId: string, msgs: string[]): Promise<void> {
  FastStorage.setItemSync(`${KEYS.DIRECT_MSGS}_${threadId}`, msgs);
}

// Social Follow Storage
export async function loadFollowedUsers(): Promise<string[]> {
  if (await isCloud()) {
    try {
      const ids = await cloud.fetchFollowingIds();
      followingSnapshot = new Set(ids);
      return ids;
    } catch (e) {
      return Array.from(followingSnapshot);
    }
  }
  return FastStorage.getItemSync(KEYS.FOLLOWED_USERS, ["p-elena"]);
}

/** Salva quem eu sigo. Na nuvem, segue/deixa de seguir só quem mudou. */
export async function saveFollowedUsers(userIds: string[]): Promise<void> {
  if (await isCloud()) {
    const next = new Set(userIds);
    const jobs: Promise<any>[] = [];
    next.forEach(id => {
      if (!followingSnapshot.has(id)) jobs.push(cloud.setFollow(id, true));
    });
    followingSnapshot.forEach(id => {
      if (!next.has(id)) jobs.push(cloud.setFollow(id, false));
    });
    followingSnapshot = next;
    await Promise.all(jobs.map(j => j.catch(() => {})));
    return;
  }
  FastStorage.setItemSync(KEYS.FOLLOWED_USERS, userIds);
}

// Stories Storage
export async function loadStories(): Promise<UserStoryGroup[]> {
  if (await isCloud()) {
    try {
      const groups = await cloud.fetchStories();
      storySnapshot = new Set(groups.flatMap(g => g.stories.map(st => st.id)));
      return groups;
    } catch (e) {
      // mesmo se a busca falhar, mostra a bolinha "Seu story" para poder publicar
      const me = await cloud.getMyProfile().catch(() => null);
      return me
        ? [{ id: me.id, username: me.username, displayName: "Seu story", avatar: me.avatar, isMe: true, hasUnseen: false, stories: [] }]
        : [];
    }
  }
  return FastStorage.getItemSync(KEYS.STORIES, INITIAL_STORIES);
}

export async function markStorySeen(storyId: string): Promise<void> {
  if (await isCloud()) await cloud.markStorySeen(storyId).catch(() => {});
}

export async function deleteMyStory(storyId: string): Promise<void> {
  if (await isCloud()) {
    await cloud.deleteStory(storyId);
    storySnapshot.delete(storyId);
    return;
  }
  const groups: UserStoryGroup[] = FastStorage.getItemSync(KEYS.STORIES, INITIAL_STORIES);
  FastStorage.setItemSync(
    KEYS.STORIES,
    groups.map(g => (g.isMe ? { ...g, stories: g.stories.filter(st => st.id !== storyId) } : g))
  );
}

export async function loadStoryViewers(storyId: string) {
  if (await isCloud()) return cloud.fetchStoryViewers(storyId).catch(() => []);
  return [] as { username: string; avatar: string; time: string }[];
}

/** Salva stories. Na nuvem, publica os stories novos do meu grupo. */
export async function saveStories(stories: UserStoryGroup[]): Promise<void> {
  if (await isCloud()) {
    const mine = stories.find(g => g.isMe);
    for (const st of mine?.stories || []) {
      if (!storySnapshot.has(st.id)) {
        const created = await cloud.addStory(st.image, st.caption);
        storySnapshot.add(st.id);
        storySnapshot.add(created.id);
      }
    }
    return;
  }
  FastStorage.setItemSync(KEYS.STORIES, stories);
}

// Activity / Notifications Storage
export async function loadActivities(): Promise<ActivityItem[]> {
  if (await isCloud()) return cloud.fetchActivities().catch(() => []);
  return FastStorage.getItemSync(KEYS.ACTIVITIES, MOCK_ACTIVITIES);
}

export async function hasUnreadActivity(): Promise<boolean> {
  if (await isCloud()) return cloud.hasRecentActivity().catch(() => false);
  return true;
}

// ---------------------------------------------------------------------
// Comentários
// ---------------------------------------------------------------------
export async function loadComments(postId: string): Promise<CommentItem[]> {
  if (await isCloud()) return cloud.fetchComments(postId);
  const all: CommentItem[] = FastStorage.getItemSync(KEYS.COMMENTS, MOCK_COMMENTS);
  return all.filter(c => c.postId === postId);
}

export async function deleteComment(postId: string, commentId: string): Promise<CommentItem[]> {
  if (await isCloud()) {
    await cloud.deleteComment(commentId);
    return cloud.fetchComments(postId);
  }
  const all: CommentItem[] = FastStorage.getItemSync(KEYS.COMMENTS, MOCK_COMMENTS);
  const rest = all.filter(c => c.id !== commentId);
  FastStorage.setItemSync(KEYS.COMMENTS, rest);
  return rest.filter(c => c.postId === postId);
}

export async function addComment(postId: string, text: string): Promise<CommentItem[]> {
  if (await isCloud()) {
    await cloud.addComment(postId, text);
    return cloud.fetchComments(postId);
  }
  const me = await loadSavedProfile();
  const all: CommentItem[] = FastStorage.getItemSync(KEYS.COMMENTS, MOCK_COMMENTS);
  const item: CommentItem = {
    id: `c-${Date.now()}`,
    postId,
    username: me.username,
    avatar: me.avatar,
    text,
    createdAt: "agora",
    likes: 0,
    canDelete: true
  };
  FastStorage.setItemSync(KEYS.COMMENTS, [...all, item]);
  return [...all, item].filter(c => c.postId === postId);
}

// ---------------------------------------------------------------------
// Direct
// ---------------------------------------------------------------------
export interface ChatMessage {
  id: string;
  text?: string;
  image?: string;
  reaction?: string;
  sender: "me" | "other";
}

export async function loadThreads(): Promise<DirectThread[]> {
  if (await isCloud()) return cloud.fetchThreads().catch(() => []);
  return MOCK_DIRECTS;
}

export async function loadChat(thread: DirectThread): Promise<ChatMessage[]> {
  if (await isCloud()) return cloud.fetchMessages(thread.profileId);
  const loaded: any[] = await loadDirectMessages(thread.id);
  if (loaded.length === 0) {
    return thread.lastMessage ? [{ id: "init-1", text: thread.lastMessage, sender: "other" }] : [];
  }
  return loaded.map((item: any, idx: number) =>
    typeof item === "string" ? { id: `m-${idx}`, text: item, sender: "me" as const } : item
  );
}

export async function sendChatMessage(
  thread: DirectThread,
  current: ChatMessage[],
  msg: { text?: string; image?: string }
): Promise<ChatMessage[]> {
  if (await isCloud()) {
    const sent = await cloud.sendMessage(thread.profileId, msg);
    return current.some(m => m.id === sent.id) ? current : [...current, sent];
  }
  const updated = [...current, { id: `m-${Date.now()}`, ...msg, sender: "me" as const }];
  await saveDirectMessages(thread.id, updated as any);
  return updated;
}

export async function setChatReaction(
  thread: DirectThread,
  current: ChatMessage[],
  id: string,
  emoji: string
): Promise<ChatMessage[]> {
  const updated = current.map(m => (m.id === id ? { ...m, reaction: m.reaction === emoji ? undefined : emoji } : m));
  if (await isCloud()) {
    const m = updated.find(x => x.id === id);
    await cloud.setReaction(id, m?.reaction || null);
    return updated;
  }
  await saveDirectMessages(thread.id, updated as any);
  return updated;
}

export async function markThreadRead(thread: DirectThread): Promise<void> {
  if (await isCloud()) await cloud.markThreadRead(thread.profileId).catch(() => {});
}

export async function unreadMessages(): Promise<number> {
  if (await isCloud()) return cloud.unreadMessagesCount().catch(() => 0);
  return 0;
}

/** Monta uma conversa (nova ou existente) com um perfil */
export function threadForProfile(p: UserProfile): DirectThread {
  return { id: p.id, profileId: p.id, username: p.username, avatar: p.avatar, lastMessage: "", time: "" };
}

// ---------------------------------------------------------------------
// Bloqueios
// ---------------------------------------------------------------------
export async function loadBlocked(): Promise<UserProfile[]> {
  if (await isCloud()) return cloud.fetchBlocked().catch(() => []);
  return FastStorage.getItemSync(KEYS.BLOCKED, []);
}

export async function setBlocked(profile: UserProfile, on: boolean): Promise<void> {
  if (await isCloud()) return cloud.setBlocked(profile.id, on);
  const list: UserProfile[] = FastStorage.getItemSync(KEYS.BLOCKED, []);
  const rest = list.filter(p => p.id !== profile.id);
  FastStorage.setItemSync(KEYS.BLOCKED, on ? [profile, ...rest] : rest);
}

export async function saveActivities(activities: ActivityItem[]): Promise<void> {
  FastStorage.setItemSync(KEYS.ACTIVITIES, activities);
}
