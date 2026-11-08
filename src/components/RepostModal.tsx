import React, { useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardSafeView } from "./KeyboardSafeView";
import { Repeat2 } from "lucide-react-native";
import { FeedPost } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { FastImage } from "./FastImage";
import { repostLook } from "../services/storage";
import { toast } from "./motion";
import { successFeedback } from "../utils/haptics";

/** Repostar o look de alguém no seu perfil, com crédito e sua legenda */
export function RepostModal({ post, onClose, onDone }: { post: FeedPost | null; onClose: () => void; onDone?: (p: FeedPost) => void }) {
  const { colors } = useAppTheme();
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  if (!post) return null;
  const author = post.originalUsername || post.creatorUsername || post.creatorName;

  const go = async () => {
    setBusy(true);
    try {
      const p = await repostLook(post, caption.trim());
      successFeedback();
      onDone?.(p);
      onClose();
      setCaption("");
      setTimeout(() => toast(`Repostado! Crédito para @${author}`), 250);
    } catch (e: any) {
      Alert.alert("Não deu para repostar", e?.message || "Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardSafeView style={s.back} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <View style={s.row}>
            <FastImage source={post.image} style={s.thumb} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>Repostar look</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>O crédito vai para @{author}</Text>
            </View>
          </View>
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder="Diga algo sobre esse look (opcional)"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={500}
            style={[s.input, { backgroundColor: colors.surface, color: colors.text }]}
          />
          <Pressable onPress={go} disabled={busy} style={[s.btn, { backgroundColor: colors.text }]}>
            {busy ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <>
                <Repeat2 size={18} color={colors.bg} />
                <Text style={{ color: colors.bg, fontWeight: "700" }}>Repostar no meu perfil</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardSafeView>
    </Modal>
  );
}

const s = StyleSheet.create({
  back: { flex: 1, backgroundColor: "rgba(0,0,0,.5)" },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, borderTopWidth: 1, padding: 20, paddingBottom: 34, gap: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: { width: 54, height: 54, borderRadius: 12 },
  input: { minHeight: 80, borderRadius: 14, padding: 12, textAlignVertical: "top" },
  btn: { height: 48, borderRadius: 24, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" }
});
