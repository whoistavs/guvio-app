import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** true quando as chaves do Supabase foram configuradas no build */
export const supabaseConfigured = Boolean(URL && KEY);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(URL!, KEY!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === "web"
      }
    })
  : null;

let cachedUserId: string | null = null;

/** id do usuário logado na nuvem (ou null em modo demo / deslogado) */
export async function cloudUserId(): Promise<string | null> {
  if (!supabase) return null;
  if (cachedUserId) return cachedUserId;
  const { data } = await supabase.auth.getSession();
  cachedUserId = data.session?.user?.id ?? null;
  return cachedUserId;
}

/** O app está usando o backend real? */
export async function isCloud(): Promise<boolean> {
  return (await cloudUserId()) !== null;
}

supabase?.auth.onAuthStateChange((_event, session) => {
  cachedUserId = session?.user?.id ?? null;
});
