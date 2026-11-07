import { WardrobeItem } from "../data/mockData";
import { slotOf } from "./dailyLook";

/** Cores em português → matiz (0–360) ou neutra. Inclui nomes comuns de moda. */
const COLORS: { names: string[]; hue: number | null; label: string; hex: string }[] = [
  { names: ["preto", "preta", "black"], hue: null, label: "Preto", hex: "#111111" },
  { names: ["branco", "branca", "off white", "offwhite", "white"], hue: null, label: "Branco", hex: "#F4F4F4" },
  { names: ["cinza", "grafite", "chumbo", "mescla"], hue: null, label: "Cinza", hex: "#8A8A8A" },
  { names: ["bege", "areia", "creme", "nude", "cru", "off"], hue: null, label: "Bege", hex: "#D9C3A0" },
  { names: ["marrom", "caramelo", "chocolate", "camel", "café", "cafe", "terroso"], hue: null, label: "Marrom", hex: "#7A4F2E" },
  { names: ["marinho", "navy"], hue: null, label: "Azul-marinho", hex: "#1F2D5A" },
  { names: ["jeans", "denim"], hue: null, label: "Jeans", hex: "#4A6C9B" },
  { names: ["vermelho", "vermelha", "red"], hue: 0, label: "Vermelho", hex: "#D93A3A" },
  { names: ["vinho", "bordo", "bordô", "marsala"], hue: 345, label: "Vinho", hex: "#7B1E34" },
  { names: ["rosa", "pink"], hue: 330, label: "Rosa", hex: "#F07FB0" },
  { names: ["laranja", "coral", "terracota"], hue: 25, label: "Laranja", hex: "#F28C28" },
  { names: ["amarelo", "amarela", "mostarda", "dourado"], hue: 50, label: "Amarelo", hex: "#F2C230" },
  { names: ["verde", "oliva", "militar", "musgo"], hue: 120, label: "Verde", hex: "#3E9B5B" },
  { names: ["azul", "royal", "celeste", "turquesa", "blue"], hue: 215, label: "Azul", hex: "#3B6FD8" },
  { names: ["roxo", "roxa", "lilás", "lilas", "lavanda", "violeta"], hue: 275, label: "Roxo", hex: "#8152C9" }
];

const norm = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function colorInfo(name: string) {
  const n = norm(name || "");
  // nomes compostos: o mais específico primeiro ("azul-marinho" é marinho, não azul)
  const sorted = [...COLORS].sort((a, b) => Math.max(...b.names.map(x => x.length)) - Math.max(...a.names.map(x => x.length)));
  for (const c of COLORS.filter(c => c.hue === null && c.names.some(x => n.includes(norm(x))))) return c;
  for (const c of sorted) if (c.names.some(x => n.includes(norm(x)))) return c;
  return null;
}

const hueDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** nota de 0 a 100: quanto duas cores combinam */
export function colorScore(a: string, b: string): number {
  const ca = colorInfo(a), cb = colorInfo(b);
  if (!ca || !cb) return 55; // cor desconhecida: neutro
  if (ca.hue === null && cb.hue === null) return ca.label === cb.label ? 70 : 85; // neutras combinam entre si
  if (ca.hue === null || cb.hue === null) return 90; // neutra + cor: clássico
  const d = hueDist(ca.hue, cb.hue);
  if (d === 0) return 75; // tom sobre tom
  if (d <= 45) return 82; // análogas
  if (Math.abs(d - 180) <= 35) return 88; // complementares
  if (Math.abs(d - 120) <= 25) return 68; // tríade
  return 40;
}

export function matchReason(a: string, b: string): string {
  const ca = colorInfo(a), cb = colorInfo(b);
  if (!ca || !cb) return "Combinação segura";
  if (ca.hue === null && cb.hue === null) return "Neutras combinam entre si";
  if (ca.hue === null || cb.hue === null) return "Neutra + cor: clássico";
  const d = hueDist(ca.hue, cb.hue);
  if (d === 0) return "Tom sobre tom";
  if (d <= 45) return "Cores vizinhas (análogas)";
  if (Math.abs(d - 180) <= 35) return "Cores opostas (complementares)";
  if (Math.abs(d - 120) <= 25) return "Tríade de cores";
  return "Contraste ousado";
}

/** peças que combinam com uma peça (de outras partes do corpo), da melhor para a pior */
export function suggestMatches(item: WardrobeItem, wardrobe: WardrobeItem[]) {
  const slot = slotOf(item);
  return wardrobe
    .filter(w => w.id !== item.id && (slotOf(w) !== slot || slot === "acessorio" || slot === "outro"))
    .map(w => ({ item: w, score: colorScore(item.colorTag, w.colorTag), reason: matchReason(item.colorTag, w.colorTag) }))
    .filter(m => m.score >= 60)
    .sort((a, b) => b.score - a.score);
}

/** paleta do guarda-roupa: cores que você mais tem e cores que combinariam e ainda faltam */
export function wardrobePalette(wardrobe: WardrobeItem[]) {
  const count = new Map<string, { label: string; hex: string; hue: number | null; n: number }>();
  wardrobe.forEach(w => {
    const c = colorInfo(w.colorTag);
    if (!c) return;
    const cur = count.get(c.label) || { label: c.label, hex: c.hex, hue: c.hue, n: 0 };
    cur.n++;
    count.set(c.label, cur);
  });
  const have = Array.from(count.values()).sort((a, b) => b.n - a.n);
  const accents = have.filter(c => c.hue !== null);
  const haveLabels = new Set(have.map(h => h.label));
  let suggest: typeof COLORS;
  if (!accents.length) {
    // só neutras: sugere cores que dão vida sem brigar com neutros
    suggest = COLORS.filter(c => ["Azul", "Vinho", "Verde", "Amarelo"].includes(c.label));
  } else {
    const main = accents[0].hue!;
    suggest = COLORS.filter(c => c.hue !== null && (Math.abs(hueDist(c.hue, main) - 180) <= 40 || (hueDist(c.hue, main) <= 45 && hueDist(c.hue, main) > 0)));
    if (!have.some(h => h.hue === null)) suggest = [...COLORS.filter(c => ["Preto", "Branco", "Bege"].includes(c.label)), ...suggest];
  }
  return {
    have,
    missing: suggest.filter(c => !haveLabels.has(c.label)).slice(0, 4).map(c => ({ label: c.label, hex: c.hex })),
    neutralShare: wardrobe.length ? Math.round((have.filter(h => h.hue === null).reduce((a, h) => a + h.n, 0) / wardrobe.length) * 100) : 0
  };
}

export const COLOR_CHIPS = COLORS.filter(c => !["Jeans"].includes(c.label)).map(c => ({ label: c.label, hex: c.hex, term: c.names[0] }));
