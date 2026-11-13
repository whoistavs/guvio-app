import { supabase } from "./supabase";
import { FastStorage } from "./FastStorage";
import { getSecureItem, setSecureItem, deleteSecureItem } from "./auth";
import { clearMyCache, loadSavedProfile } from "./storage";

/**
 * Várias contas no mesmo aparelho (igual ao Instagram).
 * A lista (foto e @) fica no armazenamento normal; o "login guardado"
 * (refresh token) de cada conta fica no armazenamento seguro do aparelho.
 */
export interface SavedAccount {
  userId: string;
  username: string;
  displayName: string;
  avatar: string;
}

const LIST_KEY = "guvio_accounts_list_v1";
const tokenKey = (id: string) => `guvio_acct_${id.replace(/[^a-zA-Z0-9]/g, "")}`;

export function savedAccounts(): SavedAccount[] {
  return FastStorage.getItemSync<SavedAccount[]>(LIST_KEY, []);
}

function saveList(list: SavedAccount[]) {
  FastStorage.setItemSync(LIST_KEY, list);
}

/** guarda/atualiza a conta que está logada agora (chamar ao entrar e quando o login renova) */
export async function rememberCurrentAccount(): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.refresh_token) return;
  await setSecureItem(tokenKey(session.user.id), session.refresh_token);
  let info: SavedAccount = {
    userId: session.user.id,
    username: (session.user.user_metadata as any)?.username || session.user.email?.split("@")[0] || "",
    displayName: (session.user.user_metadata as any)?.display_name || "",
    avatar: ""
  };
  try {
    const p = await loadSavedProfile();
    if (p?.id === session.user.id) info = { ...info, username: p.username || info.username, displayName: p.displayName || "", avatar: p.avatar || "" };
  } catch {}
  const list = savedAccounts().filter(a => a.userId !== info.userId);
  saveList([info, ...list].slice(0, 5));
}

/** só guarda o token novo (o Supabase troca o refresh token de tempos em tempos) */
export async function updateStoredToken(userId: string, refreshToken: string) {
  if (!savedAccounts().some(a => a.userId === userId)) return;
  await setSecureItem(tokenKey(userId), refreshToken);
}

export async function forgetAccount(userId: string): Promise<void> {
  saveList(savedAccounts().filter(a => a.userId !== userId));
  await deleteSecureItem(tokenKey(userId)).catch(() => {});
}

export async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id || null;
}

/** troca para outra conta salva; devolve false se o login dela venceu (aí precisa entrar de novo) */
export async function switchToAccount(userId: string): Promise<boolean> {
  if (!supabase) return false;
  await rememberCurrentAccount().catch(() => {});
  const token = await getSecureItem(tokenKey(userId));
  if (!token) return false;
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: token });
  if (error || !data.session) {
    await forgetAccount(userId);
    return false;
  }
  await setSecureItem(tokenKey(userId), data.session.refresh_token);
  clearMyCache();
  return true;
}

/** "Adicionar conta": sai só deste aparelho, sem invalidar o login guardado da conta atual */
export async function signOutForNewAccount(): Promise<void> {
  if (!supabase) return;
  await rememberCurrentAccount().catch(() => {});
  clearMyCache();
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
}
