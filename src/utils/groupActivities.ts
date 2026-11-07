import { ActivityItem } from "../data/mockData";

export interface ActivityGroup {
  key: string;
  lead: ActivityItem;
  others: ActivityItem[];
}

const GROUPABLE = new Set(["like", "comment_like", "follow"]);

/**
 * Junta avisos parecidos: "ana e mais 3 curtiram seu look".
 * Agrupa curtidas do mesmo post, curtidas de comentário do mesmo post e novos seguidores,
 * dentro do mesmo período (hoje / esta semana). Comentários e respostas ficam separados.
 */
export function groupActivities(items: ActivityItem[]): ActivityGroup[] {
  const out: ActivityGroup[] = [];
  const index = new Map<string, ActivityGroup>();
  for (const it of items) {
    if (!GROUPABLE.has(it.type)) {
      out.push({ key: it.id, lead: it, others: [] });
      continue;
    }
    const k = `${it.type}|${it.postId || ""}|${it.timeCategory}`;
    const g = index.get(k);
    if (g) {
      if (g.lead.userId !== it.userId && !g.others.some(o => o.userId === it.userId)) g.others.push(it);
    } else {
      const ng = { key: k, lead: it, others: [] as ActivityItem[] };
      index.set(k, ng);
      out.push(ng);
    }
  }
  return out;
}

export function groupMessage(g: ActivityGroup): string {
  const n = g.others.length;
  if (!n) return g.lead.message;
  const more = n === 1 ? `e @${g.others[0].username}` : `e mais ${n} pessoas`;
  switch (g.lead.type) {
    case "like":
      return `${more} curtiram seu look.`;
    case "comment_like":
      return `${more} curtiram seu comentário.`;
    case "follow":
      return `${more} começaram a seguir você.`;
    default:
      return g.lead.message;
  }
}
