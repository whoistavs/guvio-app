// GUVIO — função "recover": "Esqueci minha senha" estilo app
//   find   -> acha a conta pelo e-mail ou @ e mostra foto, @ e e-mail mascarado
//   send   -> manda o e-mail com o código (e o link) para a conta achada
//   verify -> confere o código e devolve a sessão para criar a senha nova
// O e-mail completo nunca volta para o aparelho.
// SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY já vêm prontos no Supabase.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SITE = "https://guvioapp.github.io/guvio-app/";
const URL = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const anon = () => createClient(URL, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS"
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

function mask(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "";
  const keep = user.length <= 2 ? user.slice(0, 1) : user.slice(0, 2);
  return `${keep}${"•".repeat(Math.max(3, Math.min(8, user.length - keep.length)))}@${domain}`;
}

/** acha a conta (perfil + e-mail) pelo e-mail ou pelo @ */
async function findAccount(q: string) {
  const query = q.trim().replace(/^@/, "").toLowerCase();
  if (!query || query.length > 120) return null;
  let profile: any = null;
  let email: string | null = null;
  if (query.includes("@")) {
    // e-mail: procura no auth (páginas de 1000) — ok para o tamanho do beta
    for (let page = 1; page <= 20 && !email; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      const u = data?.users.find(x => (x.email || "").toLowerCase() === query);
      if (u) {
        email = u.email!;
        const { data: p } = await admin.from("profiles").select("id, username, display_name, avatar_url").eq("id", u.id).maybeSingle();
        profile = p;
      }
      if (!data || data.users.length < 1000) break;
    }
  } else {
    const { data: p } = await admin.from("profiles").select("id, username, display_name, avatar_url").ilike("username", query).maybeSingle();
    if (p) {
      profile = p;
      const { data } = await admin.auth.admin.getUserById(p.id);
      email = data?.user?.email || null;
    }
  }
  if (!email) return null;
  return { email, profile };
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const acc = await findAccount(String(body.query || ""));
  if (!acc) return json({ error: "not_found" }, 404);

  if (action === "find") {
    return json({
      username: acc.profile?.username || "",
      displayName: acc.profile?.display_name || "",
      avatar: acc.profile?.avatar_url || "",
      maskedEmail: mask(acc.email)
    });
  }

  if (action === "send") {
    const { error } = await anon().auth.resetPasswordForEmail(acc.email, { redirectTo: SITE });
    if (error) return json({ error: /rate|seconds|limit/i.test(error.message) ? "wait" : "send_failed", detail: error.message }, 429);
    return json({ ok: true, maskedEmail: mask(acc.email) });
  }

  if (action === "verify") {
    const code = String(body.code || "").replace(/\D/g, "");
    if (code.length < 6) return json({ error: "bad_code" }, 400);
    const { data, error } = await anon().auth.verifyOtp({ email: acc.email, token: code, type: "recovery" });
    if (error || !data.session) return json({ error: "bad_code" }, 400);
    return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  }

  return json({ error: "bad_action" }, 400);
});
