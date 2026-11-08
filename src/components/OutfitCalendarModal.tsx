import React, { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { topPad } from "../utils/insets";
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { OutfitLogEntry, Outfit, WardrobeItem } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { FastImage } from "./FastImage";
import { deleteOutfitLog, loadOutfitLog, saveOutfitLog } from "../services/storage";
import { tapFeedback } from "../utils/haptics";

const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEK = ["S", "T", "Q", "Q", "S", "S", "D"];

/** Calendário de looks: o que você vestiu em cada dia */
export function OutfitCalendarModal({
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
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [log, setLog] = useState<OutfitLogEntry[]>([]);
  const [editing, setEditing] = useState<OutfitLogEntry | null>(null);

  const from = dayKey(month);
  const to = dayKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  useEffect(() => {
    if (visible) loadOutfitLog(from, to).then(setLog);
  }, [visible, from]);

  const cells = useMemo(() => {
    const first = (month.getDay() + 6) % 7; // segunda = 0
    const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const out: (Date | null)[] = Array(first).fill(null);
    for (let d = 1; d <= total; d++) out.push(new Date(month.getFullYear(), month.getMonth(), d));
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);

  const byDay = new Map(log.map(e => [e.day, e]));
  const today = dayKey(new Date());
  const itemById = (id: string) => items.find(i => i.id === id);
  const raw = month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const label = raw.charAt(0).toUpperCase() + raw.slice(1);

  // peça mais usada no mês
  const counts = new Map<string, number>();
  log.forEach(e => e.itemIds.forEach(id => counts.set(id, (counts.get(id) || 0) + 1)));
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];

  const save = async () => {
    if (!editing) return;
    if (!editing.itemIds.length) {
      await deleteOutfitLog(editing.day).catch(() => {});
      setLog(prev => prev.filter(e => e.day !== editing.day));
    } else {
      try {
        await saveOutfitLog(editing);
        setLog(prev => [...prev.filter(e => e.day !== editing.day), editing]);
      } catch (e: any) {
        Alert.alert("Erro", e?.message || "Não foi possível salvar.");
        return;
      }
    }
    setEditing(null);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.full, { backgroundColor: colors.bg }]}>
        <View style={s.head}>
          <Text style={[s.h, { color: colors.text }]}>Calendário de looks</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <X size={24} color={colors.icon} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={s.c}>
          <View style={s.monthRow}>
            <Pressable onPress={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} hitSlop={10}>
              <ChevronLeft size={22} color={colors.icon} />
            </Pressable>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>{label}</Text>
            <Pressable onPress={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} hitSlop={10}>
              <ChevronRight size={22} color={colors.icon} />
            </Pressable>
          </View>
          <View style={s.grid}>
            {WEEK.map((w, i) => (
              <Text key={i} style={[s.week, { color: colors.muted }]}>
                {w}
              </Text>
            ))}
            {cells.map((d, i) => {
              if (!d) return <View key={i} style={s.cell} />;
              const k = dayKey(d);
              const e = byDay.get(k);
              const first = e ? itemById(e.itemIds[0]) : undefined;
              return (
                <Pressable
                  key={i}
                  onPress={() => {
                    tapFeedback();
                    setEditing(e ? { ...e } : { day: k, itemIds: [], note: "" });
                  }}
                  style={[s.cell, { borderColor: k === today ? colors.text : colors.border, backgroundColor: colors.surface }]}
                >
                  {first ? <FastImage source={first.image} style={StyleSheet.absoluteFill as any} contentFit="cover" /> : null}
                  <Text style={[s.dayNum, { color: first ? "#FFF" : colors.text }, first ? s.dayShadow : null]}>{d.getDate()}</Text>
                  {e && e.itemIds.length > 1 ? <Text style={s.more}>+{e.itemIds.length - 1}</Text> : null}
                </Pressable>
              );
            })}
          </View>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 14, lineHeight: 18 }}>
            {log.length
              ? `${log.length} ${log.length === 1 ? "dia registrado" : "dias registrados"} neste mês.` +
                (top && itemById(top[0]) ? ` Peça campeã: ${itemById(top[0])!.name} (${top[1]}x).` : "")
              : "Toque num dia para registrar o look que você usou."}
          </Text>
        </ScrollView>
      </View>

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={s.back}>
          <View style={[s.sheet, { backgroundColor: colors.bg }]}>
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16, marginBottom: 10 }}>
              {editing ? new Date(editing.day + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }) : ""}
            </Text>
            {outfits.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 10 }}>
                {outfits.map(o => (
                  <Pressable
                    key={o.id}
                    onPress={() => editing && setEditing({ ...editing, itemIds: o.itemIds.filter(id => itemById(id)) })}
                    style={[s.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{o.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={s.pieces}>
              {items.map(it => {
                const on = !!editing?.itemIds.includes(it.id);
                return (
                  <Pressable
                    key={it.id}
                    onPress={() =>
                      editing &&
                      setEditing({ ...editing, itemIds: on ? editing.itemIds.filter(x => x !== it.id) : [...editing.itemIds, it.id] })
                    }
                    style={[s.piece, { borderColor: on ? colors.text : "transparent" }]}
                  >
                    <FastImage source={it.image} style={{ width: "100%", height: "100%", borderRadius: 10 }} contentFit="cover" />
                  </Pressable>
                );
              })}
            </ScrollView>
            <TextInput
              value={editing?.note || ""}
              onChangeText={v => editing && setEditing({ ...editing, note: v })}
              placeholder="Anotação (ex.: entrevista, aniversário...)"
              placeholderTextColor={colors.muted}
              style={[s.input, { backgroundColor: colors.surface, color: colors.text }]}
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => setEditing(null)} style={[s.btn, { backgroundColor: colors.surface }]}>
                <Text style={{ color: colors.text, fontWeight: "600" }}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={save} style={[s.btn, { backgroundColor: colors.text }]}>
                <Text style={{ color: colors.bg, fontWeight: "600" }}>{editing?.itemIds.length ? "Salvar" : "Limpar dia"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const s = StyleSheet.create({
  full: { flex: 1, paddingTop: topPad(50) },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20 },
  h: { fontSize: 24, fontWeight: "700" },
  c: { padding: 16, paddingBottom: 60 },
  monthRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  week: { width: `${100 / 7}%`, textAlign: "center", fontSize: 11, fontWeight: "600", marginBottom: 6 },
  cell: { width: `${100 / 7 - 1}%`, margin: "0.5%", aspectRatio: 0.8, borderRadius: 10, borderWidth: 1, overflow: "hidden", padding: 4 },
  dayNum: { fontSize: 12, fontWeight: "600" },
  dayShadow: { textShadowColor: "rgba(0,0,0,.8)", textShadowRadius: 4 },
  more: { position: "absolute", right: 4, bottom: 3, color: "#FFF", fontSize: 10, fontWeight: "700", textShadowColor: "rgba(0,0,0,.8)", textShadowRadius: 4 },
  back: { flex: 1, backgroundColor: "rgba(0,0,0,.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingBottom: 34, gap: 10 },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  pieces: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  piece: { width: 70, height: 84, borderRadius: 12, borderWidth: 2, padding: 2 },
  input: { height: 44, borderRadius: 12, paddingHorizontal: 12 },
  btn: { flex: 1, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" }
});
