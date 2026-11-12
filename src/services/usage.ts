import { AppState, Platform } from "react-native";
import { FastStorage } from "./FastStorage";

/** Tempo de uso do app por dia, guardado só no aparelho: { "2026-11-12": segundos } */
const KEY = "guvio_usage_v1";
const KEEP_DAYS = 35;

export function dayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

let startedAt: number | null = null;
let started = false;

function flush() {
  if (startedAt === null || !FastStorage.ready) return;
  const now = Date.now();
  const secs = Math.min(Math.round((now - startedAt) / 1000), 60 * 60 * 6);
  startedAt = now;
  if (secs <= 0) return;
  const data = FastStorage.getItemSync<Record<string, number>>(KEY, {});
  const k = dayKey();
  data[k] = (data[k] || 0) + secs;
  // mantém só as últimas semanas
  const keys = Object.keys(data).sort();
  while (keys.length > KEEP_DAYS) delete data[keys.shift() as string];
  FastStorage.setItemSync(KEY, data);
}

function pause() {
  flush();
  startedAt = null;
}

function resume() {
  if (startedAt === null) startedAt = Date.now();
}

/** Começa a contar o tempo com o app aberto (pausa em segundo plano). Chamar uma vez. */
export function startUsageTracking() {
  if (started) return;
  started = true;
  resume();
  AppState.addEventListener("change", st => (st === "active" ? resume() : pause()));
  if (Platform.OS === "web" && typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => (document.hidden ? pause() : resume()));
    window.addEventListener("pagehide", pause);
  }
  // grava de tempos em tempos, para não perder se o app for fechado de repente
  setInterval(() => {
    if (startedAt !== null) flush();
  }, 30000);
}

/** Últimos 7 dias (do mais antigo para hoje), em minutos. */
export function usageLastDays(n = 7): { day: string; label: string; minutes: number }[] {
  flush();
  const data = FastStorage.getItemSync<Record<string, number>>(KEY, {});
  const names = ["D", "S", "T", "Q", "Q", "S", "S"];
  const out: { day: string; label: string; minutes: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = dayKey(d);
    out.push({ day: k, label: i === 0 ? "Hoje" : names[d.getDay()], minutes: Math.round((data[k] || 0) / 60) });
  }
  return out;
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
