import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { topPad } from "../utils/insets";
import { Check, X } from "lucide-react-native";
import { WardrobeItem } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { FastImage } from "./FastImage";
import { colorInfo, suggestMatches } from "../utils/colorHarmony";
import { slotOf } from "../utils/dailyLook";
import { tapFeedback } from "../utils/haptics";

const SLOT_LABEL: Record<string, string> = {
  parteDeCima: "Parte de cima",
  parteDeBaixo: "Parte de baixo",
  pecaUnica: "Peça única",
  calcado: "Calçados",
  casaco: "Casacos",
  acessorio: "Acessórios",
  outro: "Outras"
};

/** "O que combina com esta peça?": sugere peças do guarda-roupa por cor e parte do corpo */
export function MatchPiecesModal({
  item,
  wardrobe,
  onClose,
  onSaveLook
}: {
  item: WardrobeItem | null;
  wardrobe: WardrobeItem[];
  onClose: () => void;
  onSaveLook: (ids: string[]) => void;
}) {
  const { colors } = useAppTheme();
  const [picked, setPicked] = useState<string[]>([]);
  const matches = useMemo(() => (item ? suggestMatches(item, wardrobe) : []), [item, wardrobe]);
  const groups = useMemo(() => {
    const m = new Map<string, typeof matches>();
    matches.forEach(x => {
      const k = slotOf(x.item);
      m.set(k, [...(m.get(k) || []), x]);
    });
    return Array.from(m.entries());
  }, [matches]);

  const close = () => {
    setPicked([]);
    onClose();
  };
  if (!item) return null;
  const info = colorInfo(item.colorTag);

  return (
    <Modal visible={!!item} animationType="slide" onRequestClose={close}>
      <View style={[s.full, { backgroundColor: colors.bg }]}>
        <View style={s.head}>
          <Text style={[s.h, { color: colors.text }]}>O que combina?</Text>
          <Pressable onPress={close} hitSlop={10}>
            <X size={24} color={colors.icon} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
          <View style={[s.hero, { backgroundColor: colors.surface }]}>
            <FastImage source={item.image} style={s.heroImg} contentFit="cover" />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }} numberOfLines={2}>
                {item.name}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={[s.dot, { backgroundColor: info?.hex || "#999", borderColor: colors.border }]} />
                <Text style={{ color: colors.muted, fontSize: 12 }}>{item.colorTag || "sem cor"}</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {matches.length ? `${matches.length} peças combinam` : "Nenhuma peça combina ainda"}
              </Text>
            </View>
          </View>

          {!info ? (
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 12 }}>
              Dica: escreva a cor da peça (ex.: preto, azul-marinho, bege) para sugestões mais certeiras.
            </Text>
          ) : null}

          {groups.length === 0 ? (
            <Text style={{ color: colors.muted, marginTop: 24, textAlign: "center" }}>
              Adicione peças de outras partes do corpo (calças, calçados, casacos) para ver combinações.
            </Text>
          ) : (
            groups.map(([slot, list]) => (
              <View key={slot} style={{ marginTop: 20 }}>
                <Text style={[s.label, { color: colors.muted }]}>{SLOT_LABEL[slot] || slot}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {list.map(m => {
                    const on = picked.includes(m.item.id);
                    return (
                      <Pressable
                        key={m.item.id}
                        onPress={() => {
                          tapFeedback();
                          setPicked(p => (on ? p.filter(x => x !== m.item.id) : [...p, m.item.id]));
                        }}
                        style={{ width: 104 }}
                      >
                        <View>
                          <FastImage source={m.item.image} style={[s.img, on && { borderWidth: 3, borderColor: colors.text }]} contentFit="cover" />
                          {on ? (
                            <View style={[s.check, { backgroundColor: colors.text }]}>
                              <Check size={12} color={colors.bg} />
                            </View>
                          ) : null}
                          <View style={[s.score, { backgroundColor: "rgba(0,0,0,.65)" }]}>
                            <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "700" }}>{m.score}%</Text>
                          </View>
                        </View>
                        <Text style={{ color: colors.text, fontSize: 11, fontWeight: "600", marginTop: 4 }} numberOfLines={1}>
                          {m.item.name}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 10 }} numberOfLines={1}>
                          {m.reason}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ))
          )}
        </ScrollView>
        {picked.length ? (
          <Pressable
            onPress={() => {
              onSaveLook([item.id, ...picked]);
              close();
            }}
            style={[s.save, { backgroundColor: colors.text }]}
          >
            <Text style={{ color: colors.bg, fontWeight: "700" }}>Salvar look com {picked.length + 1} peças</Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  full: { flex: 1, paddingTop: topPad(50) },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 6 },
  h: { fontSize: 22, fontWeight: "700" },
  hero: { flexDirection: "row", gap: 14, padding: 12, borderRadius: 18, alignItems: "center" },
  heroImg: { width: 84, height: 100, borderRadius: 12 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1 },
  label: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  img: { width: 104, height: 124, borderRadius: 14 },
  check: { position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  score: { position: "absolute", left: 6, bottom: 6, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  save: { position: "absolute", left: 20, right: 20, bottom: 34, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" }
});
