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
