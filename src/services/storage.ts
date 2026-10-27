import { FeedPost, WardrobeItem, UserProfile, UserStoryGroup, ActivityItem, INITIAL_STORIES, MOCK_ACTIVITIES, MOCK_PROFILES } from "../data/mockData";
import { FastStorage } from "./FastStorage";

const KEYS = {
  POSTS: "guvio_posts_v4",
  WARDROBE: "guvio_wardrobe_v4",
  PROFILE: "guvio_profile_v4",
  DIRECT_MSGS: "guvio_direct_msgs_v4",
  FOLLOWED_USERS: "guvio_followed_users_v4",
  STORIES: "guvio_stories_v4",
  ACTIVITIES: "guvio_activities_v4",
  SAVED_POST_IDS: "guvio_saved_post_ids_v4",
  REGISTERED_USERS: "guvio_registered_users_v4"
};

export const INITIAL_USER_PROFILE: UserProfile = {
  id: "my-profile",
  username: "usuario",
  displayName: "Seu Perfil",
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200",
  location: "São Paulo, Brasil",
  followers: 142,
  following: 89,
  postsCount: 0,
  bio: "Amante da moda minimalista e composições contemporâneas ✨",
  website: "guvio.app/@usuario"
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

// All Community Profiles (Mocks + Registered Users)
export async function loadAllRegisteredProfiles(): Promise<UserProfile[]> {
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

export async function loadSavedProfile(userId?: string): Promise<UserProfile> {
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

export async function saveProfile(profile: UserProfile, userId?: string): Promise<void> {
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
}

export async function loadDirectMessages(threadId: string): Promise<string[]> {
  return FastStorage.getItemSync(`${KEYS.DIRECT_MSGS}_${threadId}`, []);
}

export async function saveDirectMessages(threadId: string, msgs: string[]): Promise<void> {
  FastStorage.setItemSync(`${KEYS.DIRECT_MSGS}_${threadId}`, msgs);
}

// Social Follow Storage
export async function loadFollowedUsers(): Promise<string[]> {
  return FastStorage.getItemSync(KEYS.FOLLOWED_USERS, ["p-elena"]);
}

export async function saveFollowedUsers(userIds: string[]): Promise<void> {
  FastStorage.setItemSync(KEYS.FOLLOWED_USERS, userIds);
}

// Stories Storage
export async function loadStories(): Promise<UserStoryGroup[]> {
  return FastStorage.getItemSync(KEYS.STORIES, INITIAL_STORIES);
}

export async function saveStories(stories: UserStoryGroup[]): Promise<void> {
  FastStorage.setItemSync(KEYS.STORIES, stories);
}

// Activity / Notifications Storage
export async function loadActivities(): Promise<ActivityItem[]> {
  return FastStorage.getItemSync(KEYS.ACTIVITIES, MOCK_ACTIVITIES);
}

export async function saveActivities(activities: ActivityItem[]): Promise<void> {
  FastStorage.setItemSync(KEYS.ACTIVITIES, activities);
}
