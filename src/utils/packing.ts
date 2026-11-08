import { WardrobeItem } from "../data/mockData";
import { DayForecast } from "../services/weather";
import { slotOf, suggestDailyLook } from "./dailyLook";

export interface PackingPlan {
  days: { date: string; forecast: DayForecast; items: WardrobeItem[] }[];
  pieces: { item: WardrobeItem; days: number }[];
  tips: string[];
}

/** monta a mala: um look por dia (pelo clima de cada dia) e a lista de peças sem repetir */
export function planPacking(wardrobe: WardrobeItem[], forecast: DayForecast[]): PackingPlan {
  const days = forecast.map((f, i) => {
    const look = suggestDailyLook(wardrobe, f.weather, i + 1, new Date(f.date + "T12:00:00"));
    return { date: f.date, forecast: f, items: look.items };
  });
  const count = new Map<string, { item: WardrobeItem; days: number }>();
  days.forEach(d =>
    d.items.forEach(it => {
      const cur = count.get(it.id);
      if (cur) cur.days++;
      else count.set(it.id, { item: it, days: 1 });
    })
  );
  const order = ["casaco", "parteDeCima", "pecaUnica", "parteDeBaixo", "calcado", "acessorio", "outro"];
  const pieces = Array.from(count.values()).sort(
    (a, b) => order.indexOf(slotOf(a.item)) - order.indexOf(slotOf(b.item)) || b.days - a.days
  );
  const tips: string[] = [];
  const min = Math.min(...forecast.map(f => f.min));
  const max = Math.max(...forecast.map(f => f.max));
  if (forecast.some(f => f.rainChance >= 50)) tips.push("Leve guarda-chuva ou jaqueta impermeável: tem chuva na previsão.");
  if (min <= 8) tips.push(`Mínima de ${min}°C: cachecol, luvas e uma segunda camada.`);
  if (max >= 28) tips.push(`Máxima de ${max}°C: óculos de sol, protetor e peças leves.`);
  if (forecast.length >= 5) tips.push("Viagem longa: peças coringa que combinam entre si economizam espaço.");
  if (!wardrobe.some(i => slotOf(i) === "calcado")) tips.push("Cadastre seus calçados no guarda-roupa para eles entrarem na mala.");
  return { days, pieces, tips };
}
