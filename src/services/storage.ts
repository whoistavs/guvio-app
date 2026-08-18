import AsyncStorage from "@react-native-async-storage/async-storage";
import { FeedPost, WardrobeItem, UserProfile } from "../data/mockData";

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
  try {
    const raw = await AsyncStorage.getItem(KEYS.POSTS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export async function savePosts(posts: FeedPost[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEYS.POSTS, JSON.stringify(posts));
  } catch (e) {}
}

export async function loadSavedWardrobe(userId?: string): Promise<WardrobeItem[]> {
  try {
    const key = userId ? `${KEYS.WARDROBE}_${userId}` : KEYS.WARDROBE;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export async function saveWardrobe(items: WardrobeItem[], userId?: string): Promise<void> {
  try {
    const key = userId ? `${KEYS.WARDROBE}_${userId}` : KEYS.WARDROBE;
    await AsyncStorage.setItem(key, JSON.stringify(items));
  } catch (e) {}
}

export async function loadSavedProfile(userId?: string): Promise<UserProfile> {
  try {
    const key = userId ? `${KEYS.PROFILE}_${userId}` : KEYS.PROFILE;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) {
      return {
        ...INITIAL_USER_PROFILE,
        username: userId ? userId.split("@")[0].replace(/[^a-zA-Z0-9._]/g, "") : "usuario"
      };
    }
    return JSON.parse(raw);
  } catch (e) {
    return INITIAL_USER_PROFILE;
  }
}

export async function saveProfile(profile: UserProfile, userId?: string): Promise<void> {
  try {
    const key = userId ? `${KEYS.PROFILE}_${userId}` : KEYS.PROFILE;
    await AsyncStorage.setItem(key, JSON.stringify(profile));
  } catch (e) {}
}

export async function loadDirectMessages(threadId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(`${KEYS.DIRECT_MSGS}_${threadId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export async function saveDirectMessages(threadId: string, msgs: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(`${KEYS.DIRECT_MSGS}_${threadId}`, JSON.stringify(msgs));
  } catch (e) {}
}
