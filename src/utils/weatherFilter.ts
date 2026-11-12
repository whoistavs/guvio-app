import { FeedPost } from "../data/mockData";

export type WeatherFilter = "chuva" | "frio" | "calor";

const WORDS: Record<WeatherFilter, RegExp> = {
  chuva: /(?:^|[^\p{L}])(chuva|chuvoso|chovendo|garoa|temporal|capa de chuva|guarda[- ]chuva|galocha|impermeável|impermeavel|corta[- ]vento)(?![\p{L}])/iu,
  frio: /(?:^|[^\p{L}])(frio|inverno|gelado|congelando|neve|casaco|sobretudo|cachecol|luvas?|gorro|tric[oô]|moletom|puffer|jaqueta|bota)(?![\p{L}])/iu,
  calor: /(?:^|[^\p{L}])(calor|ver[aã]o|praia|piscina|sol|quente|regata|bermuda|shorts?|sand[aá]lia|chinelo|biqu[ií]ni|vestido leve)(?![\p{L}])/iu
};

/** O look serve para esse tempo? Usa o clima salvo no post; sem ele, a legenda e as peças marcadas. */
export function matchesWeather(p: FeedPost, f: WeatherFilter): boolean {
  if (p.weather || typeof p.tempC === "number") {
    if (f === "chuva") return p.weather === "chuva" || p.weather === "neve";
    if (f === "frio") return (typeof p.tempC === "number" && p.tempC <= 15) || p.weather === "neve";
    return typeof p.tempC === "number" && p.tempC >= 24;
  }
  const text = [p.caption, p.styleTag, ...(p.clothingTags || []).map(t => `${t.name || ""} ${(t as any).category || ""}`)].join(" ");
  return WORDS[f].test(text);
}
