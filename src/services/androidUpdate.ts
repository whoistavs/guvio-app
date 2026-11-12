import { AppState, Linking, Platform } from "react-native";
import Constants from "expo-constants";
import { FastStorage } from "./FastStorage";
import { APK_URL } from "../components/InstallPrompt";

/**
 * App Android (APK): confere se saiu uma versão nova no link fixo do GitHub.
 * O build do APK publica "android-version.json" junto com o GUVIO.apk.
 */
const INFO_URL = APK_URL.replace(/GUVIO\.apk$/, "android-version.json");
const NOTIFIED_KEY = "guvio_android_update_notified_v1";
const EVERY = 30 * 60 * 1000;

export interface AndroidUpdate {
  versionCode: number;
  build: number;
  notes?: string;
}

/** número da versão instalada (100 + número do build) */
export function installedVersionCode(): number {
  const c: any = Constants.expoConfig || (Constants as any).manifest || {};
  return Number(c?.android?.versionCode || 0);
}

export async function fetchAndroidUpdate(): Promise<AndroidUpdate | null> {
  if (Platform.OS !== "android") return null;
  const mine = installedVersionCode();
  if (!mine) return null;
  try {
    const r = await fetch(`${INFO_URL}?t=${Date.now()}`, { cache: "no-store" } as any);
    if (!r.ok) return null;
    const j = (await r.json()) as AndroidUpdate;
    return j?.versionCode > mine ? j : null;
  } catch {
    return null;
  }
}

export function openApkDownload() {
  Linking.openURL(APK_URL).catch(() => {});
}

/** Avisa uma vez por versão com uma notificação no celular (tocar abre o download) */
async function notifyOnce(u: AndroidUpdate) {
  if (FastStorage.getItemSync(NOTIFIED_KEY, 0) >= u.versionCode) return;
  FastStorage.setItemSync(NOTIFIED_KEY, u.versionCode);
  try {
    const Notifications = await import("expo-notifications");
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;
    await Notifications.setNotificationChannelAsync("updates", {
      name: "Atualizações do app",
      importance: Notifications.AndroidImportance.HIGH
    });
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Nova versão do GUVIO",
        body: u.notes ? `Toque para baixar a atualização: ${u.notes}` : "Toque para baixar e instalar a atualização.",
        data: { url: APK_URL, kind: "android-update" }
      },
      trigger: { channelId: "updates" } as any
    });
  } catch {
    // sem notificação: o aviso dentro do app continua aparecendo
  }
}

let started = false;

/** Começa a conferir (ao abrir e ao voltar para o app). onUpdate mostra o aviso dentro do app. */
export function startAndroidUpdateCheck(onUpdate: (u: AndroidUpdate) => void) {
  if (Platform.OS !== "android" || started) return;
  started = true;
  let last = 0;
  const run = async () => {
    if (Date.now() - last < EVERY) return;
    last = Date.now();
    const u = await fetchAndroidUpdate();
    if (!u) return;
    onUpdate(u);
    notifyOnce(u);
  };
  setTimeout(run, 8000);
  AppState.addEventListener("change", st => st === "active" && run());

  // tocar na notificação abre o link do APK
  import("expo-notifications")
    .then(Notifications => {
      Notifications.addNotificationResponseReceivedListener(r => {
        const d: any = r.notification.request.content.data || {};
        if (d.kind === "android-update" || (typeof d.url === "string" && d.url.endsWith(".apk"))) openApkDownload();
      });
    })
    .catch(() => {});
}
