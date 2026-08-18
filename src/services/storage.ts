import { FeedPost, WardrobeItem, UserProfile } from "../data/mockData";
import { FastStorage } from "./FastStorage";

const KEYS = {
  POSTS: "guvio_posts_v3",
  WARDROBE: "guvio_wardrobe_v3",
  PROFILE: "guvio_profile_v3",
  DIRECT_MSGS: "guvio_direct_msgs_v3"
};

export const INITIAL_USER_PROFILE: UserProfile = {
  id: "my-profile",
  username: "usuario",
  displayName: "Seu Perfil",
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200",
  location: "Brasil",
  followers: 0
};

export async function loadSavedPosts(): Promise<FeedPost[]> {
  return FastStorage.getItemSync(KEYS.POSTS, []);
}

export async function savePosts(posts: FeedPost[]): Promise<void> {
  FastStorage.setItemSync(KEYS.POSTS, posts);
}

export async function loadSavedWardrobe(userId?: string): Promise<WardrobeItem[]> {
  const key = userId ? `${KEYS.WARDROBE}_${userId}` : KEYS.WARDROBE;
  return FastStorage.getItemSync(key, []);
}

export async function saveWardrobe(items: WardrobeItem[], userId?: string): Promise<void> {
  const key = userId ? `${KEYS.WARDROBE}_${userId}` : KEYS.WARDROBE;
  FastStorage.setItemSync(key, items);
}

export async function loadSavedProfile(userId?: string): Promise<UserProfile> {
  const key = userId ? `${KEYS.PROFILE}_${userId}` : KEYS.PROFILE;
  const fallback = {
    ...INITIAL_USER_PROFILE,
    username: userId ? userId.split("@")[0].replace(/[^a-zA-Z0-9._]/g, "") : "usuario"
  };
  return FastStorage.getItemSync(key, fallback);
}

export async function saveProfile(profile: UserProfile, userId?: string): Promise<void> {
  const key = userId ? `${KEYS.PROFILE}_${userId}` : KEYS.PROFILE;
  FastStorage.setItemSync(key, profile);
}

export async function loadDirectMessages(threadId: string): Promise<string[]> {
  return FastStorage.getItemSync(`${KEYS.DIRECT_MSGS}_${threadId}`, []);
}

export async function saveDirectMessages(threadId: string, msgs: string[]): Promise<void> {
  FastStorage.setItemSync(`${KEYS.DIRECT_MSGS}_${threadId}`, msgs);
}
