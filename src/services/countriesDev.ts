export type GeoSearchItem = {
  id: string;
  label: string;
  subtitle: string;
  type: "city" | "country" | "region";
  lat: number;
  lon: number;
  countryCode?: string;
  countryName?: string;
};

type CountriesDevPlace = {
  geonameId: number;
  name: string;
  asciiName?: string;
  countryCode: string;
  admin1Code?: string;
  latitude: number;
  longitude: number;
  population?: number;
  timezone?: string;
  featureCode?: string;
};

type CountriesDevCountry = {
  name: string;
  alpha2Code: string;
  alpha3Code?: string;
  capital?: string;
  latlng?: [number, number] | number[];
};

const BASE_URL = "https://countries.dev";

async function readJsonOrEmpty<T>(response: Response): Promise<T[]> {
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`countries.dev: ${response.status}`);
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function searchCountriesDev(query: string): Promise<GeoSearchItem[]> {
  const input = query.trim();
  if (input.length < 2) return [];

  const encoded = encodeURIComponent(input);

  const [cities, populatedPlaces, countries] = await Promise.all([
    fetch(`${BASE_URL}/cities?q=${encoded}&limit=8`)
      .then((r) => readJsonOrEmpty<CountriesDevPlace>(r))
      .catch(() => [] as CountriesDevPlace[]),
    fetch(`${BASE_URL}/places?q=${encoded}&class=P&limit=10`)
      .then((r) => readJsonOrEmpty<CountriesDevPlace>(r))
      .catch(() => [] as CountriesDevPlace[]),
    fetch(`${BASE_URL}/name/${encoded}`)
      .then((r) => readJsonOrEmpty<CountriesDevCountry>(r))
      .catch(() => [] as CountriesDevCountry[]),
  ]);

  const countryNameByCode = new Map<string, string>();
  for (const country of countries) {
    if (country.alpha2Code) countryNameByCode.set(country.alpha2Code.toUpperCase(), country.name);
  }

  const countryItems: GeoSearchItem[] = countries
    .filter((c) => Array.isArray(c.latlng) && c.latlng.length >= 2)
    .slice(0, 4)
    .map((c) => ({
      id: `country-${c.alpha2Code}`,
      label: c.name,
      subtitle: "País",
      type: "country",
      lat: Number(c.latlng![0]),
      lon: Number(c.latlng![1]),
      countryCode: c.alpha2Code,
      countryName: c.name,
    }));

  const cityPool = [...cities, ...populatedPlaces];
  const cityItems: GeoSearchItem[] = cityPool.slice(0, 14).map((city) => {
    const code = city.countryCode?.toUpperCase();
    const countryName = countryNameByCode.get(code) || code;
    return {
      id: `city-${city.geonameId}`,
      label: city.name,
      subtitle: countryName || "Cidade",
      type: "city",
      lat: Number(city.latitude),
      lon: Number(city.longitude),
      countryCode: code,
      countryName,
    };
  });

  const combined = [...countryItems, ...cityItems];
  const seen = new Set<string>();
  return combined.filter((item) => {
    const key = `${item.type}:${item.label.toLowerCase()}:${item.countryCode ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);
}
