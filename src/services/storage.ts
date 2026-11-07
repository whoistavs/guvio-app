import {
  FeedPost,
  ClothingTag,
  Outfit,
  WardrobeItem,
  UserProfile,
  UserStoryGroup,
  ActivityItem,
  CommentItem,
  DirectThread,
  SavedCollection,
  Highlight,
  StoryItem,
  WishlistItem,
  OutfitLogEntry,
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
  BLOCKED: "guvio_blocked_v4",
  COLLECTIONS: "guvio_collections_v1",
  STORIES_CACHE: "guvio_stories_cache_v1",
  FEEDBACK: "guvio_feedback_v1",
  MUTED: "guvio_muted_v1",
  HIGHLIGHTS: "guvio_highlights_v1",
  DM_PREFS: "guvio_dm_prefs_v1",
  WISHLIST: "guvio_wishlist_v1",
  OUTFIT_LOG: "guvio_outfit_log_v1",
  DRAFTS: "guvio_drafts_v1",
  RECENT_SEARCHES: "guvio_recent_searches_v1",
  REQUESTED: "guvio_requested_v1"
};

/** último feed salvo no aparelho, para abrir na hora (mesmo sem internet) */
export function getCachedFeed(): FeedPost[] {
  return FastStorage.getItemSync(KEYS.POSTS, []);
}

/** true quando a última tentativa de falar com o servidor falhou */
let offline = false;
const offlineListeners = new Set<(off: boolean) => void>();
function setOffline(v: boolean) {
  if (offline === v) return;
  offline = v;
  offlineListeners.forEach(fn => fn(v));
}
export function subscribeOffline(fn: (off: boolean) => void): () => void {
  offlineListeners.add(fn);
  fn(offline);
  return () => {
    offlineListeners.delete(fn);
  };
}

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
      setOffline(false);
      return posts;
    } catch (e) {
      setOffline(true);
      const cached: FeedPost[] = FastStorage.getItemSync(KEYS.POSTS, []);
      snapshotPosts(cached);
      return cached;
    }
  }
  return FastStorage.getItemSync(KEYS.POSTS, []);
}

/** Salva o feed. Na nuvem, envia só o que mudou: curtidas, salvos e posts apagados. */
export async function savePosts(posts: FeedPost[]): Promise<void> {
  FastStorage.setItemSync(KEYS.POSTS, posts);
  if (!(await isCloud())) return;

  const jobs: Promise<any>[] = [];

  for (const p of posts) {
    // post que chegou em tempo real e ainda não estava no snapshot começa "sem curtida"
    const before = postSnapshot.get(p.id) || { isLiked: false, isSaved: false };
    if (before.isLiked !== !!p.isLiked) jobs.push(cloud.setLike(p.id, !!p.isLiked));
    if (before.isSaved !== !!p.isSaved) jobs.push(cloud.setSave(p.id, !!p.isSaved));
  }
  // Apagar post NUNCA acontece por "sumiu da lista" (arquivar, silenciar, recarregar...).
  // Só removePost() apaga de verdade.
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
  images?: string[];
  clothingTags?: ClothingTag[];
  video?: string;
  pollOptions?: string[];
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
    images: input.images && input.images.length ? input.images : [input.image],
    clothingTags: input.clothingTags || [],
    caption: input.caption,
    kind: input.video ? "video" : input.pollOptions && (input.images || []).length >= 2 ? "poll" : "photo",
    videoUrl: input.video,
    poll:
      input.pollOptions && (input.images || []).length >= 2
        ? { options: input.pollOptions.map((o, i) => o.trim() || `Look ${i + 1}`), votes: input.pollOptions.map(() => 0), myVote: null }
        : undefined,
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
/** posts locais que outras pessoas podem ver (sem os arquivados) */
function publicLocalPosts(): FeedPost[] {
  return localPosts().filter(p => !p.archived);
}

function localPosts(): FeedPost[] {
  return FastStorage.getItemSync(KEYS.POSTS, []);
}

export async function loadPost(id: string): Promise<FeedPost | null> {
  if (await isCloud()) return cloud.fetchPost(id).catch(() => null);
  return localPosts().find(p => p.id === id) || null;
}

export async function loadExplore(): Promise<FeedPost[]> {
  if (await isCloud()) return cloud.fetchExplore().catch(() => []);
  return publicLocalPosts().sort((a, b) => b.likes - a.likes);
}

export async function searchLooks(query: string): Promise<FeedPost[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  if (await isCloud()) return cloud.searchPosts(q).catch(() => []);
  return publicLocalPosts().filter(p =>
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

/** Mais posts do feed, mais antigos que o último que já está na tela */
export async function loadMorePosts(oldest?: string): Promise<FeedPost[]> {
  if (!oldest || !(await isCloud())) return [];
  try {
    const more = await cloud.fetchFeed(30, oldest);
    more.forEach(p => postSnapshot.set(p.id, { isLiked: !!p.isLiked, isSaved: !!p.isSaved, userId: p.userId }));
    return more;
  } catch (e) {
    return [];
  }
}

const pinnedFirst = (list: FeedPost[]) => [...list.filter(p => p.pinned), ...list.filter(p => !p.pinned)];

/** Posts de um perfil específico */
export async function loadUserPosts(profile: UserProfile): Promise<FeedPost[]> {
  if (await isCloud()) return cloud.fetchUserPosts(profile.id).catch(() => []);
  const all: FeedPost[] = FastStorage.getItemSync(KEYS.POSTS, []);
  return pinnedFirst(
    all.filter(
      p =>
        !p.archived &&
        (p.userId === profile.id ||
          p.creatorUsername === profile.username ||
          p.creatorName === profile.displayName ||
          p.creatorName === profile.username)
    )
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
  return pinnedFirst(all.filter(p => !p.archived && (p.creatorName === "Você" || p.userId === "my-profile" || p.userId?.startsWith("user-"))));
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
  // o feed salvo tem curtidas/salvos da conta que saiu
  if (supabaseConfigured) {
    FastStorage.setItemSync(KEYS.POSTS, []);
    FastStorage.setItemSync(KEYS.STORIES_CACHE, []);
  }
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

/**
 * Salva quem eu sigo. Na nuvem, segue/deixa de seguir só quem mudou.
 * Retorna os ids de perfis privados que viraram "pedido para seguir" (ainda não seguindo).
 */
export async function saveFollowedUsers(userIds: string[]): Promise<string[]> {
  if (await isCloud()) {
    const next = new Set(userIds);
    const requested: string[] = [];
    const jobs: Promise<any>[] = [];
    next.forEach(id => {
      if (!followingSnapshot.has(id))
        jobs.push(
          cloud.setFollow(id, true).then(r => {
            if (r === "requested") requested.push(id);
          })
        );
    });
    followingSnapshot.forEach(id => {
      if (!next.has(id)) jobs.push(cloud.setFollow(id, false));
    });
    await Promise.all(jobs.map(j => j.catch(() => {})));
    requested.forEach(id => next.delete(id));
    followingSnapshot = next;
    return requested;
  }
  FastStorage.setItemSync(KEYS.FOLLOWED_USERS, userIds);
  return [];
}

/** perfis privados para os quais pedi para seguir */
export async function loadRequestedIds(): Promise<string[]> {
  if (await isCloud()) return cloud.fetchMyRequestedIds().catch(() => []);
  return [];
}

/** cancela um pedido para seguir */
export async function cancelFollowRequest(targetId: string): Promise<void> {
  if (await isCloud()) await cloud.setFollow(targetId, false);
}

export async function loadFollowRequests(): Promise<UserProfile[]> {
  if (await isCloud()) return cloud.fetchFollowRequests().catch(() => []);
  return [];
}

export async function answerFollowRequest(requesterId: string, accept: boolean): Promise<void> {
  if (await isCloud()) return cloud.answerFollowRequest(requesterId, accept);
}

// Stories Storage
/** stories salvos no aparelho (para mostrar na hora enquanto carrega) */
export function getCachedStories(): UserStoryGroup[] {
  return FastStorage.getItemSync(KEYS.STORIES_CACHE, []);
}

export async function loadStories(): Promise<UserStoryGroup[]> {
  if (await isCloud()) {
    try {
      const groups = await cloud.fetchStories();
      storySnapshot = new Set(groups.flatMap(g => g.stories.map(st => st.id)));
      FastStorage.setItemSync(KEYS.STORIES_CACHE, groups);
      return groups;
    } catch (e) {
      const cached: UserStoryGroup[] = FastStorage.getItemSync(KEYS.STORIES_CACHE, []);
      if (cached.length) return cached;
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
        const created = await cloud.addStory(st.image, st.caption, st.overlay, { closeFriends: st.closeFriends, sticker: st.sticker });
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

export async function addComment(postId: string, text: string, parentId?: string | null): Promise<CommentItem[]> {
  if (await isCloud()) {
    await cloud.addComment(postId, text, parentId);
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
    canDelete: true,
    parentId: parentId || null
  };
  FastStorage.setItemSync(KEYS.COMMENTS, [...all, item]);
  return [...all, item].filter(c => c.postId === postId);
}

export async function setCommentLike(comment: CommentItem, on: boolean): Promise<void> {
  if (await isCloud()) return cloud.setCommentLike(comment.id, on);
  const all: CommentItem[] = FastStorage.getItemSync(KEYS.COMMENTS, MOCK_COMMENTS);
  FastStorage.setItemSync(
    KEYS.COMMENTS,
    all.map(c => (c.id === comment.id ? { ...c, isLiked: on, likes: Math.max(0, c.likes + (on ? 1 : -1)) } : c))
  );
}

// ---------------------------------------------------------------------
// Coleções de salvos
// ---------------------------------------------------------------------
type LocalCollection = { id: string; name: string; postIds: string[] };
const localCollections = (): LocalCollection[] => FastStorage.getItemSync(KEYS.COLLECTIONS, []);

export async function loadCollections(): Promise<SavedCollection[]> {
  if (await isCloud()) return cloud.fetchCollections().catch(() => []);
  const posts = localPosts();
  return localCollections().map(c => ({
    id: c.id,
    name: c.name,
    count: c.postIds.length,
    cover: posts.find(p => p.id === c.postIds[0])?.image
  }));
}

export async function createCollection(name: string): Promise<SavedCollection> {
  if (await isCloud()) return cloud.createCollection(name);
  const c = { id: `col-${Date.now()}`, name: name.trim().slice(0, 40), postIds: [] };
  FastStorage.setItemSync(KEYS.COLLECTIONS, [c, ...localCollections()]);
  return { id: c.id, name: c.name, count: 0 };
}

export async function renameCollection(id: string, name: string): Promise<void> {
  if (await isCloud()) return cloud.renameCollection(id, name);
  FastStorage.setItemSync(KEYS.COLLECTIONS, localCollections().map(c => (c.id === id ? { ...c, name } : c)));
}

export async function deleteCollection(id: string): Promise<void> {
  if (await isCloud()) return cloud.deleteCollection(id);
  FastStorage.setItemSync(KEYS.COLLECTIONS, localCollections().filter(c => c.id !== id));
}

export async function setPostInCollection(collectionId: string, post: FeedPost, on: boolean): Promise<void> {
  if (await isCloud()) {
    await cloud.setInCollection(collectionId, post.id, on);
    if (on) postSnapshot.set(post.id, { ...(postSnapshot.get(post.id) || { isLiked: !!post.isLiked }), isSaved: true, userId: post.userId });
    return;
  }
  FastStorage.setItemSync(
    KEYS.COLLECTIONS,
    localCollections().map(c =>
      c.id !== collectionId
        ? c
        : { ...c, postIds: on ? [post.id, ...c.postIds.filter(x => x !== post.id)] : c.postIds.filter(x => x !== post.id) }
    )
  );
  if (on) FastStorage.setItemSync(KEYS.POSTS, localPosts().map(p => (p.id === post.id ? { ...p, isSaved: true } : p)));
}

export async function loadPostCollectionIds(postId: string): Promise<string[]> {
  if (await isCloud()) return cloud.fetchPostCollectionIds(postId).catch(() => []);
  return localCollections().filter(c => c.postIds.includes(postId)).map(c => c.id);
}

export async function loadCollectionPosts(collectionId: string): Promise<FeedPost[]> {
  if (await isCloud()) return cloud.fetchCollectionPosts(collectionId).catch(() => []);
  const ids = localCollections().find(c => c.id === collectionId)?.postIds || [];
  const posts = localPosts();
  return ids.map(id => posts.find(p => p.id === id)).filter(Boolean) as FeedPost[];
}

// ---------------------------------------------------------------------
// Sugestões, desafio da semana e ranking por cidade
// ---------------------------------------------------------------------
export async function loadSuggestions(limit = 15): Promise<(UserProfile & { mutuals?: number })[]> {
  if (await isCloud()) return cloud.fetchSuggestions(limit).catch(() => []);
  const followed: string[] = FastStorage.getItemSync(KEYS.FOLLOWED_USERS, []);
  return MOCK_PROFILES.filter(p => !followed.includes(p.id) && !followed.includes(p.username)).slice(0, limit);
}

const likesOf = (p: FeedPost) => p.likes || 0;

export async function loadChallengePosts(tag: string, sinceIso: string): Promise<FeedPost[]> {
  if (await isCloud()) return cloud.fetchChallengePosts(tag, sinceIso).catch(() => []);
  const t = `#${tag.replace(/^#/, "").toLowerCase()}`;
  return publicLocalPosts()
    .filter(p => (p.caption || "").toLowerCase().includes(t))
    .sort((a, b) => likesOf(b) - likesOf(a));
}

export async function loadCityRanking(city: string): Promise<FeedPost[]> {
  if (await isCloud()) return cloud.fetchCityRanking(city).catch(() => []);
  const c = city.trim().toLowerCase();
  return publicLocalPosts()
    .filter(p => (p.city || "").trim().toLowerCase() === c)
    .sort((a, b) => likesOf(b) - likesOf(a));
}

// ---------------------------------------------------------------------
// Feedback dos testers
// ---------------------------------------------------------------------
export async function sendFeedback(input: {
  kind: "bug" | "ideia" | "outro";
  text: string;
  screenshot?: string;
  appVersion?: string;
}): Promise<void> {
  if (await isCloud()) return cloud.sendFeedback(input);
  const all = FastStorage.getItemSync(KEYS.FEEDBACK, []) as any[];
  FastStorage.setItemSync(KEYS.FEEDBACK, [{ ...input, at: new Date().toISOString() }, ...all]);
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
  createdAt?: string;
  postId?: string;
  replyTo?: string;
  deleted?: boolean;
  readAt?: string;
}

export async function loadThreads(): Promise<DirectThread[]> {
  if (await isCloud()) return cloud.fetchThreads().catch(() => []);
  return applyLocalThreadPrefs(MOCK_DIRECTS);
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
  msg: { text?: string; image?: string; postId?: string; replyTo?: string }
): Promise<ChatMessage[]> {
  if (await isCloud()) {
    const sent = await cloud.sendMessage(thread.profileId, msg);
    return current.some(m => m.id === sent.id) ? current : [...current, sent];
  }
  const updated = [
    ...current,
    { id: `m-${Date.now()}`, ...msg, sender: "me" as const, createdAt: new Date().toISOString() }
  ];
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

export async function deleteChatMessage(
  thread: DirectThread,
  current: ChatMessage[],
  id: string
): Promise<ChatMessage[]> {
  const updated = current.map(m =>
    m.id === id ? { ...m, deleted: true, text: undefined, image: undefined, postId: undefined, reaction: undefined } : m
  );
  if (await isCloud()) {
    await cloud.deleteMessage(id);
    return updated;
  }
  await saveDirectMessages(thread.id, updated as any);
  return updated;
}

/** manda um look para várias conversas de uma vez */
export async function sharePostToProfiles(post: FeedPost, profiles: UserProfile[], note?: string): Promise<void> {
  for (const p of profiles) {
    const thread = threadForProfile(p);
    if (await isCloud()) {
      await cloud.sendMessage(p.id, { postId: post.id, text: note?.trim() || undefined });
    } else {
      const current = await loadChat(thread);
      await sendChatMessage(thread, current, { postId: post.id, text: note?.trim() || undefined });
    }
  }
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

// ---------------------------------------------------------------------
// Looks montados
// ---------------------------------------------------------------------
const OUTFITS_KEY = "guvio_outfits_v1";

export async function loadOutfits(): Promise<Outfit[]> {
  if (await isCloud()) return cloud.fetchOutfits().catch(() => []);
  return FastStorage.getItemSync(OUTFITS_KEY, []);
}

export async function saveOutfit(name: string, itemIds: string[]): Promise<Outfit> {
  if (await isCloud()) return cloud.saveOutfit(name, itemIds);
  const o: Outfit = { id: `outfit-${Date.now()}`, name, itemIds, createdAt: new Date().toISOString() };
  FastStorage.setItemSync(OUTFITS_KEY, [o, ...FastStorage.getItemSync<Outfit[]>(OUTFITS_KEY, [])]);
  return o;
}

export async function deleteOutfit(id: string): Promise<void> {
  if (await isCloud()) return cloud.deleteOutfit(id);
  FastStorage.setItemSync(
    OUTFITS_KEY,
    FastStorage.getItemSync<Outfit[]>(OUTFITS_KEY, []).filter(o => o.id !== id)
  );
}


// =====================================================================
// MUTIRÃO 4
// =====================================================================

// ---------- posts: editar, fixar, arquivar, esconder curtidas ----------
export async function updatePost(
  post: FeedPost,
  data: { caption: string; city: string; country: string; styleTag?: string; clothingTags: ClothingTag[] }
): Promise<FeedPost> {
  if (await isCloud()) await cloud.updatePost(post.id, data);
  else
    FastStorage.setItemSync(
      KEYS.POSTS,
      localPosts().map(p => (p.id === post.id ? { ...p, ...data, styleTag: data.styleTag || p.styleTag } : p))
    );
  return { ...post, ...data, styleTag: data.styleTag || post.styleTag };
}

export async function setPostFlags(post: FeedPost, flags: { archived?: boolean; pinned?: boolean; hideLikes?: boolean }): Promise<FeedPost> {
  if (await isCloud()) {
    await cloud.setPostFlags(post.id, flags);
    // arquivado sai do feed: tira do snapshot para o savePosts não achar que foi apagado
    if (flags.archived) postSnapshot.delete(post.id);
  }
  const next: FeedPost = {
    ...post,
    ...(flags.archived !== undefined ? { archived: flags.archived, pinned: flags.archived ? false : post.pinned } : {}),
    ...(flags.pinned !== undefined ? { pinned: flags.pinned } : {}),
    ...(flags.hideLikes !== undefined ? { hideLikes: flags.hideLikes } : {})
  };
  if (!(await isCloud())) FastStorage.setItemSync(KEYS.POSTS, localPosts().map(p => (p.id === post.id ? next : p)));
  return next;
}

export async function loadArchivedPosts(): Promise<FeedPost[]> {
  if (await isCloud()) return cloud.fetchArchivedPosts().catch(() => []);
  return localPosts().filter(p => p.archived);
}

export async function loadTaggedPosts(username: string): Promise<FeedPost[]> {
  if (await isCloud()) return cloud.fetchTaggedPosts(username).catch(() => []);
  const re = new RegExp(`@${username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z0-9_.])`, "i");
  return localPosts().filter(p => !p.archived && re.test(p.caption || ""));
}

export async function loadLikers(postId: string): Promise<UserProfile[]> {
  if (await isCloud()) return cloud.fetchLikers(postId).catch(() => []);
  return [];
}

// ---------- rascunhos (ficam só no aparelho) ----------
export interface PostDraftData {
  id: string;
  images: string[];
  caption: string;
  tags: ClothingTag[];
  savedAt: string;
}

/** copia a foto para a pasta do app, para o rascunho não perder a imagem */
async function persistImage(uri: string): Promise<string> {
  try {
    if (!uri || /^https?:/.test(uri) || uri.startsWith("data:")) return uri;
    const { Platform } = require("react-native");
    if (Platform.OS === "web") return uri;
    const fs = require("expo-file-system");
    const src = new fs.File(uri);
    const dir = new fs.Directory(fs.Paths.document, "drafts");
    if (!dir.exists) dir.create();
    const dest = new fs.File(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`);
    src.copy(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}

export function loadDrafts(): PostDraftData[] {
  return FastStorage.getItemSync(KEYS.DRAFTS, []);
}

export async function saveDraft(d: Omit<PostDraftData, "savedAt" | "id"> & { id?: string }): Promise<PostDraftData> {
  const images = [];
  for (const uri of d.images) images.push(await persistImage(uri));
  const draft: PostDraftData = { id: d.id || `draft-${Date.now()}`, images, caption: d.caption, tags: d.tags, savedAt: new Date().toISOString() };
  FastStorage.setItemSync(KEYS.DRAFTS, [draft, ...loadDrafts().filter(x => x.id !== draft.id)].slice(0, 20));
  return draft;
}

export function deleteDraft(id: string) {
  FastStorage.setItemSync(KEYS.DRAFTS, loadDrafts().filter(x => x.id !== id));
}

// ---------- silenciar ----------
export async function loadMutedIds(): Promise<string[]> {
  if (await isCloud()) return cloud.fetchMutedIds().catch(() => []);
  return FastStorage.getItemSync(KEYS.MUTED, []);
}

export async function setMuted(userId: string, on: boolean): Promise<void> {
  if (await isCloud()) return cloud.setMuted(userId, on);
  const cur: string[] = FastStorage.getItemSync(KEYS.MUTED, []);
  FastStorage.setItemSync(KEYS.MUTED, on ? Array.from(new Set([...cur, userId])) : cur.filter(x => x !== userId));
}

// ---------- destaques ----------
type LocalHighlight = { id: string; userId: string; title: string; cover?: string; stories: StoryItem[] };
const localHighlights = (): LocalHighlight[] => FastStorage.getItemSync(KEYS.HIGHLIGHTS, []);

export async function loadHighlights(userId: string): Promise<Highlight[]> {
  if (await isCloud()) return cloud.fetchHighlights(userId).catch(() => []);
  return localHighlights()
    .filter(h => h.userId === userId)
    .map(h => ({ id: h.id, title: h.title, cover: h.cover || h.stories[0]?.image, stories: h.stories }));
}

export async function loadMyStoryArchive(): Promise<StoryItem[]> {
  if (await isCloud()) return cloud.fetchMyStoryArchive().catch(() => []);
  const groups: UserStoryGroup[] = FastStorage.getItemSync(KEYS.STORIES, INITIAL_STORIES);
  return groups.find(g => g.isMe)?.stories || [];
}

export async function saveHighlight(userId: string, input: { id?: string; title: string; stories: StoryItem[]; cover?: string }): Promise<void> {
  if (await isCloud()) {
    await cloud.saveHighlight({ id: input.id, title: input.title, storyIds: input.stories.map(s => s.id), cover: input.cover });
    return;
  }
  const h: LocalHighlight = { id: input.id || `hl-${Date.now()}`, userId, title: input.title, cover: input.cover, stories: input.stories };
  FastStorage.setItemSync(KEYS.HIGHLIGHTS, [...localHighlights().filter(x => x.id !== h.id), h]);
}

export async function deleteHighlight(id: string): Promise<void> {
  if (await isCloud()) return cloud.deleteHighlight(id);
  FastStorage.setItemSync(KEYS.HIGHLIGHTS, localHighlights().filter(x => x.id !== id));
}

// ---------- Direct: fixar e apagar conversa ----------
export async function setThreadPinned(thread: DirectThread, pinned: boolean): Promise<void> {
  if (await isCloud()) return cloud.setDmPinned(thread.profileId, pinned);
  const prefs = FastStorage.getItemSync(KEYS.DM_PREFS, {} as Record<string, any>);
  FastStorage.setItemSync(KEYS.DM_PREFS, { ...prefs, [thread.id]: { ...(prefs[thread.id] || {}), pinned } });
}

export async function clearThread(thread: DirectThread): Promise<void> {
  if (await isCloud()) return cloud.clearConversation(thread.profileId);
  const prefs = FastStorage.getItemSync(KEYS.DM_PREFS, {} as Record<string, any>);
  FastStorage.setItemSync(KEYS.DM_PREFS, { ...prefs, [thread.id]: { pinned: false, cleared: true } });
  await saveDirectMessages(thread.id, []);
}

/** aplica fixar/apagar nas conversas do modo demo */
export function applyLocalThreadPrefs(threads: DirectThread[]): DirectThread[] {
  const prefs = FastStorage.getItemSync(KEYS.DM_PREFS, {} as Record<string, any>);
  const list = threads
    .filter(t => !prefs[t.id]?.cleared)
    .map(t => ({ ...t, pinned: !!prefs[t.id]?.pinned }));
  return [...list.filter(t => t.pinned), ...list.filter(t => !t.pinned)];
}

// ---------- pesquisas recentes ----------
export function loadRecentSearches(): string[] {
  return FastStorage.getItemSync(KEYS.RECENT_SEARCHES, []);
}
export function addRecentSearch(term: string) {
  const t = term.trim();
  if (t.length < 2) return;
  const cur = loadRecentSearches().filter(x => x.toLowerCase() !== t.toLowerCase());
  FastStorage.setItemSync(KEYS.RECENT_SEARCHES, [t, ...cur].slice(0, 12));
}
export function removeRecentSearch(term?: string) {
  FastStorage.setItemSync(KEYS.RECENT_SEARCHES, term ? loadRecentSearches().filter(x => x !== term) : []);
}

// ---------- hashtags em alta ----------
export async function loadTrendingTags(limit = 12): Promise<{ tag: string; count: number }[]> {
  const rows = (await isCloud())
    ? await cloud.fetchRecentCaptions(7).catch(() => [])
    : localPosts().map(p => ({ caption: p.caption || "", likes: p.likes || 0 }));
  return trendingFromCaptions(rows, limit);
}

/** conta as hashtags (cada post conta 1 vez, curtidas dão um empurrãozinho) */
export function trendingFromCaptions(rows: { caption: string; likes: number }[], limit = 12) {
  const score = new Map<string, { tag: string; count: number; score: number }>();
  const re = /#([A-Za-z0-9_\u00C0-\u024F]{2,40})/g;
  rows.forEach(r => {
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(r.caption))) {
      const key = m[1].toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const cur = score.get(key) || { tag: m[1], count: 0, score: 0 };
      cur.count += 1;
      cur.score += 1 + Math.min(r.likes, 50) / 25;
      score.set(key, cur);
    }
  });
  return Array.from(score.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ tag, count }) => ({ tag, count }));
}

// ---------- guarda-roupa: editar peça ----------
export async function updateWardrobeItem(item: WardrobeItem, current: WardrobeItem[], userId?: string): Promise<WardrobeItem[]> {
  if (await isCloud()) {
    const saved = await cloud.updateWardrobeItem(item);
    return current.map(i => (i.id === item.id ? saved : i));
  }
  const updated = current.map(i => (i.id === item.id ? item : i));
  await saveWardrobe(updated, userId);
  return updated;
}

// ---------- lista de desejos ----------
export async function loadWishlist(): Promise<WishlistItem[]> {
  if (await isCloud()) return cloud.fetchWishlist().catch(() => []);
  return FastStorage.getItemSync(KEYS.WISHLIST, []);
}

export async function saveWish(item: WishlistItem): Promise<WishlistItem> {
  if (await isCloud()) return cloud.saveWish(item);
  const saved = { ...item, id: !item.id || item.id.startsWith("tmp-") ? `wish-${Date.now()}` : item.id };
  const cur: WishlistItem[] = FastStorage.getItemSync(KEYS.WISHLIST, []);
  const exists = cur.some(x => x.id === saved.id);
  FastStorage.setItemSync(KEYS.WISHLIST, exists ? cur.map(x => (x.id === saved.id ? saved : x)) : [saved, ...cur]);
  return saved;
}

export async function deleteWish(id: string): Promise<void> {
  if (await isCloud()) return cloud.deleteWish(id);
  FastStorage.setItemSync(KEYS.WISHLIST, (FastStorage.getItemSync(KEYS.WISHLIST, []) as WishlistItem[]).filter(x => x.id !== id));
}

// ---------- calendário de looks ----------
export async function loadOutfitLog(fromDay: string, toDay: string): Promise<OutfitLogEntry[]> {
  if (await isCloud()) return cloud.fetchOutfitLog(fromDay, toDay).catch(() => []);
  return (FastStorage.getItemSync(KEYS.OUTFIT_LOG, []) as OutfitLogEntry[]).filter(e => e.day >= fromDay && e.day <= toDay);
}

export async function saveOutfitLog(entry: OutfitLogEntry): Promise<void> {
  if (await isCloud()) return cloud.saveOutfitLog(entry);
  const cur: OutfitLogEntry[] = FastStorage.getItemSync(KEYS.OUTFIT_LOG, []);
  FastStorage.setItemSync(KEYS.OUTFIT_LOG, [...cur.filter(e => e.day !== entry.day), entry]);
}

export async function deleteOutfitLog(day: string): Promise<void> {
  if (await isCloud()) return cloud.deleteOutfitLog(day);
  const cur: OutfitLogEntry[] = FastStorage.getItemSync(KEYS.OUTFIT_LOG, []);
  FastStorage.setItemSync(KEYS.OUTFIT_LOG, cur.filter(e => e.day !== day));
}


/** publica um story meu de qualquer tela (ex.: look do guarda-roupa) */
export async function publishMyStory(
  imageUri: string,
  caption?: string,
  overlay?: StoryItem["overlay"],
  extra?: { closeFriends?: boolean; sticker?: StoryItem["sticker"] }
): Promise<void> {
  if (await isCloud()) {
    const created = await cloud.addStory(imageUri, caption, overlay, extra);
    storySnapshot.add(created.id);
    return;
  }
  const groups: UserStoryGroup[] = FastStorage.getItemSync(KEYS.STORIES, INITIAL_STORIES);
  const story: StoryItem = {
    id: `my-st-${Date.now()}`,
    image: imageUri,
    timestamp: "Agora",
    caption,
    overlay: overlay || null,
    closeFriends: !!extra?.closeFriends,
    sticker: extra?.sticker || null
  };
  FastStorage.setItemSync(
    KEYS.STORIES,
    groups.map(g => (g.isMe ? { ...g, hasUnseen: true, stories: [...g.stories, story] } : g))
  );
}


// =====================================================================
// MUTIRÃO 5
// =====================================================================
function patchLocalPost(id: string, fn: (p: FeedPost) => FeedPost) {
  FastStorage.setItemSync(KEYS.POSTS, localPosts().map(p => (p.id === id ? fn(p) : p)));
}

export async function votePoll(post: FeedPost, option: number): Promise<FeedPost> {
  const poll = post.poll || { options: ["Look 1", "Look 2"], votes: [0, 0], myVote: null };
  const votes = [...poll.votes];
  if (poll.myVote !== null && poll.myVote !== undefined) votes[poll.myVote] = Math.max(0, votes[poll.myVote] - 1);
  votes[option] = (votes[option] || 0) + 1;
  const next = { ...post, poll: { ...poll, votes, myVote: option } };
  if (await isCloud()) await cloud.votePoll(post.id, option);
  else patchLocalPost(post.id, () => next);
  return next;
}

export async function ratePost(post: FeedPost, value: 1 | -1): Promise<FeedPost> {
  const r = post.rating || { fire: 0, ice: 0, mine: 0 as 0 };
  const newMine: 1 | -1 | 0 = r.mine === value ? 0 : value;
  const fire = r.fire - (r.mine === 1 ? 1 : 0) + (newMine === 1 ? 1 : 0);
  const ice = r.ice - (r.mine === -1 ? 1 : 0) + (newMine === -1 ? 1 : 0);
  const next = { ...post, rating: { fire, ice, mine: newMine } };
  if (await isCloud()) await cloud.ratePost(post.id, newMine);
  else patchLocalPost(post.id, () => next);
  return next;
}

export async function repostLook(original: FeedPost, caption: string): Promise<FeedPost> {
  if (await isCloud()) {
    const p = await cloud.repost(original, caption);
    postSnapshot.set(p.id, { isLiked: false, isSaved: false, userId: p.userId });
    return p;
  }
  const p: FeedPost = {
    ...original,
    id: `rp-${Date.now()}`,
    userId: "my-profile",
    creatorName: "Você",
    creatorUsername: "voce",
    caption,
    likes: 0,
    commentsCount: 0,
    timeAgo: "Agora",
    isLiked: false,
    isSaved: false,
    kind: "repost",
    repostOf: original.repostOf || original.id,
    originalUsername: original.originalUsername || original.creatorUsername,
    originalAvatar: original.originalAvatar || original.creatorAvatar,
    pinned: false,
    archived: false
  };
  FastStorage.setItemSync(KEYS.POSTS, [p, ...localPosts()]);
  return p;
}

export async function setPinnedComment(post: FeedPost, commentId: string | null): Promise<FeedPost> {
  if (await isCloud()) await cloud.setPinnedComment(post.id, commentId);
  else patchLocalPost(post.id, p => ({ ...p, pinnedCommentId: commentId }));
  return { ...post, pinnedCommentId: commentId };
}

export async function loadNearby(lat: number, lng: number, km = 60): Promise<FeedPost[]> {
  if (await isCloud()) return cloud.fetchNearby(lat, lng, km).catch(() => []);
  const R = 6371, rad = (x: number) => (x * Math.PI) / 180;
  return publicLocalPosts().filter(p => {
    if (p.lat == null || p.lng == null) return false;
    const a = Math.sin(rad(p.lat - lat) / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(p.lat)) * Math.sin(rad(p.lng - lng) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(Math.min(1, a))) <= km;
  });
}

// ---------- não tenho interesse ----------
const NI_KEY = "guvio_not_interested_v1";
type NotInterested = { postIds: string[]; styles: string[]; authors: string[] };
let niCache: NotInterested | null = null;

export async function loadNotInterested(): Promise<NotInterested> {
  if (niCache) return niCache;
  niCache = (await isCloud())
    ? await cloud.fetchNotInterested().catch(() => ({ postIds: [], styles: [], authors: [] }))
    : FastStorage.getItemSync(NI_KEY, { postIds: [], styles: [], authors: [] });
  return niCache!;
}

export async function markNotInterested(post: FeedPost): Promise<NotInterested> {
  const cur = await loadNotInterested();
  niCache = {
    postIds: [...cur.postIds, post.id],
    styles: post.styleTag ? [...cur.styles, post.styleTag] : cur.styles,
    authors: post.userId ? [...cur.authors, post.userId] : cur.authors
  };
  if (await isCloud()) await cloud.markNotInterested(post);
  else FastStorage.setItemSync(NI_KEY, niCache);
  return niCache;
}

/**
 * Ordena o "Para você" levando em conta o "não tenho interesse":
 * some o post marcado; estilos e autores marcados vão para o fim (não somem).
 */
export function applyNotInterested(posts: FeedPost[], ni: NotInterested | null): FeedPost[] {
  if (!ni || (!ni.postIds.length && !ni.styles.length)) return posts;
  const hidden = new Set(ni.postIds);
  const styleCount = new Map<string, number>();
  ni.styles.forEach(s => styleCount.set(s.toLowerCase(), (styleCount.get(s.toLowerCase()) || 0) + 1));
  const authorCount = new Map<string, number>();
  ni.authors.forEach(a => authorCount.set(a, (authorCount.get(a) || 0) + 1));
  const penalty = (p: FeedPost) => (styleCount.get((p.styleTag || "").toLowerCase()) || 0) + (authorCount.get(p.userId || "") || 0) * 2;
  const visible = posts.filter(p => !hidden.has(p.id));
  const keep = visible.filter(p => penalty(p) === 0);
  const later = visible.filter(p => penalty(p) > 0).sort((a, b) => penalty(a) - penalty(b));
  return [...keep, ...later];
}

// ---------- criadores da semana e busca por cor ----------
export async function loadTopCreators(sinceIso: string): Promise<(UserProfile & { weekLikes: number; weekPosts: number })[]> {
  if (await isCloud()) return cloud.fetchTopCreators(sinceIso).catch(() => []);
  const by = new Map<string, { p: FeedPost; likes: number; posts: number }>();
  publicLocalPosts().forEach(p => {
    const k = p.creatorUsername || p.creatorName;
    const cur = by.get(k) || { p, likes: 0, posts: 0 };
    cur.likes += p.likes || 0;
    cur.posts += 1;
    by.set(k, cur);
  });
  return Array.from(by.values())
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 10)
    .map(x => ({
      id: x.p.userId || x.p.creatorUsername || "",
      username: x.p.creatorUsername || x.p.creatorName,
      displayName: x.p.creatorName,
      avatar: x.p.creatorAvatar,
      location: x.p.city,
      followers: 0,
      following: 0,
      weekLikes: x.likes,
      weekPosts: x.posts
    })) as any;
}

export async function searchByColor(color: string): Promise<FeedPost[]> {
  if (await isCloud()) return cloud.searchByColor(color).catch(() => []);
  const c = color.toLowerCase();
  return publicLocalPosts().filter(
    p => (p.caption || "").toLowerCase().includes(c) || JSON.stringify(p.clothingTags || []).toLowerCase().includes(c)
  );
}

// ---------- melhores amigos ----------
const CF_KEY = "guvio_close_friends_v1";
export async function loadCloseFriends(): Promise<string[]> {
  if (await isCloud()) return cloud.fetchCloseFriends().catch(() => []);
  return FastStorage.getItemSync(CF_KEY, []);
}
export async function setCloseFriend(id: string, on: boolean): Promise<void> {
  if (await isCloud()) return cloud.setCloseFriend(id, on);
  const cur: string[] = FastStorage.getItemSync(CF_KEY, []);
  FastStorage.setItemSync(CF_KEY, on ? Array.from(new Set([...cur, id])) : cur.filter(x => x !== id));
}

// ---------- respostas aos stickers ----------
const SR_KEY = "guvio_story_responses_v1";
export async function respondStory(storyId: string, kind: "vote" | "answer", value: string): Promise<void> {
  if (await isCloud()) return cloud.respondStory(storyId, kind, value);
  const all: any[] = FastStorage.getItemSync(SR_KEY, []);
  FastStorage.setItemSync(SR_KEY, [{ storyId, kind, value, userId: "me", username: "você", avatar: "" }, ...all.filter(r => !(r.storyId === storyId && r.kind === kind && r.userId === "me"))]);
}
export async function loadStoryResponses(storyId: string) {
  if (await isCloud()) return cloud.fetchStoryResponses(storyId).catch(() => []);
  return (FastStorage.getItemSync(SR_KEY, []) as any[]).filter(r => r.storyId === storyId);
}
