import { useEffect, useState } from "react";
import { FastStorage } from "./FastStorage";

/**
 * Modo desenvolvedor (só na fase beta): liga tocando 10 vezes no logo da Home.
 * Dá acesso às ferramentas de teste e a recursos guardados para o futuro.
 * NÃO dá poderes de administrador (isso só pelo Painel do criador / banco).
 */
export const BETA = true;

const KEY = "guvio_dev_mode_v1";
const FLAGS_KEY = "guvio_dev_flags_v1";

/** recursos que ficam desligados por enquanto, mas dá para ligar no modo dev */
export type DevFlag = "challenge";
export const DEV_FLAGS: { id: DevFlag; label: string; hint: string }[] = [
  { id: "challenge", label: "Desafio da semana na Home", hint: "Ideia futura: escondido por enquanto para não poluir o visual." }
];

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach(l => l());

export function isDevMode(): boolean {
  return BETA && FastStorage.getItemSync<boolean>(KEY, false);
}

export function setDevMode(on: boolean) {
  FastStorage.setItemSync(KEY, on);
  emit();
}

export function devFlag(id: DevFlag): boolean {
  if (!isDevMode()) return false;
  return !!FastStorage.getItemSync<Record<string, boolean>>(FLAGS_KEY, {})[id];
}

export function setDevFlag(id: DevFlag, on: boolean) {
  const f = FastStorage.getItemSync<Record<string, boolean>>(FLAGS_KEY, {});
  FastStorage.setItemSync(FLAGS_KEY, { ...f, [id]: on });
  emit();
}

/** re-renderiza quando o modo dev ou um recurso muda */
export function useDevMode(): { dev: boolean; flag: (id: DevFlag) => boolean } {
  const [, setN] = useState(0);
  useEffect(() => {
    const l = () => setN(n => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return { dev: isDevMode(), flag: devFlag };
}

// ---------- registro de erros (para a tela de ferramentas) ----------
export interface DevLogEntry {
  at: string;
  level: "error" | "warn";
  msg: string;
}
const LOG: DevLogEntry[] = [];
let hooked = false;

export function devLog(): DevLogEntry[] {
  return LOG.slice().reverse();
}

/** guarda os últimos erros e avisos do app (só na memória) */
export function startDevLogCapture() {
  if (hooked) return;
  hooked = true;
  const wrap = (level: "error" | "warn") => {
    const orig = (console as any)[level];
    (console as any)[level] = (...args: any[]) => {
      try {
        const msg = args
          .map(a => (a instanceof Error ? `${a.message}\n${a.stack || ""}` : typeof a === "string" ? a : JSON.stringify(a)))
          .join(" ")
          .slice(0, 1200);
        LOG.push({ at: new Date().toLocaleTimeString("pt-BR"), level, msg });
        if (LOG.length > 80) LOG.shift();
      } catch {}
      orig?.apply(console, args);
    };
  };
  wrap("error");
  wrap("warn");
}
