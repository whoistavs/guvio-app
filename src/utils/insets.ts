import { Platform, StatusBar } from "react-native";

/**
 * Espaço no topo das telas cheias (modais).
 * No Android novo o app é desenhado por baixo da barra de status, então soma a altura dela.
 */
export function topPad(other = 10): number {
  if (Platform.OS === "ios") return 50;
  if (Platform.OS === "android") return (StatusBar.currentHeight || 28) + 10;
  return other;
}
