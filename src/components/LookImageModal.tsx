import React, { useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { Download, Share2, X } from "lucide-react-native";
import { captureRef } from "react-native-view-shot";
import { FeedPost } from "../data/mockData";
import { FastImage } from "./FastImage";
import { postWebLink } from "../utils/profileLink";
import { successFeedback } from "../utils/haptics";
import { toast } from "./motion";

const W = 270;
const H = 480;
const BGS = ["#0E0F12", "#F2EDE4", "#1E2A44", "#5A1E2B"];

/** desenha o cartão num canvas (site): evita problemas de captura com fotos de outro domínio */
async function renderWebCard(post: FeedPost, bg: string): Promise<string> {
  const cw = 1080, ch = 1920;
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  const g = c.getContext("2d")!;
  const light = bg === "#F2EDE4";
  const fg = light ? "#111111" : "#FFFFFF";
  g.fillStyle = bg;
  g.fillRect(0, 0, cw, ch);
  const img = await new Promise<HTMLImageElement>((ok, fail) => {
    const i = new window.Image();
    i.crossOrigin = "anonymous";
    i.onload = () => ok(i);
    i.onerror = () => fail(new Error("Não foi possível carregar a foto"));
    i.src = post.image;
  });
  // foto 4:5 centralizada, cortada como "cover"
  const px = 90, py = 230, pw = cw - 180, ph = Math.round(pw * 1.25);
  const scale = Math.max(pw / img.width, ph / img.height);
  const sw = pw / scale, sh = ph / scale;
  g.save();
  const r = 48;
  g.beginPath();
  g.moveTo(px + r, py);
  g.arcTo(px + pw, py, px + pw, py + ph, r);
  g.arcTo(px + pw, py + ph, px, py + ph, r);
  g.arcTo(px, py + ph, px, py, r);
  g.arcTo(px, py, px + pw, py, r);
  g.closePath();
  g.clip();
  g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, px, py, pw, ph);
  g.restore();
  g.fillStyle = fg;
  g.textAlign = "center";
  g.font = "900 64px system-ui, -apple-system, sans-serif";
  g.fillText("GUVIO", cw / 2, 150);
  g.font = "800 54px system-ui, -apple-system, sans-serif";
  g.fillText(`@${post.creatorUsername || post.creatorName}`, cw / 2, py + ph + 110);
  g.globalAlpha = 0.7;
  g.font = "600 38px system-ui, -apple-system, sans-serif";
  const sub = [post.city, post.styleTag].filter(Boolean).join(" · ");
  if (sub) g.fillText(sub, cw / 2, py + ph + 170);
  const pieces = (post.clothingTags || []).slice(0, 3).map(t => t.name).join(" + ");
  if (pieces) g.fillText(pieces.length > 48 ? pieces.slice(0, 46) + "…" : pieces, cw / 2, py + ph + 230);
  g.font = "600 32px system-ui, -apple-system, sans-serif";
  g.fillText("guvioapp.github.io/guvio-app", cw / 2, ch - 80);
  g.globalAlpha = 1;
  return c.toDataURL("image/jpeg", 0.92);
}

/** Compartilhar o look como imagem 9:16 (para o story do Instagram, WhatsApp...) */
export function LookImageModal({ post, onClose }: { post: FeedPost | null; onClose: () => void }) {
  const ref = useRef<View>(null);
  const [bg, setBg] = useState(BGS[0]);
  const [busy, setBusy] = useState(false);
  if (!post) return null;
  const light = bg === "#F2EDE4";
  const fg = light ? "#111" : "#FFF";
  const who = post.creatorUsername || post.creatorName;
  const pieces = (post.clothingTags || []).slice(0, 3).map(t => t.name).join(" + ");

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (Platform.OS === "web") {
        const data = await renderWebCard(post, bg);
        const blob = await (await fetch(data)).blob();
        const file = new File([blob], `guvio-${post.id.slice(0, 8)}.jpg`, { type: "image/jpeg" });
        const nav: any = typeof navigator !== "undefined" ? navigator : null;
        if (nav?.canShare?.({ files: [file] })) {
          await nav.share({ files: [file], text: `Look de @${who} no Guvio ${postWebLink(post.id)}` }).catch(() => {});
        } else {
          const a = document.createElement("a");
          a.href = data;
          a.download = file.name;
          a.click();
          toast("Imagem baixada", "⬇️");
        }
      } else {
        const uri = await captureRef(ref, { format: "jpg", quality: 0.92, result: "tmpfile", width: 1080, height: 1920 });
        await Share.share({ url: uri, message: `Look de @${who} no Guvio ${postWebLink(post.id)}` });
      }
      successFeedback();
    } catch (e: any) {
      Alert.alert("Não deu para gerar a imagem", e?.message || "Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.back}>
        <View style={s.head}>
          <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 16 }}>Compartilhar como imagem</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <X size={22} color="#FFF" />
          </Pressable>
        </View>
        <View ref={ref} collapsable={false} style={[s.canvas, { backgroundColor: bg }]}>
          <Text style={[s.brand, { color: fg }]}>GUVIO</Text>
          <FastImage source={post.image} style={s.photo} contentFit="cover" />
          <Text style={[s.user, { color: fg }]} numberOfLines={1}>
            @{who}
          </Text>
          {post.city || post.styleTag ? (
            <Text style={[s.sub, { color: fg }]} numberOfLines={1}>
              {[post.city, post.styleTag].filter(Boolean).join(" · ")}
            </Text>
          ) : null}
          {pieces ? (
            <Text style={[s.sub, { color: fg }]} numberOfLines={1}>
              {pieces}
            </Text>
          ) : null}
          <Text style={[s.site, { color: fg }]}>guvioapp.github.io/guvio-app</Text>
        </View>
        <View style={s.bgs}>
          {BGS.map(c => (
            <Pressable key={c} onPress={() => setBg(c)} style={[s.bgDot, { backgroundColor: c, borderColor: bg === c ? "#FFF" : "rgba(255,255,255,.3)" }]} />
          ))}
        </View>
        <Pressable onPress={share} disabled={busy} style={[s.btn, { opacity: busy ? 0.6 : 1 }]}>
          {busy ? (
            <ActivityIndicator color="#111" />
          ) : (
            <>
              {Platform.OS === "web" ? <Download size={18} color="#111" /> : <Share2 size={18} color="#111" />}
              <Text style={{ color: "#111", fontWeight: "700" }}>{Platform.OS === "web" ? "Baixar / compartilhar" : "Compartilhar"}</Text>
            </>
          )}
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  back: { flex: 1, backgroundColor: "rgba(0,0,0,.88)", alignItems: "center", justifyContent: "center", gap: 14, padding: 20 },
  head: { width: W, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  canvas: { width: W, height: H, borderRadius: 18, overflow: "hidden", alignItems: "center", paddingTop: 22 },
  brand: { fontWeight: "700", fontSize: 16, letterSpacing: 2, marginBottom: 14 },
  photo: { width: W - 46, height: (W - 46) * 1.25, borderRadius: 12 },
  user: { fontWeight: "700", fontSize: 14, marginTop: 14 },
  sub: { fontSize: 10, opacity: 0.7, marginTop: 3, paddingHorizontal: 16 },
  site: { position: "absolute", bottom: 14, fontSize: 8, opacity: 0.7 },
  bgs: { flexDirection: "row", gap: 12 },
  bgDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2 },
  btn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFF", height: 50, borderRadius: 16, paddingHorizontal: 24 }
});
