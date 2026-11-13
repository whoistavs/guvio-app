import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  Archive,
  Bell,
  Bookmark,
  ChevronRight,
  Clock3,
  Code2,
  Download,
  FileText,
  Gauge,
  HelpCircle,
  Lock,
  LogOut,
  MessageCircle,
  Moon,
  Search,
  Shield,
  Star,
  Trash2,
  UserPlus,
  Users,
  UserX
} from "lucide-react-native";
import { ScreenHeader } from "./ScreenHeader";
import { Toggle } from "./Toggle";
import { useAppTheme } from "../context/AppTheme";
import { getSettings, updateSettings } from "../services/settings";
import { isAdmin } from "../services/cloud";
import { isCloud } from "../services/supabase";
import { loadSavedProfile, saveProfile } from "../services/storage";
import { canShowInstall, openInstallHelp } from "./InstallPrompt";
import { openAccountSwitcher } from "./AccountSwitcher";
import { useDevMode } from "../services/devMode";
import Constants from "expo-constants";

type Row = { id: string; l: string; i: any; hint?: string; right?: React.ReactNode; onPress?: () => void; danger?: boolean; k?: string };
type Section = { title: string; rows: Row[] };

/** Configurações e atividade, organizadas como no Instagram (com busca) */
export function SettingsView({
  onBack,
  onOpen,
  onSignOut,
  onDeleteAccount
}: {
  onBack: () => void;
  onOpen: (x: string) => void;
  onSignOut?: () => void;
  onDeleteAccount?: () => Promise<void>;
}) {
  const { colors, pref, setPref } = useAppTheme();
  const { dev } = useDevMode();
  const [q, setQ] = useState("");
  const [saver, setSaver] = useState(() => getSettings().dataSaver);
  const [admin, setAdmin] = useState(false);
  const [priv, setPriv] = useState<boolean | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    isCloud()
      .then(c => (c ? isAdmin() : false))
      .then(setAdmin)
      .catch(() => {});
    loadSavedProfile()
      .then(p => setPriv(!!p.isPrivate))
      .catch(() => {});
  }, []);

  const toggleSaver = () => setSaver(updateSettings({ dataSaver: !saver }).dataSaver);
  const togglePrivate = async () => {
    if (priv === null) return;
    const next = !priv;
    setPriv(next);
    try {
      const p = await loadSavedProfile();
      await saveProfile({ ...p, isPrivate: next }, p.id);
    } catch (e: any) {
      setPriv(!next);
      Alert.alert("Não foi possível mudar", e?.message || "Tente de novo.");
    }
  };

  const confirmSignOut = () =>
    Alert.alert("Sair da conta", "Deseja encerrar a sessão da sua conta no GUVIO?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: onSignOut }
    ]);

  const confirmDelete = () =>
    Alert.alert(
      "Apagar sua conta?",
      "Seu perfil, posts, comentários, mensagens, stories e guarda-roupa serão apagados para sempre. Isso não pode ser desfeito.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Continuar",
          style: "destructive",
          onPress: () =>
            Alert.alert("Tem certeza absoluta?", "Última confirmação: sua conta será apagada agora.", [
              { text: "Cancelar", style: "cancel" },
              {
                text: "Apagar minha conta",
                style: "destructive",
                onPress: async () => {
                  if (!onDeleteAccount) return;
                  setDeleting(true);
                  try {
                    await onDeleteAccount();
                  } catch (e: any) {
                    Alert.alert("Não foi possível apagar", e?.message || "Tente novamente.");
                  } finally {
                    setDeleting(false);
                  }
                }
              }
            ])
        }
      ]
    );

  const themeSwitch = (
    <View style={{ flexDirection: "row", backgroundColor: colors.surface, borderRadius: 10, padding: 3 }}>
      {([
        ["system", "Auto"],
        ["light", "Claro"],
        ["dark", "Escuro"]
      ] as const).map(([k, l]) => (
        <Pressable
          key={k}
          onPress={() => setPref(k)}
          style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: pref === k ? colors.text : "transparent" }}
        >
          <Text style={{ color: pref === k ? colors.bg : colors.text, fontSize: 12, fontWeight: "600" }}>{l}</Text>
        </Pressable>
      ))}
    </View>
  );

  const sections: Section[] = useMemo(
    () => [
      ...(admin || dev
        ? [
            {
              title: "Equipe GUVIO",
              rows: [
                ...(admin ? [{ id: "admin", l: "Painel do criador", i: Gauge, hint: "Denúncias, feedback, usuários e pedidos de acesso" }] : []),
                ...(dev ? [{ id: "devtools", l: "Ferramentas de desenvolvedor", i: Code2, hint: "Modo dev ligado (beta)" }] : [])
              ]
            }
          ]
        : []),
      {
        title: "Sua conta",
        rows: [{ id: "accounts", l: "Trocar ou adicionar conta", i: Users, onPress: openAccountSwitcher, k: "central de contas login" }]
      },
      {
        title: "Como você usa o GUVIO",
        rows: [
          { id: "saved", l: "Salvos", i: Bookmark, k: "coleções" },
          { id: "archived", l: "Arquivados", i: Archive },
          { id: "activity", l: "Sua atividade", i: Clock3, k: "tempo curtidas comentários" },
          { id: "notifications", l: "Notificações", i: Bell, k: "push avisos" }
        ]
      },
      {
        title: "Quem pode ver seu conteúdo",
        rows: [
          {
            id: "private",
            l: "Privacidade da conta",
            i: Lock,
            hint: priv ? "Privada: só seguidores aprovados veem seus looks" : "Pública: qualquer pessoa vê seus looks",
            right: priv === null ? null : <Toggle value={priv} onValueChange={togglePrivate} />,
            onPress: togglePrivate,
            k: "privado público"
          },
          { id: "closeFriends", l: "Melhores amigos", i: Star, k: "stories" },
          { id: "blocked", l: "Bloqueados", i: UserX, k: "bloquear" }
        ]
      },
      {
        title: "Seu app e mídia",
        rows: [
          ...(canShowInstall() ? [{ id: "install", l: "Instalar o app na tela de início", i: Download, onPress: openInstallHelp }] : []),
          { id: "theme", l: "Tema", i: Moon, right: themeSwitch, onPress: () => {}, k: "escuro claro aparência" },
          {
            id: "saver",
            l: "Economia de dados",
            i: Gauge,
            hint: "Fotos mais leves ao publicar e sem pré-carregar imagens",
            right: <Toggle value={saver} onValueChange={toggleSaver} />,
            onPress: toggleSaver,
            k: "internet"
          }
        ]
      },
      {
        title: "Mais informações e suporte",
        rows: [
          { id: "invite", l: "Convidar amigos para o beta", i: UserPlus },
          { id: "feedback", l: "Enviar feedback / reportar bug", i: MessageCircle, k: "ajuda problema" },
          { id: "tutorial", l: "Ver tutorial de novo", i: HelpCircle },
          { id: "privacy", l: "Política de Privacidade", i: Shield, k: "lgpd dados" },
          { id: "terms", l: "Termos de Uso", i: FileText }
        ]
      },
      {
        title: "Login",
        rows: [
          { id: "addAccount", l: "Adicionar conta", i: UserPlus, onPress: openAccountSwitcher },
          ...(onSignOut ? [{ id: "signout", l: "Sair", i: LogOut, onPress: confirmSignOut, danger: true }] : []),
          ...(onDeleteAccount
            ? [{ id: "delete", l: deleting ? "Apagando conta..." : "Apagar minha conta", i: Trash2, onPress: confirmDelete, danger: true }]
            : [])
        ]
      }
    ],
    [admin, dev, priv, saver, pref, colors, deleting]
  );

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? sections
        .map(sec => ({ ...sec, rows: sec.rows.filter(r => `${r.l} ${r.hint || ""} ${r.k || ""}`.toLowerCase().includes(needle)) }))
        .filter(sec => sec.rows.length)
    : sections;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Configurações e atividade" onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={[s.search, { backgroundColor: colors.surface }]}>
          <Search size={17} color={colors.muted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Pesquisar"
            placeholderTextColor={colors.muted}
            style={{ flex: 1, color: colors.text, fontSize: 15, paddingVertical: 0 }}
          />
        </View>
        {filtered.map((sec, si) => (
          <View key={sec.title} style={[s.section, si > 0 && { borderTopColor: colors.surface, borderTopWidth: 6 }]}>
            <Text style={[s.secTitle, { color: colors.muted }]}>{sec.title}</Text>
            {sec.rows.map(r => {
              const I = r.i;
              const tint = r.danger ? "#FF3B30" : colors.text;
              return (
                <Pressable
                  key={r.id}
                  onPress={r.onPress || (() => onOpen(r.id))}
                  style={({ pressed }) => [s.row, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <I size={22} color={r.danger ? "#FF3B30" : colors.icon} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: tint, fontSize: 15 }}>{r.l}</Text>
                    {r.hint ? <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{r.hint}</Text> : null}
                  </View>
                  {r.right !== undefined ? r.right : r.danger ? null : <ChevronRight size={18} color={colors.muted} />}
                </Pressable>
              );
            })}
          </View>
        ))}
        {needle && !filtered.length ? (
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: 30 }}>Nada encontrado para “{q}”.</Text>
        ) : null}
        <Text style={{ color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 24 }}>
          GUVIO beta · versão {Constants.expoConfig?.version || "1.0.0"}
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 6, marginBottom: 6, height: 40, borderRadius: 12, paddingHorizontal: 12 },
  section: { paddingTop: 14, paddingBottom: 4 },
  secTitle: { fontSize: 13, fontWeight: "600", marginHorizontal: 16, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 13 }
});
