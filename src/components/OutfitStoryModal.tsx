import React, { useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { X } from "lucide-react-native";
import { captureRef } from "react-native-view-shot";
import { WardrobeItem } from "../data/mockData";
import { FastImage } from "./FastImage";
import { openStoryEditor } from "./story/StoryEditor";

const W = 270;
const H = 480;
const BGS = ["#0E0F12", "#F2EDE4", "#1E2A44", "#3B2A2A"];

/** Monta uma colagem 9:16 com as peças do look e publica como story */
export function OutfitStoryModal({
  pieces,
  title,
  onClose,
  onPublished
}: {
  pieces: WardrobeItem[] | null;
  title: string;
  onClose: () => void;
  onPublished?: () => void;
}) {
  const ref = useRef<View>(null);
  const [bg, setBg] = useState(BGS[0]);
  const [capturing, setCapturing] = useState(false);
  const [loaded, setLoaded] = useState(0);
  if (!pieces) return null;
  const list = pieces.slice(0, 6);
  const light = bg === "#F2EDE4";
  const cols = list.length <= 2 ? 1 : 2;
  const cellW = (W - 36 - (cols - 1) * 8) / cols;
  const rows = Math.ceil(list.length / cols);
  const cellH = Math.min(cellW * 1.25, (H - 120 - (rows - 1) * 8) / rows);

  const next = async () => {
    setCapturing(true);
    try {
      const uri = await captureRef(ref, { format: "jpg", quality: 0.9, result: "tmpfile", width: 1080, height: 1920 });
      // abre o editor de story com a colagem (texto, figurinhas, desenho...)
      onClose();
      onPublished?.();
      setTimeout(() => openStoryEditor({ uri, type: "image" }), 400);
    } catch (e: any) {
      Alert.alert("Não deu para montar a imagem", e?.message || "Tente de novo.");
    } finally {
      setCapturing(false);
    }
  };

  return (
    <>
      <Modal visible transparent animationType="fade" onRequestClose={onClose}>
        <View style={s.back}>
          <View style={s.card}>
            <View style={s.head}>
              <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 16 }}>Look no story</Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <X size={22} color="#FFF" />
              </Pressable>
            </View>
            <View ref={ref} collapsable={false} style={[s.canvas, { backgroundColor: bg }]}>
              <Text style={[s.title, { color: light ? "#111" : "#FFF" }]} numberOfLines={1}>
                {title}
              </Text>
              <View style={s.grid}>
                {list.map(p => (
                  <View key={p.id} style={{ width: cellW, height: cellH }}>
                    <FastImage source={p.image} style={{ width: "100%", height: "100%", borderRadius: 14 }} contentFit="cover" onLoad={() => setLoaded(n => n + 1)} />
                  </View>
                ))}
              </View>
              <Text style={[s.brand, { color: light ? "#111" : "#FFF" }]}>GUVIO</Text>
            </View>
            <View style={s.bgRow}>
              {BGS.map(c => (
                <Pressable key={c} onPress={() => setBg(c)} style={[s.bgDot, { backgroundColor: c, borderWidth: bg === c ? 3 : 1 }]} />
              ))}
            </View>
            <Pressable onPress={next} disabled={capturing} style={s.btn}>
              {capturing ? <ActivityIndicator color="#000" /> : <Text style={{ fontWeight: "700" }}>Continuar</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  back: { flex: 1, backgroundColor: "rgba(0,0,0,.8)", alignItems: "center", justifyContent: "center" },
  card: { alignItems: "center", gap: 14 },
  head: { width: W, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  canvas: { width: W, height: H, borderRadius: 18, padding: 18, overflow: "hidden", justifyContent: "space-between" },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  brand: { fontSize: 12, fontWeight: "700", letterSpacing: 4, textAlign: "center", opacity: 0.8 },
  bgRow: { flexDirection: "row", gap: 10 },
  bgDot: { width: 28, height: 28, borderRadius: 14, borderColor: "#FFF" },
  btn: { width: W, height: 46, borderRadius: 23, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center" }
});
