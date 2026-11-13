import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Check, Plus, User } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../context/AppTheme";
import { FastImage } from "./FastImage";
import { useDragToClose } from "./gestures";
import { currentUserId, rememberCurrentAccount, savedAccounts, SavedAccount, signOutForNewAccount, switchToAccount } from "../services/accounts";
import { tapFeedback } from "../utils/haptics";

// abre de qualquer lugar (o @ do perfil, segurar a aba Perfil)
let openFn: (() => void) | null = null;
export function openAccountSwitcher() {
  openFn?.();
}

// reinicia o app inteiro na conta nova (o App registra como fazer)
let restartFn: (() => void) | null = null;
export function setAppRestarter(fn: () => void) {
  restartFn = fn;
}
export function restartApp() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.location.reload();
    return;
  }
  restartFn?.();
}

export function AccountSwitcherHost() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<SavedAccount[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const drag = useDragToClose(() => setOpen(false));

  useEffect(() => {
    openFn = async () => {
      tapFeedback();
      await rememberCurrentAccount().catch(() => {});
      setList(savedAccounts());
      setMe(await currentUserId());
      setOpen(true);
    };
    return () => {
      openFn = null;
    };
  }, []);

  const pick = async (a: SavedAccount) => {
    if (a.userId === me) return setOpen(false);
    setBusy(a.userId);
    const ok = await switchToAccount(a.userId).catch(() => false);
    setBusy(null);
    if (!ok) {
      setList(savedAccounts());
      Alert.alert("Entre de novo", `O login de @${a.username} venceu neste aparelho. Use "Adicionar conta" e entre com ela.`);
      return;
    }
    setOpen(false);
    restartApp();
  };

  const add = () => {
    setOpen(false);
    Alert.alert("Adicionar conta", "Você vai para a tela de entrar. A conta atual continua salva aqui para trocar depois.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Continuar",
        onPress: async () => {
          await signOutForNewAccount();
          restartApp();
        }
      }
    ]);
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <Pressable style={s.backdrop} onPress={() => setOpen(false)} />
      <View style={[s.sheet, { backgroundColor: colors.bg, paddingBottom: insets.bottom + 18 }]}>
        <View {...drag.panHandlers} style={s.grabArea}>
          <View style={[s.grabber, { backgroundColor: colors.border }]} />
        </View>
        {list.map(a => {
          const current = a.userId === me;
          return (
            <Pressable key={a.userId} onPress={() => pick(a)} style={s.row} disabled={!!busy}>
              {a.avatar ? (
                <FastImage source={a.avatar} style={s.avatar} contentFit="cover" />
              ) : (
                <View style={[s.avatar, { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }]}>
                  <User size={24} color={colors.muted} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>{a.username}</Text>
                {a.displayName ? <Text style={{ color: colors.muted, fontSize: 12 }}>{a.displayName}</Text> : null}
              </View>
              {busy === a.userId ? (
                <ActivityIndicator color={colors.muted} />
              ) : current ? (
                <View style={[s.check, { backgroundColor: "#0095F6" }]}>
                  <Check size={14} color="#FFF" strokeWidth={3} />
                </View>
              ) : (
                <View style={[s.check, { borderWidth: 1.5, borderColor: colors.border }]} />
              )}
            </Pressable>
          );
        })}
        <Pressable onPress={add} style={s.row} disabled={!!busy}>
          <View style={[s.avatar, { borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" }]}>
            <Plus size={24} color={colors.text} />
          </View>
          <Text style={{ color: colors.text, fontWeight: "600", fontSize: 15 }}>Adicionar conta</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18 },
  grabArea: { alignItems: "center", paddingVertical: 10 },
  grabber: { width: 40, height: 5, borderRadius: 3 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 10 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  check: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" }
});
