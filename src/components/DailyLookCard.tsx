import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { RefreshCw, Send, Sun, Bookmark } from "lucide-react-native";
import { WardrobeItem } from "../data/mockData";
import { WeatherData } from "../services/weather";
import { useAppTheme } from "../context/AppTheme";
import { PressableScale } from "./motion";
import { FastImage } from "./FastImage";
import { suggestDailyLook } from "../utils/dailyLook";
import { tapFeedback } from "../utils/haptics";

/** Sugestão do dia com as peças do guarda-roupa, de acordo com o clima da sua cidade */
export function DailyLookCard({
  items,
  weather,
  onSave,
  onPublish,
  onWore
}: {
  items: WardrobeItem[];
  weather?: WeatherData | null;
  onSave?: (pieces: WardrobeItem[]) => void;
  onPublish?: (pieces: WardrobeItem[]) => void;
  /** registra no calendário que usou este look hoje */
  onWore?: (pieces: WardrobeItem[]) => void;
}) {
  const { colors } = useAppTheme();
  const [variation, setVariation] = useState(0);
  const look = useMemo(() => suggestDailyLook(items, weather, variation), [items, weather, variation]);
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  if (items.length < 2) {
    return (
      <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={s.head}>
          <Sun size={18} color="#F5A524" />
          <Text style={[s.title, { color: colors.text }]}>Look do dia</Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
          Cadastre pelo menos 2 peças (ex.: uma camiseta e uma calça) e todo dia o Guvio monta uma sugestão pensando no clima da sua cidade.
        </Text>
      </View>
    );
  }

  return (
    <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={s.head}>
        <Sun size={18} color="#F5A524" />
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.text }]}>Look do dia</Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            {today}
            {weather ? ` · ${weather.temperature}°C ${weather.condition}` : ""}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            tapFeedback();
            setVariation(v => v + 1);
          }}
          hitSlop={10}
          style={[s.iconBtn, { backgroundColor: colors.bg }]}
        >
          <RefreshCw size={15} color={colors.text} />
        </Pressable>
      </View>
      <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 10 }}>{look.reason}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {look.items.map(i => (
          <View key={i.id} style={{ width: 86 }}>
            <FastImage source={i.image} style={s.img} contentFit="cover" />
            <Text style={{ color: colors.text, fontSize: 10, fontWeight: "700", marginTop: 4 }} numberOfLines={1}>
              {i.name}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View style={s.actions}>
        {onWore ? (
          <PressableScale haptic onPress={() => onWore(look.items)} style={[s.btn, { backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>✓ Usei hoje</Text>
          </PressableScale>
        ) : null}
        {onSave ? (
          <PressableScale haptic onPress={() => onSave(look.items)} style={[s.btn, { backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1 }]}>
            <Bookmark size={14} color={colors.text} />
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 12 }}>Salvar</Text>
          </PressableScale>
        ) : null}
        {onPublish ? (
          <PressableScale haptic onPress={() => onPublish(look.items)} style={[s.btn, { backgroundColor: colors.text }]}>
            <Send size={14} color={colors.bg} />
            <Text style={{ color: colors.bg, fontWeight: "900", fontSize: 12 }}>Publicar</Text>
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 22, padding: 14, marginBottom: 16 },
  head: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  title: { fontSize: 16, fontWeight: "900" },
  iconBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  img: { width: 86, height: 104, borderRadius: 14 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  btn: { flex: 1, height: 38, borderRadius: 19, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center" }
});
