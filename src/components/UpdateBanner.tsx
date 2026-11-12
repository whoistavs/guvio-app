import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Download, RefreshCw } from "lucide-react-native";
import { AndroidUpdate, openApkDownload, startAndroidUpdateCheck } from "../services/androidUpdate";

const BUILD = process.env.EXPO_PUBLIC_BUILD_ID || "";
const EVERY = 5 * 60 * 1000;

/** Site: avisa quando uma versão nova foi publicada (compara com dist/version.json) */
export function UpdateBanner() {
  const [fresh, setFresh] = useState(false);
  // app Android: versão nova do APK
  const [apk, setApk] = useState<AndroidUpdate | null>(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    startAndroidUpdateCheck(u => {
      setApk(u);
      setHidden(false);
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || !BUILD || typeof window === "undefined") return;
    const base = window.location.pathname.replace(/[^/]*$/, "");
    let stop = false;
    const check = async () => {
      if (stop || document.visibilityState === "hidden") return;
      try {
        const r = await fetch(`${base}version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (j?.build && j.build !== BUILD) setFresh(true);
      } catch {}
    };
    const t = setInterval(check, EVERY);
    const onVis = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVis);
    const first = setTimeout(check, 15000);
    return () => {
      stop = true;
      clearInterval(t);
      clearTimeout(first);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  if (apk && !hidden) {
    return (
      <View style={s.wrap} pointerEvents="box-none">
        <Pressable
          onPress={() => {
            openApkDownload();
            setHidden(true);
          }}
          style={s.pill}
        >
          <Download size={15} color="#FFF" />
          <Text style={s.t}>Nova versão do app</Text>
          <Text style={[s.t, { color: "#7CC4FF" }]}>Baixar</Text>
        </Pressable>
      </View>
    );
  }
  if (!fresh) return null;
  return (
    <View style={s.wrap} pointerEvents="box-none">
      <Pressable onPress={() => window.location.reload()} style={s.pill}>
        <RefreshCw size={15} color="#FFF" />
        <Text style={s.t}>Nova versão do Guvio</Text>
        <Text style={[s.t, { color: "#7CC4FF" }]}>Atualizar</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: "absolute", top: Platform.OS === "android" ? 48 : 14, left: 0, right: 0, alignItems: "center", zIndex: 9999 },
  pill: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#111", borderRadius: 22, paddingHorizontal: 16, height: 42, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 10 },
  t: { color: "#FFF", fontWeight: "600", fontSize: 13 }
});
