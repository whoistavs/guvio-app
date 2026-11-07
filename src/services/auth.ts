import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { FastStorage } from "./FastStorage";
import { registerNewProfile, isUsernameTaken, loadSavedProfile, clearMyCache } from "./storage";
import { supabase, supabaseConfigured } from "./supabase";
import type { Session } from "@supabase/supabase-js";
import * as WebBrowser from "expo-web-browser";
import { deleteMyAccount as cloudDeleteMyAccount } from "./cloud";

WebBrowser.maybeCompleteAuthSession();

export const authConfigured = supabaseConfigured;
export const AUTH_REDIRECT = "guvio://auth/callback";

/** Erro especial: conta criada, mas o Supabase exige confirmar o e-mail */
export class ConfirmEmailError extends Error {}

function fromCloudSession(s: Session): AuthSession {
  const meta: any = s.user.user_metadata || {};
  const email = s.user.email || "";
  return {
    user: {
      id: s.user.id,
      email,
      username: meta.username || email.split("@")[0],
      displayName: meta.display_name || meta.full_name || meta.username || email.split("@")[0]
    },
    access_token: s.access_token
  };
}

function translateAuthError(msg?: string): string {
  const m = (msg || "").toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Este e-mail já está cadastrado. Faça login na sua conta.";
  if (m.includes("password")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (m.includes("rate limit")) return "Muitas tentativas. Aguarde um minuto e tente de novo.";
  if (m.includes("network") || m.includes("fetch")) return "Sem conexão com o servidor. Verifique sua internet.";
  return msg || "Não foi possível autenticar.";
}

async function cloudSignUp(email: string, password: string, username: string, displayName: string): Promise<AuthSession> {
  const { data: free } = await supabase!.rpc("username_available", { name: username });
  if (free === false) throw new Error(`O @${username} já está em uso. Por favor, escolha outro nome de usuário.`);
  const { data, error } = await supabase!.auth.signUp({
    email,
    password,
    options: { data: { username, display_name: displayName }, emailRedirectTo: AUTH_REDIRECT }
  });
  if (error) throw new Error(translateAuthError(error.message));
  if (!data.session) {
    throw new ConfirmEmailError(
      `Conta criada! Enviamos um link de confirmação para ${email}. Abra o e-mail, confirme e depois faça login.`
    );
  }
  return fromCloudSession(data.session);
}

async function cloudSignIn(identifier: string, password: string): Promise<AuthSession> {
  if (!identifier.includes("@") || identifier.startsWith("@")) {
    throw new Error("Para entrar, use o e-mail da sua conta.");
  }
  const { data, error } = await supabase!.auth.signInWithPassword({ email: identifier, password });
  if (error || !data.session) throw new Error(translateAuthError(error?.message));
  return fromCloudSession(data.session);
}

/** Quais logins sociais estão ligados no painel do Supabase (demo: todos) */
export async function getEnabledProviders(): Promise<{ google: boolean; apple: boolean }> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { google: true, apple: true };
  try {
    const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    const data = await r.json();
    return { google: Boolean(data?.external?.google), apple: Boolean(data?.external?.apple) };
  } catch (e) {
    return { google: false, apple: false };
  }
}

/** Trata o retorno do login com Google/Apple ou do link de confirmação de e-mail */
export async function handleAuthRedirect(url: string | null): Promise<boolean> {
  if (!url || !supabase || !url.includes("auth/callback")) return false;
  const hash = url.split("#")[1] || "";
  const query = (url.split("?")[1] || "").split("#")[0];
  const params = new URLSearchParams(hash || query);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  const code = new URLSearchParams(query).get("code");
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    return !error;
  }
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return !error;
  }
  return false;
}

const SESSION_KEY = "guvio_auth_session_v2";
const ACCOUNTS_KEY = "guvio_auth_accounts_v2";

export interface StoredAccount {
  id: string;
  email: string;
  passwordHash?: string;
  password?: string; // Mantido para migração retrocompatível
  username: string;
  displayName: string;
  avatar: string;
  createdAt: string;
}

export interface AuthSession {
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string;
  };
  access_token?: string;
}

// Utilitários de Armazenamento Seguro (Expo SecureStore no iOS/Android + Fallback Web)
async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS !== "web" && (await SecureStore.isAvailableAsync())) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
  } catch (e) {}
  await AsyncStorage.setItem(key, value);
}

async function getSecureItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS !== "web" && (await SecureStore.isAvailableAsync())) {
      const val = await SecureStore.getItemAsync(key);
      if (val !== null) return val;
    }
  } catch (e) {}
  return await AsyncStorage.getItem(key);
}

async function deleteSecureItem(key: string): Promise<void> {
  try {
    if (Platform.OS !== "web" && (await SecureStore.isAvailableAsync())) {
      await SecureStore.deleteItemAsync(key);
    }
  } catch (e) {}
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {}
}

// Função determinística para hashing seguro de senhas (SHA-256)
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`guvio_salt_${password}`);
  if (typeof crypto !== "undefined" && crypto.subtle && crypto.subtle.digest) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  }
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < password.length; i++) {
    const ch = password.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

export async function getStoredAccounts(): Promise<StoredAccount[]> {
  return FastStorage.getItemSync(ACCOUNTS_KEY, []);
}

export async function saveStoredAccounts(accounts: StoredAccount[]): Promise<void> {
  FastStorage.setItemSync(ACCOUNTS_KEY, accounts);
}

export async function signUpEmail(
  email: string,
  password: string,
  username?: string,
  displayName?: string
): Promise<AuthSession> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanUsername = (username || email.split("@")[0]).trim().toLowerCase().replace(/[^a-z0-9._]/g, "");
  const cleanDisplayName = (displayName || cleanUsername).trim();

  if (supabaseConfigured) {
    return cloudSignUp(cleanEmail, password, cleanUsername, cleanDisplayName);
  }

  // Check if username is already taken
  const taken = await isUsernameTaken(cleanUsername);
  if (taken) {
    throw new Error(`O @${cleanUsername} já está em uso. Por favor, escolha outro nome de usuário.`);
  }

  // Check if email is already registered locally
  const accounts = await getStoredAccounts();
  const existingEmail = accounts.find(a => a.email.toLowerCase() === cleanEmail);
  if (existingEmail) {
    throw new Error("Este e-mail já está cadastrado. Faça login na sua conta.");
  }

  const userId = `user-${Date.now()}`;
  const defaultAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200";

  // Gerar hash seguro da senha
  const passwordHash = await hashPassword(password);

  // Create new local account com senha criptografada em hash
  const newAccount: StoredAccount = {
    id: userId,
    email: cleanEmail,
    passwordHash: passwordHash,
    username: cleanUsername,
    displayName: cleanDisplayName,
    avatar: defaultAvatar,
    createdAt: new Date().toISOString()
  };

  const updatedAccounts = [newAccount, ...accounts];
  await saveStoredAccounts(updatedAccounts);

  // Register public profile in the community directory
  await registerNewProfile({
    id: userId,
    username: cleanUsername,
    displayName: cleanDisplayName,
    avatar: defaultAvatar,
    location: "Brasil",
    followers: 0,
    following: 0,
    postsCount: 0,
    bio: "Novo criador de estilo na comunidade Guvio ✨",
    website: `guvio.app/@${cleanUsername}`
  });

  const session: AuthSession = {
    user: {
      id: userId,
      email: cleanEmail,
      username: cleanUsername,
      displayName: cleanDisplayName
    },
    access_token: "local-token"
  };

  await saveAuthSession(session);
  return session;
}

export async function signInEmail(loginIdentifier: string, password: string): Promise<AuthSession> {
  const cleanId = loginIdentifier.trim().toLowerCase().replace(/^@/, "");

  if (supabaseConfigured) {
    return cloudSignIn(cleanId, password);
  }

  // Validate against stored local accounts database
  const accounts = await getStoredAccounts();
  const foundAccount = accounts.find(
    a => a.email.toLowerCase() === cleanId || a.username.toLowerCase() === cleanId
  );

  if (!foundAccount) {
    throw new Error(
      `Nenhuma conta encontrada para "${loginIdentifier}". Verifique os dados ou crie sua conta.`
    );
  }

  // Validação por hash com suporte a migração de senhas antigas em texto puro
  const inputHash = await hashPassword(password);
  const isMatch = foundAccount.passwordHash
    ? foundAccount.passwordHash === inputHash
    : foundAccount.password === password;

  if (!isMatch) {
    throw new Error("Senha incorreta. Por favor, tente novamente.");
  }

  // Migrar conta antiga para hash se ainda estiver em texto puro
  if (!foundAccount.passwordHash) {
    foundAccount.passwordHash = inputHash;
    delete foundAccount.password;
    await saveStoredAccounts(accounts);
  }

  // Retrieve full profile
  const profile = await loadSavedProfile(foundAccount.id);

  const session: AuthSession = {
    user: {
      id: foundAccount.id,
      email: foundAccount.email,
      username: profile.username || foundAccount.username,
      displayName: profile.displayName || foundAccount.displayName
    },
    access_token: "local-session"
  };

  await saveAuthSession(session);
  return session;
}

export async function startOAuth(provider: "google" | "apple") {
  if (!supabase) throw new Error("Login com Google/Apple precisa do servidor configurado.");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: Platform.OS !== "web" }
  });
  if (error) throw new Error(translateAuthError(error.message));
  if (data?.url && Platform.OS !== "web") {
    // abre o login dentro do app e volta sozinho para guvio://auth/callback
    const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT);
    if (result.type === "success") {
      const ok = await handleAuthRedirect(result.url);
      if (!ok) throw new Error("Não foi possível concluir o login.");
    }
  }
}

/** Apaga a conta logada e tudo dela, depois sai */
export async function deleteAccount(): Promise<void> {
  if (supabase) {
    await cloudDeleteMyAccount();
    await signOut();
    return;
  }
  const session = await getSavedAuthSession();
  const accounts = await getStoredAccounts();
  await saveStoredAccounts(accounts.filter(a => a.id !== session?.user.id));
  await signOut();
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  try {
    await setSecureItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {}
}

export async function getSavedAuthSession(): Promise<AuthSession | null> {
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    return data.session ? fromCloudSession(data.session) : null;
  }
  try {
    const raw = await getSecureItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export async function signOut(): Promise<void> {
  clearMyCache();
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
  }
  try {
    await deleteSecureItem(SESSION_KEY);
  } catch (e) {}
}

