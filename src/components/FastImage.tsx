import React from "react";
import { Image as ExpoImage, ImageProps as ExpoImageProps } from "expo-image";
import { StyleProp, ImageStyle, StyleSheet, View } from "react-native";
import { User, ImagePlus } from "lucide-react-native";
import { useAppTheme } from "../context/AppTheme";

/** Fotos de exemplo antigas que não devem mais aparecer como foto de perfil */
const STOCK_AVATARS = ["photo-1534528741775-53994a69daeb"];

export function isRealImage(src: unknown): boolean {
  if (typeof src === "number") return true;
  const uri = typeof src === "string" ? src : (src as any)?.uri;
  if (!uri || typeof uri !== "string" || !uri.trim()) return false;
  return !STOCK_AVATARS.some(id => uri.includes(id));
}

/** Ícone no lugar da foto, no estilo Instagram/TikTok */
export function ImagePlaceholder({
  style,
  kind = "avatar"
}: {
  style?: StyleProp<ImageStyle>;
  kind?: "avatar" | "photo";
}) {
  const { colors, dark } = useAppTheme() as any;
  const flat = (StyleSheet.flatten(style) || {}) as any;
  const w = typeof flat.width === "number" ? flat.width : 40;
  const h = typeof flat.height === "number" ? flat.height : w;
  const size = Math.max(14, Math.min(w, h) * (kind === "avatar" ? 0.62 : 0.3));
  const bg = dark ? "#2A2A2E" : "#E3E5E8";
  const fg = dark ? "#8E8E93" : "#FFFFFF";
  return (
    <View
      style={[
        style as any,
        {
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: kind === "avatar" ? "flex-end" : "center",
          overflow: "hidden"
        }
      ]}
    >
      {kind === "avatar" ? (
        <User size={size} color={fg} fill={fg} strokeWidth={1.2} style={{ marginBottom: -size * 0.12 }} />
      ) : (
        <ImagePlus size={size} color={colors?.muted || fg} />
      )}
    </View>
  );
}

export interface FastImageProps extends Omit<ExpoImageProps, "style"> {
  source: string | { uri: string } | number;
  style?: StyleProp<ImageStyle>;
}

export function FastImage({ source, style, contentFit = "cover", transition = 150, ...props }: FastImageProps) {
  if (!isRealImage(source)) return <ImagePlaceholder style={style} />;
  const imageSource = typeof source === "string" ? { uri: source } : source;

  return (
    <ExpoImage
      source={imageSource as any}
      style={style as any}
      contentFit={contentFit}
      transition={transition}
      cachePolicy="memory-disk"
      {...props}
    />
  );
}

// Precarregador síncrono nativo para fotos de guarda-roupa e feed
export function preloadImages(urls: string[]) {
  // economia de dados: não baixa fotos antes de aparecerem na tela
  if (require("../services/settings").isDataSaver()) return;
  const validUrls = urls.filter(u => typeof u === "string" && u.startsWith("http"));
  if (validUrls.length > 0) {
    ExpoImage.prefetch(validUrls, "memory-disk").catch(() => {});
  }
}
