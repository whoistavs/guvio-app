import { FeedPost, Outfit, WardrobeItem } from "../data/mockData";

export interface WardrobeStats {
  total: number;
  byCategory: { label: string; count: number }[];
  byColor: { label: string; count: number }[];
  mostUsed: { item: WardrobeItem; uses: number }[];
  forgotten: WardrobeItem[];
}

const key = (v: string) => v.trim().toLowerCase();

function groupCount(values: string[]) {
  const map = new Map<string, { label: string; count: number }>();
  values.forEach(v => {
    const k = key(v || "Outros");
    const cur = map.get(k);
    if (cur) cur.count++;
    else map.set(k, { label: (v || "Outros").trim(), count: 1 });
  });
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

/** uso = vezes em que a peça foi marcada nos meus posts + vezes em que aparece nos looks salvos */
export function computeWardrobeStats(items: WardrobeItem[], myPosts: FeedPost[], outfits: Outfit[]): WardrobeStats {
  const uses = new Map<string, number>();
  const bump = (id: string) => uses.set(id, (uses.get(id) || 0) + 1);
  myPosts.forEach(p =>
    (p.clothingTags || []).forEach(t => {
      const id = t.id.startsWith("tag-") ? t.id.slice(4) : t.id;
      if (items.some(i => i.id === id)) bump(id);
    })
  );
  outfits.forEach(o => o.itemIds.forEach(id => items.some(i => i.id === id) && bump(id)));
  const ranked = items
    .map(item => ({ item, uses: uses.get(item.id) || 0 }))
    .sort((a, b) => b.uses - a.uses);
  return {
    total: items.length,
    byCategory: groupCount(items.map(i => i.category)),
    byColor: groupCount(items.map(i => i.colorTag)),
    mostUsed: ranked.filter(r => r.uses > 0).slice(0, 5),
    forgotten: ranked.filter(r => r.uses === 0).map(r => r.item)
  };
}
