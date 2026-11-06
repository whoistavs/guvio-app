import { Platform } from "react-native";
import * as Location from "expo-location";

export interface CurrentPlace {
  city: string;
  region: string;
  country: string;
  lat: number;
  lng: number;
}

let cached: CurrentPlace | null = null;

/** Localização atual do aparelho (cidade/país). Retorna null se o usuário negar. */
export async function getCurrentPlace(): Promise<CurrentPlace | null> {
  if (cached) return cached;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;
    const pos =
      (await Location.getLastKnownPositionAsync()) ||
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    if (!pos) return null;
    const { latitude: lat, longitude: lng } = pos.coords;

    let city = "";
    let region = "";
    let country = "";
    if (Platform.OS !== "web") {
      const [addr] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      city = addr?.city || addr?.subregion || addr?.district || "";
      region = addr?.region || "";
      country = addr?.country || "";
    }
    cached = { city, region, country, lat, lng };
    return cached;
  } catch (e) {
    return null;
  }
}
