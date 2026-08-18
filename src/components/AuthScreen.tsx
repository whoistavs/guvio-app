import React, { useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Apple } from "lucide-react-native";
import { authConfigured, signInEmail, signUpEmail, startOAuth } from "../services/auth";
import { useAppTheme } from "../context/AppTheme";

export function AuthScreen({ onAuthenticated }: { onAuthenticated: () => void }) {
  const { colors } = useAppTheme();
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email || password.length < 6) {
      Alert.alert("Confira os dados", "Informe e-mail e senha com pelo menos 6 caracteres.");
      return;
    }
    setBusy(true);
    try {
      if (authConfigured) {
        signup ? await signUpEmail(email, password) : await signInEmail(email, password);
      }
      onAuthenticated();
    } catch (e: any) {
      Alert.alert("Login", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[s.c, { backgroundColor: colors.bg }]}>
      <View style={s.logo}>
        <Image
          source={require("../assets/logo.png")}
          style={s.logoImg}
        />
        <Text style={[s.brand, { color: colors.text }]}>GUVIO</Text>
        <Text style={{ color: colors.muted, textAlign: "center", marginTop: 4 }}>Moda do mundo. Seu guarda-roupa.</Text>
      </View>

      <Text style={[s.h, { color: colors.text }]}>{signup ? "Criar conta" : "Entrar"}</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="E-mail"
        placeholderTextColor={colors.muted}
        style={[s.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Senha"
        placeholderTextColor={colors.muted}
        style={[s.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
      />

      <Pressable onPress={submit} style={[s.main, { backgroundColor: colors.text }]}>
        {busy ? <ActivityIndicator color={colors.bg} /> : <Text style={{ color: colors.bg, fontWeight: "900" }}>{signup ? "Criar conta" : "Entrar"}</Text>}
      </Pressable>

      <View style={s.or}>
        <View style={[s.line, { backgroundColor: colors.border }]} />
        <Text style={{ color: colors.muted, fontSize: 11 }}>ou</Text>
        <View style={[s.line, { backgroundColor: colors.border }]} />
      </View>

      <Pressable onPress={() => (authConfigured ? startOAuth("google") : onAuthenticated())} style={[s.social, { borderColor: colors.border }]}>
        <Text style={{ color: colors.text, fontWeight: "800" }}>G</Text>
        <Text style={{ color: colors.text, fontWeight: "800" }}>Continuar com Google</Text>
      </Pressable>

      <Pressable onPress={() => (authConfigured ? startOAuth("apple") : onAuthenticated())} style={[s.social, { borderColor: colors.border }]}>
        <Apple size={19} color={colors.icon} />
        <Text style={{ color: colors.text, fontWeight: "800" }}>Continuar com Apple</Text>
      </Pressable>

      <Pressable onPress={() => setSignup(!signup)}>
        <Text style={[s.switch, { color: colors.muted }]}>{signup ? "Já tenho uma conta · Entrar" : "Ainda não tem conta? Criar usuário"}</Text>
      </Pressable>

      {!authConfigured ? (
        <Text style={[s.demo, { color: colors.muted }]}>Modo demonstração: Supabase ainda não configurado; os botões entram no app para teste da interface.</Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
  logo: { alignItems: "center", marginBottom: 32 },
  logoImg: { width: 92, height: 92, borderRadius: 22, marginBottom: 12 },
  brand: { fontSize: 32, fontWeight: "900", letterSpacing: 5 },
  h: { fontSize: 24, fontWeight: "900", marginBottom: 16 },
  input: { height: 50, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, marginBottom: 10 },
  main: { height: 50, borderRadius: 15, alignItems: "center", justifyContent: "center", marginTop: 4 },
  or: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 18 },
  line: { height: 1, flex: 1 },
  social: { height: 48, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10, marginBottom: 9 },
  switch: { textAlign: "center", marginTop: 12, fontWeight: "700" },
  demo: { fontSize: 10, textAlign: "center", marginTop: 16, lineHeight: 15 }
});
