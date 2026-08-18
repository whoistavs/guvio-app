import { FeedPost, WardrobeItem } from "../data/mockData";
import { authConfigured } from "./auth";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export interface RealtimeSyncCallbacks {
  onNewPost?: (post: FeedPost) => void;
  onLikeUpdate?: (postId: string, newLikes: number) => void;
  onWardrobeSync?: (items: WardrobeItem[]) => void;
}

class RealtimeSyncManager {
  private active = false;
  private intervalId: any = null;
  private lastFetchTime = new Date().toISOString();

  startSocialFeedChannel(onNewPost?: (p: FeedPost) => void, onLikeUpdate?: (id: string, count: number) => void) {
    if (!authConfigured || !URL || !KEY) return;
    this.active = true;

    // Polling de alta frequência (a cada 4 segundos) simulando listener Realtime WebSocket do Supabase
    if (!this.intervalId) {
      this.intervalId = setInterval(async () => {
        try {
          const r = await fetch(`${URL}/rest/v1/posts?select=*&order=created_at.desc&limit=10`, {
            headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
          });
          if (r.ok) {
            const remotePosts = await r.json();
            if (Array.isArray(remotePosts) && remotePosts.length > 0) {
              remotePosts.forEach((rp: any) => {
                const formattedPost: FeedPost = {
                  id: rp.id,
                  creatorName: rp.creator_name || "Membro Guvio",
                  creatorAvatar: rp.creator_avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200",
                  city: rp.city || "São Paulo",
                  country: rp.country || "Brasil",
                  styleTag: rp.style_tag || "Estilo Urbano",
                  image: rp.image,
                  caption: rp.caption || "",
                  likes: rp.likes || 0,
                  commentsCount: rp.comments_count || 0,
                  timeAgo: "agora",
                  isLiked: false,
                  isSaved: false
                };
                if (onNewPost) onNewPost(formattedPost);
              });
            }
          }
        } catch (e) {}
      }, 4000);
    }
  }

  startWardrobeChannel(userId: string, onWardrobeSync?: (items: WardrobeItem[]) => void) {
    if (!authConfigured || !URL || !KEY || !userId) return;

    setInterval(async () => {
      try {
        const r = await fetch(`${URL}/rest/v1/wardrobe_items?select=*&user_id=eq.${encodeURIComponent(userId)}`, {
          headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
        });
        if (r.ok) {
          const remoteItems = await r.json();
          if (Array.isArray(remoteItems) && onWardrobeSync) {
            const formatted = remoteItems.map((ri: any) => ({
              id: ri.id,
              name: ri.name,
              category: ri.category,
              colorTag: ri.color_tag,
              image: ri.image
            }));
            onWardrobeSync(formatted);
          }
        }
      } catch (e) {}
    }, 6000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.active = false;
  }
}

export const RealtimeSync = new RealtimeSyncManager();
