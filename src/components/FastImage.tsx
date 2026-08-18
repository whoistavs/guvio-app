import React from "react";
import { Image as ExpoImage, ImageProps as ExpoImageProps } from "expo-image";
import { StyleProp, ImageStyle } from "react-native";

export interface FastImageProps extends Omit<ExpoImageProps, "style"> {
  source: string | { uri: string } | number;
  style?: StyleProp<ImageStyle>;
}

export function FastImage({ source, style, contentFit = "cover", transition = 150, ...props }: FastImageProps) {
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
  const validUrls = urls.filter(u => typeof u === "string" && u.startsWith("http"));
  if (validUrls.length > 0) {
    ExpoImage.prefetch(validUrls, "memory-disk").catch(() => {});
  }
}
