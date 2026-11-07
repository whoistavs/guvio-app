/** link que abre um perfil direto no app: guvio://u/<username> */
export function profileLink(username: string): string {
  return `guvio://u/${encodeURIComponent(username.replace(/^@/, ""))}`;
}

/** lê o username de um link de perfil (guvio://u/ana, guvio:///u/ana ou .../u/ana) */
export function parseProfileLink(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:^guvio:\/\/\/?|\/)u\/([^/?#]+)/i);
  if (!m) return null;
  try {
    const name = decodeURIComponent(m[1]).replace(/^@/, "").trim();
    return name || null;
  } catch {
    return null;
  }
}
