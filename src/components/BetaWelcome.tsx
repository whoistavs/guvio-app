import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Bug, MessageCircle, Rocket, Users } from "lucide-react-native";
import { useAppTheme } from "../context/AppTheme";
import { FastStorage } from "../services/FastStorage";

const KEY = "guvio_beta_welcome_v1";

/** Primeira vez no app: explica que é beta e pede feedback */
export function BetaWelcome({ onFeedback, onInvite }: { onFeedback: () => void; onInvite: () => void }) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!FastStorage.getItemSync(KEY, false)) {
      const t = setTimeout(() => setOpen(true), 900);
      return () => clearTimeout(t);
    }
  }, []);

  const close = () => {
    FastStorage.setItemSync(KEY, true);
    setOpen(false);
  };
  if (!open) return null;

  const Row = ({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) => (
    <View style={s.row}>
      <View style={[s.icon, { backgroundColor: colors.surface }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 }}>{text}</Text>
      </View>
    </View>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={s.back}>
        <View style={[s.card, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <View style={[s.badge, { borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>BETA</Text>
          </View>
          <Text style={[s.title, { color: colors.text }]}>Você está no beta do GUVIO</Text>
          <Text style={[s.sub, { color: colors.muted }]}>Obrigado por testar antes de todo mundo. O app ainda está crescendo, e sua opinião decide o que vem a seguir.</Text>
          <View style={{ gap: 14, alignSelf: "stretch", marginTop: 6 }}>
            <Row icon={<Rocket size={18} color={colors.text} />} title="Coisas novas toda semana" text="Recursos podem mudar ou aparecer de repente." />
            <Row icon={<Bug size={18} color={colors.text} />} title="Achou um erro?" text="Toque no selo BETA ao lado do logo e mande um print." />
            <Row icon={<Users size={18} color={colors.text} />} title="Traga seus amigos" text="Rede social boa é rede social com gente. Mande seu convite." />
          </View>
          <Pressable onPress={close} style={[s.btn, { backgroundColor: colors.text }]}>
            <Text style={{ color: colors.bg, fontWeight: "600", fontSize: 15 }}>Começar</Text>
          </Pressable>
          <View style={{ flexDirection: "row", gap: 10, alignSelf: "stretch" }}>
            <Pressable
              onPress={() => {
                close();
                onInvite();
              }}
              style={[s.btn2, { borderColor: colors.border }]}
            >
              <Users size={16} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "600" }}>Convidar</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                close();
                onFeedback();
              }}
              style={[s.btn2, { borderColor: colors.border }]}
            >
              <MessageCircle size={16} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "600" }}>Feedback</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  back: { flex: 1, backgroundColor: "rgba(0,0,0,.55)", alignItems: "center", justifyContent: "center", padding: 22 },
  card: { width: "100%", maxWidth: 400, borderRadius: 24, borderWidth: 1, padding: 22, alignItems: "center", gap: 10 },
  badge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  title: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  sub: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  btn: { alignSelf: "stretch", height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 10 },
  btn2: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" }
});
