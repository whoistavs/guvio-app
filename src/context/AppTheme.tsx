import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ThemeMode = "light" | "dark";

type Palette = {
  bg: string; surface: string; surface2: string; text: string; muted: string;
  border: string; icon: string; glass: string; glassStrong: string; blueGlass: string;
};

const THEME_STORAGE_KEY = "guvio_theme_preference_v1";

const palettes: Record<ThemeMode, Palette> = {
  light: {
    bg: "#FFFFFF", surface: "#F7F7F8", surface2: "#EEEEF0", text: "#0B0B0C",
    muted: "#77777C", border: "#E8E8EB", icon: "#101011",
    glass: "rgba(255,255,255,0.62)", glassStrong: "rgba(255,255,255,0.82)", blueGlass: "rgba(178,226,255,0.22)"
  },
  dark: {
    bg: "#090A0C", surface: "#141518", surface2: "#1D1F23", text: "#F6F6F7",
    muted: "#9A9CA2", border: "#27292E", icon: "#F5F5F6",
    glass: "rgba(22,24,28,0.72)", glassStrong: "rgba(35,38,43,0.84)", blueGlass: "rgba(91,181,235,0.18)"
  },
};

type AppThemeValue = { mode: ThemeMode; dark: boolean; colors: Palette; toggle: () => void; setMode: (m: ThemeMode) => void };
const Ctx = createContext<AppThemeValue | null>(null);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");

  useEffect(() => {
    // Carregar preferência salva de tema do AsyncStorage
    AsyncStorage.getItem(THEME_STORAGE_KEY).then(saved => {
      if (saved === "light" || saved === "dark") {
        setModeState(saved);
      }
    });
  }, []);

  const changeMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, newMode).catch(() => {});
  };

  const toggle = () => {
    const next = mode === "light" ? "dark" : "light";
    changeMode(next);
  };

  const value = useMemo(
    () => ({
      mode,
      dark: mode === "dark",
      colors: palettes[mode],
      toggle,
      setMode: changeMode
    }),
    [mode]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppTheme() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useAppTheme deve estar dentro de AppThemeProvider");
  return value;
}
