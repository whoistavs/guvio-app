import { WardrobeItem } from "../data/mockData";
import { WeatherData } from "../services/weather";

export type Slot = "casaco" | "parteDeCima" | "parteDeBaixo" | "pecaUnica" | "calcado" | "acessorio" | "outro";

const has = (v: string, words: string[]) => {
  const t = v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return words.some(w => t.includes(w));
};

/** em que parte do corpo a peça vai, pela categoria e pelo nome */
export function slotOf(item: WardrobeItem): Slot {
  const t = `${item.category} ${item.name}`;
  if (has(t, ["vestido", "macacao", "macaquinho"])) return "pecaUnica";
  if (has(t, ["tenis", "sapato", "bota", "sandalia", "chinelo", "calcado", "mocassim", "salto", "rasteira"])) return "calcado";
  if (has(t, ["casaco", "jaqueta", "sobretudo", "blazer", "moletom", "cardigan", "sueter", "trench", "parka", "corta vento", "colete"])) return "casaco";
  if (has(t, ["calca", "short", "saia", "bermuda", "jeans", "legging"])) return "parteDeBaixo";
  if (has(t, ["camiseta", "camisa", "blusa", "top", "regata", "polo", "cropped", "body", "tricot"])) return "parteDeCima";
  if (has(t, ["bone", "bolsa", "oculos", "relogio", "colar", "brinco", "pulseira", "cinto", "chapeu", "acessorio", "mochila", "lenco", "cachecol", "gorro"])) return "acessorio";
  return "outro";
}

/** número pseudo-aleatório estável para a mesma "semente" */
function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function daySeed(d = new Date()) {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

export interface DailyLook {
  items: WardrobeItem[];
  reason: string;
}

/**
 * Sugere um look com as peças do guarda-roupa conforme o clima.
 * Mesmo dia + mesma variação = mesmo look (não muda toda vez que abre o app).
 */
export function suggestDailyLook(wardrobe: WardrobeItem[], weather?: WeatherData | null, variation = 0, date = new Date()): DailyLook {
  if (wardrobe.length === 0) return { items: [], reason: "Adicione peças ao guarda-roupa para receber sugestões." };
  const rnd = seeded(daySeed(date) * 31 + variation * 7919);
  const pick = <T,>(arr: T[]) => (arr.length ? arr[Math.floor(rnd() * arr.length)] : undefined);

  const temp = weather?.temperature;
  const cold = weather ? weather.isCold || weather.temperature < 16 : false;
  const hot = weather ? weather.isWarm && weather.temperature >= 26 : false;
  const rainy = weather ? has(weather.condition, ["chuva", "garoa", "tempestade", "neve"]) : false;

  const by: Record<Slot, WardrobeItem[]> = { casaco: [], parteDeCima: [], parteDeBaixo: [], pecaUnica: [], calcado: [], acessorio: [], outro: [] };
  wardrobe.forEach(i => by[slotOf(i)].push(i));

  // no calor evita bermuda longa/calça pesada quando há opção mais leve
  const bottoms = hot ? by.parteDeBaixo.filter(i => has(`${i.category} ${i.name}`, ["short", "saia", "bermuda"])) : [];
  const shoesDry = rainy ? by.calcado.filter(i => !has(`${i.category} ${i.name}`, ["sandalia", "chinelo", "rasteira"])) : [];

  const items: WardrobeItem[] = [];
  const useDress = by.pecaUnica.length > 0 && (by.parteDeCima.length === 0 || by.parteDeBaixo.length === 0 || rnd() < 0.3);
  if (useDress) items.push(pick(by.pecaUnica)!);
  else {
    const top = pick(by.parteDeCima);
    const bottom = pick(bottoms.length ? bottoms : by.parteDeBaixo);
    if (top) items.push(top);
    if (bottom) items.push(bottom);
  }
  if ((cold || rainy) && by.casaco.length) items.push(pick(by.casaco)!);
  else if (!hot && by.casaco.length && rnd() < 0.35) items.push(pick(by.casaco)!);
  const shoe = pick(shoesDry.length ? shoesDry : by.calcado);
  if (shoe) items.push(shoe);
  if (by.acessorio.length && rnd() < 0.5) items.push(pick(by.acessorio)!);
  if (items.length === 0) items.push(...wardrobe.slice(0, 3));

  const reason = !weather
    ? "Uma combinação do seu guarda-roupa para hoje."
    : cold
    ? `Está frio (${temp}°C): uma camada a mais para sair bem agasalhado.`
    : rainy
    ? `Previsão de ${weather.condition.toLowerCase()} (${temp}°C): calçado fechado e algo por cima.`
    : hot
    ? `Calor de ${temp}°C: peças leves e frescas.`
    : `Clima agradável (${temp}°C): confortável e com estilo.`;
  return { items: Array.from(new Set(items)), reason };
}
