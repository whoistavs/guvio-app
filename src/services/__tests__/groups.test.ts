import { groupActivities, groupMessage } from "../../utils/groupActivities";
import { trendingFromCaptions } from "../storage";
import { computeAchievements } from "../../utils/achievements";

const a = (id: string, type: any, userId: string, postId?: string, cat: any = "today") => ({
  id, type, userId, username: userId, userAvatar: "", message: type === "like" ? "curtiu seu look." : "comentou: oi", timeAgo: "", postId, timeCategory: cat
});

describe("notificações agrupadas", () => {
  it("junta curtidas do mesmo post e mantém comentários separados", () => {
    const g = groupActivities([
      a("1", "like", "ana", "p1"), a("2", "like", "bia", "p1"), a("3", "like", "leo", "p1"),
      a("4", "comment", "bia", "p1"), a("5", "like", "ana", "p2"), a("6", "like", "bia", "p1", "week")
    ]);
    expect(g).toHaveLength(4);
    expect(groupMessage(g[0])).toBe("e mais 2 pessoas curtiram seu look.");
    expect(g[1].lead.type).toBe("comment");
    expect(groupMessage(g[2])).toBe("curtiu seu look.");
  });
  it("não conta a mesma pessoa duas vezes", () => {
    const g = groupActivities([a("1", "follow", "ana"), a("2", "follow", "ana"), a("3", "follow", "bia")]);
    expect(g).toHaveLength(1);
    expect(groupMessage(g[0])).toBe("e @bia começaram a seguir você.");
  });
});

describe("hashtags em alta", () => {
  it("conta cada post uma vez e ordena", () => {
    const t = trendingFromCaptions([
      { caption: "#verão #look #verão", likes: 0 },
      { caption: "meu #look de hoje", likes: 10 },
      { caption: "#Look", likes: 0 },
      { caption: "sem tag", likes: 99 }
    ]);
    expect(t[0]).toEqual({ tag: "look", count: 3 });
    expect(t.find(x => x.tag === "verão")?.count).toBe(1);
  });
});

describe("conquistas", () => {
  it("dá as insígnias certas", () => {
    const posts: any[] = [
      { city: "Lisboa", country: "Portugal", likes: 60, caption: "#monocromatico" },
      { city: "Porto", country: "Portugal", likes: 1, caption: "" },
      { city: "Madrid", country: "Espanha", likes: 2, caption: "" }
    ];
    const ids = computeAchievements({ id: "u", username: "u", displayName: "", avatar: "", location: "", followers: 120 }, posts).map(x => x.id);
    expect(ids).toEqual(["first", "traveler", "loved", "popular", "challenger"]);
  });
});
