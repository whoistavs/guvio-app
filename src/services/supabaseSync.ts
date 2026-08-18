import { authConfigured } from "./auth";
import { FeedPost, WardrobeItem, UserProfile } from "../data/mockData";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function supabaseFetch(table: string, method: string = "GET", body?: any) {
  if (!authConfigured || !URL || !KEY) return null;
  try {
    const r = await fetch(`${URL}/rest/v1/${table}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        Prefer: method === "POST" ? "return=representation" : "return=minimal"
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  }
}

export async function syncPostToCloud(post: FeedPost): Promise<void> {
  await supabaseFetch("posts", "POST", {
    id: post.id,
    creator_name: post.creatorName,
    creator_avatar: post.creatorAvatar,
    city: post.city,
    country: post.country,
    style_tag: post.styleTag,
    image: post.image,
    caption: post.caption,
    likes: post.likes,
    comments_count: post.commentsCount,
    created_at: new Date().toISOString()
  });
}

export async function syncWardrobeToCloud(item: WardrobeItem): Promise<void> {
  await supabaseFetch("wardrobe_items", "POST", {
    id: item.id,
    name: item.name,
    category: item.category,
    color_tag: item.colorTag,
    image: item.image,
    created_at: new Date().toISOString()
  });
}

export async function syncProfileToCloud(profile: UserProfile): Promise<void> {
  await supabaseFetch("profiles", "POST", {
    id: profile.id,
    username: profile.username,
    display_name: profile.displayName,
    avatar: profile.avatar,
    location: profile.location,
    updated_at: new Date().toISOString()
  });
}
