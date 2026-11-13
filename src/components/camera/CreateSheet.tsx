import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CircleFadingPlus, Clapperboard, Grid3x3, Heart, Shirt } from "lucide-react-native";
import { useAppTheme } from "../../context/AppTheme";

export type CreateChoice = "post" | "story" | "video" | "highlight" | "clothing";

/** menu "Criar" do + na aba Perfil (igual ao Instagram) */
export function CreateSheet({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (c: CreateChoice) => void }) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const rows: { id: CreateChoice; label: string; Icon: any }[] = [
    { id: "video", label: "Drip (vídeo)", Icon: Clapperboard },
    { id: "post", label: "Publicação", Icon: Grid3x3 },
    { id: "story", label: "Story", Icon: CircleFadingPlus },
    { id: "highlight", label: "Destaque dos stories", Icon: Heart },
    { id: "clothing", label: "Peça no guarda-roupa", Icon: Shirt }
  ];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,.35)" }} onPress={onClose} />
      <View style={[s.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 18 }]}>
        <View style={[s.grabber, { backgroundColor: colors.border }]} />
        <Text style={[s.title, { color: colors.text }]}>Criar</Text>
        {rows.map(({ id, label, Icon }) => (
          <Pressable
            key={id}
            onPress={() => {
              onClose();
              setTimeout(() => onPick(id), 250);
            }}
            style={({ pressed }) => [s.row, { borderTopColor: colors.border, opacity: pressed ? 0.6 : 1 }]}
          >
            <Icon size={24} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: 16 }}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingTop: 10 },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, marginBottom: 12 },
  title: { textAlign: "center", fontWeight: "800", fontSize: 16, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 15, borderTopWidth: StyleSheet.hairlineWidth }
});
