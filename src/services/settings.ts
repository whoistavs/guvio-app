import { FastStorage } from "./FastStorage";

/** Preferências do app guardadas no aparelho */
export type NotifKind = "like" | "comment" | "follow" | "message" | "story";

export interface AppSettings {
  dataSaver: boolean;
  notify: Record<NotifKind, boolean>;
  pauseAll: boolean;
}

const KEY = "guvio_settings_v1";
const DEFAULTS: AppSettings = {
  dataSaver: false,
  pauseAll: false,
  notify: { like: true, comment: true, follow: true, message: true, story: true }
};

let cache: AppSettings | null = null;

export function getSettings(): AppSettings {
  if (cache) return cache;
  const saved = (FastStorage.getItemSync(KEY, null) as Partial<AppSettings> | null) || {};
  cache = { ...DEFAULTS, ...saved, notify: { ...DEFAULTS.notify, ...(saved.notify || {}) } };
  return cache;
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const cur = getSettings();
  cache = { ...cur, ...patch, notify: { ...cur.notify, ...(patch.notify || {}) } };
  FastStorage.setItemSync(KEY, cache);
  return cache;
}

/** este tipo de aviso deve aparecer? (curtida, comentário, seguidor, mensagem) */
export function shouldNotify(kind: NotifKind): boolean {
  const s = getSettings();
  return !s.pauseAll && s.notify[kind] !== false;
}

export function isDataSaver(): boolean {
  return getSettings().dataSaver;
}
