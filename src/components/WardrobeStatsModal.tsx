import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { noSwipeBack } from "./gestures";
import { topPad } from "../utils/insets";
import { X } from "lucide-react-native";
import { FeedPost, Outfit, WardrobeItem } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { ListSkeleton } from "./SkeletonLoader";
import { FastImage } from "./FastImage";
import { loadMyPosts } from "../services/storage";
import { computeWardrobeStats } from "../utils/wardrobeStats";
import { wardrobePalette } from "../utils/colorHarmony";

// cores aproximadas para as bolinhas da legenda de cores
const SWATCH: Record<string, string> = {
  preto: "#111", branco: "#F4F4F4", cinza: "#8A8A8A", azul: "#3B6FD8", marinho: "#1F2D5A", vermelho: "#D93A3A",
  verde: "#3E9B5B", amarelo: "#F2C230", rosa: "#F07FB0", roxo: "#8152C9", lilas: "#B79CE6", laranja: "#F28C28",
  marrom: "#7A4F2E", bege: "#D9C3A0", caramelo: "#B5763A", vinho: "#7B1E34", creme: "#F3E9D2", jeans: "#4A6C9B", nude: "#E3C2AC"
};
const swatchOf = (label: string) => {
  const k = label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const hit = Object.keys(SWATCH).find(w => k.includes(w));
  return hit ? SWATCH[hit] : "#999";
};

export function WardrobeStatsModal({
  visible,
  onClose,
  items,
  outfits
}: {
  visible: boolean;
  onClose: () => void;
  items: WardrobeItem[];
  outfits: Outfit[];
}) {
  const { colors } = useAppTheme();
  const [posts, setPosts] = useState<FeedPost[] | null>(null);

  useEffect(() => {
    if (!visible) return;
    loadMyPosts().then(setPosts).catch(() => setPosts([]));
  }, [visible]);

  const stats = useMemo(() => computeWardrobeStats(items, posts || [], outfits), [items, posts, outfits]);
  const palette = useMemo(() => wardrobePalette(items), [items]);
  const maxCat = Math.max(1, ...stats.byCategory.map(c => c.count));
  const totalColors = Math.max(1, stats.byColor.reduce((a, c) => a + c.count, 0));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.full, { backgroundColor: colors.bg }]}>
        <View style={s.head}>
          <Text style={[s.h, { color: colors.text }]}>Estatísticas</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <X size={24} color={colors.icon} />
          </Pressable>
        </View>
        {posts === null ? (
          <ListSkeleton rows={6} avatar={40} lines={1} style={{ padding: 20 }} />
        ) : (
          <ScrollView contentContainerStyle={s.c}>
            <View style={s.kpis}>
              {[
                { v: stats.total, l: "peças" },
                { v: stats.byCategory.length, l: "categorias" },
                { v: outfits.length, l: "looks salvos" }
              ].map(k => (
                <View key={k.l} style={[s.kpi, { backgroundColor: colors.surface }]}>
                  <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700" }}>{k.v}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{k.l}</Text>
                </View>
              ))}
            </View>

            <Text style={[s.label, { color: colors.muted }]}>Por categoria</Text>
            {stats.byCategory.map(c => (
              <View key={c.label} style={s.barRow}>
                <Text style={{ color: colors.text, fontSize: 12, width: 92 }} numberOfLines={1}>
                  {c.label}
                </Text>
                <View style={[s.barTrack, { backgroundColor: colors.surface }]}>
                  <View style={[s.bar, { width: `${(c.count / maxCat) * 100}%`, backgroundColor: colors.text }]} />
                </View>
                <Text style={{ color: colors.muted, fontSize: 12, width: 24, textAlign: "right" }}>{c.count}</Text>
              </View>
            ))}

            <Text style={[s.label, { color: colors.muted }]}>Cores que mais aparecem</Text>
            <View style={s.colorStrip}>
              {stats.byColor.map(c => (
                <View key={c.label} style={{ flex: c.count, backgroundColor: swatchOf(c.label) }} />
              ))}
            </View>
            <View style={s.legend}>
              {stats.byColor.slice(0, 8).map(c => (
                <View key={c.label} style={s.legendItem}>
                  <View style={[s.dot, { backgroundColor: swatchOf(c.label), borderColor: colors.border }]} />
                  <Text style={{ color: colors.text, fontSize: 12 }}>
                    {c.label} <Text style={{ color: colors.muted }}>{Math.round((c.count / totalColors) * 100)}%</Text>
                  </Text>
                </View>
              ))}
            </View>

            <Text style={[s.label, { color: colors.muted }]}>Sua paleta</Text>
            {palette.have.length === 0 ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>Escreva a cor das peças para montar sua paleta.</Text>
            ) : (
              <View style={[s.paletteBox, { backgroundColor: colors.surface }]}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {palette.have.slice(0, 8).map(c => (
                    <View key={c.label} style={{ alignItems: "center", width: 54 }}>
                      <View style={[s.chip, { backgroundColor: c.hex, borderColor: colors.border }]} />
                      <Text style={{ color: colors.text, fontSize: 10, marginTop: 4 }} numberOfLines={1}>
                        {c.label}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 10 }}>
                  {palette.neutralShare >= 70
                    ? `${palette.neutralShare}% neutras: base versátil. Uma peça colorida dá vida aos looks.`
                    : palette.neutralShare <= 30
                    ? `Só ${palette.neutralShare}% neutras: algumas peças básicas ajudam a combinar tudo.`
                    : `${palette.neutralShare}% neutras: bom equilíbrio entre base e cor.`}
                </Text>
                {palette.missing.length ? (
                  <>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600", marginTop: 12, marginBottom: 8 }}>
                      Cores que combinariam e você ainda não tem
                    </Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      {palette.missing.map(c => (
                        <View key={c.label} style={{ alignItems: "center", width: 54 }}>
                          <View style={[s.chip, { backgroundColor: c.hex, borderColor: colors.border, borderStyle: "dashed", borderWidth: 2 }]} />
                          <Text style={{ color: colors.muted, fontSize: 10, marginTop: 4 }} numberOfLines={1}>
                            {c.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : null}
              </View>
            )}

            <Text style={[s.label, { color: colors.muted }]}>Mais usadas</Text>
            {stats.mostUsed.length === 0 ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Marque peças nos seus posts ou salve looks para ver quais você mais usa.
              </Text>
            ) : (
              stats.mostUsed.map((r, i) => (
                <View key={r.item.id} style={s.useRow}>
                  <Text style={{ color: colors.muted, fontWeight: "700", width: 22 }}>{i + 1}</Text>
                  <FastImage source={r.item.image} style={s.thumb} contentFit="cover" />
                  <Text style={{ color: colors.text, fontWeight: "700", flex: 1 }} numberOfLines={1}>
                    {r.item.name}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {r.uses} {r.uses === 1 ? "uso" : "usos"}
                  </Text>
                </View>
              ))
            )}

            <Text style={[s.label, { color: colors.muted }]}>Esquecidas ({stats.forgotten.length})</Text>
            {stats.forgotten.length === 0 ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>Nenhuma! Você usa todo o seu guarda-roupa.</Text>
            ) : (
              <>
                <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 10 }}>
                  Peças que ainda não apareceram em nenhum post nem look. Que tal usá-las esta semana?
                </Text>
                <ScrollView {...noSwipeBack} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {stats.forgotten.map(i => (
                    <View key={i.id} style={{ width: 80 }}>
                      <FastImage source={i.image} style={{ width: 80, height: 96, borderRadius: 12 }} contentFit="cover" />
                      <Text style={{ color: colors.text, fontSize: 10, marginTop: 4 }} numberOfLines={1}>
                        {i.name}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  full: { flex: 1, paddingTop: topPad(50) },
  paletteBox: { borderRadius: 16, padding: 14 },
  chip: { width: 40, height: 40, borderRadius: 20, borderWidth: 1 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 6 },
  h: { fontSize: 26, fontWeight: "700" },
  c: { padding: 20, paddingBottom: 60 },
  kpis: { flexDirection: "row", gap: 8 },
  kpi: { flex: 1, borderRadius: 16, padding: 12, alignItems: "center" },
  label: { fontSize: 13, fontWeight: "600", marginTop: 26, marginBottom: 12 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  barTrack: { flex: 1, height: 10, borderRadius: 5, overflow: "hidden" },
  bar: { height: "100%", borderRadius: 5 },
  colorStrip: { flexDirection: "row", height: 18, borderRadius: 9, overflow: "hidden" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
  useRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  thumb: { width: 40, height: 40, borderRadius: 10 }
});
