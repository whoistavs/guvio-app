/**
 * Acesso ao backend real (Supabase). Todas as funções assumem que o usuário
 * está logado na nuvem — quem decide entre nuvem e modo demo é o storage.ts.
 */
import { Platform } from "react-native";
import { supabase, cloudUserId } from "./supabase";
import type {
  ActivityItem,
  CommentItem,
  DirectThread,
  FeedPost,
  UserProfile,
  UserStoryGroup,
  WardrobeItem
} from "../data/mockData";

export const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200";

function db() {
  if (!supabase) throw new Error("Supabase não configurado");
  return supabase;
}

async function me(): Promise<string> {
  const id = await cloudUserId();
  if (!id) throw new Error("Você precisa estar logado.");
  return id;
}

function check<T>(res: { data: T; error: any }): T {
  if (res.error) throw new Error(res.error.message || "Erro no servidor");
  return res.data;
}

// ---------------------------------------------------------------------
// Tempo relativo
// ---------------------------------------------------------------------
export function timeAgo(iso?: string): string {
  if (!iso) return "agora";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 604800) return `${Math.floor(s / 86400)} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function timeCategory(iso: string): ActivityItem["timeCategory"] {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 86400) return "today";
  if (s < 604800) return "week";
  return "earlier";
}

// ---------------------------------------------------------------------
// Upload de imagens
// ---------------------------------------------------------------------
function isRemote(uri: string) {
  return /^https?:\/\//i.test(uri);
}

/** Envia uma foto local (câmera/galeria) para o Storage e devolve a URL pública. */
export async function uploadImage(uri: string, folder: string): Promise<string> {
  if (!uri || isRemote(uri)) return uri;
  const uid = await me();
  const ext = (uri.split("?")[0].split(".").pop() || "jpg").toLowerCase().slice(0, 5);
  const safeExt = ["jpg", "jpeg", "png", "webp", "heic", "gif"].includes(ext) ? ext : "jpg";
  const contentType = safeExt === "jpg" ? "image/jpeg" : `image/${safeExt}`;
  const path = `${uid}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

  let body: ArrayBuffer | Blob;
  if (Platform.OS === "web") {
    body = await (await fetch(uri)).blob();
  } else {
    // carregado só no celular (o módulo nativo não existe na web)
    const { File } = require("expo-file-system") as typeof import("expo-file-system");
    const bytes = await new File(uri).bytes();
    body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }

  check(await db().storage.from("media").upload(path, body, { contentType, upsert: false }));
  return db().storage.from("media").getPublicUrl(path).data.publicUrl;
}

// ---------------------------------------------------------------------
// Perfis
// ---------------------------------------------------------------------
function toProfile(r: any, followingIds?: Set<string>): UserProfile {
  return {
    id: r.id,
    username: r.username,
    displayName: r.display_name || r.username,
    avatar: r.avatar_url || DEFAULT_AVATAR,
    location: r.location || "",
    bio: r.bio || "",
    website: r.website || "",
    followers: r.followers_count ?? 0,
    following: r.following_count ?? 0,
    postsCount: r.posts_count ?? 0,
    isFollowing: followingIds ? followingIds.has(r.id) : undefined
  };
}

export async function getMyProfile(): Promise<UserProfile> {
  const uid = await me();
  const row = check(await db().from("profile_stats").select("*").eq("id", uid).single());
  return toProfile(row);
}

export async function getProfile(idOrUsername: string): Promise<UserProfile | null> {
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrUsername);
  const q = db().from("profile_stats").select("*");
  const res = isUuid ? await q.eq("id", idOrUsername).maybeSingle() : await q.eq("username", idOrUsername.toLowerCase()).maybeSingle();
  const row = check(res);
  return row ? toProfile(row) : null;
}

export async function listProfiles(): Promise<UserProfile[]> {
  const uid = await me();
  const rows = check(
    await db().from("profile_stats").select("*").neq("id", uid).order("followers_count", { ascending: false }).limit(200)
  );
  return (rows || []).map((r: any) => toProfile(r));
}

export async function updateMyProfile(p: UserProfile): Promise<UserProfile> {
  const uid = await me();
  const avatar = p.avatar ? await uploadImage(p.avatar, "avatar") : null;
  const username = p.username.trim().toLowerCase().replace(/^@/, "");
  const res = await db()
    .from("profiles")
    .update({
      username,
      display_name: p.displayName,
      avatar_url: avatar,
      bio: p.bio || "",
      website: p.website || "",
      location: p.location || ""
    })
    .eq("id", uid);
  if (res.error) {
    if (res.error.code === "23505") throw new Error(`O @${username} já está em uso.`);
    if (res.error.code === "23514") throw new Error("O @ deve ter de 3 a 30 caracteres: letras, números, . e _");
    throw new Error(res.error.message);
  }
  return getMyProfile();
}

export async function usernameAvailable(name: string): Promise<boolean> {
  const res = await db().rpc("username_available", { name });
  if (res.error) return true;
  return Boolean(res.data);
}

// ---------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------
function toPost(r: any, liked: Set<string>, saved: Set<string>): FeedPost {
  return {
    id: r.id,
    userId: r.user_id,
    creatorName: r.display_name || r.username,
    creatorUsername: r.username,
    creatorAvatar: r.avatar_url || DEFAULT_AVATAR,
    city: r.city || "",
    country: r.country || "",
    styleTag: r.style_tag || "Novo look",
    image: r.image_url,
    caption: r.caption || "",
    likes: r.likes_count ?? 0,
    commentsCount: r.comments_count ?? 0,
    timeAgo: timeAgo(r.created_at),
    createdAt: r.created_at,
    isLiked: liked.has(r.id),
    isSaved: saved.has(r.id),
    clothingTags: Array.isArray(r.clothing_tags) ? r.clothing_tags : []
  };
}

async function myLikesAndSaves(postIds: string[]) {
  const uid = await me();
  if (postIds.length === 0) return { liked: new Set<string>(), saved: new Set<string>() };
  const [l, s] = await Promise.all([
    db().from("likes").select("post_id").eq("user_id", uid).in("post_id", postIds),
    db().from("saves").select("post_id").eq("user_id", uid).in("post_id", postIds)
  ]);
  return {
    liked: new Set<string>((l.data || []).map((x: any) => x.post_id)),
    saved: new Set<string>((s.data || []).map((x: any) => x.post_id))
  };
}

async function mapPosts(rows: any[]): Promise<FeedPost[]> {
  const { liked, saved } = await myLikesAndSaves(rows.map(r => r.id));
  return rows.map(r => toPost(r, liked, saved));
}

export async function fetchFeed(limit = 60): Promise<FeedPost[]> {
  const rows = check(await db().from("feed_posts").select("*").order("created_at", { ascending: false }).limit(limit));
  return mapPosts(rows || []);
}

export async function fetchPost(id: string): Promise<FeedPost | null> {
  const row = check(await db().from("feed_posts").select("*").eq("id", id).maybeSingle());
  return row ? (await mapPosts([row]))[0] : null;
}

export async function fetchUserPosts(userId: string): Promise<FeedPost[]> {
  const rows = check(
    await db().from("feed_posts").select("*").eq("user_id", userId).order("created_at", { ascending: false })
  );
  return mapPosts(rows || []);
}

export async function fetchSavedPosts(): Promise<FeedPost[]> {
  const uid = await me();
  const s = check(await db().from("saves").select("post_id").eq("user_id", uid).order("created_at", { ascending: false }));
  const ids = (s || []).map((x: any) => x.post_id);
  if (ids.length === 0) return [];
  const rows = check(await db().from("feed_posts").select("*").in("id", ids));
  const posts = await mapPosts(rows || []);
  return ids.map((id: string) => posts.find(p => p.id === id)).filter(Boolean) as FeedPost[];
}

export async function createPost(input: {
  image: string;
  caption: string;
  city: string;
  country: string;
  styleTag: string;
}): Promise<FeedPost> {
  const uid = await me();
  const image_url = await uploadImage(input.image, "posts");
  const row = check(
    await db()
      .from("posts")
      .insert({ user_id: uid, image_url, caption: input.caption, city: input.city, country: input.country, style_tag: input.styleTag })
      .select("id")
      .single()
  ) as any;
  const post = await fetchPost(row.id);
  if (!post) throw new Error("Post criado, mas não foi possível carregá-lo.");
  return post;
}

export async function deletePost(id: string) {
  check(await db().from("posts").delete().eq("id", id));
}

export async function setLike(postId: string, on: boolean) {
  const uid = await me();
  if (on) {
    const r = await db().from("likes").insert({ post_id: postId, user_id: uid });
    if (r.error && r.error.code !== "23505") throw new Error(r.error.message);
  } else {
    check(await db().from("likes").delete().eq("post_id", postId).eq("user_id", uid));
  }
}

export async function setSave(postId: string, on: boolean) {
  const uid = await me();
  if (on) {
    const r = await db().from("saves").insert({ post_id: postId, user_id: uid });
    if (r.error && r.error.code !== "23505") throw new Error(r.error.message);
  } else {
    check(await db().from("saves").delete().eq("post_id", postId).eq("user_id", uid));
  }
}

// ---------------------------------------------------------------------
// Comentários
// ---------------------------------------------------------------------
export async function fetchComments(postId: string): Promise<CommentItem[]> {
  const rows = check(
    await db()
      .from("comments")
      .select("id, post_id, text, created_at, profiles(username, avatar_url)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
  );
  return (rows || []).map((r: any) => ({
    id: r.id,
    postId: r.post_id,
    username: r.profiles?.username || "membro",
    avatar: r.profiles?.avatar_url || DEFAULT_AVATAR,
    text: r.text,
    createdAt: timeAgo(r.created_at),
    likes: 0
  }));
}

export async function addComment(postId: string, text: string) {
  const uid = await me();
  check(await db().from("comments").insert({ post_id: postId, user_id: uid, text }));
}

// ---------------------------------------------------------------------
// Seguir
// ---------------------------------------------------------------------
export async function fetchFollowingIds(): Promise<string[]> {
  const uid = await me();
  const rows = check(await db().from("follows").select("following_id").eq("follower_id", uid));
  return (rows || []).map((r: any) => r.following_id);
}

export async function setFollow(targetId: string, on: boolean) {
  const uid = await me();
  if (targetId === uid) return;
  if (on) {
    const r = await db().from("follows").insert({ follower_id: uid, following_id: targetId });
    if (r.error && r.error.code !== "23505") throw new Error(r.error.message);
  } else {
    check(await db().from("follows").delete().eq("follower_id", uid).eq("following_id", targetId));
  }
}

// ---------------------------------------------------------------------
// Stories (últimas 24h)
// ---------------------------------------------------------------------
export async function fetchStories(): Promise<UserStoryGroup[]> {
  const uid = await me();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [rows, mine] = await Promise.all([
    db()
      .from("stories")
      .select("id, user_id, image_url, caption, created_at, profiles(username, display_name, avatar_url)")
      .gte("created_at", since)
      .order("created_at", { ascending: true }),
    getMyProfile()
  ]);
  const groups = new Map<string, UserStoryGroup>();
  groups.set(uid, {
    id: uid,
    username: mine.username,
    displayName: "Seu story",
    avatar: mine.avatar,
    isMe: true,
    hasUnseen: false,
    stories: []
  });
  for (const r of (check(rows) as any[]) || []) {
    if (!groups.has(r.user_id)) {
      groups.set(r.user_id, {
        id: r.user_id,
        username: r.profiles?.username || "membro",
        displayName: r.profiles?.display_name || r.profiles?.username || "",
        avatar: r.profiles?.avatar_url || DEFAULT_AVATAR,
        hasUnseen: true,
        stories: []
      });
    }
    groups.get(r.user_id)!.stories.push({ id: r.id, image: r.image_url, caption: r.caption || undefined, timestamp: timeAgo(r.created_at) });
  }
  return Array.from(groups.values());
}

export async function addStory(imageUri: string, caption?: string): Promise<{ id: string; image: string }> {
  const uid = await me();
  const image_url = await uploadImage(imageUri, "stories");
  const row = check(
    await db().from("stories").insert({ user_id: uid, image_url, caption: caption || null }).select("id").single()
  ) as any;
  return { id: row.id, image: image_url };
}

// ---------------------------------------------------------------------
// Direct
// ---------------------------------------------------------------------
export interface CloudMessage {
  id: string;
  text?: string;
  image?: string;
  reaction?: string;
  sender: "me" | "other";
  createdAt: string;
}

export async function fetchThreads(): Promise<DirectThread[]> {
  const uid = await me();
  const rows = check(
    await db()
      .from("messages")
      .select("id, sender_id, recipient_id, text, image_url, created_at")
      .or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)
      .order("created_at", { ascending: false })
      .limit(500)
  ) as any[];
  const last = new Map<string, any>();
  for (const m of rows || []) {
    const other = m.sender_id === uid ? m.recipient_id : m.sender_id;
    if (!last.has(other)) last.set(other, m);
  }
  if (last.size === 0) return [];
  const profs = check(
    await db().from("profiles").select("id, username, avatar_url").in("id", Array.from(last.keys()))
  ) as any[];
  return Array.from(last.entries()).map(([other, m]) => {
    const p = (profs || []).find(x => x.id === other);
    return {
      id: other,
      profileId: other,
      username: p?.username || "membro",
      avatar: p?.avatar_url || DEFAULT_AVATAR,
      lastMessage: m.text || "📷 Foto",
      time: timeAgo(m.created_at)
    };
  });
}

function toMessage(m: any, uid: string): CloudMessage {
  return {
    id: m.id,
    text: m.text || undefined,
    image: m.image_url || undefined,
    reaction: m.reaction || undefined,
    sender: m.sender_id === uid ? "me" : "other",
    createdAt: m.created_at
  };
}

export async function fetchMessages(otherId: string): Promise<CloudMessage[]> {
  const uid = await me();
  const rows = check(
    await db()
      .from("messages")
      .select("*")
      .or(`and(sender_id.eq.${uid},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${uid})`)
      .order("created_at", { ascending: true })
      .limit(500)
  ) as any[];
  return (rows || []).map(m => toMessage(m, uid));
}

export async function sendMessage(otherId: string, msg: { text?: string; image?: string }): Promise<CloudMessage> {
  const uid = await me();
  const image_url = msg.image ? await uploadImage(msg.image, "direct") : null;
  const row = check(
    await db()
      .from("messages")
      .insert({ sender_id: uid, recipient_id: otherId, text: msg.text || null, image_url })
      .select("*")
      .single()
  );
  return toMessage(row, uid);
}

export async function setReaction(messageId: string, emoji: string | null) {
  check(await db().from("messages").update({ reaction: emoji }).eq("id", messageId));
}

/** Escuta mensagens novas/alteradas da conversa com otherId. Retorna função para parar. */
export function subscribeMessages(otherId: string, onChange: (m: CloudMessage) => void): () => void {
  const client = db();
  let uid: string | null = null;
  cloudUserId().then(id => (uid = id));
  const ch = client
    .channel(`dm-${otherId}-${Date.now()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, payload => {
      const m: any = payload.new;
      if (!m || !uid) return;
      const inThread =
        (m.sender_id === uid && m.recipient_id === otherId) || (m.sender_id === otherId && m.recipient_id === uid);
      if (inThread) onChange(toMessage(m, uid));
    })
    .subscribe();
  return () => {
    client.removeChannel(ch);
  };
}

// ---------------------------------------------------------------------
// Guarda-roupa
// ---------------------------------------------------------------------
export async function fetchWardrobe(): Promise<WardrobeItem[]> {
  const uid = await me();
  const rows = check(
    await db().from("wardrobe_items").select("*").eq("user_id", uid).order("created_at", { ascending: false })
  ) as any[];
  return (rows || []).map(r => ({ id: r.id, name: r.name, category: r.category, colorTag: r.color_tag, image: r.image_url }));
}

export async function addWardrobeItem(item: WardrobeItem): Promise<WardrobeItem> {
  const uid = await me();
  const image_url = await uploadImage(item.image, "wardrobe");
  const r = check(
    await db()
      .from("wardrobe_items")
      .insert({ user_id: uid, name: item.name, category: item.category, color_tag: item.colorTag, image_url })
      .select("*")
      .single()
  ) as any;
  return { id: r.id, name: r.name, category: r.category, colorTag: r.color_tag, image: r.image_url };
}

export async function deleteWardrobeItem(id: string) {
  check(await db().from("wardrobe_items").delete().eq("id", id));
}

// ---------------------------------------------------------------------
// Notificações (Atividade)
// ---------------------------------------------------------------------
export async function fetchActivities(): Promise<ActivityItem[]> {
  const uid = await me();
  const rows = check(
    await db()
      .from("notifications")
      .select("id, type, text, created_at, actor_id, actor:profiles!notifications_actor_id_fkey(username, avatar_url), post:posts(image_url)")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(100)
  ) as any[];
  return (rows || []).map(r => ({
    id: r.id,
    type: r.type,
    userId: r.actor_id,
    username: r.actor?.username || "membro",
    userAvatar: r.actor?.avatar_url || DEFAULT_AVATAR,
    message:
      r.type === "like"
        ? "curtiu seu look."
        : r.type === "comment"
        ? `comentou: ${r.text || ""}`
        : "começou a seguir você.",
    timeAgo: timeAgo(r.created_at),
    postImage: r.post?.image_url || undefined,
    timeCategory: timeCategory(r.created_at)
  }));
}

export async function hasRecentActivity(): Promise<boolean> {
  const uid = await me();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await db()
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid)
    .gte("created_at", since);
  return (count || 0) > 0;
}

// ---------------------------------------------------------------------
// Bloqueios
// ---------------------------------------------------------------------
export async function fetchBlocked(): Promise<UserProfile[]> {
  const uid = await me();
  const rows = check(await db().from("blocks").select("blocked_id").eq("blocker_id", uid)) as any[];
  const ids = (rows || []).map(r => r.blocked_id);
  if (ids.length === 0) return [];
  const profs = check(await db().from("profile_stats").select("*").in("id", ids)) as any[];
  return (profs || []).map(r => toProfile(r));
}

export async function setBlocked(targetId: string, on: boolean) {
  const uid = await me();
  if (on) {
    const r = await db().from("blocks").insert({ blocker_id: uid, blocked_id: targetId });
    if (r.error && r.error.code !== "23505") throw new Error(r.error.message);
    await setFollow(targetId, false).catch(() => {});
  } else {
    check(await db().from("blocks").delete().eq("blocker_id", uid).eq("blocked_id", targetId));
  }
}

// ---------------------------------------------------------------------
// Tempo real do feed
// ---------------------------------------------------------------------
export function subscribeFeed(handlers: {
  onNewPost?: (p: FeedPost) => void;
  onDeletedPost?: (id: string) => void;
  onLikesChanged?: (postId: string) => void;
  onCommentsChanged?: (postId: string) => void;
}): () => void {
  const client = db();
  const ch = client
    .channel(`feed-${Date.now()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, async payload => {
      const id = (payload.new as any)?.id;
      if (!id || !handlers.onNewPost) return;
      const p = await fetchPost(id).catch(() => null);
      if (p) handlers.onNewPost(p);
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts" }, payload => {
      const id = (payload.old as any)?.id;
      if (id) handlers.onDeletedPost?.(id);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "likes" }, payload => {
      const id = ((payload.new as any)?.post_id || (payload.old as any)?.post_id) as string | undefined;
      if (id) handlers.onLikesChanged?.(id);
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments" }, payload => {
      const id = (payload.new as any)?.post_id;
      if (id) handlers.onCommentsChanged?.(id);
    })
    .subscribe();
  return () => {
    client.removeChannel(ch);
  };
}

export async function fetchPostCounts(postId: string): Promise<{ likes: number; comments: number } | null> {
  const row = check(
    await db().from("feed_posts").select("likes_count, comments_count").eq("id", postId).maybeSingle()
  ) as any;
  return row ? { likes: row.likes_count, comments: row.comments_count } : null;
}
