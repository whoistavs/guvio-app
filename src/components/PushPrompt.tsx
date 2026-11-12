import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Bell, X } from "lucide-react-native";
import { useAppTheme } from "../context/AppTheme";
import { FastStorage } from "../services/FastStorage";
import { enableWebPush, webPushState } from "../services/push";
import { isCloud } from "../services/supabase";

const KEY = "guvio_push_prompt_v1";

/** Convite para ligar os avisos (site). No iPhone o pedido precisa vir de um toque, por isso o botão. */
export function PushPrompt() {
  const { colors } = useAppTheme();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (FastStorage.getItemSync(KEY, false)) return;
    Promise.all([isCloud(), webPushState()]).then(([c, st]) => setShow(c && st === "off"));
  }, []);
  if (!show) return null;
  const close = () => {
    FastStorage.setItemSync(KEY, true);
    setShow(false);
  };
  return (
    <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Bell size={20} color={colors.text} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>Ligar os avisos?</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Saiba na hora quando curtirem, comentarem ou mandarem mensagem.</Text>
      </View>
      <Pressable
        onPress={async () => {
          await enableWebPush().catch(() => null);
          close();
        }}
        style={[s.btn, { backgroundColor: colors.text }]}
      >
        <Text style={{ color: colors.bg, fontWeight: "700", fontSize: 12 }}>Ligar</Text>
      </Pressable>
      <Pressable onPress={close} hitSlop={10}>
        <X size={16} color={colors.muted} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: 14, borderWidth: 1 },
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }
});
