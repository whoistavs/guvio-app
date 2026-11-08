import React, { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { topPad } from "../utils/insets";
import { MapPin, Search, X } from "lucide-react-native";
import { WardrobeItem } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { FastImage } from "./FastImage";
import { fetchForecast, Place, searchPlaces } from "../services/weather";
import { planPacking, PackingPlan } from "../utils/packing";

/** Mala de viagem: escolhe a cidade e os dias, o app monta a mala pela previsão do tempo de lá */
export function TripPackingModal({
  visible,
  onClose,
  items,
  onSaveAsLook
}: {
  visible: boolean;
  onClose: () => void;
  items: WardrobeItem[];
  onSaveAsLook?: (name: string, ids: string[]) => void;
}) {
  const { colors } = useAppTheme();
  const [q, setQ] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [place, setPlace] = useState<Place | null>(null);
  const [startIn, setStartIn] = useState(0);
  const [days, setDays] = useState(4);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<PackingPlan | null>(null);

  const find = async () => {
    setLoading(true);
    try {
      const r = await searchPlaces(q);
      setPlaces(r);
      if (!r.length) Alert.alert("Cidade não encontrada", "Tente escrever de outro jeito.");
    } catch (e: any) {
      Alert.alert("Sem conexão", e?.message || "Tente de novo.");
    } finally {
      setLoading(false);
    }
  };

  const build = async () => {
    if (!place) return;
    if (items.length < 2) return Alert.alert("Guarda-roupa vazio", "Cadastre algumas peças primeiro.");
    setLoading(true);
    try {
      const fc = await fetchForecast(place.lat, place.lon, startIn, Math.min(days, 16 - startIn));
      setPlan(planPacking(items, fc));
    } catch (e: any) {
      Alert.alert("Não deu para buscar a previsão", e?.message || "Tente de novo.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPlan(null);
    setPlace(null);
    setPlaces([]);
    setQ("");
  };

  const fmt = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.full, { backgroundColor: colors.bg }]}>
        <View style={s.head}>
          <Text style={[s.h, { color: colors.text }]}>Mala de viagem</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <X size={24} color={colors.icon} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={s.c} keyboardShouldPersistTaps="handled">
          {!plan ? (
            <>
              <Text style={{ color: colors.muted, marginBottom: 12, lineHeight: 20 }}>
                Diga para onde vai e por quantos dias. O Guvio olha a previsão do tempo de lá e monta um look por dia com as suas peças.
              </Text>
              {!place ? (
                <>
                  <View style={[s.search, { backgroundColor: colors.surface }]}>
                    <Search size={17} color={colors.muted} />
                    <TextInput
                      value={q}
                      onChangeText={setQ}
                      onSubmitEditing={find}
                      returnKeyType="search"
                      placeholder="Cidade de destino (ex.: Lisboa)"
                      placeholderTextColor={colors.muted}
                      style={{ flex: 1, color: colors.text, height: "100%" }}
                    />
                    <Pressable onPress={find} hitSlop={8}>
                      <Text style={{ color: "#0095F6", fontWeight: "700" }}>Buscar</Text>
                    </Pressable>
                  </View>
                  {loading ? <ActivityIndicator color={colors.muted} style={{ marginTop: 16 }} /> : null}
                  {places.map((p, i) => (
                    <Pressable key={i} onPress={() => setPlace(p)} style={s.placeRow}>
                      <MapPin size={16} color={colors.muted} />
                      <Text style={{ color: colors.text, fontWeight: "700" }}>
                        {p.name}
                        <Text style={{ color: colors.muted, fontWeight: "400" }}> · {p.country}</Text>
                      </Text>
                    </Pressable>
                  ))}
                </>
              ) : (
                <>
                  <Pressable onPress={() => setPlace(null)} style={[s.placeSel, { backgroundColor: colors.surface }]}>
                    <MapPin size={16} color={colors.text} />
                    <Text style={{ color: colors.text, fontWeight: "700", flex: 1 }}>
                      {place.name}, {place.country}
                    </Text>
                    <Text style={{ color: "#0095F6", fontWeight: "600", fontSize: 12 }}>Trocar</Text>
                  </Pressable>
                  <Text style={[s.label, { color: colors.muted }]}>Quando você vai?</Text>
                  <View style={s.chips}>
                    {[0, 1, 3, 7, 10].map(n => (
                      <Pressable key={n} onPress={() => setStartIn(n)} style={[s.chip, { backgroundColor: startIn === n ? colors.text : colors.surface, borderColor: colors.border }]}>
                        <Text style={{ color: startIn === n ? colors.bg : colors.text, fontWeight: "600", fontSize: 12 }}>
                          {n === 0 ? "Hoje" : n === 1 ? "Amanhã" : `Em ${n} dias`}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={[s.label, { color: colors.muted }]}>Quantos dias?</Text>
                  <View style={s.chips}>
                    {[2, 3, 4, 5, 7, 10].map(n => (
                      <Pressable key={n} onPress={() => setDays(n)} style={[s.chip, { backgroundColor: days === n ? colors.text : colors.surface, borderColor: colors.border }]}>
                        <Text style={{ color: days === n ? colors.bg : colors.text, fontWeight: "600", fontSize: 12 }}>{n} dias</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 8 }}>A previsão do tempo vai até 16 dias à frente.</Text>
                  <Pressable onPress={build} disabled={loading} style={[s.go, { backgroundColor: colors.text }]}>
                    {loading ? <ActivityIndicator color={colors.bg} /> : <Text style={{ color: colors.bg, fontWeight: "700" }}>Montar minha mala</Text>}
                  </Pressable>
                </>
              )}
            </>
          ) : (
            <>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 18 }}>
                {place?.name}: {plan.days.length} dias
              </Text>
              <Text style={{ color: colors.muted, marginTop: 2 }}>
                {plan.pieces.length} peças na mala · {Math.min(...plan.days.map(d => d.forecast.min))}°C a {Math.max(...plan.days.map(d => d.forecast.max))}°C
              </Text>
              {plan.tips.map(t => (
                <Text key={t} style={[s.tip, { color: colors.text, backgroundColor: colors.surface }]}>
                  {t}
                </Text>
              ))}
              <Text style={[s.label, { color: colors.muted }]}>O que levar</Text>
              <View style={s.pieces}>
                {plan.pieces.map(p => (
                  <View key={p.item.id} style={{ width: 78 }}>
                    <FastImage source={p.item.image} style={{ width: 78, height: 94, borderRadius: 12 }} contentFit="cover" />
                    <Text style={{ color: colors.text, fontSize: 10, fontWeight: "700", marginTop: 3 }} numberOfLines={1}>
                      {p.item.name}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 9 }}>{p.days}x</Text>
                  </View>
                ))}
              </View>
              <Text style={[s.label, { color: colors.muted }]}>Look de cada dia</Text>
              {plan.days.map(d => (
                <View key={d.date} style={[s.dayRow, { borderColor: colors.border }]}>
                  <View style={{ width: 92 }}>
                    <Text style={{ color: colors.text, fontWeight: "600", fontSize: 12, textTransform: "capitalize" }}>{fmt(d.date)}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {d.forecast.min}°–{d.forecast.max}° · {d.forecast.rainChance}% chuva
                    </Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
                    {d.items.map(i => (
                      <FastImage key={i.id} source={i.image} style={{ width: 40, height: 48, borderRadius: 8 }} contentFit="cover" />
                    ))}
                  </ScrollView>
                </View>
              ))}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
                <Pressable onPress={reset} style={[s.go, { flex: 1, marginTop: 0, backgroundColor: colors.surface }]}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Nova viagem</Text>
                </Pressable>
                {onSaveAsLook ? (
                  <Pressable
                    onPress={() => onSaveAsLook(`Mala: ${place?.name || "viagem"}`, plan.pieces.map(p => p.item.id))}
                    style={[s.go, { flex: 1, marginTop: 0, backgroundColor: colors.text }]}
                  >
                    <Text style={{ color: colors.bg, fontWeight: "700" }}>Salvar mala</Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  full: { flex: 1, paddingTop: topPad(50) },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20 },
  h: { fontSize: 24, fontWeight: "700" },
  c: { padding: 20, paddingBottom: 60 },
  search: { height: 48, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  placeRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  placeSel: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 14, padding: 14 },
  label: { fontSize: 13, fontWeight: "600", marginTop: 20, marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  go: { height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginTop: 20 },
  tip: { borderRadius: 12, padding: 10, marginTop: 8, fontSize: 13, overflow: "hidden" },
  pieces: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth }
});
