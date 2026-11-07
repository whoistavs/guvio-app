/**
 * Acesso ao backend real (Supabase). Todas as funções assumem que o usuário
 * está logado na nuvem — quem decide entre nuvem e modo demo é o storage.ts.
 */
import { Image as RNImage, Platform } from "react-native";
import { supabase, cloudUserId } from "./supabase";
import type {
  ClothingTag,
  Outfit,
  ActivityItem,
  CommentItem,
  DirectThread,
  SavedCollection,
  Highlight,
  StoryItem,
  StoryOverlay,
  StorySticker,
  WishlistItem,
  OutfitLogEntry,
  FeedPost,
  UserProfile,
  UserStoryGroup,
  WardrobeItem
} from "../data/mockData";

export const DEFAULT_AVATAR = ""; // sem foto: o app mostra o ícone de perfil

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

const MAX_SIDE = 1440;

function imageSize(uri: string): Promise<{ width: number; height: number } | null> {
  return new Promise(resolve =>
    RNImage.getSize(uri, (width, height) => resolve({ width, height }), () => resolve(null))
  );
}

/** Reduz a foto para no máximo 1440px e JPEG 80% antes de enviar (bem mais rápido no 4G) */
// tamanho máximo (lado maior) por tipo de foto: avatar aparece pequeno, não precisa de 1440px
const SIDE_BY_FOLDER: Record<string, number> = { avatar: 480, wardrobe: 1000, wishlist: 800, feedback: 1280 };

async function compress(uri: string, folder = ""): Promise<string> {
  if (Platform.OS === "web") return uri;
  try {
    const { manipulateAsync, SaveFormat } = require("expo-image-manipulator") as typeof import("expo-image-manipulator");
    const size = await imageSize(uri);
    const actions: any[] = [];
    // economia de dados: fotos menores e mais comprimidas
    const saver = require("./settings").isDataSaver() as boolean;
    const side = Math.min(saver ? 1080 : MAX_SIDE, SIDE_BY_FOLDER[folder] || MAX_SIDE);
    if (size && Math.max(size.width, size.height) > side) {
      actions.push({ resize: size.width >= size.height ? { width: side } : { height: side } });
    }
    const out = await manipulateAsync(uri, actions, { compress: saver ? 0.62 : 0.8, format: SaveFormat.JPEG });
    return out.uri;
  } catch (e) {
    return uri;
  }
}

/** Envia uma foto local (câmera/galeria) para o Storage e devolve a URL pública. */
export async function uploadImage(uri: string, folder: string): Promise<string> {
  if (!uri || isRemote(uri)) return uri;
  const uid = await me();
  uri = await compress(uri, folder);
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

/** Envia um vídeo (até ~50 MB) para o Storage */
export async function uploadVideo(uri: string): Promise<string> {
  if (!uri || isRemote(uri)) return uri;
  const uid = await me();
  const ext = (uri.split("?")[0].split(".").pop() || "mp4").toLowerCase();
  const safeExt = ["mp4", "mov", "m4v", "webm"].includes(ext) ? ext : "mp4";
  const path = `${uid}/videos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
  let body: ArrayBuffer | Blob;
  if (Platform.OS === "web") body = await (await fetch(uri)).blob();
  else {
    const { File } = require("expo-file-system") as typeof import("expo-file-system");
    const bytes = await new File(uri).bytes();
    body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }
  // H.264 em .mov toca no navegador quando marcado como mp4
  const contentType = safeExt === "webm" ? "video/webm" : "video/mp4";
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
    isFollowing: followingIds ? followingIds.has(r.id) : undefined,
    isPrivate: !!r.is_private,
    pronouns: r.pronouns || ""
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
  // foto de exemplo antiga não é salva: fica o ícone de perfil
  const stock = !p.avatar || p.avatar.includes("photo-1534528741775-53994a69daeb");
  const avatar = stock ? null : await uploadImage(p.avatar, "avatar");
  const username = p.username.trim().toLowerCase().replace(/^@/, "");
  const res = await db()
    .from("profiles")
    .update({
      username,
      display_name: p.displayName,
      avatar_url: avatar,
      bio: p.bio || "",
      website: p.website || "",
      location: p.location || "",
      pronouns: (p.pronouns || "").slice(0, 30),
      is_private: !!p.isPrivate
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
    images: [r.image_url, ...(Array.isArray(r.images) ? r.images : [])].filter(Boolean),
    caption: r.caption || "",
    likes: r.likes_count ?? 0,
    commentsCount: r.comments_count ?? 0,
    timeAgo: timeAgo(r.created_at),
    createdAt: r.created_at,
    lat: r.lat ?? undefined,
    lng: r.lng ?? undefined,
    isLiked: liked.has(r.id),
    isSaved: saved.has(r.id),
    clothingTags: Array.isArray(r.clothing_tags) ? r.clothing_tags : [],
    archived: !!r.archived,
    pinned: !!r.pinned_at,
    hideLikes: !!r.hide_likes,
    kind: r.kind || "photo",
    videoUrl: r.video_url || undefined,
    repostOf: r.repost_of || undefined,
    originalUsername: r.original_username || undefined,
    originalAvatar: r.original_avatar_url || undefined,
    pinnedCommentId: r.pinned_comment_id || null
  };
}

/** votos das enquetes e avaliações 🔥/🧊 dos posts da lista (2 consultas para a lista toda) */
async function attachExtras(rows: any[], posts: FeedPost[]): Promise<FeedPost[]> {
  if (!posts.length) return posts;
  const uid = await me();
  const ids = posts.map(p => p.id);
  const pollIds = rows.filter(r => r.kind === "poll").map(r => r.id);
  const [ratings, votes] = await Promise.all([
    db().from("post_ratings").select("post_id, user_id, value").in("post_id", ids),
    pollIds.length ? db().from("poll_votes").select("post_id, user_id, option").in("post_id", pollIds) : Promise.resolve({ data: [] as any[] })
  ]);
  const rr = (ratings.data || []) as any[];
  const vv = (votes.data || []) as any[];
  return posts.map((p, i) => {
    const mine = rr.find(x => x.post_id === p.id && x.user_id === uid);
    const rating = {
      fire: rr.filter(x => x.post_id === p.id && x.value === 1).length,
      ice: rr.filter(x => x.post_id === p.id && x.value === -1).length,
      mine: (mine ? mine.value : 0) as 1 | -1 | 0
    };
    const row = rows[i];
    if (row?.kind !== "poll") return { ...p, rating };
    const options: string[] = Array.isArray(row.poll?.options) ? row.poll.options : ["Look 1", "Look 2"];
    const pv = vv.filter(x => x.post_id === p.id);
    const myVote = pv.find(x => x.user_id === uid)?.option;
    return {
      ...p,
      rating,
      poll: { options, votes: options.map((_, k) => pv.filter(x => x.option === k).length), myVote: myVote ?? null }
    };
  });
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
  const posts = rows.map(r => toPost(r, liked, saved));
  return attachExtras(rows, posts).catch(() => posts);
}

/** ids de quem eu bloqueei/silenciei e dos posts que denunciei (somem do meu feed) */
// guardado por 60s: o feed, o Explorar e o tempo real pedem isso várias vezes seguidas
let hiddenCache: { at: number; uid: string; v: { users: Set<string>; posts: Set<string> } } | null = null;
export function invalidateHidden() {
  hiddenCache = null;
}

async function hiddenSets(): Promise<{ users: Set<string>; posts: Set<string> }> {
  const uid = await me();
  if (hiddenCache && hiddenCache.uid === uid && Date.now() - hiddenCache.at < 60000) return hiddenCache.v;
  const v = await loadHiddenSets(uid);
  hiddenCache = { at: Date.now(), uid, v };
  return v;
}

async function loadHiddenSets(uid: string): Promise<{ users: Set<string>; posts: Set<string> }> {
  const [b, r, m] = await Promise.all([
    db().from("blocks").select("blocked_id").eq("blocker_id", uid),
    db().from("reports").select("post_id").eq("reporter_id", uid),
    db().from("mutes").select("muted_id").eq("muter_id", uid)
  ]);
  return {
    users: new Set<string>([
      ...(b.data || []).map((x: any) => x.blocked_id),
      ...(m.data || []).map((x: any) => x.muted_id)
    ]),
    posts: new Set<string>((r.data || []).map((x: any) => x.post_id))
  };
}

function visible(rows: any[], hidden: { users: Set<string>; posts: Set<string> }) {
  return rows.filter(r => !r.archived && !hidden.users.has(r.user_id) && !hidden.posts.has(r.id));
}

export async function fetchFeed(limit = 30, before?: string): Promise<FeedPost[]> {
  let q = db().from("feed_posts").select("*").order("created_at", { ascending: false }).limit(limit);
  if (before) q = q.lt("created_at", before);
  const [res, hidden] = await Promise.all([q, hiddenSets()]);
  return mapPosts(visible(check(res) || [], hidden));
}

/** Explorar: looks de outras pessoas, mais curtidos primeiro */
export async function fetchExplore(limit = 60): Promise<FeedPost[]> {
  const uid = await me();
  const [res, hidden] = await Promise.all([
    db().from("feed_posts").select("*").neq("user_id", uid).order("created_at", { ascending: false }).limit(150),
    hiddenSets()
  ]);
  const rows = visible(check(res) || [], hidden)
    .sort((a: any, b: any) => b.likes_count + b.comments_count * 2 - (a.likes_count + a.comments_count * 2))
    .slice(0, limit);
  return mapPosts(rows);
}

/** Busca looks por cidade, país, estilo ou legenda */
export async function searchPosts(query: string): Promise<FeedPost[]> {
  const q = query.trim().replace(/[%,()]/g, " ");
  if (!q) return [];
  const like = `%${q}%`;
  const [res, hidden] = await Promise.all([
    db()
      .from("feed_posts")
      .select("*")
      .or(`city.ilike.${like},country.ilike.${like},style_tag.ilike.${like},caption.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(60),
    hiddenSets()
  ]);
  return mapPosts(visible(check(res) || [], hidden));
}

export async function updateCaption(postId: string, caption: string) {
  check(await db().from("posts").update({ caption }).eq("id", postId));
}

export async function reportPost(postId: string, reason: string) {
  const uid = await me();
  invalidateHidden();
  const r = await db().from("reports").insert({ reporter_id: uid, post_id: postId, reason });
  if (r.error && r.error.code !== "23505") throw new Error(r.error.message);
}

export async function fetchPost(id: string): Promise<FeedPost | null> {
  const row = check(await db().from("feed_posts").select("*").eq("id", id).maybeSingle());
  return row ? (await mapPosts([row]))[0] : null;
}

/** posts do perfil: fixados primeiro, sem os arquivados */
export async function fetchUserPosts(userId: string): Promise<FeedPost[]> {
  const rows = check(
    await db()
      .from("feed_posts")
      .select("*")
      .eq("user_id", userId)
      .eq("archived", false)
      .order("pinned_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
  );
  return mapPosts(rows || []);
}

export async function fetchArchivedPosts(): Promise<FeedPost[]> {
  const uid = await me();
  const rows = check(
    await db().from("feed_posts").select("*").eq("user_id", uid).eq("archived", true).order("created_at", { ascending: false })
  );
  return mapPosts(rows || []);
}

/** posts em que alguém marcou @username na legenda */
export async function fetchTaggedPosts(username: string): Promise<FeedPost[]> {
  const clean = username.replace(/^@/, "").replace(/[%,()]/g, "");
  const [res, hidden] = await Promise.all([
    db()
      .from("feed_posts")
      .select("*")
      .ilike("caption", `%@${clean}%`)
      .order("created_at", { ascending: false })
      .limit(60),
    hiddenSets()
  ]);
  const re = new RegExp(`@${clean.replace(/\./g, "\\.")}(?![A-Za-z0-9_.])`, "i");
  return mapPosts(visible(check(res) || [], hidden).filter((r: any) => re.test(r.caption || "")));
}

export async function setPostFlags(postId: string, flags: { archived?: boolean; pinned?: boolean; hideLikes?: boolean }) {
  const patch: any = {};
  if (flags.archived !== undefined) {
    patch.archived = flags.archived;
    if (flags.archived) patch.pinned_at = null;
  }
  if (flags.pinned !== undefined) patch.pinned_at = flags.pinned ? new Date().toISOString() : null;
  if (flags.hideLikes !== undefined) patch.hide_likes = flags.hideLikes;
  check(await db().from("posts").update(patch).eq("id", postId));
}

export async function updatePost(
  postId: string,
  data: { caption: string; city: string; country: string; styleTag?: string; clothingTags: ClothingTag[] }
) {
  check(
    await db()
      .from("posts")
      .update({
        caption: data.caption,
        city: data.city,
        country: data.country,
        style_tag: data.styleTag || "Novo look",
        clothing_tags: data.clothingTags
      })
      .eq("id", postId)
  );
}

export async function fetchLikers(postId: string): Promise<UserProfile[]> {
  const rows = check(
    await db().from("likes").select("user_id, created_at").eq("post_id", postId).order("created_at", { ascending: false }).limit(300)
  ) as any[];
  const ids = (rows || []).map(r => r.user_id);
  if (!ids.length) return [];
  const [profs, following] = await Promise.all([
    db().from("profile_stats").select("*").in("id", ids),
    fetchFollowingIds()
  ]);
  const set = new Set(following);
  const list = ((check(profs) as any[]) || []).map(r => toProfile(r, set));
  return ids.map(id => list.find(p => p.id === id)).filter(Boolean) as UserProfile[];
}

/** legendas recentes, para calcular as hashtags em alta */
export async function fetchRecentCaptions(days = 7): Promise<{ caption: string; likes: number }[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const rows = check(
    await db().from("feed_posts").select("caption, likes_count").gte("created_at", since).like("caption", "%#%").limit(500)
  ) as any[];
  return (rows || []).map(r => ({ caption: r.caption || "", likes: r.likes_count || 0 }));
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
  lat?: number;
  lng?: number;
  images?: string[];
  clothingTags?: ClothingTag[];
  /** vídeo local + capa (input.image é a capa) */
  video?: string;
  /** enquete: uma legenda por foto */
  pollOptions?: string[];
}): Promise<FeedPost> {
  const uid = await me();
  const video_url = input.video ? await uploadVideo(input.video) : null;
  const all = (input.images && input.images.length ? input.images : [input.image]).slice(0, 10);
  // sobe as fotos em sequência (mais estável no 4G)
  const uploaded: string[] = [];
  for (const uri of all) uploaded.push(await uploadImage(uri, "posts"));
  const image_url = uploaded[0];
  const row = check(
    await db()
      .from("posts")
      .insert({
        user_id: uid,
        image_url,
        caption: input.caption,
        city: input.city,
        country: input.country,
        style_tag: input.styleTag,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        images: uploaded.slice(1),
        clothing_tags: (input.clothingTags || []).map(t => ({ ...t, image: t.image && /^https?:/.test(t.image) ? t.image : undefined })),
        kind: video_url ? "video" : input.pollOptions && uploaded.length >= 2 ? "poll" : "photo",
        video_url,
        poll: input.pollOptions && uploaded.length >= 2 ? { options: input.pollOptions.slice(0, uploaded.length).map((o, i) => o.trim() || `Look ${i + 1}`) } : null
      })
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
  const uid = await me();
  const [rows, post] = await Promise.all([
    db()
      .from("comments")
      .select("id, post_id, user_id, text, created_at, parent_id, profiles!comments_user_id_fkey(username, avatar_url)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true }),
    db().from("posts").select("user_id").eq("id", postId).maybeSingle()
  ]);
  const list = check(rows) || [];
  const ids = list.map((r: any) => r.id);
  const likes = ids.length
    ? ((check(await db().from("comment_likes").select("comment_id, user_id").in("comment_id", ids)) as any[]) || [])
    : [];
  const postOwner = (post.data as any)?.user_id;
  return list.map((r: any) => ({
    id: r.id,
    postId: r.post_id,
    userId: r.user_id,
    parentId: r.parent_id || null,
    canDelete: r.user_id === uid || postOwner === uid,
    username: r.profiles?.username || "membro",
    avatar: r.profiles?.avatar_url || DEFAULT_AVATAR,
    text: r.text,
    createdAt: timeAgo(r.created_at),
    likes: likes.filter(l => l.comment_id === r.id).length,
    isLiked: likes.some(l => l.comment_id === r.id && l.user_id === uid)
  }));
}

export async function deleteComment(commentId: string) {
  check(await db().from("comments").delete().eq("id", commentId));
}

export async function addComment(postId: string, text: string, parentId?: string | null) {
  const uid = await me();
  check(await db().from("comments").insert({ post_id: postId, user_id: uid, text, parent_id: parentId || null }));
}

export async function setCommentLike(commentId: string, on: boolean) {
  const uid = await me();
  if (on) {
    const { error } = await db().from("comment_likes").insert({ comment_id: commentId, user_id: uid });
    if (error && !String(error.message).includes("duplicate")) throw new Error(error.message);
  } else {
    check(await db().from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", uid));
  }
}

// ---------------------------------------------------------------------
// Coleções de salvos
// ---------------------------------------------------------------------
export async function fetchCollections(): Promise<SavedCollection[]> {
  const uid = await me();
  const rows = check(
    await db()
      .from("collections")
      .select("id, name, created_at, collection_items(post_id, created_at, posts(image_url))")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
  ) as any[];
  return (rows || []).map(r => {
    const items = (r.collection_items || []).sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1));
    return { id: r.id, name: r.name, count: items.length, cover: items[0]?.posts?.image_url || undefined };
  });
}

export async function createCollection(name: string): Promise<SavedCollection> {
  const uid = await me();
  const r = check(await db().from("collections").insert({ user_id: uid, name: name.trim().slice(0, 40) }).select("id, name").single()) as any;
  return { id: r.id, name: r.name, count: 0 };
}

export async function renameCollection(id: string, name: string) {
  check(await db().from("collections").update({ name: name.trim().slice(0, 40) }).eq("id", id));
}

export async function deleteCollection(id: string) {
  check(await db().from("collections").delete().eq("id", id));
}

export async function setInCollection(collectionId: string, postId: string, on: boolean) {
  if (on) {
    await setSave(postId, true).catch(() => {});
    const { error } = await db().from("collection_items").insert({ collection_id: collectionId, post_id: postId });
    if (error && !String(error.message).includes("duplicate")) throw new Error(error.message);
  } else {
    check(await db().from("collection_items").delete().eq("collection_id", collectionId).eq("post_id", postId));
  }
}

export async function fetchPostCollectionIds(postId: string): Promise<string[]> {
  const rows = check(await db().from("collection_items").select("collection_id").eq("post_id", postId)) as any[];
  return (rows || []).map(r => r.collection_id);
}

export async function fetchCollectionPosts(collectionId: string): Promise<FeedPost[]> {
  const items = check(
    await db().from("collection_items").select("post_id").eq("collection_id", collectionId).order("created_at", { ascending: false })
  ) as any[];
  const ids = (items || []).map(i => i.post_id);
  if (!ids.length) return [];
  const posts = await mapPosts(check(await db().from("feed_posts").select("*").in("id", ids)) || []);
  return ids.map(id => posts.find(p => p.id === id)).filter(Boolean) as FeedPost[];
}

// ---------------------------------------------------------------------
// Sugestões, desafios e rankings
// ---------------------------------------------------------------------
export interface SuggestedProfile extends UserProfile {
  mutuals: number;
}

export async function fetchSuggestions(limit = 15): Promise<SuggestedProfile[]> {
  const rows = check(await db().rpc("suggested_profiles", { lim: limit })) as any[];
  return (rows || []).map(r => ({
    ...toProfile({ ...r, followers_count: r.followers }),
    isFollowing: false,
    mutuals: r.mutuals || 0
  }));
}

/** looks com a #tag do desafio desde o início da semana, mais curtidos primeiro */
export async function fetchChallengePosts(tag: string, sinceIso: string, limit = 30): Promise<FeedPost[]> {
  const clean = tag.replace(/^#/, "").replace(/[%,()]/g, "");
  const [res, hidden] = await Promise.all([
    db()
      .from("feed_posts")
      .select("*")
      .ilike("caption", `%#${clean}%`)
      .gte("created_at", sinceIso)
      .order("likes_count", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(limit),
    hiddenSets()
  ]);
  return mapPosts(visible(check(res) || [], hidden));
}

/** looks mais curtidos de uma cidade */
export async function fetchCityRanking(city: string, limit = 30): Promise<FeedPost[]> {
  const clean = city.replace(/[%,()]/g, "").trim();
  const [res, hidden] = await Promise.all([
    db()
      .from("feed_posts")
      .select("*")
      .ilike("city", clean)
      .order("likes_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit),
    hiddenSets()
  ]);
  return mapPosts(visible(check(res) || [], hidden));
}

// ---------------------------------------------------------------------
// Feedback dos testers
// ---------------------------------------------------------------------
export async function sendFeedback(input: {
  kind: "bug" | "ideia" | "outro";
  text: string;
  screenshot?: string;
  appVersion?: string;
}) {
  const uid = await me();
  const screenshot_url = input.screenshot ? await uploadImage(input.screenshot, "feedback") : null;
  check(
    await db().from("feedback").insert({
      user_id: uid,
      kind: input.kind,
      text: input.text.trim().slice(0, 4000),
      screenshot_url,
      app_version: input.appVersion || null,
      platform: Platform.OS
    })
  );
}

// ---------------------------------------------------------------------
// Seguir
// ---------------------------------------------------------------------
export async function fetchFollowingIds(): Promise<string[]> {
  const uid = await me();
  const rows = check(await db().from("follows").select("following_id").eq("follower_id", uid));
  return (rows || []).map((r: any) => r.following_id);
}

/** segue (perfil aberto) ou manda pedido (perfil privado). Retorna o que aconteceu. */
export async function setFollow(targetId: string, on: boolean): Promise<"following" | "requested" | "none"> {
  const uid = await me();
  if (targetId === uid) return "none";
  if (on) {
    const r = await db().from("follows").insert({ follower_id: uid, following_id: targetId });
    if (!r.error || r.error.code === "23505") return "following";
    // perfil privado: a regra do banco não deixa seguir direto, vira pedido
    if (r.error.code === "42501" || /row-level security/i.test(r.error.message)) {
      const q = await db().from("follow_requests").insert({ requester_id: uid, target_id: targetId });
      if (q.error && q.error.code !== "23505") throw new Error(q.error.message);
      return "requested";
    }
    throw new Error(r.error.message);
  }
  check(await db().from("follows").delete().eq("follower_id", uid).eq("following_id", targetId));
  await db().from("follow_requests").delete().eq("requester_id", uid).eq("target_id", targetId);
  return "none";
}

export async function fetchMyRequestedIds(): Promise<string[]> {
  const uid = await me();
  const rows = check(await db().from("follow_requests").select("target_id").eq("requester_id", uid)) as any[];
  return (rows || []).map(r => r.target_id);
}

export async function fetchFollowRequests(): Promise<UserProfile[]> {
  const uid = await me();
  const rows = check(
    await db().from("follow_requests").select("requester_id, created_at").eq("target_id", uid).order("created_at", { ascending: false })
  ) as any[];
  const ids = (rows || []).map(r => r.requester_id);
  if (!ids.length) return [];
  const profs = check(await db().from("profile_stats").select("*").in("id", ids)) as any[];
  return ids.map(id => (profs || []).find(p => p.id === id)).filter(Boolean).map(r => toProfile(r));
}

export async function answerFollowRequest(requesterId: string, accept: boolean) {
  const uid = await me();
  if (accept) check(await db().rpc("approve_follow_request", { requester: requesterId }));
  else {
    check(await db().from("follow_requests").delete().eq("requester_id", requesterId).eq("target_id", uid));
    await db().from("notifications").delete().eq("user_id", uid).eq("actor_id", requesterId).eq("type", "follow_request");
  }
}

// ---------------------------------------------------------------------
// Silenciar
// ---------------------------------------------------------------------
export async function fetchMutedIds(): Promise<string[]> {
  const uid = await me();
  const rows = check(await db().from("mutes").select("muted_id").eq("muter_id", uid)) as any[];
  return (rows || []).map(r => r.muted_id);
}

export async function setMuted(targetId: string, on: boolean) {
  const uid = await me();
  if (on) {
    invalidateHidden();
    const r = await db().from("mutes").insert({ muter_id: uid, muted_id: targetId });
    if (r.error && r.error.code !== "23505") throw new Error(r.error.message);
  } else {
    invalidateHidden();
    check(await db().from("mutes").delete().eq("muter_id", uid).eq("muted_id", targetId));
  }
}

export async function fetchFollowList(userId: string, kind: "followers" | "following"): Promise<UserProfile[]> {
  const col = kind === "followers" ? "follower_id" : "following_id";
  const where = kind === "followers" ? "following_id" : "follower_id";
  const rows = check(await db().from("follows").select(col).eq(where, userId).limit(500)) as any[];
  const ids = (rows || []).map(r => r[col]);
  if (ids.length === 0) return [];
  const profs = check(await db().from("profile_stats").select("*").in("id", ids)) as any[];
  return (profs || []).map(r => toProfile(r));
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
      .select("id, user_id, image_url, caption, overlay, audience, sticker, created_at, profiles!stories_user_id_fkey(username, display_name, avatar_url)")
      .gte("created_at", since)
      .order("created_at", { ascending: true }),
    getMyProfile()
  ]);
  const storyIds = ((check(rows) as any[]) || []).map(r => r.id);
  const seenRes = storyIds.length
    ? await db().from("story_views").select("story_id").eq("viewer_id", uid).in("story_id", storyIds)
    : { data: [] as any[] };
  const seen = new Set<string>((seenRes.data || []).map((x: any) => x.story_id));
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
        hasUnseen: false,
        stories: []
      });
    }
    const g = groups.get(r.user_id)!;
    const wasSeen = r.user_id === uid || seen.has(r.id);
    if (!wasSeen) g.hasUnseen = true;
    g.stories.push({
      id: r.id,
      image: r.image_url,
      caption: r.caption || undefined,
      overlay: r.overlay || null,
      sticker: r.sticker || null,
      closeFriends: r.audience === "close",
      timestamp: timeAgo(r.created_at),
      seen: wasSeen
    });
    if (r.audience === "close" && !wasSeen) g.hasClose = true;
  }
  // quem tem story não visto aparece primeiro (depois do meu)
  const all = Array.from(groups.values());
  return [all[0], ...all.slice(1).sort((a, b) => Number(!!b.hasUnseen) - Number(!!a.hasUnseen))];
}

export async function addStory(
  imageUri: string,
  caption?: string,
  overlay?: StoryOverlay | null,
  extra?: { closeFriends?: boolean; sticker?: StorySticker | null }
): Promise<{ id: string; image: string }> {
  const uid = await me();
  const image_url = await uploadImage(imageUri, "stories");
  const row = check(
    await db()
      .from("stories")
      .insert({
        user_id: uid,
        image_url,
        caption: caption || null,
        overlay: overlay?.text ? overlay : null,
        audience: extra?.closeFriends ? "close" : "all",
        sticker: extra?.sticker || null
      })
      .select("id")
      .single()
  ) as any;
  return { id: row.id, image: image_url };
}

export async function markStorySeen(storyId: string) {
  const uid = await me();
  const r = await db().from("story_views").insert({ story_id: storyId, viewer_id: uid });
  if (r.error && r.error.code !== "23505" && r.error.code !== "23503") throw new Error(r.error.message);
}

export async function deleteStory(storyId: string) {
  check(await db().from("stories").delete().eq("id", storyId));
}

export async function fetchStoryViewers(storyId: string): Promise<{ username: string; avatar: string; time: string }[]> {
  const rows = check(
    await db()
      .from("story_views")
      .select("created_at, profiles!story_views_viewer_id_fkey(username, avatar_url)")
      .eq("story_id", storyId)
      .order("created_at", { ascending: false })
  ) as any[];
  return (rows || []).map(r => ({
    username: r.profiles?.username || "membro",
    avatar: r.profiles?.avatar_url || DEFAULT_AVATAR,
    time: timeAgo(r.created_at)
  }));
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
  /** look compartilhado */
  postId?: string;
  /** mensagem respondida */
  replyTo?: string;
  deleted?: boolean;
  readAt?: string;
}

function previewOf(m: any): string {
  if (m.deleted_at) return "Mensagem apagada";
  if (m.text) return m.text;
  if (m.post_id) return "👗 Enviou um look";
  return "📷 Foto";
}

export async function fetchThreads(): Promise<DirectThread[]> {
  const uid = await me();
  const [res, prefs] = await Promise.all([
    db()
      .from("messages")
      .select("id, sender_id, recipient_id, text, image_url, post_id, deleted_at, created_at, read_at")
      .or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)
      .order("created_at", { ascending: false })
      .limit(500),
    fetchDmPrefs().catch(() => ({} as Record<string, { pinned: boolean; clearedAt?: string }>))
  ]);
  const rows = check(res) as any[];
  const last = new Map<string, any>();
  const unread = new Map<string, number>();
  for (const m of rows || []) {
    const other = m.sender_id === uid ? m.recipient_id : m.sender_id;
    const cleared = prefs[other]?.clearedAt;
    if (cleared && m.created_at <= cleared) continue; // conversa apagada por mim
    if (!last.has(other)) last.set(other, m);
    if (m.recipient_id === uid && !m.read_at) unread.set(other, (unread.get(other) || 0) + 1);
  }
  if (last.size === 0) return [];
  const profs = check(
    await db().from("profiles").select("id, username, avatar_url").in("id", Array.from(last.keys()))
  ) as any[];
  const list = Array.from(last.entries()).map(([other, m]) => {
    const p = (profs || []).find(x => x.id === other);
    return {
      id: other,
      profileId: other,
      username: p?.username || "membro",
      avatar: p?.avatar_url || DEFAULT_AVATAR,
      lastMessage: previewOf(m),
      time: timeAgo(m.created_at),
      unread: unread.get(other) || 0,
      pinned: !!prefs[other]?.pinned
    };
  });
  // fixadas primeiro, mantendo a ordem da mais recente
  return [...list.filter(t => t.pinned), ...list.filter(t => !t.pinned)];
}

function toMessage(m: any, uid: string): CloudMessage {
  return {
    id: m.id,
    text: m.text || undefined,
    image: m.image_url || undefined,
    reaction: m.reaction || undefined,
    sender: m.sender_id === uid ? "me" : "other",
    createdAt: m.created_at,
    postId: m.post_id || undefined,
    replyTo: m.reply_to || undefined,
    deleted: !!m.deleted_at,
    readAt: m.read_at || undefined
  };
}

export async function fetchMessages(otherId: string): Promise<CloudMessage[]> {
  const uid = await me();
  const prefs = await fetchDmPrefs().catch(() => ({} as Record<string, { pinned: boolean; clearedAt?: string }>));
  let q = db()
    .from("messages")
    .select("*")
    .or(`and(sender_id.eq.${uid},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${uid})`)
    .order("created_at", { ascending: true })
    .limit(500);
  const cleared = prefs[otherId]?.clearedAt;
  if (cleared) q = q.gt("created_at", cleared);
  const rows = check(await q) as any[];
  return (rows || []).map(m => toMessage(m, uid));
}

export async function sendMessage(
  otherId: string,
  msg: { text?: string; image?: string; postId?: string; replyTo?: string }
): Promise<CloudMessage> {
  const uid = await me();
  const image_url = msg.image ? await uploadImage(msg.image, "direct") : null;
  const row = check(
    await db()
      .from("messages")
      .insert({
        sender_id: uid,
        recipient_id: otherId,
        text: msg.text || null,
        image_url,
        post_id: msg.postId || null,
        reply_to: msg.replyTo || null
      })
      .select("*")
      .single()
  );
  return toMessage(row, uid);
}

export async function markThreadRead(otherId: string) {
  await db().rpc("mark_thread_read", { other: otherId });
}

export async function unreadMessagesCount(): Promise<number> {
  const uid = await me();
  const { count } = await db()
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", uid)
    .is("read_at", null);
  return count || 0;
}

export async function setReaction(messageId: string, emoji: string | null) {
  check(await db().rpc("react_message", { msg: messageId, emoji: emoji || "" }));
}

export async function deleteMessage(messageId: string) {
  check(await db().rpc("delete_message", { msg: messageId }));
}

// ---------------------------------------------------------------------
// Online e "digitando..." (Realtime Presence/Broadcast, sem gravar nada no banco)
// ---------------------------------------------------------------------
const onlineIds = new Set<string>();
const onlineListeners = new Set<(ids: Set<string>) => void>();
let presenceChannel: any = null;

/** entra no canal "online" (chamar depois do login). Retorna função para sair. */
export function startPresence(): () => void {
  const client = db();
  let stopped = false;
  cloudUserId().then(uid => {
    if (!uid || stopped || presenceChannel) return;
    const ch = client.channel("guvio-online", { config: { presence: { key: uid } } });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, unknown>;
      onlineIds.clear();
      Object.keys(state).forEach(k => onlineIds.add(k));
      onlineListeners.forEach(fn => fn(new Set(onlineIds)));
    }).subscribe((status: string) => {
      if (status === "SUBSCRIBED") ch.track({ at: Date.now() }).catch(() => {});
    });
    presenceChannel = ch;
  });
  return () => {
    stopped = true;
    if (presenceChannel) client.removeChannel(presenceChannel);
    presenceChannel = null;
    onlineIds.clear();
  };
}

export function subscribeOnline(fn: (ids: Set<string>) => void): () => void {
  onlineListeners.add(fn);
  fn(new Set(onlineIds));
  return () => {
    onlineListeners.delete(fn);
  };
}

/** canal só da conversa para avisar "digitando..." */
export function typingChannel(otherId: string, onTyping: (typing: boolean) => void) {
  const client = db();
  let uid: string | null = null;
  let ch: any = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSent = 0;
  cloudUserId().then(id => {
    uid = id;
    if (!id) return;
    const name = `typing-${[id, otherId].sort().join("-")}`;
    ch = client
      .channel(name, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, (msg: any) => {
        if (msg?.payload?.from !== otherId) return;
        onTyping(!!msg.payload.typing);
        if (timer) clearTimeout(timer);
        if (msg.payload.typing) timer = setTimeout(() => onTyping(false), 4000);
      })
      .subscribe();
  });
  return {
    /** chamar a cada letra digitada; manda no máximo 1 aviso a cada 2s */
    ping(typing = true) {
      if (!ch || !uid) return;
      const now = Date.now();
      if (typing && now - lastSent < 2000) return;
      lastSent = typing ? now : 0;
      ch.send({ type: "broadcast", event: "typing", payload: { from: uid, typing } }).catch?.(() => {});
    },
    stop() {
      if (timer) clearTimeout(timer);
      if (ch) client.removeChannel(ch);
    }
  };
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
  return (rows || []).map(r => ({ id: r.id, name: r.name, category: r.category, colorTag: r.color_tag, image: r.image_url, link: r.link || undefined }));
}

export async function addWardrobeItem(item: WardrobeItem): Promise<WardrobeItem> {
  const uid = await me();
  const image_url = await uploadImage(item.image, "wardrobe");
  const r = check(
    await db()
      .from("wardrobe_items")
      .insert({ user_id: uid, name: item.name, category: item.category, color_tag: item.colorTag, image_url, link: item.link || null })
      .select("*")
      .single()
  ) as any;
  return { id: r.id, name: r.name, category: r.category, colorTag: r.color_tag, image: r.image_url, link: r.link || undefined };
}

export async function updateWardrobeItem(item: WardrobeItem): Promise<WardrobeItem> {
  const image_url = await uploadImage(item.image, "wardrobe");
  const r = check(
    await db()
      .from("wardrobe_items")
      .update({ name: item.name, category: item.category, color_tag: item.colorTag, image_url, link: item.link || null })
      .eq("id", item.id)
      .select("*")
      .single()
  ) as any;
  return { id: r.id, name: r.name, category: r.category, colorTag: r.color_tag, image: r.image_url, link: r.link || undefined };
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
      .select("id, type, text, created_at, actor_id, post_id, actor:profiles!notifications_actor_id_fkey(username, avatar_url), post:posts(image_url)")
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
        : r.type === "reply"
        ? `respondeu seu comentário: ${r.text || ""}`
        : r.type === "comment_like"
        ? `curtiu seu comentário: ${r.text || ""}`
        : r.type === "follow_request"
        ? "pediu para seguir você."
        : r.type === "follow_accept"
        ? "aceitou seu pedido para seguir."
        : r.type === "story_mention"
        ? `marcou você num story: ${r.text || ""}`
        : r.type === "repost"
        ? "repostou seu look."
        : "começou a seguir você.",
    timeAgo: timeAgo(r.created_at),
    postImage: r.post?.image_url || undefined,
    postId: r.post_id || undefined,
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
    invalidateHidden();
    const r = await db().from("blocks").insert({ blocker_id: uid, blocked_id: targetId });
    if (r.error && r.error.code !== "23505") throw new Error(r.error.message);
    await setFollow(targetId, false).catch(() => {});
  } else {
    invalidateHidden();
    check(await db().from("blocks").delete().eq("blocker_id", uid).eq("blocked_id", targetId));
  }
}

// ---------------------------------------------------------------------
// Tempo real do feed
// ---------------------------------------------------------------------
export function subscribeFeed(handlers: {
  onNewPost?: (p: FeedPost) => void;
  onUpdatedPost?: (p: FeedPost) => void;
  onDeletedPost?: (id: string) => void;
  onLikesChanged?: (postId: string) => void;
  onCommentsChanged?: (postId: string) => void;
}): () => void {
  const client = db();
  const ch = client
    .channel(`feed-${Date.now()}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, async payload => {
      const row = payload.new as any;
      if (!row?.id || !handlers.onNewPost || row.archived) return;
      // não mostra posts de quem eu silenciei/bloqueei
      const hidden = await hiddenSets().catch(() => null);
      if (hidden && (hidden.users.has(row.user_id) || hidden.posts.has(row.id))) return;
      const p = await fetchPost(row.id).catch(() => null);
      if (p) handlers.onNewPost(p);
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "posts" }, async payload => {
      const row = payload.new as any;
      if (!row?.id) return;
      // arquivado (ou ficou invisível para mim): sai do feed; editado: atualiza legenda/cidade/peças
      if (row.archived) return handlers.onDeletedPost?.(row.id);
      if (!handlers.onUpdatedPost) return;
      const p = await fetchPost(row.id).catch(() => null);
      if (p) handlers.onUpdatedPost(p);
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

// ---------------------------------------------------------------------
// Apagar conta
// ---------------------------------------------------------------------
export async function deleteMyAccount() {
  const uid = await me();
  const bucket = db().storage.from("media");
  for (const folder of ["posts", "avatar", "stories", "direct", "wardrobe"]) {
    const { data } = await bucket.list(`${uid}/${folder}`, { limit: 1000 });
    const paths = (data || []).map(f => `${uid}/${folder}/${f.name}`);
    if (paths.length) await bucket.remove(paths);
  }
  check(await db().rpc("delete_my_account"));
}

// ---------------------------------------------------------------------
// Alertas em tempo real para mim (curtidas, comentários, seguidores, direct)
// ---------------------------------------------------------------------
async function usernameOf(id: string): Promise<string> {
  const { data } = await db().from("profiles").select("username").eq("id", id).maybeSingle();
  return (data as any)?.username || "alguém";
}

export function subscribeMyAlerts(
  onAlert: (title: string, body: string, kind: "activity" | "message", type?: string) => void
): () => void {
  const client = db();
  let ch: ReturnType<typeof client.channel> | null = null;
  let stopped = false;

  cloudUserId().then(uid => {
    if (!uid || stopped) return;
    ch = client
      .channel(`alerts-${uid}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        async payload => {
          const n: any = payload.new;
          const who = await usernameOf(n.actor_id);
          const emit = (t: string, b: string) => onAlert(t, b, "activity", n.type);
          if (n.type === "like") emit("Nova curtida ❤️", `@${who} curtiu seu look.`);
          else if (n.type === "comment") emit("Novo comentário 💬", `@${who}: ${n.text || ""}`);
          else if (n.type === "follow") emit("Novo seguidor ✨", `@${who} começou a seguir você.`);
          else if (n.type === "reply") emit("Nova resposta 💬", `@${who}: ${n.text || ""}`);
          else if (n.type === "comment_like") emit("Curtiram seu comentário ❤️", `@${who} curtiu: ${n.text || ""}`);
          else if (n.type === "follow_request") emit("Pedido para seguir 🔒", `@${who} quer seguir você.`);
          else if (n.type === "story_mention") emit("Você foi marcado 📸", `@${who} marcou você num story.`);
          else if (n.type === "repost") emit("Repost 🔁", `@${who} repostou seu look.`);
          else if (n.type === "follow_accept") emit("Pedido aceito ✅", `@${who} aceitou seu pedido.`);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${uid}` },
        async payload => {
          const m: any = payload.new;
          const who = await usernameOf(m.sender_id);
          onAlert(`@${who}`, m.text || (m.post_id ? "👗 Enviou um look" : "📷 Enviou uma foto"), "message");
        }
      )
      .subscribe();
  });

  return () => {
    stopped = true;
    if (ch) client.removeChannel(ch);
  };
}

// ---------------------------------------------------------------------
// Looks montados
// ---------------------------------------------------------------------
export async function fetchOutfits(): Promise<Outfit[]> {
  const uid = await me();
  const rows = check(
    await db().from("outfits").select("*").eq("user_id", uid).order("created_at", { ascending: false })
  ) as any[];
  return (rows || []).map(r => ({ id: r.id, name: r.name, itemIds: r.item_ids || [], createdAt: r.created_at }));
}

export async function saveOutfit(name: string, itemIds: string[]): Promise<Outfit> {
  const uid = await me();
  const r = check(
    await db().from("outfits").insert({ user_id: uid, name, item_ids: itemIds }).select("*").single()
  ) as any;
  return { id: r.id, name: r.name, itemIds: r.item_ids || [], createdAt: r.created_at };
}

export async function deleteOutfit(id: string) {
  check(await db().from("outfits").delete().eq("id", id));
}

// ---------------------------------------------------------------------
// Destaques de stories
// ---------------------------------------------------------------------
function toStory(r: any): StoryItem {
  return { id: r.id, image: r.image_url, caption: r.caption || undefined, overlay: r.overlay || null, timestamp: timeAgo(r.created_at), seen: true };
}

export async function fetchHighlights(userId: string): Promise<Highlight[]> {
  const rows = check(
    await db()
      .from("highlights")
      .select("id, title, cover_url, created_at, highlight_items(created_at, stories(id, image_url, caption, overlay, created_at))")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
  ) as any[];
  return (rows || []).map(h => {
    const stories = (h.highlight_items || [])
      .filter((i: any) => i.stories)
      .sort((a: any, b: any) => (a.stories.created_at < b.stories.created_at ? -1 : 1))
      .map((i: any) => toStory(i.stories));
    return { id: h.id, title: h.title, cover: h.cover_url || stories[0]?.image, stories };
  });
}

/** todos os meus stories (inclusive os que já passaram de 24h), para montar destaques */
export async function fetchMyStoryArchive(): Promise<StoryItem[]> {
  const uid = await me();
  const rows = check(
    await db().from("stories").select("id, image_url, caption, overlay, created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(200)
  ) as any[];
  return (rows || []).map(toStory);
}

export async function saveHighlight(input: { id?: string; title: string; storyIds: string[]; cover?: string }): Promise<string> {
  const uid = await me();
  let id = input.id;
  const cover_url = input.cover || null;
  if (id) check(await db().from("highlights").update({ title: input.title, cover_url }).eq("id", id));
  else {
    const r = check(await db().from("highlights").insert({ user_id: uid, title: input.title, cover_url }).select("id").single()) as any;
    id = r.id as string;
  }
  check(await db().from("highlight_items").delete().eq("highlight_id", id));
  if (input.storyIds.length) {
    check(await db().from("highlight_items").insert(input.storyIds.map(story_id => ({ highlight_id: id, story_id }))));
  }
  return id!;
}

export async function deleteHighlight(id: string) {
  check(await db().from("highlights").delete().eq("id", id));
}

// ---------------------------------------------------------------------
// Direct: fixar e apagar conversa (só para mim)
// ---------------------------------------------------------------------
export async function fetchDmPrefs(): Promise<Record<string, { pinned: boolean; clearedAt?: string }>> {
  const uid = await me();
  const rows = check(await db().from("dm_prefs").select("other_id, pinned, cleared_at").eq("user_id", uid)) as any[];
  const out: Record<string, { pinned: boolean; clearedAt?: string }> = {};
  (rows || []).forEach(r => (out[r.other_id] = { pinned: r.pinned, clearedAt: r.cleared_at || undefined }));
  return out;
}

async function upsertDmPref(otherId: string, patch: { pinned?: boolean; cleared_at?: string }) {
  const uid = await me();
  const cur = await db().from("dm_prefs").select("pinned, cleared_at").eq("user_id", uid).eq("other_id", otherId).maybeSingle();
  const row = { user_id: uid, other_id: otherId, pinned: (cur.data as any)?.pinned ?? false, cleared_at: (cur.data as any)?.cleared_at ?? null, ...patch };
  check(await db().from("dm_prefs").upsert(row, { onConflict: "user_id,other_id" }));
}

export async function setDmPinned(otherId: string, pinned: boolean) {
  await upsertDmPref(otherId, { pinned });
}

export async function clearConversation(otherId: string) {
  await upsertDmPref(otherId, { cleared_at: new Date().toISOString(), pinned: false });
}

// ---------------------------------------------------------------------
// Lista de desejos
// ---------------------------------------------------------------------
function toWish(r: any): WishlistItem {
  return { id: r.id, name: r.name, link: r.link || undefined, price: r.price || undefined, image: r.image_url || undefined, bought: !!r.bought };
}

export async function fetchWishlist(): Promise<WishlistItem[]> {
  const uid = await me();
  const rows = check(await db().from("wishlist_items").select("*").eq("user_id", uid).order("created_at", { ascending: false })) as any[];
  return (rows || []).map(toWish);
}

export async function saveWish(item: WishlistItem): Promise<WishlistItem> {
  const uid = await me();
  const image_url = item.image ? await uploadImage(item.image, "wishlist") : null;
  const data = { name: item.name.trim().slice(0, 80), link: item.link || null, price: item.price || null, image_url, bought: !!item.bought };
  const isNew = !item.id || item.id.startsWith("tmp-");
  const r = check(
    isNew
      ? await db().from("wishlist_items").insert({ ...data, user_id: uid }).select("*").single()
      : await db().from("wishlist_items").update(data).eq("id", item.id).select("*").single()
  );
  return toWish(r);
}

export async function deleteWish(id: string) {
  check(await db().from("wishlist_items").delete().eq("id", id));
}

// ---------------------------------------------------------------------
// Calendário de looks
// ---------------------------------------------------------------------
export async function fetchOutfitLog(fromDay: string, toDay: string): Promise<OutfitLogEntry[]> {
  const uid = await me();
  const rows = check(
    await db().from("outfit_log").select("day, item_ids, note").eq("user_id", uid).gte("day", fromDay).lte("day", toDay)
  ) as any[];
  return (rows || []).map(r => ({ day: r.day, itemIds: Array.isArray(r.item_ids) ? r.item_ids : [], note: r.note || "" }));
}

export async function saveOutfitLog(entry: OutfitLogEntry) {
  const uid = await me();
  check(
    await db()
      .from("outfit_log")
      .upsert({ user_id: uid, day: entry.day, item_ids: entry.itemIds, note: entry.note || "" }, { onConflict: "user_id,day" })
  );
}

export async function deleteOutfitLog(day: string) {
  const uid = await me();
  check(await db().from("outfit_log").delete().eq("user_id", uid).eq("day", day));
}


// =====================================================================
// MUTIRÃO 5
// =====================================================================
export async function votePoll(postId: string, option: number) {
  const uid = await me();
  check(await db().from("poll_votes").upsert({ post_id: postId, user_id: uid, option }, { onConflict: "post_id,user_id" }));
}

export async function ratePost(postId: string, value: 1 | -1 | 0) {
  const uid = await me();
  if (value === 0) check(await db().from("post_ratings").delete().eq("post_id", postId).eq("user_id", uid));
  else check(await db().from("post_ratings").upsert({ post_id: postId, user_id: uid, value }, { onConflict: "post_id,user_id" }));
}

/** repostar: novo post meu apontando para o original (mesmas fotos, minha legenda) */
export async function repost(original: FeedPost, caption: string): Promise<FeedPost> {
  const uid = await me();
  const srcId = original.repostOf || original.id;
  const row = check(
    await db()
      .from("posts")
      .insert({
        user_id: uid,
        image_url: original.image,
        images: (original.images || []).slice(1),
        caption,
        city: original.city,
        country: original.country,
        style_tag: original.styleTag,
        clothing_tags: original.clothingTags || [],
        kind: "repost",
        repost_of: srcId,
        video_url: original.videoUrl || null
      })
      .select("id")
      .single()
  ) as any;
  const post = await fetchPost(row.id);
  if (!post) throw new Error("Repost criado, mas não carregou.");
  return post;
}

export async function setPinnedComment(postId: string, commentId: string | null) {
  check(await db().from("posts").update({ pinned_comment_id: commentId }).eq("id", postId));
}

export async function fetchNearby(lat: number, lng: number, km = 60): Promise<FeedPost[]> {
  const [res, hidden] = await Promise.all([db().rpc("nearby_posts", { p_lat: lat, p_lng: lng, km, lim: 60 }), hiddenSets()]);
  return mapPosts(visible((check(res) as any[]) || [], hidden));
}

export async function markNotInterested(post: FeedPost) {
  const uid = await me();
  const r = await db().from("not_interested").insert({ user_id: uid, post_id: post.id, style_tag: post.styleTag, author_id: post.userId || null });
  if (r.error && r.error.code !== "23505") throw new Error(r.error.message);
}

export async function fetchNotInterested(): Promise<{ postIds: string[]; styles: string[]; authors: string[] }> {
  const uid = await me();
  const rows = (check(await db().from("not_interested").select("post_id, style_tag, author_id").eq("user_id", uid).limit(500)) as any[]) || [];
  return {
    postIds: rows.map(r => r.post_id),
    styles: rows.map(r => r.style_tag).filter(Boolean),
    authors: rows.map(r => r.author_id).filter(Boolean)
  };
}

export async function fetchTopCreators(sinceIso: string): Promise<(UserProfile & { weekLikes: number; weekPosts: number })[]> {
  const rows = (check(await db().rpc("top_creators", { since: sinceIso, lim: 10 })) as any[]) || [];
  return rows.map(r => ({ ...toProfile(r), weekLikes: r.likes, weekPosts: r.posts }));
}

/** looks com uma cor nas peças marcadas ou na legenda */
export async function searchByColor(color: string): Promise<FeedPost[]> {
  const c = color.trim().toLowerCase().replace(/[%,()]/g, "");
  if (!c) return [];
  const [res, hidden] = await Promise.all([
    db()
      .from("feed_posts")
      .select("*")
      .or(`tags_text.ilike.%${c}%,caption.ilike.%${c}%`)
      .order("created_at", { ascending: false })
      .limit(60),
    hiddenSets()
  ]);
  return mapPosts(visible(check(res) || [], hidden));
}

// ---------- melhores amigos ----------
export async function fetchCloseFriends(): Promise<string[]> {
  const uid = await me();
  const rows = (check(await db().from("close_friends").select("friend_id").eq("owner_id", uid)) as any[]) || [];
  return rows.map(r => r.friend_id);
}

export async function setCloseFriend(friendId: string, on: boolean) {
  const uid = await me();
  if (on) {
    const r = await db().from("close_friends").insert({ owner_id: uid, friend_id: friendId });
    if (r.error && r.error.code !== "23505") throw new Error(r.error.message);
  } else check(await db().from("close_friends").delete().eq("owner_id", uid).eq("friend_id", friendId));
}

// ---------- respostas aos stickers do story ----------
export async function respondStory(storyId: string, kind: "vote" | "answer", value: string) {
  const uid = await me();
  check(
    await db()
      .from("story_responses")
      .upsert({ story_id: storyId, user_id: uid, kind, value: value.slice(0, 300) }, { onConflict: "story_id,user_id,kind" })
  );
}

export async function fetchStoryResponses(storyId: string): Promise<{ userId: string; username: string; avatar: string; kind: "vote" | "answer"; value: string }[]> {
  const rows = (check(
    await db()
      .from("story_responses")
      .select("user_id, kind, value, created_at, profiles!story_responses_user_id_fkey(username, avatar_url)")
      .eq("story_id", storyId)
      .order("created_at", { ascending: false })
  ) as any[]) || [];
  return rows.map(r => ({ userId: r.user_id, username: r.profiles?.username || "membro", avatar: r.profiles?.avatar_url || "", kind: r.kind, value: r.value }));
}
