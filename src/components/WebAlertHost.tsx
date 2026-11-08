import React, { useEffect, useState } from "react";
import { Alert, AlertButton, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../context/AppTheme";

/**
 * No site, o Alert do react-native-web não faz nada (menus e confirmações sumiam).
 * Aqui o Alert.alert vira uma folha de opções de verdade.
 */
type Req = { title: string; message?: string; buttons: AlertButton[] };
let push: ((r: Req) => void) | null = null;
const queue: Req[] = [];

export function installWebAlert() {
  if (Platform.OS !== "web") return;
  (Alert as any).alert = (title: string, message?: string, buttons?: AlertButton[]) => {
    const req = { title: title || "", message, buttons: buttons && buttons.length ? buttons : [{ text: "OK" }] };
    if (push) push(req);
    else queue.push(req);
  };
}

export function WebAlertHost() {
  const { colors } = useAppTheme();
  const [list, setList] = useState<Req[]>([]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    push = r => setList(l => [...l, r]);
    if (queue.length) setList(l => [...l, ...queue.splice(0)]);
    return () => {
      push = null;
    };
  }, []);

  const cur = list[0];
  if (!cur) return null;
  const close = () => setList(l => l.slice(1));
  const cancel = cur.buttons.find(b => b.style === "cancel");
  const others = cur.buttons.filter(b => b !== cancel);
  const press = (b?: AlertButton) => {
    close();
    // roda depois de fechar, para o próximo alerta (se houver) abrir por cima
    setTimeout(() => b?.onPress?.(), 0);
  };
  // uma só opção sem estilo = aviso simples
  const simple = cur.buttons.length === 1 && !cancel;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => press(cancel)}>
      <Pressable style={s.back} onPress={() => press(cancel)}>
        <Pressable style={[s.card, { backgroundColor: colors.bg, borderColor: colors.border }]} onPress={e => e.stopPropagation?.()}>
          {cur.title ? <Text style={[s.title, { color: colors.text }]}>{cur.title}</Text> : null}
          {cur.message ? <Text style={[s.msg, { color: colors.muted }]}>{cur.message}</Text> : null}
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 6, marginTop: 12 }}>
            {others.map((b, i) => (
              <Pressable
                key={i}
                onPress={() => press(b)}
                style={[s.btn, { backgroundColor: simple ? colors.text : colors.surface }]}
              >
                <Text
                  style={{
                    color: b.style === "destructive" ? "#E5484D" : simple ? colors.bg : colors.text,
                    fontWeight: "600",
                    fontSize: 14
                  }}
                >
                  {b.text || "OK"}
                </Text>
              </Pressable>
            ))}
            {cancel ? (
              <Pressable onPress={() => press(cancel)} style={[s.btn, { borderWidth: 1, borderColor: colors.border }]}>
                <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 14 }}>{cancel.text || "Cancelar"}</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  back: { flex: 1, backgroundColor: "rgba(0,0,0,.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 360, borderRadius: 20, padding: 18, borderWidth: 1 },
  title: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  msg: { fontSize: 13, textAlign: "center", marginTop: 6, lineHeight: 18 },
  btn: { height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" }
});
