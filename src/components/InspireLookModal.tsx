import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Check, Shirt, Sparkles, X } from "lucide-react-native";
import { FeedPost, WardrobeItem } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { FastImage } from "./FastImage";
import { noSwipeBack } from "./gestures";
import { topPad } from "../utils/insets";
import { colorInfo, colorScore, COLOR_CHIPS } from "../utils/colorHarmony";
import { Slot, slotOf } from "../utils/dailyLook";
import { loadSavedWardrobe, saveOutfit } from "../services/storage";
import { tapFeedback, successFeedback } from "../utils/haptics";

const SLOTS: { id: Slot; label: string }[] = [
  { id: "parteDeCima", label: "Parte de cima" },
  { id: "pecaUnica", label: "Peça única" },
  { id: "parteDeBaixo", label: "Parte de baixo" },
  { id: "casaco", label: "Casaco" },
  { id: "calcado", label: "Calçado" },
  { id: "acessorio", label: "Acessório" }
];

const norm = (v: string) =>
  (v || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** cores que aparecem no look: das peças marcadas, da legenda e do estilo */
function lookColors(post: FeedPost): string[] {
  const texts = [post.caption || "", post.styleTag || "", ...(post.clothingTags || []).map(t => `${t.name} ${t.color || ""}`)];
  const found: string[] = [];
  texts.forEach(t => {
    t.split(/[\s,.;#/()-]+/).forEach(w => {
      const c = colorInfo(w);
      if (c && !found.includes(c.label)) found.push(c.label);
    });
  });
  return found.slice(0, 4);
}

/** a peça do look que vai nesta parte do corpo (pelas peças marcadas) */
function tagForSlot(post: FeedPost, slot: Slot) {
  return (post.clothingTags || []).find(t => slotOf({ id: t.id, name: t.name, category: "", colorTag: t.color || "", image: "" }) === slot);
}

/** nota de 0 a 100: quanto a peça do guarda-roupa lembra o look */
function scoreItem(item: WardrobeItem, post: FeedPost, colors: string[], slot: Slot): number {
  let score = 0;
  const tag = tagForSlot(post, slot);
  if (tag) {
    // mesmo tipo de peça (ex.: "jaqueta jeans" x "jaqueta")
    const words = norm(tag.name).split(/\s+/).filter(w => w.length > 3);
    if (words.some(w => norm(`${item.name} ${item.category}`).includes(w))) score += 35;
    const tc = colorInfo(`${tag.color || ""} ${tag.name}`);
    const ic = colorInfo(`${item.colorTag} ${item.name}`);
    if (tc && ic && tc.label === ic.label) score += 45;
    else if (tc && ic) score += Math.round(colorScore(tc.label, ic.label) / 4);
  }
  const ic = colorInfo(`${item.colorTag} ${item.name}`);
  if (ic && colors.includes(ic.label)) score += 30;
  else if (ic && colors.length) score += Math.round(Math.max(...colors.map(c => colorScore(c, ic.label))) / 5);
  return score;
}

// abre de qualquer tela (o App registra)
let opener: ((p: FeedPost) => void) | null = null;
export function setInspireOpener(fn: (p: FeedPost) => void) {
  opener = fn;
}
export function openInspireLook(p: FeedPost) {
  opener?.(p);
}

/**
 * "Montar parecido": usa um look do feed como inspiração e monta um look
 * com as peças do seu guarda-roupa (por tipo de peça e por cor).
 */
export function InspireLookModal({
  post,
  onClose,
  onOpenWardrobe
}: {
  post: FeedPost | null;
  onClose: () => void;
  onOpenWardrobe?: () => void;
}) {
  const { colors } = useAppTheme();
  const [wardrobe, setWardrobe] = useState<WardrobeItem[] | null>(null);
  const [palette, setPalette] = useState<string[]>([]);
  const [picked, setPicked] = useState<Partial<Record<Slot, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!post) return;
    setWardrobe(null);
    setPicked({});
    setPalette(lookColors(post));
    loadSavedWardrobe()
      .then(setWardrobe)
      .catch(() => setWardrobe([]));
  }, [post]);

  // para cada parte do corpo: as peças mais parecidas, da melhor para a pior
  const bySlot = useMemo(() => {
    if (!post || !wardrobe) return [];
    return SLOTS.map(sl => {
      const items = wardrobe
        .filter(i => slotOf(i) === sl.id)
        .map(i => ({ item: i, score: scoreItem(i, post, palette, sl.id) }))
        .sort((a, b) => b.score - a.score);
      return { ...sl, items, tag: tagForSlot(post, sl.id) };
    }).filter(g => g.items.length > 0);
  }, [post, wardrobe, palette]);

  // já escolhe a melhor peça de cada parte (sem peça única junto com cima+baixo)
  useEffect(() => {
    if (!bySlot.length) return;
    const auto: Partial<Record<Slot, string>> = {};
    bySlot.forEach(g => {
      if (g.items[0] && (g.items[0].score >= 20 || g.tag)) auto[g.id] = g.items[0].item.id;
    });
    if (auto.pecaUnica && (auto.parteDeCima || auto.parteDeBaixo)) {
      const one = bySlot.find(g => g.id === "pecaUnica")?.items[0]?.score || 0;
      const top = bySlot.find(g => g.id === "parteDeCima")?.items[0]?.score || 0;
      if (one > top) {
        delete auto.parteDeCima;
        delete auto.parteDeBaixo;
      } else delete auto.pecaUnica;
    }
    setPicked(auto);
  }, [bySlot]);

  const toggle = (slot: Slot, id: string) => {
    tapFeedback();
    setPicked(p => ({ ...p, [slot]: p[slot] === id ? undefined : id }));
  };

  const ids = Object.values(picked).filter(Boolean) as string[];

  const save = async () => {
    if (!post || ids.length === 0) return;
    setSaving(true);
    try {
      await saveOutfit(`Inspirado em @${post.creatorUsername || post.creatorName}`.slice(0, 40), ids);
      successFeedback();
      onClose();
      Alert.alert("Look salvo", "Ele está em Guarda-roupa > Meus looks.", [
        { text: "OK" },
        ...(onOpenWardrobe ? [{ text: "Ver agora", onPress: onOpenWardrobe }] : [])
      ]);
    } catch (e: any) {
      Alert.alert("Não deu para salvar", e?.message || "Tente de novo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={!!post} animationType="slide" onRequestClose={onClose}>
      <View style={[s.wrap, { backgroundColor: colors.bg, paddingTop: topPad(6) }]}>
        <View style={s.head}>
          <Pressable onPress={onClose} hitSlop={10}>
            <X size={24} color={colors.icon} />
          </Pressable>
          <Text style={[s.title, { color: colors.text }]}>Montar parecido</Text>
          <View style={{ width: 24 }} />
        </View>

        {!post ? null : (
          <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
            <View style={s.inspo}>
              <FastImage source={post.image} style={s.inspoImg} contentFit="cover" />
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Inspiração</Text>
                <Text style={{ color: colors.text, fontWeight: "700" }}>@{post.creatorUsername || post.creatorName}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Cores do look (toque para ajustar):</Text>
                <ScrollView {...noSwipeBack} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {COLOR_CHIPS.map(c => {
                    const on = palette.includes(c.label);
                    return (
                      <Pressable
                        key={c.label}
                        onPress={() => setPalette(p => (on ? p.filter(x => x !== c.label) : [...p, c.label]))}
                        style={[s.chip, { borderColor: on ? colors.text : colors.border }]}
                      >
                        <View style={[s.dot, { backgroundColor: c.hex }]} />
                        <Text style={{ color: colors.text, fontSize: 11, fontWeight: on ? "700" : "500" }}>{c.label}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {wardrobe === null ? (
              <ActivityIndicator color={colors.muted} style={{ marginTop: 40 }} />
            ) : wardrobe.length === 0 ? (
              <View style={s.empty}>
                <Shirt size={36} color={colors.icon} />
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>Seu guarda-roupa está vazio</Text>
                <Text style={{ color: colors.muted, textAlign: "center" }}>
                  Adicione suas peças no Guarda-roupa e volte aqui para montar um look parecido.
                </Text>
                {onOpenWardrobe ? (
                  <Pressable
                    onPress={() => {
                      onClose();
                      onOpenWardrobe();
                    }}
                    style={[s.save, { backgroundColor: colors.text, alignSelf: "stretch" }]}
                  >
                    <Text style={{ color: colors.bg, fontWeight: "700" }}>Ir para o Guarda-roupa</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              bySlot.map(g => (
                <View key={g.id} style={{ marginTop: 18 }}>
                  <Text style={[s.slot, { color: colors.text }]}>
                    {g.label}
                    {g.tag ? <Text style={{ color: colors.muted, fontWeight: "500" }}> · no look: {g.tag.name}</Text> : null}
                  </Text>
                  <ScrollView {...noSwipeBack} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }}>
                    {g.items.slice(0, 12).map(({ item, score }, i) => {
                      const on = picked[g.id] === item.id;
                      return (
                        <Pressable key={item.id} onPress={() => toggle(g.id, item.id)} style={{ width: 104 }}>
                          <View>
                            <FastImage source={item.image} style={[s.piece, { borderColor: on ? colors.text : "transparent" }]} contentFit="cover" />
                            {on ? (
                              <View style={[s.check, { backgroundColor: colors.text }]}>
                                <Check size={13} color={colors.bg} strokeWidth={3} />
                              </View>
                            ) : null}
                            {i === 0 && score >= 40 ? (
                              <View style={s.best}>
                                <Sparkles size={10} color="#FFF" />
                                <Text style={{ color: "#FFF", fontSize: 9, fontWeight: "700" }}>Mais parecida</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={{ color: colors.text, fontSize: 11, marginTop: 4 }} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 10 }} numberOfLines={1}>
                            {item.colorTag}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ))
            )}
          </ScrollView>
        )}

        {wardrobe && wardrobe.length > 0 ? (
          <View style={[s.footer, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
            <Pressable onPress={save} disabled={!ids.length || saving} style={[s.save, { backgroundColor: colors.text, opacity: ids.length ? 1 : 0.4 }]}>
              {saving ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={{ color: colors.bg, fontWeight: "700" }}>
                  Salvar look{ids.length ? ` (${ids.length} ${ids.length === 1 ? "peça" : "peças"})` : ""}
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  head: { height: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  title: { fontSize: 17, fontWeight: "700" },
  inspo: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 6 },
  inspoImg: { width: 92, height: 115, borderRadius: 10 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 5 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(0,0,0,.25)" },
  slot: { fontWeight: "700", fontSize: 14, paddingHorizontal: 16, marginBottom: 8 },
  piece: { width: 104, height: 130, borderRadius: 10, borderWidth: 2 },
  check: { position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  best: { position: "absolute", left: 6, bottom: 6, flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "rgba(0,0,0,.6)", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  empty: { alignItems: "center", gap: 10, padding: 32, marginTop: 30 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 30, borderTopWidth: StyleSheet.hairlineWidth },
  save: { height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" }
});
