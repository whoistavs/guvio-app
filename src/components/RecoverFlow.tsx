import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ArrowLeft, Eye, EyeOff, Mail, User } from "lucide-react-native";
import { useAppTheme } from "../context/AppTheme";
import { FastImage } from "./FastImage";
import { KeyboardSafeView } from "./KeyboardSafeView";
import { topPad } from "../utils/insets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { recoverFind, recoverSend, recoverVerify, setNewPassword, RecoverAccount, setRecoverFlowActive } from "../services/auth";

// abre de qualquer lugar (a tela de entrar some quando a pessoa entra na conta,
// então o fluxo fica num "host" na raiz do app)
let openFn: (() => void) | null = null;
export function openRecoverFlow() {
  openFn?.();
}

type Step = "find" | "confirm" | "code" | "password";

/** "Esqueci minha senha": achar a conta → confirmar → código do e-mail → senha nova */
export function RecoverHost() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("find");
  const [query, setQuery] = useState("");
  const [acc, setAcc] = useState<RecoverAccount | null>(null);
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    openFn = () => {
      setStep("find");
      setQuery("");
      setAcc(null);
      setCode("");
      setPw("");
      setErr(null);
      setOpen(true);
      setRecoverFlowActive(true);
    };
    return () => {
      openFn = null;
    };
  }, []);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const startWait = () => {
    setWait(60);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => setWait(w => (w <= 1 ? (clearInterval(timer.current!), 0) : w - 1)), 1000);
  };

  const close = () => {
    setOpen(false);
    setRecoverFlowActive(false);
  };

  const back = () => {
    setErr(null);
    if (step === "find") close();
    else if (step === "confirm") setStep("find");
    else if (step === "code") setStep("confirm");
    else close(); // na senha nova já está dentro da conta
  };

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e: any) {
      setErr(e?.message || "Algo deu errado. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  const find = () =>
    run(async () => {
      const a = await recoverFind(query);
      setAcc(a);
      setStep("confirm");
    });

  const send = () =>
    run(async () => {
      await recoverSend(query, acc?.direct);
      setCode("");
      startWait();
      setStep("code");
    });

  const verify = () =>
    run(async () => {
      await recoverVerify(query, code.replace(/\D/g, ""), acc?.direct);
      setStep("password");
    });

  const save = () =>
    run(async () => {
      if (pw.length < 6) throw new Error("Use pelo menos 6 caracteres.");
      await setNewPassword(pw);
      close();
      Alert.alert("Senha trocada", "Pronto! Você já está na sua conta.");
    });

  const title = {
    find: "Encontre sua conta",
    confirm: "Vamos mandar um código por e-mail",
    code: "Digite o código",
    password: "Crie uma senha nova"
  }[step];

  return (
    <Modal visible={open} animationType="slide" onRequestClose={back}>
      <KeyboardSafeView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={[s.top, { paddingTop: Math.max(topPad(12), insets.top + 10) }]}>
          <Pressable onPress={back} hitSlop={12}>
            <ArrowLeft size={24} color={colors.icon} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          {step === "confirm" ? (
            <>
              <Text style={[s.h, { color: colors.text, textAlign: "center" }]}>{title}</Text>
              <Text style={[s.sub, { color: colors.text, textAlign: "center" }]}>{acc?.maskedEmail}</Text>
              <View style={{ alignItems: "center", marginVertical: 26, gap: 10 }}>
                {acc?.avatar ? (
                  <FastImage source={acc.avatar} style={s.avatar} contentFit="cover" />
                ) : (
                  <View style={[s.avatar, { backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }]}>
                    {acc?.direct ? <Mail size={40} color={colors.muted} /> : <User size={44} color={colors.muted} />}
                  </View>
                )}
                {acc?.username ? <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>{acc.username}</Text> : null}
                {acc?.displayName && acc.displayName !== acc.username ? (
                  <Text style={{ color: colors.muted, fontSize: 13 }}>{acc.displayName}</Text>
                ) : null}
              </View>
            </>
          ) : (
            <>
              <Text style={[s.h, { color: colors.text }]}>{title}</Text>
              <Text style={[s.sub, { color: colors.muted }]}>
                {step === "find"
                  ? "Digite o e-mail ou o nome de usuário (@) da sua conta."
                  : step === "code"
                  ? `Mandamos um código para ${acc?.maskedEmail}. O e-mail também tem um botão para redefinir a senha.`
                  : "Use pelo menos 6 caracteres. Você vai usar ela para entrar da próxima vez."}
              </Text>
            </>
          )}

          {step === "find" ? (
            <TextInput
              value={query}
              onChangeText={t => {
                setQuery(t);
                setErr(null);
              }}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="E-mail ou @usuário"
              placeholderTextColor={colors.muted}
              onSubmitEditing={() => query.trim() && find()}
              style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            />
          ) : step === "code" ? (
            <TextInput
              value={code}
              onChangeText={t => {
                setCode(t.replace(/\D/g, "").slice(0, 10));
                setErr(null);
              }}
              autoFocus
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              placeholder="Código"
              placeholderTextColor={colors.muted}
              onSubmitEditing={() => code.length >= 6 && verify()}
              style={[s.input, s.code, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            />
          ) : step === "password" ? (
            <View style={[s.input, s.pwWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <TextInput
                value={pw}
                onChangeText={t => {
                  setPw(t);
                  setErr(null);
                }}
                autoFocus
                secureTextEntry={!show}
                placeholder="Senha nova"
                placeholderTextColor={colors.muted}
                onSubmitEditing={save}
                style={{ flex: 1, color: colors.text, fontSize: 15, height: "100%" }}
              />
              <Pressable onPress={() => setShow(v => !v)} hitSlop={10}>
                {show ? <EyeOff size={20} color={colors.muted} /> : <Eye size={20} color={colors.muted} />}
              </Pressable>
            </View>
          ) : null}

          {err ? <Text style={s.err}>{err}</Text> : null}

          <Pressable
            onPress={step === "find" ? find : step === "confirm" ? send : step === "code" ? verify : save}
            disabled={busy || (step === "find" && !query.trim()) || (step === "code" && code.length < 6)}
            style={[
              s.btn,
              { opacity: busy || (step === "find" && !query.trim()) || (step === "code" && code.length < 6) ? 0.5 : 1 }
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={s.btnText}>{step === "password" ? "Salvar e entrar" : "Continuar"}</Text>
            )}
          </Pressable>

          {step === "confirm" ? (
            <Pressable onPress={() => setStep("find")} style={[s.btn2, { backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.text, fontWeight: "600" }}>Não é você? Procurar outra conta</Text>
            </Pressable>
          ) : null}

          {step === "code" ? (
            <>
              <Pressable onPress={send} disabled={wait > 0 || busy} style={[s.btn2, { backgroundColor: colors.surface, opacity: wait > 0 ? 0.6 : 1 }]}>
                <Text style={{ color: colors.text, fontWeight: "600" }}>{wait > 0 ? `Reenviar código em ${wait}s` : "Reenviar código"}</Text>
              </Pressable>
              <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 14 }}>
                Não chegou? Olhe na caixa de spam e em "Promoções".
              </Text>
            </>
          ) : null}
        </ScrollView>
      </KeyboardSafeView>
    </Modal>
  );
}

const s = StyleSheet.create({
  top: { paddingHorizontal: 18, paddingBottom: 8 },
  body: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 40, maxWidth: 480, width: "100%", alignSelf: "center" },
  h: { fontSize: 24, fontWeight: "700", letterSpacing: -0.4, marginBottom: 8 },
  sub: { fontSize: 14, lineHeight: 20, marginBottom: 18 },
  input: { height: 54, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 15 },
  code: { fontSize: 22, letterSpacing: 6, textAlign: "center", fontWeight: "600" },
  pwWrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 110, height: 110, borderRadius: 55 },
  err: { color: "#ED4956", fontSize: 13, marginTop: 10 },
  btn: { height: 50, borderRadius: 25, backgroundColor: "#0095F6", alignItems: "center", justifyContent: "center", marginTop: 18 },
  btnText: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  btn2: { height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", marginTop: 10 }
});
