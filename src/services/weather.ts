export interface WeatherData {
  temperature: number;
  condition: string;
  isCold: boolean;
  isWarm: boolean;
}

const WEATHER_CODES: Record<number, string> = {
  0: "Ensolarado",
  1: "Predominantemente Ensolarado",
  2: "Parcialmente Nublado",
  3: "Nublado",
  45: "Nevoeiro",
  48: "Nevoeiro com Geada",
  51: "Garoa Leve",
  53: "Garoa Moderada",
  55: "Garoa Densa",
  61: "Chuva Leve",
  63: "Chuva Moderada",
  65: "Chuva Forte",
  71: "Neve Leve",
  73: "Neve Moderada",
  75: "Neve Forte",
  80: "Pancadas de Chuva Leves",
  81: "Pancadas de Chuva Moderadas",
  82: "Pancadas de Chuva Violentas",
  95: "Tempestade",
  96: "Tempestade com Granizo"
};

const cache: Record<string, WeatherData> = {};

export async function fetchCityWeather(lat: number, lon: number): Promise<WeatherData> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  if (cache[key]) return cache[key];

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Falha ao obter clima");
    const data = await res.json();
    const current = data.current_weather;
    const temp = Math.round(current.temperature);
    const code = current.weathercode;
    const condition = WEATHER_CODES[code] || "Tempo Limpo";

    const weather: WeatherData = {
      temperature: temp,
      condition,
      isCold: temp < 18,
      isWarm: temp >= 22
    };

    cache[key] = weather;
    return weather;
  } catch (error) {
    return {
      temperature: 23,
      condition: "Ensolarado",
      isCold: false,
      isWarm: true
    };
  }
}

// ---------------------------------------------------------------------
// Mala de viagem: busca a cidade e a previsão dos próximos dias
// ---------------------------------------------------------------------
export interface Place {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

export interface DayForecast {
  date: string; // AAAA-MM-DD
  min: number;
  max: number;
  rainChance: number;
  condition: string;
  weather: WeatherData;
}

/** procura cidades pelo nome (Open-Meteo, grátis e sem chave) */
export async function searchPlaces(name: string): Promise<Place[]> {
  const q = name.trim();
  if (q.length < 2) return [];
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=pt&format=json`
  );
  if (!res.ok) throw new Error("Não foi possível buscar a cidade.");
  const data = await res.json();
  return (data.results || []).map((r: any) => ({
    name: r.name,
    country: r.country || "",
    lat: r.latitude,
    lon: r.longitude
  }));
}

/** previsão diária (até 16 dias à frente) */
export async function fetchForecast(lat: number, lon: number, startOffset: number, days: number): Promise<DayForecast[]> {
  const total = Math.min(16, startOffset + days);
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=${total}&timezone=auto`
  );
  if (!res.ok) throw new Error("Não foi possível buscar a previsão.");
  const d = (await res.json()).daily || {};
  const out: DayForecast[] = [];
  for (let i = startOffset; i < (d.time || []).length && out.length < days; i++) {
    const max = Math.round(d.temperature_2m_max[i]);
    const min = Math.round(d.temperature_2m_min[i]);
    const rain = d.precipitation_probability_max?.[i] ?? 0;
    const cond = WEATHER_CODES[d.weathercode[i]] || "Tempo Limpo";
    const avg = Math.round((max + min) / 2);
    out.push({
      date: d.time[i],
      min,
      max,
      rainChance: rain,
      condition: cond,
      weather: { temperature: avg, condition: rain >= 60 && !/chuva|garoa|tempestade/i.test(cond) ? "Chuva provável" : cond, isCold: avg < 16, isWarm: max >= 26 }
    });
  }
  return out;
}
