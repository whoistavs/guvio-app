import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import { Image } from "expo-image";
import { ScreenHeader } from "./ScreenHeader";
import { Toggle } from "./Toggle";
import { useAppTheme } from "../context/AppTheme";
import { DEV_FLAGS, devLog, setDevFlag, setDevMode, useDevMode } from "../services/devMode";
import { myAdminRequest, requestAdmin, AdminRequestStatus } from "../services/cloud";
import { isCloud } from "../services/supabase";
import { loadSavedProfile } from "../services/storage";
import { FastStorage } from "../services/FastStorage";
import { toast } from "./motion";

/** Ferramentas do modo desenvolvedor (beta). Não dá poder de admin: só permite PEDIR. */
export function DevToolsView({ onBack }: { onBack: () => void }) {
  const { colors } = useAppTheme();
  const { flag } = useDevMode();
  const [uid, setUid] = useState("");
  const [username, setUsername] = useState("");
  const [req, setReq] = useState<AdminRequestStatus | "loading">("loading");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [log, setLog] = useState(() => devLog());

  useEffect(() => {
    loadSavedProfile()
      .then(p => {
        setUid(p.id);
        setUsername(p.username);
      })
      .catch(() => {});
    isCloud()
      .then(c => (c ? myAdminRequest() : null))
      .then(setReq)
      .catch(() => setReq(null));
  }, []);

  const info = [
    ["Versão", Constants.expoConfig?.version || "?"],
    ["Build iOS", String(Constants.expoConfig?.ios?.buildNumber || "-")],
    ["Build Android", String(Constants.expoConfig?.android?.versionCode || "-")],
    ["Plataforma", `${Platform.OS} ${Platform.Version ?? ""}`],
    ["Usuário", username ? `@${username}` : "-"],
    ["ID", uid || "-"]
  ];

  const copyInfo = async () => {
    await Clipboard.setStringAsync(info.map(([k, v]) => `${k}: ${v}`).join("\n")).catch(() => {});
    toast("Informações copiadas");
  };

  const ask = async () => {
    setSending(true);
    try {
      const r = await requestAdmin(note.trim());
      setReq(r as AdminRequestStatus);
      toast(r === "already" ? "Você já é admin" : "Pedido enviado");
    } catch (e: any) {
      Alert.alert("Não deu para pedir", e?.message || "Tente de novo.");
    } finally {
      setSending(false);
    }
  };

  const clearCache = () =>
    Alert.alert("Limpar cache?", "Apaga o feed e as imagens guardadas no aparelho. Sua conta continua conectada.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Limpar",
        style: "destructive",
        onPress: () => {
          try {
            ["guvio_stories_cache", "guvio_feed", "guvio_me_cache", "guvio_posts_cache"].forEach(k => FastStorage.clearPrefixSync(k));
            Image.clearDiskCache().catch(() => {});
            Image.clearMemoryCache().catch(() => {});
          } catch {}
          toast("Cache limpo. Feche e abra o app.");
        }
      }
    ]);

  const card = [s.card, { backgroundColor: colors.surface }];
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Ferramentas de desenvolvedor" onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 16 }}>
        <View style={card}>
          <Text style={[s.h, { color: colors.text }]}>Este aparelho</Text>
          {info.map(([k, v]) => (
            <View key={k} style={s.kv}>
              <Text style={{ color: colors.muted }}>{k}</Text>
              <Text style={{ color: colors.text, flexShrink: 1, textAlign: "right" }} selectable numberOfLines={1}>
                {v}
              </Text>
            </View>
          ))}
          <Pressable onPress={copyInfo} style={[s.btn, { borderColor: colors.border }]}>
            <Text style={{ color: colors.text, fontWeight: "600" }}>Copiar informações</Text>
          </Pressable>
        </View>

        <View style={card}>
          <Text style={[s.h, { color: colors.text }]}>Acesso de admin</Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 10 }}>
            O modo dev não dá poderes de admin. Você pode pedir, e um admin aprova no Painel do criador.
          </Text>
          {req === "loading" ? (
            <ActivityIndicator color={colors.text} />
          ) : req === "admin" || req === "approved" ? (
            <Text style={{ color: "#22C55E", fontWeight: "700" }}>Você já é admin. O Painel do criador aparece nas Configurações.</Text>
          ) : req === "pending" ? (
            <Text style={{ color: colors.text, fontWeight: "600" }}>Pedido enviado. Aguardando um admin aprovar.</Text>
          ) : (
            <>
              {req === "denied" ? <Text style={{ color: "#FF3B30", marginBottom: 8 }}>Seu último pedido foi recusado. Dá para pedir de novo.</Text> : null}
              <TextInput
                value={note}
                onChangeText={setNote}
                maxLength={300}
                placeholder="Por que você precisa? (opcional)"
                placeholderTextColor={colors.muted}
                style={[s.input, { color: colors.text, borderColor: colors.border }]}
              />
              <Pressable onPress={ask} disabled={sending} style={[s.btn, { backgroundColor: "#0095F6", borderColor: "#0095F6" }]}>
                {sending ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: "#FFF", fontWeight: "700" }}>Pedir acesso de admin</Text>}
              </Pressable>
            </>
          )}
        </View>

        <View style={card}>
          <Text style={[s.h, { color: colors.text }]}>Recursos em teste</Text>
          {DEV_FLAGS.map(f => (
            <View key={f.id} style={s.kv}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ color: colors.text }}>{f.label}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{f.hint}</Text>
              </View>
              <Toggle value={flag(f.id)} onValueChange={v => setDevFlag(f.id, v)} />
            </View>
          ))}
        </View>

        <View style={card}>
          <View style={[s.kv, { marginBottom: 6 }]}>
            <Text style={[s.h, { color: colors.text, marginBottom: 0 }]}>Erros recentes ({log.length})</Text>
            <Pressable onPress={() => setLog(devLog())} hitSlop={8}>
              <Text style={{ color: "#0095F6", fontWeight: "600" }}>Atualizar</Text>
            </Pressable>
          </View>
          {log.length === 0 ? (
            <Text style={{ color: colors.muted }}>Nenhum erro registrado desde que o app abriu.</Text>
          ) : (
            log.slice(0, 30).map((e, i) => (
              <Pressable
                key={i}
                onLongPress={() => Clipboard.setStringAsync(e.msg).then(() => toast("Erro copiado")).catch(() => {})}
                style={[s.logRow, { borderTopColor: colors.border }]}
              >
                <Text style={{ color: e.level === "error" ? "#FF3B30" : "#FF9500", fontSize: 11, fontWeight: "700" }}>
                  {e.level === "error" ? "ERRO" : "AVISO"} · {e.at}
                </Text>
                <Text style={{ color: colors.text, fontSize: 12 }} numberOfLines={4}>
                  {e.msg}
                </Text>
              </Pressable>
            ))
          )}
        </View>

        <Pressable onPress={clearCache} style={[s.btn, { borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontWeight: "600" }}>Limpar cache do aparelho</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setDevMode(false);
            toast("Modo desenvolvedor desligado");
            onBack();
          }}
          style={[s.btn, { borderColor: "#FF3B30" }]}
        >
          <Text style={{ color: "#FF3B30", fontWeight: "700" }}>Desligar modo desenvolvedor</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 16, padding: 14 },
  h: { fontWeight: "800", fontSize: 15, marginBottom: 10 },
  kv: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, gap: 10 },
  btn: { borderWidth: 1, borderRadius: 12, height: 44, alignItems: "center", justifyContent: "center", marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44 },
  logRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 8 }
});
