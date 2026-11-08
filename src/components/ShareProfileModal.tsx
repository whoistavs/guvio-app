import React from "react";
import { Modal, Pressable, Share, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Share2, X } from "lucide-react-native";
import { useAppTheme } from "../context/AppTheme";
import { profileLink } from "../utils/profileLink";
import { FastImage } from "./FastImage";

export function ShareProfileModal({
  visible,
  onClose,
  username,
  displayName,
  avatar
}: {
  visible: boolean;
  onClose: () => void;
  username: string;
  displayName?: string;
  avatar?: string;
}) {
  const { colors } = useAppTheme();
  const link = profileLink(username);

  const share = async () => {
    try {
      await Share.share({
        message: `Veja os looks de @${username} no Guvio: ${link}`,
        url: link
      });
    } catch {}
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.back}>
        <View style={[s.card, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <Pressable onPress={onClose} hitSlop={12} style={s.close}>
            <X size={22} color={colors.icon} />
          </Pressable>
          <FastImage source={avatar || ""} style={s.avatar} contentFit="cover" />
          <Text style={[s.user, { color: colors.text }]}>@{username}</Text>
          {displayName ? <Text style={{ color: colors.muted, marginBottom: 14 }}>{displayName}</Text> : null}
          <View style={s.qr}>
            <QRCode value={link} size={200} color="#050608" backgroundColor="#FFFFFF" />
          </View>
          <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 12 }}>
            Aponte a câmera do celular para abrir este perfil no Guvio.
          </Text>
          <Pressable onPress={share} style={[s.btn, { backgroundColor: colors.text }]}>
            <Share2 size={16} color={colors.bg} />
            <Text style={{ color: colors.bg, fontWeight: "700" }}>Compartilhar link</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  back: { flex: 1, backgroundColor: "rgba(0,0,0,.6)", alignItems: "center", justifyContent: "center", padding: 22 },
  card: { width: "100%", maxWidth: 360, borderRadius: 28, borderWidth: 1, padding: 22, alignItems: "center" },
  close: { alignSelf: "flex-end" },
  avatar: { width: 72, height: 72, borderRadius: 36, marginBottom: 8 },
  user: { fontSize: 18, fontWeight: "700" },
  qr: { padding: 14, backgroundColor: "#FFFFFF", borderRadius: 22 },
  btn: { marginTop: 18, alignSelf: "stretch", height: 46, borderRadius: 23, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" }
});
