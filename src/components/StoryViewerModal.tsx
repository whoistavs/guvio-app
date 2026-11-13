import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
  Animated,
  Platform,
  PanResponder,
  ScrollView,
  Easing
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useVideoPlayer, VideoView } from "expo-video";
import { Eye, Send, Trash2, X } from "lucide-react-native";
import { StoryStickerView } from "./StoryStickerView";
import { StoryOverlayText } from "./StoryOverlayText";
import { placeStyle, StoryLayersView } from "./story/StoryLayers";
import { UserStoryGroup, StoryItem } from "../data/mockData";
import { FastImage } from "./FastImage";
import {
  markStorySeen,
  deleteMyStory,
  loadStoryViewers,
  loadStoryResponses,
  loadChat,
  sendChatMessage
} from "../services/storage";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const STORY_DURATION = 5000; // 5 seconds per story

export function StoryViewerModal({
  visible,
  onClose,
  storyGroups,
  initialGroupIndex = 0,
  onAddStory,
  onStorySeen,
  onStoryDeleted,
  onOpenProfile,
  onOpenTag
}: {
  visible: boolean;
  onClose: () => void;
  storyGroups: UserStoryGroup[];
  initialGroupIndex?: number;
  onAddStory?: (imageUri: string, caption?: string) => void;
  onStorySeen?: (storyId: string) => void;
  onStoryDeleted?: (storyId: string) => void;
  /** tocar numa @menção / #hashtag do story */
  onOpenProfile?: (username: string) => void;
  onOpenTag?: (tag: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [reactionHeart, setReactionHeart] = useState(false);
  const [reactionEmoji, setReactionEmoji] = useState("❤️");
  const [reactionLabel, setReactionLabel] = useState("Reação enviada");

  const progressAnim = useRef(new Animated.Value(0)).current;
  const [viewers, setViewers] = useState<{ username: string; avatar: string; time: string }[] | null>(null);

  // Filter groups that have stories
  const activeGroups = storyGroups.filter(g => g.stories && g.stories.length > 0);
  const currentGroup = activeGroups[groupIndex] || null;
  const currentStory: StoryItem | null = currentGroup?.stories[storyIndex] || null;

  useEffect(() => {
    if (visible) {
      setGroupIndex(Math.min(initialGroupIndex, Math.max(0, activeGroups.length - 1)));
      setStoryIndex(0);
    }
  }, [visible, initialGroupIndex]);

  // segurar o dedo: pausa e esconde a interface (igual ao Instagram)
  const [holding, setHolding] = useState(false);
  // vídeo: o tempo do story é o do vídeo; foto: 5s
  const [dur, setDur] = useState(STORY_DURATION);
  const [mediaReady, setMediaReady] = useState(true);
  const [fit, setFit] = useState<"cover" | "contain">("cover");
  const progressVal = useRef(0);
  const nextRef = useRef(() => {});
  useEffect(() => {
    const id = progressAnim.addListener(({ value }) => (progressVal.current = value));
    return () => progressAnim.removeListener(id);
  }, []);

  // story novo: barra do zero
  useEffect(() => {
    progressAnim.setValue(0);
    progressVal.current = 0;
    setDur(STORY_DURATION);
    setFit("cover");
    setMediaReady(!currentStory?.videoUrl);
  }, [visible, currentStory?.id]);

  useEffect(() => {
    if (!visible || !currentStory || isPaused || !mediaReady) {
      progressAnim.stopAnimation();
      return;
    }
    // continua de onde parou (pausar não zera a barra)
    const from = progressVal.current;
    const animation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: Math.max(60, dur * (1 - from)),
      easing: Easing.linear,
      useNativeDriver: false
    });
    animation.start(({ finished }) => {
      if (finished) nextRef.current();
    });
    return () => {
      progressAnim.stopAnimation();
    };
  }, [visible, currentStory?.id, isPaused, mediaReady, dur]);

  const player = useVideoPlayer(visible && currentStory?.videoUrl ? currentStory.videoUrl : null, p => {
    p.loop = false;
    p.play();
  });
  useEffect(() => {
    if (!player || !currentStory?.videoUrl) return;
    const ready = () => {
      setDur(Math.min(30000, Math.max(1500, (player.duration || 5) * 1000)));
      setMediaReady(true);
    };
    if (player.status === "readyToPlay") ready();
    const sub = player.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay") ready();
      // vídeo não carregou: mostra a capa por 5s
      if (status === "error") setMediaReady(true);
    });
    return () => sub.remove();
  }, [player]);
  useEffect(() => {
    if (!player) return;
    try {
      if (isPaused || !visible) player.pause();
      else player.play();
    } catch {}
  }, [player, isPaused, visible]);

  const handleNextStory = () => {
    if (!currentGroup) return;
    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex(prev => prev + 1);
    } else if (groupIndex < activeGroups.length - 1) {
      setGroupIndex(prev => prev + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  };

  nextRef.current = handleNextStory;

  const handlePrevStory = () => {
    if (storyIndex > 0) {
      setStoryIndex(prev => prev - 1);
    } else if (groupIndex > 0) {
      setGroupIndex(prev => prev - 1);
      const prevGroup = activeGroups[groupIndex - 1];
      setStoryIndex(prevGroup.stories.length - 1);
    }
  };

  // ---- gestos: arrastar para baixo fecha; para o lado troca de pessoa ----
  const dragY = useRef(new Animated.Value(0)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  // lado em que a "aresta do cubo" fica enquanto troca de pessoa
  const [cubeEdge, setCubeEdge] = useState<"left" | "right">("right");
  const navRef = useRef({ next: () => {}, prev: () => {}, close: () => {} });
  navRef.current = {
    next: () => {
      if (groupIndex < activeGroups.length - 1) {
        setGroupIndex(g => g + 1);
        setStoryIndex(0);
      } else onClose();
    },
    prev: () => {
      if (groupIndex > 0) {
        setGroupIndex(g => g - 1);
        setStoryIndex(0);
      }
    },
    close: onClose
  };
  const swipe = useMemo(() => {
    const ND = Platform.OS !== "web";
    let axis: "x" | "y" | null = null;
    const reset = () =>
      Animated.parallel([
        Animated.spring(dragY, { toValue: 0, useNativeDriver: ND }),
        Animated.spring(dragX, { toValue: 0, useNativeDriver: ND })
      ]).start();
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_e, g) => {
        if (Math.abs(g.dy) > 12 && g.dy > 0 && Math.abs(g.dy) > Math.abs(g.dx) * 1.3) {
          axis = "y";
          return true;
        }
        if (Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.3) {
          axis = "x";
          setCubeEdge(g.dx < 0 ? "right" : "left");
          return true;
        }
        return false;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => setIsPaused(true),
      onPanResponderMove: (_e, g) => {
        if (axis === "y") dragY.setValue(Math.max(0, g.dy));
        else dragX.setValue(g.dx);
      },
      onPanResponderRelease: (_e, g) => {
        const W = Dimensions.get("window").width;
        const H = Dimensions.get("window").height;
        if (axis === "y" && (g.dy > H * 0.18 || g.vy > 0.8)) {
          Animated.timing(dragY, { toValue: H, duration: 180, useNativeDriver: ND }).start(() => {
            dragY.setValue(0);
            setIsPaused(false);
            navRef.current.close();
          });
          return;
        }
        if (axis === "x" && (Math.abs(g.dx) > W * 0.25 || Math.abs(g.vx) > 0.6)) {
          const left = g.dx < 0;
          Animated.timing(dragX, { toValue: left ? -W : W, duration: 170, useNativeDriver: ND }).start(() => {
            dragX.setValue(0);
            setIsPaused(false);
            if (left) navRef.current.next();
            else navRef.current.prev();
          });
          return;
        }
        reset();
        setIsPaused(false);
      },
      onPanResponderTerminate: () => {
        reset();
        setIsPaused(false);
      }
    });
  }, []);

  // marca como visto quando o story aparece na tela
  useEffect(() => {
    if (!visible || !currentStory || !currentGroup || currentGroup.isMe || currentStory.seen) return;
    markStorySeen(currentStory.id);
    onStorySeen?.(currentStory.id);
  }, [visible, currentStory?.id]);

  // respostas e reações viram mensagens de verdade no Direct
  const sendToAuthor = async (text: string) => {
    if (!currentGroup || !currentStory) return;
    const thread = {
      id: currentGroup.id,
      profileId: currentGroup.id,
      username: currentGroup.username,
      avatar: currentGroup.avatar,
      lastMessage: "",
      time: ""
    };
    const current = await loadChat(thread).catch(() => []);
    await sendChatMessage(thread, current, { text, image: currentStory.image });
  };

  const handleSendReaction = (emoji: string) => {
    setReactionEmoji(emoji);
    setReactionLabel("Reação enviada");
    setReactionHeart(true);
    setTimeout(() => setReactionHeart(false), 1100);
    sendToAuthor(`${emoji} Reagiu ao seu story`).catch(() => {});
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    const text = replyText.trim();
    setReplyText("");
    try {
      await sendToAuthor(`Respondeu ao seu story: ${text}`);
      // mesmo aviso animado das reações, sem pop-up
      setReactionLabel("Resposta enviada no Direct");
      setReactionEmoji("✉️");
      setReactionHeart(true);
      setTimeout(() => setReactionHeart(false), 1200);
    } catch (e: any) {
      Alert.alert("Não enviado", e?.message || "Tente novamente.");
    }
  };

  const [responses, setResponses] = useState<{ username: string; avatar: string; kind: string; value: string }[]>([]);
  const openViewers = async () => {
    if (!currentStory) return;
    setIsPaused(true);
    setViewers([]);
    setResponses([]);
    const [v, r] = await Promise.all([
      loadStoryViewers(currentStory.id),
      currentStory.sticker ? loadStoryResponses(currentStory.id).catch(() => []) : Promise.resolve([])
    ]);
    setViewers(v);
    setResponses(r as any);
  };

  const handleDeleteStory = () => {
    if (!currentStory) return;
    setIsPaused(true);
    Alert.alert("Apagar story?", "Ele some para todo mundo.", [
      { text: "Cancelar", style: "cancel", onPress: () => setIsPaused(false) },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMyStory(currentStory.id);
            onStoryDeleted?.(currentStory.id);
            onClose();
          } catch (e: any) {
            Alert.alert("Erro", e?.message || "Não foi possível apagar.");
            setIsPaused(false);
          }
        }
      }
    ]);
  };

  if (!visible || !currentGroup || !currentStory) return null;

  // o story tem sempre o formato 9:16 (o mesmo do editor), para o texto e as figurinhas ficarem no lugar certo
  const win = Dimensions.get("window");
  const maxH = win.height - insets.top - insets.bottom - 70;
  const CW = Math.min(win.width, maxH * (9 / 16));
  const CH = CW * (16 / 9);
  const layers = currentStory.overlay?.layers;
  const sticker = currentStory.sticker;
  const placed = sticker && typeof sticker.x === "number";
  const pressIn = () => setIsPaused(true);
  const pressOut = () => {
    setIsPaused(false);
    setHolding(false);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <Animated.View
        style={[
          s.container,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            transformOrigin: cubeEdge,
            transform: [
              { perspective: 900 },
              { translateY: dragY },
              { translateX: dragX },
              {
                // efeito cubo: a tela gira em volta da aresta enquanto troca de pessoa
                rotateY: dragX.interpolate({
                  inputRange: [-win.width, 0, win.width],
                  outputRange: ["-75deg", "0deg", "75deg"],
                  extrapolate: "clamp"
                })
              },
              { scale: dragY.interpolate({ inputRange: [0, 600], outputRange: [1, 0.85], extrapolate: "clamp" }) }
            ]
          }
        ]}
        {...swipe.panHandlers}
      >
        <View style={[s.canvas, { width: CW, height: CH }]}>
          {/* foto que não é 9:16: aparece inteira, com o fundo desfocado */}
          {fit === "contain" ? (
            <FastImage source={currentStory.image} style={s.storyImage} contentFit="cover" blurRadius={40} />
          ) : null}
          <FastImage
            source={currentStory.image}
            style={s.storyImage}
            contentFit={fit}
            transition={120}
            onLoad={e => {
              const w = e?.source?.width, h = e?.source?.height;
              if (w && h) {
                const r = w / h;
                setFit(r > 0.68 || r < 0.5 ? "contain" : "cover");
              }
            }}
          />
          {currentStory.videoUrl && player ? (
            <VideoView player={player} style={s.storyImage} contentFit="cover" nativeControls={false} />
          ) : null}
          {!layers?.length ? <StoryOverlayText overlay={currentStory.overlay} /> : null}

          {/* toque: esquerda volta, direita avança; segurar pausa */}
          <View style={s.touchArea}>
            <Pressable
              style={s.touchLeft}
              onPress={handlePrevStory}
              onPressIn={pressIn}
              onPressOut={pressOut}
              onLongPress={() => setHolding(true)}
              delayLongPress={220}
            />
            <Pressable
              style={s.touchRight}
              onPress={handleNextStory}
              onPressIn={pressIn}
              onPressOut={pressOut}
              onLongPress={() => setHolding(true)}
              delayLongPress={220}
            />
          </View>

          {/* textos, menções, links e desenho (por cima dos toques, para dar para tocar) */}
          <StoryLayersView
            layers={layers}
            W={CW}
            H={CH}
            onMention={u => {
              onClose();
              onOpenProfile?.(u);
            }}
            onHashtag={tag => {
              onClose();
              onOpenTag?.(tag);
            }}
          />

          {sticker ? (
            placed ? (
              <View style={placeStyle({ x: sticker.x!, y: sticker.y ?? 0.6, scale: sticker.scale ?? 1, rot: sticker.rot ?? 0 }, CW, CH)} pointerEvents="box-none">
                <View style={{ width: CW }} pointerEvents="box-none">
                  <StoryStickerView sticker={sticker} story={currentStory} isMe={!!currentGroup.isMe} onPause={p => setIsPaused(p)} />
                </View>
              </View>
            ) : (
              <View style={s.stickerWrap} pointerEvents="box-none">
                <StoryStickerView sticker={sticker} story={currentStory} isMe={!!currentGroup.isMe} onPause={p => setIsPaused(p)} />
              </View>
            )
          ) : null}

          {/* topo: barras e autor (somem enquanto segura) */}
          {!holding ? (
            <View style={s.topWrap} pointerEvents="box-none">
              <View style={s.topOverlay} pointerEvents="none" />
              <View style={s.progressContainer} pointerEvents="none">
                {currentGroup.stories.map((st, idx) => {
                  let width: any = "0%";
                  if (idx < storyIndex) width = "100%";
                  else if (idx === storyIndex)
                    width = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
                  return (
                    <View key={st.id} style={s.progressBarBackground}>
                      <Animated.View style={[s.progressBarFill, { width }]} />
                    </View>
                  );
                })}
              </View>
              <View style={s.header} pointerEvents="box-none">
                <Pressable
                  style={s.authorInfo}
                  onPress={() => {
                    if (currentGroup.isMe) return;
                    onClose();
                    onOpenProfile?.(currentGroup.username);
                  }}
                >
                  <FastImage source={currentGroup.avatar} style={s.authorAvatar} contentFit="cover" />
                  <View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={s.authorName}>{currentGroup.displayName}</Text>
                      <Text style={s.timeAgo}>· {currentStory.timestamp}</Text>
                      {currentStory.closeFriends ? (
                        <View style={s.cfBadge}>
                          <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "700" }}>Melhores amigos</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={s.authorHandle}>@{currentGroup.username}</Text>
                  </View>
                </Pressable>
                <Pressable onPress={onClose} hitSlop={15} style={s.closeButton}>
                  <X size={24} color="#FFF" />
                </Pressable>
              </View>
            </View>
          ) : null}

          {currentStory.caption && !holding ? (
            <View style={s.captionContainer} pointerEvents="none">
              <Text style={s.captionText}>{currentStory.caption}</Text>
            </View>
          ) : null}

          {!currentGroup.isMe && !holding ? (
            <View style={s.reactionsRow}>
              {["❤️", "🔥", "😍", "😂", "👏", "✨"].map(emoji => (
                <Pressable key={emoji} onPress={() => handleSendReaction(emoji)} style={s.emojiBtn} hitSlop={4}>
                  <Text style={s.emojiText}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* reação: o emoji escolhido aparece grande */}
          {reactionHeart && (
            <View pointerEvents="none" style={s.reactionOverlay}>
              <Text style={{ fontSize: 96 }}>{reactionEmoji}</Text>
              <Text style={{ color: "#FFF", fontWeight: "600", marginTop: 6 }}>{reactionLabel}</Text>
            </View>
          )}
        </View>

        {/* embaixo do story: responder / reações, ou Quem viu e Apagar */}
        <View style={{ flex: 1, alignSelf: "stretch", justifyContent: "center", opacity: holding ? 0 : 1 }}>
          {currentGroup.isMe ? (
            <View style={s.ownerBar}>
              <Pressable onPress={openViewers} style={s.ownerBtn} hitSlop={8}>
                <Eye size={20} color="#FFF" />
                <Text style={s.ownerText}>Quem viu</Text>
              </Pressable>
              <Pressable onPress={handleDeleteStory} style={s.ownerBtn} hitSlop={8}>
                <Trash2 size={20} color="#FFF" />
                <Text style={s.ownerText}>Apagar</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.bottomBar}>
              <View style={s.replyInputWrapper}>
                <TextInput
                  value={replyText}
                  onChangeText={setReplyText}
                  placeholder={`Responder a @${currentGroup.username}...`}
                  placeholderTextColor="rgba(255,255,255,0.6)"
                  style={s.replyInput}
                  onFocus={() => setIsPaused(true)}
                  onBlur={() => setIsPaused(false)}
                />
                {replyText.trim() ? (
                  <Pressable onPress={handleSendReply} style={s.sendBtn}>
                    <Send size={18} color="#FFF" />
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
        </View>
        {viewers !== null ? (
          <View style={s.viewersSheet}>
            <View style={s.viewersHead}>
              <Text style={s.viewersTitle}>Visto por {viewers.length}</Text>
              <Pressable
                onPress={() => {
                  setViewers(null);
                  setIsPaused(false);
                }}
                hitSlop={10}
              >
                <X size={22} color="#FFF" />
              </Pressable>
            </View>
            <ScrollView>
              {responses.length > 0 && currentStory?.sticker ? (
                <View style={{ marginBottom: 14 }}>
                  <Text style={s.respTitle}>
                    {currentStory.sticker.type === "poll" ? "Votos" : "Respostas"} ({responses.length})
                  </Text>
                  {responses.map((r, i) => (
                    <View key={i} style={s.viewerRow}>
                      <FastImage source={r.avatar} style={s.viewerAvatar} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: "#FFF", fontWeight: "600" }}>@{r.username}</Text>
                        <Text style={{ color: "rgba(255,255,255,.8)", fontSize: 13 }}>
                          {r.kind === "vote" && currentStory.sticker?.type === "poll"
                            ? `votou em "${currentStory.sticker.options[Number(r.value)] ?? r.value}"`
                            : r.value}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
              {viewers.length === 0 ? (
                <Text style={{ color: "rgba(255,255,255,.7)", textAlign: "center", marginTop: 20 }}>
                  Ninguém viu ainda.
                </Text>
              ) : (
                viewers.map(v => (
                  <View key={v.username} style={s.viewerRow}>
                    <FastImage source={v.avatar} style={s.viewerAvatar} />
                    <Text style={{ color: "#FFF", fontWeight: "600", flex: 1 }}>@{v.username}</Text>
                    <Text style={{ color: "rgba(255,255,255,.6)", fontSize: 11 }}>{v.time}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        ) : null}
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  stickerWrap: { position: "absolute", left: 0, right: 0, top: "55%" },
  stickerInput: { color: "#FFF", fontSize: 16, fontWeight: "700", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.4)", paddingVertical: 8, textAlign: "center" },
  cfBadge: { backgroundColor: "#22C55E", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  cfToggle: { position: "absolute", left: 14, top: 14, zIndex: 6, borderWidth: 1.5, borderColor: "rgba(255,255,255,.7)", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(0,0,0,.4)" },
  respTitle: { color: "rgba(255,255,255,.6)", fontSize: 13, fontWeight: "600", marginBottom: 6 },
  textTools: { position: "absolute", top: 14, right: 14, gap: 10, zIndex: 6 },
  toolBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(0,0,0,.5)", alignItems: "center", justifyContent: "center" },
  textEditor: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,.55)", justifyContent: "center", padding: 24, zIndex: 7 },
  textEditorInput: { fontSize: 28, fontWeight: "700", textAlign: "center", minHeight: 60 },
  colorRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 24 },
  colorDot: { width: 30, height: 30, borderRadius: 15, borderColor: "#FFF" },
  doneText: { alignSelf: "center", marginTop: 24, backgroundColor: "#FFF", paddingHorizontal: 22, paddingVertical: 10, borderRadius: 20 },
  ownerBar: { flexDirection: "row", justifyContent: "center", gap: 40 },
  ownerBtn: { alignItems: "center", gap: 4 },
  ownerText: { color: "#FFF", fontSize: 11, fontWeight: "600" },
  viewersSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: SCREEN_HEIGHT * 0.45,
    backgroundColor: "rgba(15,15,15,.96)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18
  },
  viewersHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  viewersTitle: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  viewerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  viewerAvatar: { width: 36, height: 36, borderRadius: 18 },
  container: { flex: 1, backgroundColor: "#000", alignItems: "center" },
  canvas: { borderRadius: 14, overflow: "hidden", backgroundColor: "#111" },
  topWrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  storyImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 130,
    backgroundColor: "rgba(0,0,0,0.3)"
  },
  bottomOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: "rgba(0,0,0,0.6)"
  },
  safeArea: { flex: 1, justifyContent: "flex-start" },
  progressContainer: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 8,
    zIndex: 10
  },
  progressBarBackground: {
    flex: 1,
    height: 2.5,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
    overflow: "hidden"
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#FFF"
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    zIndex: 10
  },
  authorInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  authorAvatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: "#FFF" },
  authorName: { color: "#FFF", fontSize: 13, fontWeight: "600" },
  timeAgo: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "500" },
  authorHandle: { color: "rgba(255,255,255,0.8)", fontSize: 11 },
  closeButton: { padding: 4 },
  touchArea: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row"
  },
  touchLeft: { width: "35%", height: "100%" },
  touchRight: { width: "65%", height: "100%" },
  captionContainer: {
    position: "absolute",
    bottom: 64,
    maxWidth: "88%",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    alignSelf: "center",
    zIndex: 10,
    marginBottom: 10
  },
  captionText: { color: "#FFF", fontSize: 13, fontWeight: "600", textAlign: "center" },
  bottomBar: {
    paddingHorizontal: 12,
    width: "100%"
  },
  replyInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 46
  },
  replyInput: { flex: 1, color: "#FFF", fontSize: 13 },
  sendBtn: { padding: 4 },
  reactionsRow: { position: "absolute", left: 10, right: 10, bottom: 12, flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  emojiBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.35)"
  },
  emojiText: { fontSize: 20 },
  reactionOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20
  },

  // Create Story Modal Styles
  createContainer: { flex: 1, backgroundColor: "#111" },
  createHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#222"
  },
  createTitle: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  publishBtn: { backgroundColor: "#0095F6", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16 },
  publishBtnText: { color: "#FFF", fontSize: 12, fontWeight: "600" },
  previewContainer: { flex: 1, margin: 16, borderRadius: 20, overflow: "hidden", backgroundColor: "#000" },
  previewImage: { width: "100%", height: "100%" },
  captionInputBox: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  captionInput: { color: "#FFF", fontSize: 14 },
  emptyPicker: { flex: 1, justifyContent: "center", alignItems: "center", padding: 30, gap: 24 },
  pickerPrompt: { color: "#AAA", fontSize: 15, textAlign: "center", fontWeight: "600" },
  pickerButtonsRow: { flexDirection: "row", gap: 20 },
  pickerOption: {
    width: 120,
    height: 120,
    borderRadius: 20,
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#333"
  },
  pickerOptionText: { color: "#FFF", fontSize: 13, fontWeight: "700" }
});
