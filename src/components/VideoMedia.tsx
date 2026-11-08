import React, { useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Play, Video } from "lucide-react-native";
import { FastImage } from "./FastImage";

/**
 * Vídeo no feed: mostra a capa (o feed continua leve).
 * Um toque abre em tela cheia; dois toques curtem.
 */
export function VideoMedia({
  poster,
  style,
  onOpen,
  onDoubleTap
}: {
  uri?: string;
  poster: string;
  style: any;
  onOpen?: () => void;
  onDoubleTap?: () => void;
}) {
  const last = useRef(0);
  const single = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (single.current) clearTimeout(single.current);
  }, []);

  const onPress = () => {
    const now = Date.now();
    if (now - last.current < 280) {
      last.current = 0;
      if (single.current) clearTimeout(single.current);
      single.current = null;
      onDoubleTap?.();
      return;
    }
    last.current = now;
    single.current = setTimeout(() => {
      single.current = null;
      onOpen?.();
    }, 280);
  };

  return (
    <Pressable onPress={onPress} style={style}>
      <FastImage source={poster} style={StyleSheet.absoluteFill as any} contentFit="cover" />
      <View style={s.center} pointerEvents="none">
        <View style={s.play}>
          <Play size={28} color="#FFF" fill="#FFF" />
        </View>
      </View>
      <View style={s.badge} pointerEvents="none">
        <Video size={16} color="#FFF" />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  play: { width: 62, height: 62, borderRadius: 31, backgroundColor: "rgba(0,0,0,.45)", alignItems: "center", justifyContent: "center", paddingLeft: 3 },
  badge: { position: "absolute", top: 12, right: 12 }
});
