import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { Apple, AtSign, Check, User, X } from "lucide-react-native";
import { authConfigured, signInEmail, signUpEmail, startOAuth } from "../services/auth";
import { useAppTheme } from "../context/AppTheme";
import { isUsernameTaken } from "../services/storage";

export function AuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const { colors } = useAppTheme();
  const [signup, setSignup] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const cleanUsername = (text: string) => {
    return text.toLowerCase().replace(/[^a-z0-9._]/g, "");
  };

  const submit = async () => {
    if (signup) {
      const cleanUser = cleanUsername(username);
      if (!cleanUser || cleanUser.length < 3) {
        Alert.alert(
          "Nome de usuário inválido",
          "O nome de usuário (@) deve conter pelo menos 3 caracteres (apenas letras, números, . e _)."
        );
        return;
      }

      // Check if username is already taken
      const taken = await isUsernameTaken(cleanUser);
      if (taken) {
        Alert.alert(
          "Nome de usuário indisponível",
          `O @${cleanUser} já está em uso por outro usuário. Por favor, escolha outro.`
        );
        return;
      }

      if (!displayName.trim()) {
        Alert.alert("Nome obrigatório", "Por favor, informe seu nome de exibição.");
        return;
      }
    }

    if (!email.trim() || password.length < 6) {
      Alert.alert("Confira os dados", "Informe um e-mail válido e senha com pelo menos 6 caracteres.");
      return;
    }

    setBusy(true);
    try {
      if (signup) {
        await signUpEmail(email.trim(), password, cleanUsername(username), displayName.trim());
      } else {
        await signInEmail(email.trim(), password);
      }
      onAuthenticated();
    } catch (e: any) {
      Alert.alert("Acesso", e.message || "Não foi possível autenticar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={s.scrollContainer}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.c}>
        <View style={s.logo}>
          <Image source={require("../assets/logo.png")} style={s.logoImg} />
          <Text style={[s.brand, { color: colors.text }]}>GUVIO</Text>
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: 4 }}>
            Moda do mundo. Seu guarda-roupa social.
          </Text>
        </View>

        <Text style={[s.h, { color: colors.text }]}>{signup ? "Criar sua conta" : "Entrar"}</Text>

        {signup && (
          <>
            {/* Full Name */}
            <View style={[s.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <User size={18} color={colors.muted} />
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Nome completo (ex: Thiago Silva)"
                placeholderTextColor={colors.muted}
                style={[s.input, { color: colors.text }]}
              />
            </View>

            {/* Custom @username */}
            <View style={[s.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <AtSign size={18} color={colors.muted} />
              <TextInput
                value={username}
                onChangeText={t => setUsername(cleanUsername(t))}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Nome de usuário (@unico)"
                placeholderTextColor={colors.muted}
                style={[s.input, { color: colors.text }]}
              />
              {username.length >= 3 && <Check size={16} color="#10B981" />}
            </View>
            <Text style={[s.helperText, { color: colors.muted }]}>
              Seu perfil será encontrado como: @{cleanUsername(username) || "seunome"}
            </Text>
          </>
        )}

        {/* Email or @username in login */}
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType={signup ? "email-address" : "default"}
          placeholder={signup ? "E-mail" : "E-mail ou @username"}
          placeholderTextColor={colors.muted}
          style={[s.plainInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
        />

        {/* Password */}
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="Senha (mínimo 6 dígitos)"
          placeholderTextColor={colors.muted}
          style={[s.plainInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
        />

        <Pressable onPress={submit} disabled={busy} style={[s.main, { backgroundColor: colors.text }]}>
          {busy ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={{ color: colors.bg, fontWeight: "900", fontSize: 14 }}>
              {signup ? "Criar conta e Começar" : "Entrar no Guvio"}
            </Text>
          )}
        </Pressable>

        <View style={s.or}>
          <View style={[s.line, { backgroundColor: colors.border }]} />
          <Text style={{ color: colors.muted, fontSize: 11 }}>ou</Text>
          <View style={[s.line, { backgroundColor: colors.border }]} />
        </View>

        <Pressable
          onPress={() => (authConfigured ? startOAuth("google") : onAuthenticated())}
          style={[s.social, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>G</Text>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13 }}>Continuar com Google</Text>
        </Pressable>

        <Pressable
          onPress={() => (authConfigured ? startOAuth("apple") : onAuthenticated())}
          style={[s.social, { borderColor: colors.border }]}
        >
          <Apple size={19} color={colors.icon} />
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13 }}>Continuar com Apple</Text>
        </Pressable>

        <Pressable onPress={() => setSignup(!signup)} hitSlop={10}>
          <Text style={[s.switch, { color: colors.muted }]}>
            {signup ? "Já possui uma conta? Entrar" : "Ainda não tem conta? Criar novo usuário (@)"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scrollContainer: { flexGrow: 1, justifyContent: "center", paddingVertical: 40 },
  c: { paddingHorizontal: 28, maxWidth: 500, width: "100%", alignSelf: "center" },
  logo: { alignItems: "center", marginBottom: 28 },
  logoImg: { width: 88, height: 88, borderRadius: 22, marginBottom: 12 },
  brand: { fontSize: 32, fontWeight: "900", letterSpacing: 5 },
  h: { fontSize: 24, fontWeight: "900", marginBottom: 16 },
  inputWrap: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
    marginBottom: 8
  },
  input: { flex: 1, height: "100%", fontSize: 14 },
  plainInput: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 10,
    fontSize: 14
  },
  helperText: { fontSize: 11, marginBottom: 12, marginLeft: 4, fontWeight: "500" },
  main: { height: 50, borderRadius: 15, alignItems: "center", justifyContent: "center", marginTop: 6 },
  or: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 18 },
  line: { height: 1, flex: 1 },
  social: {
    height: 48,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 9
  },
  switch: { textAlign: "center", marginTop: 14, fontWeight: "700", fontSize: 13 }
});
