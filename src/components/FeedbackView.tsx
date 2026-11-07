import React, { useState } from "react";
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Bug, ImagePlus, Lightbulb, MessageSquare, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import Constants from "expo-constants";
import { useAppTheme } from "../context/AppTheme";
import { toast } from "./motion";
import { ScreenHeader } from "./ScreenHeader";
import { sendFeedback } from "../services/storage";
import { successFeedback } from "../utils/haptics";

type Kind = "bug" | "ideia" | "outro";
const KINDS: { id: Kind; label: string; icon: any }[] = [
  { id: "bug", label: "Bug", icon: Bug },
  { id: "ideia", label: "Ideia", icon: Lightbulb },
  { id: "outro", label: "Outro", icon: MessageSquare }
];

export const APP_VERSION = `${Constants.expoConfig?.version || "?"} (${
  Platform.OS === "ios" ? Constants.expoConfig?.ios?.buildNumber || "?" : Platform.OS
})`;

/** Testers mandam bugs e ideias direto para a tabela "feedback" do Supabase */
export function FeedbackView({ onBack }: { onBack: () => void }) {
  const { colors } = useAppTheme();
  const [kind, setKind] = useState<Kind>("bug");
  const [text, setText] = useState("");
  const [shot, setShot] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== "granted") return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (!res.canceled && res.assets?.[0]?.uri) setShot(res.assets[0].uri);
  };

  const send = async () => {
    if (!text.trim()) {
      Alert.alert("Conte o que aconteceu", "Escreva uma descrição antes de enviar.");
      return;
    }
    setSending(true);
    try {
      await sendFeedback({ kind, text, screenshot: shot || undefined, appVersion: APP_VERSION });
      successFeedback();
      toast("Obrigado! Seu feedback chegou", "💜");
      onBack();
    } catch (e: any) {
      Alert.alert("Não foi possível enviar", e?.message || "Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Enviar feedback" onBack={onBack} />
      <ScrollView contentContainerStyle={s.c} keyboardShouldPersistTaps="handled">
        <Text style={{ color: colors.muted, lineHeight: 20, marginBottom: 16 }}>
          Você está testando a versão beta do Guvio. Achou um erro ou teve uma ideia? Conta pra gente, e se puder anexe um print da tela.
        </Text>
        <View style={s.kinds}>
          {KINDS.map(k => {
            const I = k.icon;
            const on = kind === k.id;
            return (
              <Pressable
                key={k.id}
                onPress={() => setKind(k.id)}
                style={[s.kind, { backgroundColor: on ? colors.text : colors.surface, borderColor: colors.border }]}
              >
                <I size={16} color={on ? colors.bg : colors.text} />
                <Text style={{ color: on ? colors.bg : colors.text, fontWeight: "800" }}>{k.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          maxLength={4000}
          placeholder={kind === "bug" ? "O que aconteceu? O que você estava fazendo na hora?" : "Escreva aqui..."}
          placeholderTextColor={colors.muted}
          style={[s.input, { backgroundColor: colors.surface, color: colors.text }]}
        />
        {shot ? (
          <View style={{ alignSelf: "flex-start" }}>
            <Image source={{ uri: shot }} style={s.shot} />
            <Pressable onPress={() => setShot(null)} style={s.remove} hitSlop={8}>
              <X size={13} color="#FFF" />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={pick} style={[s.attach, { borderColor: colors.border }]}>
            <ImagePlus size={18} color={colors.icon} />
            <Text style={{ color: colors.text, fontWeight: "700" }}>Anexar print</Text>
          </Pressable>
        )}
        <Pressable onPress={send} disabled={sending} style={[s.send, { backgroundColor: colors.text, opacity: sending ? 0.6 : 1 }]}>
          {sending ? <ActivityIndicator color={colors.bg} /> : <Text style={{ color: colors.bg, fontWeight: "900" }}>Enviar</Text>}
        </Pressable>
        <Text style={{ color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 14 }}>Versão {APP_VERSION}</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  c: { padding: 20, paddingBottom: 60 },
  kinds: { flexDirection: "row", gap: 8, marginBottom: 14 },
  kind: { flex: 1, height: 42, borderRadius: 21, borderWidth: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" },
  input: { minHeight: 150, borderRadius: 18, padding: 14, textAlignVertical: "top", fontSize: 14 },
  attach: { marginTop: 12, height: 46, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  shot: { width: 110, height: 200, borderRadius: 14, marginTop: 12 },
  remove: { position: "absolute", top: 18, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,.65)", alignItems: "center", justifyContent: "center" },
  send: { height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", marginTop: 20 }
});
