import React, { useEffect, useRef, useState } from "react";
import { Dimensions, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { noSwipeBack } from "./gestures";
import { X } from "lucide-react-native";
import { FastImage } from "./FastImage";

/** Foto em tela cheia: arraste para os lados para trocar e use dois dedos para dar zoom */
export function ImageZoomModal({
  images,
  index,
  onClose
}: {
  images: string[] | null;
  index: number;
  onClose: () => void;
}) {
  const { width, height } = Dimensions.get("window");
  const [current, setCurrent] = useState(index);
  const pager = useRef<ScrollView>(null);

  useEffect(() => {
    if (!images) return;
    setCurrent(index);
    setTimeout(() => pager.current?.scrollTo({ x: index * width, animated: false }), 0);
  }, [images, index]);

  if (!images) return null;

  return (
    <Modal visible animationType="fade" transparent={false} onRequestClose={onClose} statusBarTranslucent>
      <View style={s.back}>
        <ScrollView {...noSwipeBack}
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={e => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {images.map((uri, i) => (
            <ScrollView
              key={`${uri}-${i}`}
              style={{ width, height }}
              contentContainerStyle={{ width, height, alignItems: "center", justifyContent: "center" }}
              maximumZoomScale={4}
              minimumZoomScale={1}
              bouncesZoom
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <FastImage source={uri} style={{ width, height: height * 0.8 }} contentFit="contain" />
            </ScrollView>
          ))}
        </ScrollView>

        <Pressable onPress={onClose} hitSlop={14} style={s.close}>
          <X size={26} color="#FFF" />
        </Pressable>
        {images.length > 1 ? (
          <View style={s.counter}>
            <Text style={s.counterText}>
              {current + 1}/{images.length}
            </Text>
          </View>
        ) : null}
        {Platform.OS !== "web" ? <Text style={s.hint}>Use dois dedos para dar zoom</Text> : null}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  back: { flex: 1, backgroundColor: "#000" },
  close: { position: "absolute", top: 56, right: 20, backgroundColor: "rgba(255,255,255,.12)", borderRadius: 20, padding: 7 },
  counter: { position: "absolute", top: 60, left: 20, backgroundColor: "rgba(255,255,255,.12)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  counterText: { color: "#FFF", fontWeight: "600", fontSize: 12 },
  hint: { position: "absolute", bottom: 44, alignSelf: "center", color: "rgba(255,255,255,.5)", fontSize: 11 }
});
