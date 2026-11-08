import React, { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Expand } from "lucide-react-native";
import { FastImage } from "./FastImage";
import { VideoMedia } from "./VideoMedia";
import { usePinchZoom, noSwipeBack } from "./gestures";

/**
 * Foto(s) do post: uma foto ou carrossel (arrastar para os lados), com bolinhas.
 * Dois toques chamam onDoubleTap; segurar ou tocar no ícone abre o zoom.
 */
export function PostMedia({
  images,
  onDoubleTap,
  onOpenZoom,
  children,
  video,
  labels,
  onOpenVideo,
  aspect = 1
}: {
  images: string[];
  /** post de vídeo: a primeira imagem é a capa */
  video?: string;
  /** enquete: nome de cada opção, por cima de cada foto */
  labels?: string[];
  onDoubleTap?: () => void;
  /** vídeo: um toque abre em tela cheia */
  onOpenVideo?: () => void;
  /** proporção da foto (largura/altura) */
  aspect?: number;
  onOpenZoom?: (index: number) => void;
  /** coisas por cima da foto (coração animado, etiquetas das peças) */
  children?: React.ReactNode;
}) {
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const lastTap = useRef(0);
  const list = images.length ? images : [""];
  // como no feed das redes: entre 3:4 (retrato) e 1,91:1 (paisagem); fora disso, a foto aparece inteira com faixas
  const shown = Math.min(1.91, Math.max(0.75, aspect || 1));
  const fit = Math.abs(shown - (aspect || 1)) < 0.01 ? "cover" : "contain";
  const imgStyle = [s.image, { aspectRatio: shown }];
  // pinça com dois dedos dá zoom por cima de tudo
  const pinch = usePinchZoom(() => <FastImage source={list[index] || list[0]} style={{ width: "100%", height: "100%" }} contentFit={fit} />);

  const handlePress = () => {
    const now = Date.now();
    if (now - lastTap.current < 320) {
      lastTap.current = 0;
      onDoubleTap?.();
    } else {
      lastTap.current = now;
    }
  };

  if (video) {
    return (
      <View style={s.wrap}>
        <VideoMedia uri={video} poster={list[0]} style={imgStyle} onOpen={onOpenVideo} onDoubleTap={onDoubleTap} />
        {children}
      </View>
    );
  }

  return (
    <View style={s.wrap} onLayout={e => setWidth(e.nativeEvent.layout.width)} ref={pinch.ref} collapsable={false} {...pinch.panHandlers}>

      {list.length === 1 ? (
        <Pressable onPress={handlePress} onLongPress={() => onOpenZoom?.(0)} delayLongPress={350}>
          <FastImage source={list[0]} style={imgStyle} contentFit={fit} transition={120} />
        </Pressable>
      ) : (
        <ScrollView {...noSwipeBack}
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
              <FastImage source={uri} style={imgStyle} contentFit={fit} transition={120} />
              {labels?.[i] ? (
                <View style={s.label} pointerEvents="none">
                  <Text style={s.labelNum}>{i + 1}</Text>
                  <Text style={s.labelText} numberOfLines={1}>
                    {labels[i]}
                  </Text>
                </View>
              ) : null}
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
  label: { position: "absolute", left: 12, bottom: 34, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(0,0,0,.65)", borderRadius: 18, paddingRight: 12, maxWidth: "80%" },
  labelNum: { color: "#000", backgroundColor: "#FFF", fontWeight: "700", width: 28, height: 28, borderRadius: 14, textAlign: "center", lineHeight: 28, overflow: "hidden" },
  labelText: { color: "#FFF", fontWeight: "600", fontSize: 13 },
  wrap: { position: "relative", width: "100%" },
  image: { width: "100%", aspectRatio: 1, backgroundColor: "#111" },
  counter: { position: "absolute", top: 12, right: 12, backgroundColor: "rgba(0,0,0,.6)", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 },
  counterText: { color: "#FFF", fontSize: 11, fontWeight: "600" },
  dots: { position: "absolute", bottom: 10, alignSelf: "center", flexDirection: "row", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,.45)" },
  dotOn: { backgroundColor: "#FFF" },
  zoomBtn: { position: "absolute", bottom: 10, right: 12, backgroundColor: "rgba(0,0,0,.55)", borderRadius: 14, padding: 6 }
});
