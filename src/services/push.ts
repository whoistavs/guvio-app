import { Platform } from "react-native";
import { supabase } from "./supabase";
import { getSettings } from "./settings";

/**
 * Avisos no celular com o app fechado (push).
 * - Site/PWA (Android e iPhone com o site na tela de início): Web Push
 * - App Android (APK): Firebase Cloud Messaging, quando o google-services.json estiver no build
 * O envio é feito pelo servidor (função "push" do Supabase).
 */

// chave PÚBLICA do servidor de avisos (a privada fica só no Supabase)
export const VAPID_PUBLIC_KEY = "BH4MoBbfSU19Eu0R4TFOaCTO8KSSL9iDYB_pjOimyNQIfa74FK871Fgez4Nqs6pvAyWhOuKpdSWKOWFUOn8JMhI";

let currentEndpoint: string | null = null;

function b64ToBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

function prefsNow() {
  const st = getSettings();
  return {
    pauseAll: !!st.pauseAll,
    like: st.notify?.like !== false,
    comment: st.notify?.comment !== false,
    follow: st.notify?.follow !== false,
    message: st.notify?.message !== false
  };
}

/** O navegador/aparelho suporta push? (no iPhone, só com o site instalado na tela de início) */
export function webPushSupported(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function isStandalonePwa(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true;
}

export type PushState = "on" | "off" | "denied" | "unsupported" | "needs-install";

export async function webPushState(): Promise<PushState> {
  if (Platform.OS !== "web") return "unsupported";
  const ios = typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (!webPushSupported()) return ios && !isStandalonePwa() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === "granted" ? "on" : "off";
  } catch {
    return "off";
  }
}

async function saveSubscription(kind: "web" | "fcm", endpoint: string, p256dh: string | null, auth: string | null) {
  if (!supabase) return;
  const { error } = await supabase.rpc("save_push_subscription", { p_kind: kind, p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth });
  if (error) throw new Error(error.message);
  currentEndpoint = endpoint;
  await syncPushPrefs();
}

/** Liga os avisos no site. Precisa ser chamado num toque do usuário (exigência do iPhone). */
export async function enableWebPush(): Promise<PushState> {
  if (!webPushSupported()) return webPushState();
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "off";
  const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.ready);
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY) as any });
  }
  const j: any = sub.toJSON();
  await saveSubscription("web", sub.endpoint, j.keys?.p256dh || null, j.keys?.auth || null);
  return "on";
}

export async function disableWebPush(): Promise<void> {
  if (!webPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  if (supabase) await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe().catch(() => {});
  currentEndpoint = null;
}

/** Ao abrir o app: se os avisos já estão ligados, confirma a inscrição na conta atual */
export async function refreshPushRegistration(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (!webPushSupported() || Notification.permission !== "granted") return;
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (!sub) return;
      const j: any = sub.toJSON();
      await saveSubscription("web", sub.endpoint, j.keys?.p256dh || null, j.keys?.auth || null);
      return;
    }
    if (Platform.OS === "android") await registerAndroidPush();
  } catch {
    // push é um extra: nunca atrapalha o app
  }
}

/** App Android: pega o token do Firebase (só funciona se o build tiver o google-services.json) */
export async function registerAndroidPush(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  try {
    const Notifications = await import("expo-notifications");
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      const r = await Notifications.requestPermissionsAsync();
      if (r.status !== "granted") return false;
    }
    await Notifications.setNotificationChannelAsync("default", {
      name: "Avisos",
      importance: Notifications.AndroidImportance.HIGH
    });
    const tok = await Notifications.getDevicePushTokenAsync();
    if (!tok?.data) return false;
    await saveSubscription("fcm", String(tok.data), null, null);
    return true;
  } catch {
    return false;
  }
}

/** Manda para o servidor o que a pessoa quer receber (curtidas, comentários...) */
export async function syncPushPrefs(): Promise<void> {
  if (!supabase || !currentEndpoint) return;
  await supabase.from("push_subscriptions").update({ prefs: prefsNow() }).eq("endpoint", currentEndpoint);
}

/** Ao sair da conta: apaga a inscrição deste aparelho (o navegador continua inscrito para a próxima conta) */
export async function forgetPushDevice(): Promise<void> {
  if (!supabase) return;
  let endpoint = currentEndpoint;
  if (!endpoint && webPushSupported()) {
    const reg = await navigator.serviceWorker.getRegistration();
    endpoint = (await reg?.pushManager.getSubscription())?.endpoint || null;
  }
  if (endpoint) await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  currentEndpoint = null;
}
