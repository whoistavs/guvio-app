import { Linking, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { FastStorage } from "./FastStorage";
import { registerNewProfile, isUsernameTaken, loadSavedProfile } from "./storage";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const authConfigured = Boolean(URL && KEY);

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

async function authFetch(path: string, body: any) {
  if (!URL || !KEY) throw new Error("Supabase ainda não configurado");
  const r = await fetch(`${URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) {
    const errorMsg = data?.msg || data?.error_description || data?.message || "Falha na autenticação";
    throw new Error(errorMsg);
  }
  return data;
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

  let cloudUserId: string | null = null;
  let accessToken: string | undefined = undefined;

  if (authConfigured) {
    try {
      const data = await authFetch("signup", {
        email: cleanEmail,
        password,
        data: {
          username: cleanUsername,
          display_name: cleanDisplayName
        }
      });
      cloudUserId = data.user?.id;
      accessToken = data.access_token;
    } catch (e) {
      // If cloud signup fails, continue with local creation
    }
  }

  const userId = cloudUserId || `user-${Date.now()}`;
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
    access_token: accessToken || "local-token"
  };

  await saveAuthSession(session);
  return session;
}

export async function signInEmail(loginIdentifier: string, password: string): Promise<AuthSession> {
  const cleanId = loginIdentifier.trim().toLowerCase().replace(/^@/, "");

  if (authConfigured && cleanId.includes("@")) {
    try {
      const data = await authFetch("token?grant_type=password", { email: cleanId, password });
      const session: AuthSession = {
        user: {
          id: data.user?.id || `user-${Date.now()}`,
          email: data.user?.email || cleanId,
          username: data.user?.user_metadata?.username || cleanId.split("@")[0],
          displayName: data.user?.user_metadata?.display_name || cleanId.split("@")[0]
        },
        access_token: data.access_token
      };
      await saveAuthSession(session);
      return session;
    } catch (e: any) {
      if (e.message?.includes("Invalid login credentials")) {
        throw new Error("E-mail ou senha incorretos.");
      }
    }
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
  if (!URL) throw new Error("Supabase ainda não configurado");
  const redirect = "guvio://auth/callback";
  await Linking.openURL(`${URL}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirect)}`);
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  try {
    await setSecureItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {}
}

export async function getSavedAuthSession(): Promise<AuthSession | null> {
  try {
    const raw = await getSecureItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export async function signOut(): Promise<void> {
  try {
    await deleteSecureItem(SESSION_KEY);
  } catch (e) {}
}

