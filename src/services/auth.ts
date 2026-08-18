import { Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const authConfigured = Boolean(URL && KEY);

const SESSION_KEY = "guvio_auth_session_v1";

export interface AuthSession {
  user: {
    id: string;
    email: string;
  };
  access_token?: string;
}

async function authFetch(path: string, body: any) {
  if (!URL || !KEY) throw new Error("Supabase ainda não configurado no arquivo .env");
  const r = await fetch(`${URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.msg || data?.error_description || data?.message || "Falha na autenticação");
  return data;
}

export async function signUpEmail(email: string, password: string): Promise<AuthSession> {
  const data = await authFetch("signup", { email, password });
  const session: AuthSession = {
    user: {
      id: data.user?.id || `user-${Date.now()}`,
      email: data.user?.email || email
    },
    access_token: data.access_token
  };
  await saveAuthSession(session);
  return session;
}

export async function signInEmail(email: string, password: string): Promise<AuthSession> {
  const data = await authFetch("token?grant_type=password", { email, password });
  const session: AuthSession = {
    user: {
      id: data.user?.id || `user-${Date.now()}`,
      email: data.user?.email || email
    },
    access_token: data.access_token
  };
  await saveAuthSession(session);
  return session;
}

export async function startOAuth(provider: "google" | "apple") {
  if (!URL) throw new Error("Supabase ainda não configurado no arquivo .env");
  const redirect = "guvio://auth/callback";
  await Linking.openURL(`${URL}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirect)}`);
}

export async function saveAuthSession(session: AuthSession): Promise<void> {
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (e) {}
}

export async function getSavedAuthSession(): Promise<AuthSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export async function signOut(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch (e) {}
}
