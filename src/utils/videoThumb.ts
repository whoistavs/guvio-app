import { Platform } from "react-native";

/** gera a capa do vídeo (um quadro do início) e devolve a uri da imagem */
export async function videoThumbnail(uri: string): Promise<string> {
  if (Platform.OS !== "web") {
    const { getThumbnailAsync } = require("expo-video-thumbnails") as typeof import("expo-video-thumbnails");
    const t = await getThumbnailAsync(uri, { time: 300, quality: 0.8 });
    return t.uri;
  }
  // no navegador: desenha um quadro do vídeo num canvas
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.muted = true;
    v.preload = "auto";
    v.src = uri;
    v.onloadeddata = () => {
      v.currentTime = Math.min(0.3, (v.duration || 1) / 2);
    };
    v.onseeked = () => {
      try {
        const c = document.createElement("canvas");
        c.width = v.videoWidth || 720;
        c.height = v.videoHeight || 1280;
        c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.8));
      } catch (e) {
        reject(e);
      }
    };
    v.onerror = () => reject(new Error("Não foi possível ler o vídeo."));
  });
}
