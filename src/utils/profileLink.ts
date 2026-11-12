/** link que abre um perfil direto no app: guvio://u/<username> */
export function profileLink(username: string): string {
  return `guvio://u/${encodeURIComponent(username.replace(/^@/, ""))}`;
}

/** lê o username de um link de perfil (guvio://u/ana, guvio:///u/ana ou .../u/ana) */
export function parseProfileLink(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:^guvio:\/\/\/?|\/)u\/([^/?#]+)/i) || url.match(/[?&]u=([^&#]+)/);
  if (!m) return null;
  try {
    const name = decodeURIComponent(m[1]).replace(/^@/, "").trim();
    return name || null;
  } catch {
    return null;
  }
}

/** endereço do site (GitHub Pages) */
export const SITE_URL = "https://guvioapp.github.io/guvio-app/";

/** link de um post: abre no site e, com ?p=, já mostra o post */
export function postWebLink(postId: string): string {
  return `${SITE_URL}?p=${encodeURIComponent(postId)}`;
}
export function postAppLink(postId: string): string {
  return `guvio://p/${encodeURIComponent(postId)}`;
}

/** lê o id do post de guvio://p/<id>, .../p/<id> ou ...?p=<id> */
export function parsePostLink(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:^guvio:\/\/\/?|\/)p\/([^/?#]+)/i) || url.match(/[?&]p=([^&#]+)/);
  if (!m) return null;
  try {
    const id = decodeURIComponent(m[1]).trim();
    return /^[\w-]{4,64}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** link de convite: o site com ?convite=<usuário> */
export function inviteLink(username: string): string {
  return `${SITE_URL}?convite=${encodeURIComponent(username)}`;
}
/** lê o @ de quem convidou: ...?convite=ana ou guvio://convite/ana */
export function parseInviteLink(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/[?&]convite=([^&#]+)/i) || url.match(/^guvio:\/\/\/?convite\/([^/?#]+)/i);
  if (!m) return null;
  try {
    const u = decodeURIComponent(m[1]).trim().replace(/^@/, "").toLowerCase();
    return /^[a-z0-9._]{2,30}$/.test(u) ? u : null;
  } catch {
    return null;
  }
}
