import React, { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Expand } from "lucide-react-native";
import { FastImage } from "./FastImage";

/**
 * Foto(s) do post: uma foto ou carrossel (arrastar para os lados), com bolinhas.
 * Dois toques chamam onDoubleTap; segurar ou tocar no ícone abre o zoom.
 */
export function PostMedia({
  images,
  onDoubleTap,
  onOpenZoom,
  children
}: {
  images: string[];
  onDoubleTap?: () => void;
  onOpenZoom?: (index: number) => void;
  /** coisas por cima da foto (coração animado, etiquetas das peças) */
  children?: React.ReactNode;
}) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const lastTap = useRef(0);
  const list = images.length ? images : [""];

  const handlePress = () => {
    const now = Date.now();
    if (now - lastTap.current < 320) {
      lastTap.current = 0;
      onDoubleTap?.();
    } else {
      lastTap.current = now;
    }
  };

  return (
    <View style={s.wrap} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {list.length === 1 ? (
        <Pressable onPress={handlePress} onLongPress={() => onOpenZoom?.(0)} delayLongPress={350}>
          <FastImage source={list[0]} style={s.image} contentFit="cover" transition={120} />
        </Pressable>
      ) : (
        <ScrollView
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={e => width && setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          scrollEventThrottle={16}
        >
          {list.map((uri, i) => (
            <Pressable
              key={`${uri}-${i}`}
              onPress={handlePress}
              onLongPress={() => onOpenZoom?.(i)}
              delayLongPress={350}
              style={{ width: width || 1 }}
            >
              <FastImage source={uri} style={s.image} contentFit="cover" transition={120} />
            </Pressable>
          ))}
        </ScrollView>
      )}

      {children}

      {list.length > 1 ? (
        <>
          <View style={s.counter} pointerEvents="none">
            <Text style={s.counterText}>
              {index + 1}/{list.length}
            </Text>
          </View>
          <View style={s.dots} pointerEvents="none">
            {list.map((_, i) => (
              <View key={i} style={[s.dot, i === index && s.dotOn]} />
            ))}
          </View>
        </>
      ) : null}

      {onOpenZoom ? (
        <Pressable onPress={() => onOpenZoom(index)} hitSlop={10} style={s.zoomBtn}>
          <Expand size={14} color="#FFF" />
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: "relative", width: "100%" },
  image: { width: "100%", aspectRatio: 1, backgroundColor: "#111" },
  counter: { position: "absolute", top: 12, right: 12, backgroundColor: "rgba(0,0,0,.6)", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 },
  counterText: { color: "#FFF", fontSize: 11, fontWeight: "800" },
  dots: { position: "absolute", bottom: 10, alignSelf: "center", flexDirection: "row", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,.45)" },
  dotOn: { backgroundColor: "#FFF" },
  zoomBtn: { position: "absolute", bottom: 10, right: 12, backgroundColor: "rgba(0,0,0,.55)", borderRadius: 14, padding: 6 }
});
