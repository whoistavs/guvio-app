import React, { useEffect, useState } from "react";
import { Image, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Download, MoreVertical, PlusSquare, Share, X } from "lucide-react-native";
import { useAppTheme } from "../context/AppTheme";

/**
 * Site: convida a instalar o GUVIO na tela de início.
 * - Android/computador: usa o pedido de instalação do navegador
 * - iPhone: mostra o passo a passo (Compartilhar › Adicionar à Tela de Início)
 */
const KEY = "guvio_install_hint_v1";
const EVERY_MS = 14 * 24 * 3600 * 1000;

let deferred: any = null;
let openListener: (() => void) | null = null;
if (Platform.OS === "web" && typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: any) => {
    e.preventDefault();
    deferred = e;
  });
}

export function isInstalledApp(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return true;
  return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || (navigator as any).standalone === true;
}
export const APK_URL = "https://github.com/guvioapp/guvio-app/releases/download/beta-android/GUVIO.apk";
const isAndroid = () => Platform.OS === "web" && typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
const isIOS = () =>
  Platform.OS === "web" &&
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1));

/** abre o passo a passo (ex.: pelo botão nas configurações) */
export function openInstallHelp() {
  openListener?.();
}
export const canShowInstall = () => Platform.OS === "web" && !isInstalledApp();

export function InstallPrompt() {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || isInstalledApp()) return;
    openListener = () => setOpen(true);
    let last = 0;
    try {
      last = Number(localStorage.getItem(KEY) || 0);
    } catch {}
    const t = Date.now() - last > EVERY_MS ? setTimeout(() => setOpen(true), 12000) : null;
    return () => {
      openListener = null;
      if (t) clearTimeout(t);
    };
  }, []);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {}
  };

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => null);
    deferred = null;
    close();
  };

  if (!open) return null;
  const ios = isIOS();

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={s.back} onPress={close}>
        <Pressable style={[s.card, { backgroundColor: colors.bg, borderColor: colors.border }]} onPress={e => e.stopPropagation?.()}>
          <Pressable onPress={close} style={s.x} hitSlop={10}>
            <X size={20} color={colors.muted} />
          </Pressable>
          <Image source={{ uri: `${window.location.pathname.replace(/[^/]*$/, "")}apple-touch-icon.png` }} style={s.logo} />
          <Text style={[s.title, { color: colors.text }]}>Instale o GUVIO</Text>
          <Text style={[s.sub, { color: colors.muted }]}>Fica na tela de início, abre em tela cheia e carrega mais rápido. Não ocupa quase nada.</Text>

          {ios ? (
            <View style={{ gap: 12, marginTop: 6, alignSelf: "stretch" }}>
              <Step n={1} colors={colors} icon={<Share size={18} color={colors.text} />} text="Toque em Compartilhar. No iOS 26 ele fica no ícone à esquerda do endereço (ou em ···)" />
              <Step n={2} colors={colors} icon={<PlusSquare size={18} color={colors.text} />} text="Role a lista e escolha “Adicionar à Tela de Início”" />
              <Step n={3} colors={colors} icon={<Text style={{ color: colors.text, fontWeight: "700" }}>OK</Text>} text="Deixe “Abrir como App Web” ligado e toque em Adicionar" />
            </View>
          ) : deferred ? (
            <Pressable onPress={install} style={[s.btn, { backgroundColor: colors.text }]}>
              <Download size={18} color={colors.bg} />
              <Text style={{ color: colors.bg, fontWeight: "600" }}>Instalar</Text>
            </Pressable>
          ) : (
            <View style={{ gap: 12, marginTop: 6, alignSelf: "stretch" }}>
              <Step n={1} colors={colors} icon={<MoreVertical size={18} color={colors.text} />} text="Abra o menu do navegador (⋮)" />
              <Step n={2} colors={colors} icon={<Download size={18} color={colors.text} />} text="Toque em “Instalar app” ou “Adicionar à tela inicial”" />
            </View>
          )}
          {isAndroid() ? (
            <Pressable onPress={() => window.open(APK_URL, "_blank")} style={[s.btn, { borderWidth: 1, borderColor: colors.border }]}>
              <Download size={18} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "600" }}>Baixar o app Android (APK)</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={close} style={{ marginTop: 14 }} hitSlop={8}>
            <Text style={{ color: colors.muted, fontWeight: "500" }}>Agora não</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Step({ n, icon, text, colors }: { n: number; icon: React.ReactNode; text: string; colors: any }) {
  return (
    <View style={s.step}>
      <View style={[s.num, { borderColor: colors.border }]}>
        <Text style={{ color: colors.text, fontWeight: "600", fontSize: 12 }}>{n}</Text>
      </View>
      <View style={[s.icon, { backgroundColor: colors.surface }]}>{icon}</View>
      <Text style={{ color: colors.text, flex: 1, fontSize: 14 }}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  back: { flex: 1, backgroundColor: "rgba(0,0,0,.5)", justifyContent: "flex-end", alignItems: "center" },
  card: { width: "100%", maxWidth: 480, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 22, paddingBottom: 30, alignItems: "center", gap: 8 },
  x: { position: "absolute", right: 16, top: 16 },
  logo: { width: 60, height: 60, borderRadius: 14, marginBottom: 4 },
  title: { fontSize: 19, fontWeight: "700" },
  sub: { fontSize: 13, textAlign: "center", lineHeight: 18, marginBottom: 6 },
  btn: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", height: 50, borderRadius: 14, alignSelf: "stretch", marginTop: 6 },
  step: { flexDirection: "row", alignItems: "center", gap: 10 },
  num: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" }
});
