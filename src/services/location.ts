import { Platform } from "react-native";
import * as Location from "expo-location";

export interface CurrentPlace {
  city: string;
  region: string;
  country: string;
  lat: number;
  lng: number;
}

export type LocationError = "denied" | "unavailable" | "unsupported" | null;

let cached: CurrentPlace | null = null;
let lastError: LocationError = null;

/** Motivo da última falha (para mostrar a dica certa ao usuário). */
export function lastLocationError(): LocationError {
  return lastError;
}

/** No navegador: pede a posição direto ao navegador (o expo-location falha no Safari/PWA). */
function webPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    const geo = typeof navigator !== "undefined" ? navigator.geolocation : undefined;
    if (!geo) {
      reject({ code: -1 });
      return;
    }
    geo.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 }
    );
  });
}

async function fetchJson(url: string, ms = 8000): Promise<any> {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : undefined;
  const t = setTimeout(() => ctrl?.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl?.signal });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/** Cidade a partir das coordenadas, no navegador (serviços gratuitos sem chave). */
async function webReverse(lat: number, lng: number): Promise<{ city: string; region: string; country: string }> {
  try {
    const d = await fetchJson(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=pt`
    );
    const city = d?.city || d?.locality || "";
    if (city) return { city, region: d?.principalSubdivision || "", country: d?.countryName || "" };
  } catch {
    // tenta o próximo
  }
  try {
    const d = await fetchJson(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=pt-BR&lat=${lat}&lon=${lng}`
    );
    const a = d?.address || {};
    return {
      city: a.city || a.town || a.village || a.municipality || a.county || "",
      region: a.state || "",
      country: a.country || ""
    };
  } catch {
    return { city: "", region: "", country: "" };
  }
}

/** Localização atual do aparelho (cidade/país). Retorna null se o usuário negar ou falhar. */
export async function getCurrentPlace(force = false): Promise<CurrentPlace | null> {
  if (cached && !force) return cached;
  lastError = null;

  if (Platform.OS === "web") {
    try {
      const { lat, lng } = await webPosition();
      const addr = await webReverse(lat, lng);
      cached = { ...addr, lat, lng };
      return cached;
    } catch (e: any) {
      lastError = e?.code === 1 ? "denied" : e?.code === -1 ? "unsupported" : "unavailable";
      return null;
    }
  }

  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      lastError = "denied";
      return null;
    }
    const pos =
      (await Location.getLastKnownPositionAsync()) ||
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    if (!pos) {
      lastError = "unavailable";
      return null;
    }
    const { latitude: lat, longitude: lng } = pos.coords;
    const [addr] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    cached = {
      city: addr?.city || addr?.subregion || addr?.district || "",
      region: addr?.region || "",
      country: addr?.country || "",
      lat,
      lng
    };
    return cached;
  } catch {
    lastError = "unavailable";
    return null;
  }
}
