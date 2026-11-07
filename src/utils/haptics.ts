import { Platform } from "react-native";

/** Vibração leve do iPhone ao interagir. Não faz nada na web ou se não houver suporte. */
function haptics() {
  if (Platform.OS === "web") return null;
  try {
    return require("expo-haptics") as typeof import("expo-haptics");
  } catch (e) {
    return null;
  }
}

export function tapFeedback() {
  try {
    haptics()?.impactAsync(haptics()!.ImpactFeedbackStyle.Light);
  } catch (e) {}
}

export function likeFeedback() {
  try {
    haptics()?.impactAsync(haptics()!.ImpactFeedbackStyle.Medium);
  } catch (e) {}
}

export function successFeedback() {
  try {
    haptics()?.notificationAsync(haptics()!.NotificationFeedbackType.Success);
  } catch (e) {}
}
