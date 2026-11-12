// GUVIO — função "push": manda o aviso para o celular de quem recebeu
// a notificação (curtida, comentário, seguidor...) ou a mensagem do Direct.
//
// É chamada pelos "Database Webhooks" do Supabase quando entra uma linha nova
// em public.notifications ou public.messages.
//
// Segredos (Edge Functions > Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  -> avisos do site (Web Push)
//   PUSH_WEBHOOK_SECRET                   -> senha que o webhook manda no cabeçalho x-guvio-secret
//   FIREBASE_SERVICE_ACCOUNT (opcional)   -> avisos do app Android (FCM)
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm prontos dentro do Supabase.

import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import webpush from "npm:web-push@3.6.7";

const SITE = "https://whoistavs.github.io/guvio-app/";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false }
});

webpush.setVapidDetails("mailto:guvioapp@gmail.com", Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);

type Msg = { title: string; body: string; url: string; tag?: string; pref: "like" | "comment" | "follow" | "message" };

async function username(id: string): Promise<string> {
  const { data } = await db.from("profiles").select("username").eq("id", id).maybeSingle();
  return data?.username || "alguém";
}

function cut(t: string | null | undefined, n = 120) {
  const s = (t || "").trim();
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

async function buildFromNotification(n: any): Promise<{ to: string; msg: Msg } | null> {
  if (!n?.user_id || n.user_id === n.actor_id) return null;
  const who = "@" + (await username(n.actor_id));
  const post = n.post_id ? `${SITE}?p=${n.post_id}` : SITE;
  const map: Record<string, Msg> = {
    like: { title: "Nova curtida", body: `${who} curtiu seu look.`, url: post, pref: "like", tag: `like-${n.post_id}` },
    comment_like: { title: "Curtiram seu comentário", body: `${who} curtiu: ${cut(n.text)}`, url: post, pref: "like" },
    comment: { title: "Novo comentário", body: `${who}: ${cut(n.text)}`, url: post, pref: "comment" },
    reply: { title: "Nova resposta", body: `${who}: ${cut(n.text)}`, url: post, pref: "comment" },
    follow: { title: "Novo seguidor", body: `${who} começou a seguir você.`, url: SITE, pref: "follow" },
    follow_request: { title: "Pedido para seguir", body: `${who} quer seguir você.`, url: SITE, pref: "follow" },
    story_mention: { title: "Você foi marcado", body: `${who} marcou você num story.`, url: SITE, pref: "comment" },
    repost: { title: "Repost", body: `${who} repostou seu look.`, url: post, pref: "like" }
  };
  const msg = map[n.type];
  return msg ? { to: n.user_id, msg } : null;
}

async function buildFromMessage(m: any): Promise<{ to: string; msg: Msg } | null> {
  if (!m?.recipient_id || m.deleted_at || m.sender_id === m.recipient_id) return null;
  const who = "@" + (await username(m.sender_id));
  const body = m.text ? cut(m.text) : m.image_url ? "enviou uma foto" : m.post_id ? "enviou um look" : "nova mensagem";
  return { to: m.recipient_id, msg: { title: who, body, url: SITE, pref: "message", tag: `dm-${m.sender_id}` } };
}

// ---------- FCM (app Android) ----------
let fcmToken: { value: string; exp: number } | null = null;

function b64url(data: ArrayBuffer | string) {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = "";
  bytes.forEach(b => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function fcmAccess(sa: any): Promise<string> {
  if (fcmToken && fcmToken.exp > Date.now() + 60_000) return fcmToken.value;
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600
    })
  );
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${claim}`));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${head}.${claim}.${b64url(sig)}`
  });
  const j = await res.json();
  fcmToken = { value: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return fcmToken.value;
}

async function sendFcm(token: string, msg: Msg): Promise<"ok" | "gone" | "fail"> {
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!raw) return "fail";
  const sa = JSON.parse(raw);
  const access = await fcmAccess(sa);
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { authorization: `Bearer ${access}`, "content-type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: msg.title, body: msg.body },
        data: { url: msg.url },
        android: { priority: "high", notification: { channel_id: "default", tag: msg.tag } }
      }
    })
  });
  if (res.ok) return "ok";
  return res.status === 404 || res.status === 400 ? "gone" : "fail";
}

// ---------- entrada ----------
Deno.serve(async req => {
  const secret = Deno.env.get("PUSH_WEBHOOK_SECRET");
  if (secret && req.headers.get("x-guvio-secret") !== secret) return new Response("forbidden", { status: 403 });

  const payload = await req.json().catch(() => null);
  if (!payload || payload.type !== "INSERT") return new Response("ignored");

  const built =
    payload.table === "notifications"
      ? await buildFromNotification(payload.record)
      : payload.table === "messages"
      ? await buildFromMessage(payload.record)
      : null;
  if (!built) return new Response("nothing");

  const { data: subs } = await db.from("push_subscriptions").select("*").eq("user_id", built.to);
  let sent = 0;
  for (const s of subs || []) {
    const prefs = s.prefs || {};
    if (prefs.pauseAll || prefs[built.msg.pref] === false) continue;
    try {
      if (s.kind === "web") {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: built.msg.title, body: built.msg.body, url: built.msg.url, tag: built.msg.tag }),
          { TTL: 60 * 60 * 24 }
        );
        sent++;
      } else if (s.kind === "fcm") {
        const r = await sendFcm(s.endpoint, built.msg);
        if (r === "ok") sent++;
        if (r === "gone") await db.from("push_subscriptions").delete().eq("id", s.id);
      }
    } catch (e: any) {
      // inscrição expirada (pessoa desinstalou / limpou o navegador): remove
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
    }
  }
  return new Response(JSON.stringify({ sent }), { headers: { "content-type": "application/json" } });
});
