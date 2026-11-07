import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Pause, Play, Volume2, VolumeX } from "lucide-react-native";
import { FastImage } from "./FastImage";

/** Vídeo do post: mostra a capa; só carrega o vídeo quando a pessoa toca (feed continua leve) */
export function VideoMedia({ uri, poster, style }: { uri: string; poster: string; style: any }) {
  const [started, setStarted] = useState(false);
  return (
    <View style={style}>
      <FastImage source={poster} style={StyleSheet.absoluteFill as any} contentFit="cover" />
      {started ? (
        <Player uri={uri} />
      ) : (
        <Pressable onPress={() => setStarted(true)} style={s.center} hitSlop={20}>
          <View style={s.play}>
            <Play size={30} color="#FFF" fill="#FFF" />
          </View>
        </Pressable>
      )}
    </View>
  );
}

function Player({ uri }: { uri: string }) {
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(true);
  const player = useVideoPlayer(uri, p => {
    p.loop = true;
    p.muted = false;
    p.play();
  });

  useEffect(() => {
    player.muted = muted;
  }, [muted]);

  const toggle = () => {
    if (player.playing) {
      player.pause();
      setPlaying(false);
    } else {
      player.play();
      setPlaying(true);
    }
  };

  return (
    <>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      <Pressable onPress={toggle} style={StyleSheet.absoluteFill}>
        {!playing ? (
          <View style={s.center} pointerEvents="none">
            <View style={s.play}>
              <Pause size={28} color="#FFF" fill="#FFF" />
            </View>
          </View>
        ) : null}
      </Pressable>
      <Pressable onPress={() => setMuted(m => !m)} style={s.mute} hitSlop={10}>
        {muted ? <VolumeX size={16} color="#FFF" /> : <Volume2 size={16} color="#FFF" />}
      </Pressable>
    </>
  );
}

const s = StyleSheet.create({
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  play: { width: 64, height: 64, borderRadius: 32, backgroundColor: "rgba(0,0,0,.55)", alignItems: "center", justifyContent: "center", paddingLeft: 3 },
  mute: { position: "absolute", right: 12, bottom: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,.6)", alignItems: "center", justifyContent: "center" }
});
