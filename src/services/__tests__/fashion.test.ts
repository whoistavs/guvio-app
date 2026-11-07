import { currentChallenge, weekStart, CHALLENGES } from "../../data/challenges";
import { slotOf, suggestDailyLook } from "../../utils/dailyLook";
import { WardrobeItem } from "../../data/mockData";

const it_ = (id: string, name: string, category: string): WardrobeItem => ({ id, name, category, colorTag: "Preto", image: "" });
const wardrobe = [
  it_("1", "Camiseta branca", "Camisetas"),
  it_("2", "Calça jeans", "Calças"),
  it_("3", "Jaqueta de couro", "Casacos"),
  it_("4", "Tênis branco", "Calçados"),
  it_("5", "Short linho", "Shorts"),
  it_("6", "Sandália", "Calçados")
];

describe("desafio da semana", () => {
  it("é o mesmo de segunda a domingo e muda na segunda seguinte", () => {
    const mon = new Date(2026, 10, 2, 9), sun = new Date(2026, 10, 8, 22), nextMon = new Date(2026, 10, 9, 1);
    expect(weekStart(sun).getDate()).toBe(2);
    expect(currentChallenge(mon).tag).toBe(currentChallenge(sun).tag);
    expect(currentChallenge(nextMon).tag).not.toBe(currentChallenge(sun).tag);
    expect(currentChallenge(sun).daysLeft).toBe(1);
    expect(CHALLENGES.every(c => /^[a-z0-9]+$/.test(c.tag))).toBe(true);
  });
});

describe("look do dia", () => {
  it("classifica as peças", () => {
    expect(slotOf(wardrobe[0])).toBe("parteDeCima");
    expect(slotOf(wardrobe[2])).toBe("casaco");
    expect(slotOf(wardrobe[3])).toBe("calcado");
  });
  it("no frio inclui casaco; com chuva evita sandália", () => {
    const cold = suggestDailyLook(wardrobe, { temperature: 8, condition: "Chuva", isCold: true, isWarm: false });
    const names = cold.items.map(i => i.name);
    expect(names).toContain("Jaqueta de couro");
    expect(names).not.toContain("Sandália");
  });
  it("no calor prefere short e não põe casaco", () => {
    const hot = suggestDailyLook(wardrobe, { temperature: 31, condition: "Ensolarado", isCold: false, isWarm: true });
    const names = hot.items.map(i => i.name);
    expect(names).toContain("Short linho");
    expect(names).not.toContain("Jaqueta de couro");
  });
  it("é estável no mesmo dia e muda com outra variação", () => {
    const d = new Date(2026, 10, 7);
    const a = suggestDailyLook(wardrobe, null, 0, d).items.map(i => i.id).join();
    const b = suggestDailyLook(wardrobe, null, 0, d).items.map(i => i.id).join();
    expect(a).toBe(b);
    const variants = new Set([0, 1, 2, 3, 4, 5].map(v => suggestDailyLook(wardrobe, null, v, d).items.map(i => i.id).join()));
    expect(variants.size).toBeGreaterThan(1);
  });
});

import { computeWardrobeStats } from "../../utils/wardrobeStats";
describe("estatísticas do guarda-roupa", () => {
  it("conta usos por posts e looks e acha as esquecidas", () => {
    const posts: any[] = [{ id: "p", clothingTags: [{ id: "tag-1", name: "", brand: "", x: 0, y: 0 }, { id: "tag-4", name: "", brand: "", x: 0, y: 0 }] }];
    const outfits = [{ id: "o", name: "x", itemIds: ["1", "2"] }];
    const st = computeWardrobeStats(wardrobe, posts, outfits);
    expect(st.mostUsed[0]).toEqual({ item: wardrobe[0], uses: 2 });
    expect(st.forgotten.map(i => i.id).sort()).toEqual(["3", "5", "6"]);
    expect(st.byCategory.find(c => c.label === "Calçados")?.count).toBe(2);
  });
});
