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
  ScrollView
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BarChart2, Camera, ChevronLeft, Eye, Heart, HelpCircle, ImagePlus, MoveVertical, Plus, Send, Square, Trash2, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { StoryOverlay, StorySticker } from "../data/mockData";
import { StoryStickerView } from "./StoryStickerView";
import { OVERLAY_COLORS, StoryOverlayText } from "./StoryOverlayText";
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
  onStoryDeleted
}: {
  visible: boolean;
  onClose: () => void;
  storyGroups: UserStoryGroup[];
  initialGroupIndex?: number;
  onAddStory?: (imageUri: string, caption?: string) => void;
  onStorySeen?: (storyId: string) => void;
  onStoryDeleted?: (storyId: string) => void;
}) {
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

  useEffect(() => {
    if (!visible || !currentStory || isPaused) {
      progressAnim.stopAnimation();
      return;
    }

    progressAnim.setValue(0);
    const animation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false
    });

    animation.start(({ finished }) => {
      if (finished) {
        handleNextStory();
      }
    });

    return () => {
      progressAnim.stopAnimation();
    };
  }, [visible, groupIndex, storyIndex, isPaused, currentStory]);

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

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <Animated.View
        style={[
          s.container,
          {
            transform: [
              { translateY: dragY },
              { translateX: dragX },
              { scale: dragY.interpolate({ inputRange: [0, 600], outputRange: [1, 0.85], extrapolate: "clamp" }) }
            ],
            borderRadius: 18,
            overflow: "hidden"
          }
        ]}
        {...swipe.panHandlers}
      >
        {/* Story Background Image */}
        <FastImage source={currentStory.image} style={s.storyImage} contentFit="cover" transition={150} />
        <StoryOverlayText overlay={currentStory.overlay} />
        {currentStory.sticker ? (
          <View style={s.stickerWrap} pointerEvents="box-none">
            <StoryStickerView
              sticker={currentStory.sticker}
              story={currentStory}
              isMe={!!currentGroup.isMe}
              onPause={p => setIsPaused(p)}
            />
          </View>
        ) : null}

        {/* reação: o emoji escolhido aparece grande */}
        {reactionHeart && (
          <View pointerEvents="none" style={s.reactionOverlay}>
            <Text style={{ fontSize: 96 }}>{reactionEmoji}</Text>
            <Text style={{ color: "#FFF", fontWeight: "600", marginTop: 6 }}>{reactionLabel}</Text>
          </View>
        )}

        {/* Gradient dark overlays */}
        <View style={s.topOverlay} pointerEvents="none" />
        <View style={s.bottomOverlay} pointerEvents="none" />

        <SafeAreaView style={s.safeArea}>
          {/* Progress Indicators */}
          <View style={s.progressContainer}>
            {currentGroup.stories.map((st, idx) => {
              let width: any = "0%";
              if (idx < storyIndex) {
                width = "100%";
              } else if (idx === storyIndex) {
                width = progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"]
                });
              }
              return (
                <View key={st.id} style={s.progressBarBackground}>
                  <Animated.View style={[s.progressBarFill, { width }]} />
                </View>
              );
            })}
          </View>

          {/* Story Author Header */}
          <View style={s.header}>
            <View style={s.authorInfo}>
              <FastImage source={currentGroup.avatar} style={s.authorAvatar} contentFit="cover" />
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={s.authorName}>
                    {currentGroup.displayName}
                  </Text>
                  <Text style={s.timeAgo}>· {currentStory.timestamp}</Text>
                  {currentStory.closeFriends ? (
                    <View style={s.cfBadge}>
                      <Text style={{ color: "#FFF", fontSize: 10, fontWeight: "700" }}>Melhores amigos</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={s.authorHandle}>@{currentGroup.username}</Text>
              </View>
            </View>

            <Pressable onPress={onClose} hitSlop={15} style={s.closeButton}>
              <X size={24} color="#FFF" />
            </Pressable>
          </View>

          {/* Touch navigation zones */}
          <View style={s.touchArea}>
            <Pressable
              style={s.touchLeft}
              onPress={handlePrevStory}
              onPressIn={() => setIsPaused(true)}
              onPressOut={() => setIsPaused(false)}
            />
            <Pressable
              style={s.touchRight}
              onPress={handleNextStory}
              onPressIn={() => setIsPaused(true)}
              onPressOut={() => setIsPaused(false)}
            />
          </View>

          {/* empurra legenda e barra de resposta para baixo; topo fica preso em cima */}
          <View style={{ flex: 1 }} pointerEvents="none" />

          {/* Caption text */}
          {currentStory.caption ? (
            <View style={s.captionContainer}>
              <Text style={s.captionText}>{currentStory.caption}</Text>
            </View>
          ) : null}

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

              <View style={s.reactionsRow}>
                {["❤️", "🔥", "😍", "😂", "👏", "✨"].map(emoji => (
                  <Pressable key={emoji} onPress={() => handleSendReaction(emoji)} style={s.emojiBtn}>
                    <Text style={s.emojiText}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

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
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

// Modal to create and publish a new story
export function CreateStoryModal({
  visible,
  onClose,
  onPublish,
  initialImage
}: {
  visible: boolean;
  onClose: () => void;
  onPublish: (
    imageUri: string,
    caption?: string,
    overlay?: StoryOverlay | null,
    extra?: { closeFriends?: boolean; sticker?: StorySticker | null }
  ) => void;
  /** já abre com esta imagem (ex.: colagem de um look do guarda-roupa) */
  initialImage?: string | null;
}) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [ovText, setOvText] = useState("");
  const [ovColor, setOvColor] = useState(OVERLAY_COLORS[0]);
  const [ovBoxed, setOvBoxed] = useState(false);
  const [ovY, setOvY] = useState(0.42);
  const [editingText, setEditingText] = useState(false);
  const [sticker, setSticker] = useState<StorySticker | null>(null);
  const [stickerForm, setStickerForm] = useState<"poll" | "question" | null>(null);
  const [sq, setSq] = useState("");
  const [so1, setSo1] = useState("Sim");
  const [so2, setSo2] = useState("Não");
  const [closeOnly, setCloseOnly] = useState(false);

  useEffect(() => {
    if (visible && initialImage) setImageUri(initialImage);
  }, [visible, initialImage]);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.85
    });
    if (!res.canceled && res.assets[0]?.uri) {
      setImageUri(res.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permissão necessária", "Precisamos de acesso à câmera para tirar uma foto.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.85
    });
    if (!res.canceled && res.assets[0]?.uri) {
      setImageUri(res.assets[0].uri);
    }
  };

  const handlePublish = () => {
    if (!imageUri) return;
    onPublish(imageUri, caption, ovText.trim() ? { text: ovText.trim(), color: ovColor, boxed: ovBoxed, y: ovY } : null, {
      closeFriends: closeOnly,
      sticker
    });
    setImageUri(null);
    setCaption("");
    setOvText("");
    setEditingText(false);
    setSticker(null);
    setCloseOnly(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={s.createContainer}>
        <StatusBar barStyle="light-content" />
        <View style={s.createHeader}>
          <Pressable onPress={onClose} hitSlop={10}>
            <X size={26} color="#FFF" />
          </Pressable>
          <Text style={s.createTitle}>Novo Story</Text>
          <Pressable
            onPress={handlePublish}
            disabled={!imageUri}
            style={[s.publishBtn, { opacity: imageUri ? 1 : 0.4 }]}
          >
            <Text style={s.publishBtnText}>Compartilhar</Text>
          </Pressable>
        </View>

        {imageUri ? (
          <View style={s.previewContainer}>
            <FastImage source={imageUri} style={s.previewImage} contentFit="cover" />
            {!editingText ? <StoryOverlayText overlay={ovText ? { text: ovText, color: ovColor, boxed: ovBoxed, y: ovY } : null} /> : null}
            {sticker && !stickerForm ? (
              <Pressable style={s.stickerWrap} onLongPress={() => setSticker(null)}>
                <StoryStickerView sticker={sticker} preview />
                <Text style={{ color: "#FFF", fontSize: 10, textAlign: "center", marginTop: 4 }}>segure para remover</Text>
              </Pressable>
            ) : null}
            {stickerForm ? (
              <View style={s.textEditor}>
                <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 18, textAlign: "center", marginBottom: 14 }}>
                  {stickerForm === "poll" ? "Enquete" : "Caixinha de pergunta"}
                </Text>
                <TextInput
                  value={sq}
                  onChangeText={setSq}
                  autoFocus
                  maxLength={80}
                  placeholder={stickerForm === "poll" ? "Pergunta (ex.: Uso esse look hoje?)" : "Ex.: Me pergunte sobre estilo"}
                  placeholderTextColor="rgba(255,255,255,.6)"
                  style={s.stickerInput}
                />
                {stickerForm === "poll" ? (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <TextInput value={so1} onChangeText={setSo1} maxLength={24} style={[s.stickerInput, { flex: 1 }]} placeholderTextColor="rgba(255,255,255,.6)" placeholder="Opção 1" />
                    <TextInput value={so2} onChangeText={setSo2} maxLength={24} style={[s.stickerInput, { flex: 1 }]} placeholderTextColor="rgba(255,255,255,.6)" placeholder="Opção 2" />
                  </View>
                ) : null}
                <Pressable
                  onPress={() => {
                    setSticker(
                      stickerForm === "poll"
                        ? { type: "poll", question: sq.trim() || "O que acham?", options: [so1.trim() || "Sim", so2.trim() || "Não"] }
                        : { type: "question", prompt: sq.trim() || "Me pergunte algo" }
                    );
                    setStickerForm(null);
                  }}
                  style={s.doneText}
                >
                  <Text style={{ color: "#000", fontWeight: "700" }}>Adicionar</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={s.textTools}>
              <Pressable onPress={() => setEditingText(v => !v)} style={s.toolBtn}>
                <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 18 }}>Aa</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setSq("");
                  setStickerForm("poll");
                }}
                style={s.toolBtn}
              >
                <BarChart2 size={20} color="#FFF" />
              </Pressable>
              <Pressable
                onPress={() => {
                  setSq("");
                  setStickerForm("question");
                }}
                style={s.toolBtn}
              >
                <HelpCircle size={20} color="#FFF" />
              </Pressable>
              {ovText ? (
                <>
                  <Pressable onPress={() => setOvBoxed(b => !b)} style={[s.toolBtn, ovBoxed && { backgroundColor: "rgba(255,255,255,.35)" }]}>
                    <Square size={18} color="#FFF" />
                  </Pressable>
                  <Pressable onPress={() => setOvY(y => (y <= 0.2 ? 0.42 : y <= 0.5 ? 0.7 : 0.15))} style={s.toolBtn}>
                    <MoveVertical size={18} color="#FFF" />
                  </Pressable>
                </>
              ) : null}
            </View>
            {editingText ? (
              <View style={s.textEditor}>
                <TextInput
                  value={ovText}
                  onChangeText={setOvText}
                  autoFocus
                  multiline
                  maxLength={120}
                  placeholder="Escreva algo... use @ para marcar alguém"
                  placeholderTextColor="rgba(255,255,255,.6)"
                  style={[s.textEditorInput, { color: ovColor }]}
                />
                <View style={s.colorRow}>
                  {OVERLAY_COLORS.map(c => (
                    <Pressable key={c} onPress={() => setOvColor(c)} style={[s.colorDot, { backgroundColor: c, borderWidth: ovColor === c ? 3 : 1.5 }]} />
                  ))}
                </View>
                <Pressable onPress={() => setEditingText(false)} style={s.doneText}>
                  <Text style={{ color: "#000", fontWeight: "700" }}>Pronto</Text>
                </Pressable>
              </View>
            ) : null}
            <Pressable onPress={() => setCloseOnly(v => !v)} style={[s.cfToggle, closeOnly && { backgroundColor: "#22C55E", borderColor: "#22C55E" }]}>
              <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 12 }}>{closeOnly ? "Só melhores amigos" : "Melhores amigos"}</Text>
            </Pressable>
            <View style={s.captionInputBox}>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Adicionar legenda ao story..."
                placeholderTextColor="rgba(255,255,255,0.7)"
                style={s.captionInput}
              />
            </View>
          </View>
        ) : (
          <View style={s.emptyPicker}>
            <Text style={s.pickerPrompt}>Escolha como adicionar seu look aos Stories</Text>
            <View style={s.pickerButtonsRow}>
              <Pressable onPress={takePhoto} style={s.pickerOption}>
                <Camera size={32} color="#FFF" />
                <Text style={s.pickerOptionText}>Câmera</Text>
              </Pressable>
              <Pressable onPress={pickImage} style={s.pickerOption}>
                <ImagePlus size={32} color="#FFF" />
                <Text style={s.pickerOptionText}>Galeria</Text>
              </Pressable>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  stickerWrap: { position: "absolute", left: 0, right: 0, top: "55%", zIndex: 6 },
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
  ownerBar: { flexDirection: "row", justifyContent: "center", gap: 40, paddingBottom: 30, zIndex: 10 },
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
  container: { flex: 1, backgroundColor: "#000" },
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
    flexDirection: "row",
    zIndex: 5
  },
  touchLeft: { width: "35%", height: "100%" },
  touchRight: { width: "65%", height: "100%" },
  captionContainer: {
    marginHorizontal: 18,
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
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
    zIndex: 10
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
  reactionsRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
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
