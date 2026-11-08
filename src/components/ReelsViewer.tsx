import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View
} from "react-native";
import { topPad } from "../utils/insets";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  Bookmark,
  ChevronLeft,
  Flag,
  Gauge,
  Heart,
  Layers,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Play,
  Repeat2,
  Send,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
  X
} from "lucide-react-native";
import { FeedPost } from "../data/mockData";
import { FastImage } from "./FastImage";
import { CommentsModal } from "./CommentsModal";
import { SharePostModal } from "./SharePostModal";
import { RepostModal } from "./RepostModal";
import { askReport } from "./PostMenus";
import { toast } from "./motion";
import { likeFeedback, tapFeedback } from "../utils/haptics";
import { markNotInterested } from "../services/storage";

const SPEEDS = [0.5, 1, 1.5, 2];
const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r < 10 ? "0" : ""}${r}`;
};
const count = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".", ",")} mil` : String(n));

export type ReelsActions = {
  isMine: (p: FeedPost) => boolean;
  isFollowing: (p: FeedPost) => boolean;
  onToggle: (id: string, key: "isLiked" | "isSaved") => void;
  onToggleFollow: (p: FeedPost) => void;
  onOpenProfile: (username: string) => void;
  onPostChange: (p: FeedPost) => void;
  onRemoved?: (id: string) => void;
  onNotInterested?: (p: FeedPost, ni: any) => void;
  onAssemble?: (p: FeedPost) => void;
  onReposted?: (p: FeedPost) => void;
};

type ViewerProps = {
  posts: FeedPost[];
  startId: string | null;
  onClose: () => void;
  actions: ReelsActions;
};

/** Vídeos em tela cheia, um por tela, arrastando para cima/baixo */
export function ReelsViewer(props: ViewerProps) {
  if (!props.startId) return null;
  // "key": cada abertura começa do zero, já no vídeo tocado
  return <Viewer key={props.startId} {...props} startId={props.startId} />;
}

function Viewer({ posts: livePosts, startId, onClose, actions }: ViewerProps & { startId: string }) {
  // a ordem fica congelada enquanto a tela está aberta (curtir ou "não tenho interesse" não embaralha a lista)
  const [order] = useState(() => livePosts.map(p => p.id));
  const posts = useMemo(() => {
    const byId = new Map(livePosts.map(p => [p.id, p]));
    return order.map(id => byId.get(id)).filter(Boolean) as FeedPost[];
  }, [livePosts, order]);
  const [size, setSize] = useState(() => Dimensions.get("window"));
  const [active, setActive] = useState(() => Math.max(0, livePosts.findIndex(p => p.id === startId)));
  // no site o navegador só deixa tocar sozinho sem som
  const [muted, setMuted] = useState(Platform.OS === "web");
  const [speed, setSpeed] = useState(1);
  const [comments, setComments] = useState<FeedPost | null>(null);
  const [share, setShare] = useState<FeedPost | null>(null);
  const [repost, setRepost] = useState<FeedPost | null>(null);
  const [menu, setMenu] = useState<FeedPost | null>(null);
  const listRef = useRef<FlatList<FeedPost>>(null);

  const [startIndex] = useState(active);

  useEffect(() => {
    const sub = Dimensions.addEventListener("change", ({ window }) => setSize(window));
    return () => sub.remove();
  }, []);

  const H = size.height;

  const close = () => {
    setMenu(null);
    onClose();
  };

  const openProfile = (u: string) => {
    close();
    setTimeout(() => actions.onOpenProfile(u), 50);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={close} statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={s.root} onLayout={e => setSize({ ...size, height: e.nativeEvent.layout.height, width: e.nativeEvent.layout.width })}>
        <FlatList
          ref={listRef}
          data={posts}
          keyExtractor={p => p.id}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: H, offset: H * i, index: i })}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          decelerationRate="fast"
          snapToInterval={H}
          onMomentumScrollEnd={e => setActive(Math.round(e.nativeEvent.contentOffset.y / H))}
          onScroll={
            Platform.OS === "web"
              ? e => {
                  const i = Math.round(e.nativeEvent.contentOffset.y / H);
                  if (i !== active) setActive(i);
                }
              : undefined
          }
          scrollEventThrottle={64}
          renderItem={({ item, index }) => (
            <Reel
              post={item}
              height={H}
              active={index === active}
              suspended={!!comments || !!share || !!repost}
              muted={muted}
              speed={speed}
              onToggleMute={() => setMuted(m => !m)}
              actions={actions}
              onComments={() => setComments(item)}
              onShare={() => setShare(item)}
              onRepost={() => setRepost(item)}
              onMenu={() => setMenu(item)}
              onOpenProfile={openProfile}
            />
          )}
        />

        <View style={s.top} pointerEvents="box-none">
          <Pressable onPress={close} hitSlop={12} style={s.topBtn}>
            <ChevronLeft size={28} color="#FFF" />
          </Pressable>
          <Text style={s.topTitle}>Looks em vídeo</Text>
          <View style={{ width: 40 }} />
        </View>

        {menu ? (
          <ReelMenu
            post={menu}
            speed={speed}
            onSpeed={setSpeed}
            onClose={() => setMenu(null)}
            onOpenProfile={openProfile}
            actions={actions}
          />
        ) : null}

        <CommentsModal
          post={comments}
          visible={!!comments}
          isOwner={!!comments && actions.isMine(comments)}
          onPostChange={actions.onPostChange}
          onClose={() => setComments(null)}
          onCommented={(id, total) => {
            const p = posts.find(x => x.id === id);
            if (p) actions.onPostChange({ ...p, commentsCount: total });
          }}
          onOpenProfile={u => {
            setComments(null);
            openProfile(u);
          }}
        />
        <SharePostModal post={share} visible={!!share} onClose={() => setShare(null)} />
        <RepostModal
          post={repost}
          onClose={() => setRepost(null)}
          onDone={np => {
            setRepost(null);
            actions.onReposted?.(np);
          }}
        />
      </View>
    </Modal>
  );
}

function Reel({
  post,
  height,
  active,
  suspended,
  muted,
  speed,
  onToggleMute,
  actions,
  onComments,
  onShare,
  onRepost,
  onMenu,
  onOpenProfile
}: {
  post: FeedPost;
  height: number;
  active: boolean;
  suspended: boolean;
  muted: boolean;
  speed: number;
  onToggleMute: () => void;
  actions: ReelsActions;
  onComments: () => void;
  onShare: () => void;
  onRepost: () => void;
  onMenu: () => void;
  onOpenProfile: (u: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const who = post.creatorUsername || post.creatorName;
  const mine = actions.isMine(post);
  const following = actions.isFollowing(post);
  const heart = useRef(new Animated.Value(0)).current;
  const [heartOn, setHeartOn] = useState(false);

  const likeByDoubleTap = () => {
    likeFeedback();
    if (!post.isLiked) actions.onToggle(post.id, "isLiked");
    setHeartOn(true);
    heart.setValue(0);
    Animated.sequence([
      Animated.spring(heart, { toValue: 1, friction: 4, tension: 140, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(heart, { toValue: 0, duration: 260, delay: 380, useNativeDriver: Platform.OS !== "web" })
    ]).start(() => setHeartOn(false));
  };

  return (
    <View style={[s.reel, { height }]}>
      {active && post.videoUrl ? (
        <ActivePlayer uri={post.videoUrl} poster={post.image} suspended={suspended} muted={muted} speed={speed} onToggleMute={onToggleMute} onDoubleTap={likeByDoubleTap} />
      ) : (
        <FastImage source={post.image} style={StyleSheet.absoluteFill as any} contentFit="contain" />
      )}

      {heartOn ? (
        <View style={s.center} pointerEvents="none">
          <Animated.View style={{ opacity: heart, transform: [{ scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }}>
            <Heart size={110} color="#FFF" fill="#FFF" />
          </Animated.View>
        </View>
      ) : null}

      <View style={s.fade} pointerEvents="none" />

      {/* ações na lateral */}
      <View style={s.side}>
        <SideBtn
          onPress={() => actions.onToggle(post.id, "isLiked")}
          label={count(post.likes || 0)}
          icon={<Heart size={30} color={post.isLiked ? "#FF3B4A" : "#FFF"} fill={post.isLiked ? "#FF3B4A" : "none"} strokeWidth={1.8} />}
        />
        <SideBtn onPress={onComments} label={count(post.commentsCount || 0)} icon={<MessageCircle size={29} color="#FFF" strokeWidth={1.8} />} />
        {!mine ? <SideBtn onPress={onRepost} label="Repostar" icon={<Repeat2 size={29} color="#FFF" strokeWidth={1.8} />} /> : null}
        <SideBtn onPress={onShare} label="Enviar" icon={<Send size={27} color="#FFF" strokeWidth={1.8} />} />
        <SideBtn
          onPress={() => {
            tapFeedback();
            actions.onToggle(post.id, "isSaved");
          }}
          label={post.isSaved ? "Salvo" : "Salvar"}
          icon={<Bookmark size={28} color="#FFF" fill={post.isSaved ? "#FFF" : "none"} strokeWidth={1.8} />}
        />
        <SideBtn onPress={onMenu} icon={<MoreHorizontal size={28} color="#FFF" />} />
      </View>

      {/* autor, legenda e áudio */}
      <View style={s.info}>
        <View style={s.authorRow}>
          <Pressable onPress={() => onOpenProfile(who)} style={s.author} hitSlop={6}>
            <FastImage source={post.creatorAvatar} style={s.avatar} contentFit="cover" />
            <Text style={s.authorName} numberOfLines={1}>
              {who}
            </Text>
          </Pressable>
          {!mine && !following ? (
            <Pressable
              onPress={() => {
                tapFeedback();
                actions.onToggleFollow(post);
              }}
              style={s.follow}
              hitSlop={6}
            >
              <Text style={s.followText}>Seguir</Text>
            </Pressable>
          ) : null}
        </View>
        {post.caption ? (
          <Pressable onPress={() => setExpanded(v => !v)}>
            <Text style={s.caption} numberOfLines={expanded ? 8 : 1}>
              {post.caption}
            </Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => onOpenProfile(who)} style={s.audio} hitSlop={6}>
          <Music2 size={13} color="#FFF" />
          <Text style={s.audioText} numberOfLines={1}>
            {who} · Áudio original
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function SideBtn({ icon, label, onPress }: { icon: React.ReactNode; label?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.sideBtn} hitSlop={8}>
      {icon}
      {label ? <Text style={s.sideLabel}>{label}</Text> : null}
    </Pressable>
  );
}

function ActivePlayer({
  uri,
  poster,
  suspended,
  muted,
  speed,
  onToggleMute,
  onDoubleTap
}: {
  uri: string;
  poster: string;
  suspended: boolean;
  muted: boolean;
  speed: number;
  onToggleMute: () => void;
  onDoubleTap: () => void;
}) {
  const player = useVideoPlayer(uri, p => {
    p.loop = true;
    p.muted = muted;
    p.play();
  });
  const [paused, setPaused] = useState(false);
  const userPaused = useRef(false);
  const [time, setTime] = useState({ cur: 0, dur: 0 });
  const [scrub, setScrub] = useState<number | null>(null);
  const [barW, setBarW] = useState(1);
  const lastTap = useRef(0);
  const single = useRef<ReturnType<typeof setTimeout> | null>(null);

  const suspendedRef = useRef(suspended);
  useEffect(() => {
    // comentários/enviar por cima: pausa e depois continua de onde parou
    suspendedRef.current = suspended;
    try {
      if (suspended) player.pause();
      else if (!userPaused.current) player.play();
    } catch {}
  }, [suspended]);
  useEffect(() => {
    player.muted = muted;
  }, [muted]);
  useEffect(() => {
    try {
      player.playbackRate = speed;
    } catch {}
  }, [speed]);

  useEffect(() => {
    const t = setInterval(() => {
      try {
        setTime({ cur: player.currentTime || 0, dur: player.duration || 0 });
        if (!userPaused.current && !suspendedRef.current) {
          // o navegador pode ter barrado o play: tenta de novo
          if (!player.playing) player.play();
        }
      } catch {}
    }, 250);
    return () => {
      clearInterval(t);
      if (single.current) clearTimeout(single.current);
    };
  }, [player]);

  const togglePause = () => {
    if (!userPaused.current) {
      userPaused.current = true;
      player.pause();
      setPaused(true);
    } else {
      userPaused.current = false;
      player.play();
      setPaused(false);
    }
  };

  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      lastTap.current = 0;
      if (single.current) clearTimeout(single.current);
      single.current = null;
      onDoubleTap();
      return;
    }
    lastTap.current = now;
    single.current = setTimeout(() => {
      single.current = null;
      togglePause();
    }, 280);
  };

  // arrastar na linha do tempo (a barra ocupa a largura toda da tela)
  const ratioAt = (x: number) => Math.min(1, Math.max(0, x / barW));
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: e => setScrub(ratioAt(e.nativeEvent.pageX)),
        onPanResponderMove: e => setScrub(ratioAt(e.nativeEvent.pageX)),
        onPanResponderRelease: e => {
          const r = ratioAt(e.nativeEvent.pageX);
          try {
            player.currentTime = r * (player.duration || 0);
          } catch {}
          setScrub(null);
        },
        onPanResponderTerminate: () => setScrub(null)
      }),
    [barW, player]
  );

  const progress = scrub ?? (time.dur ? time.cur / time.dur : 0);

  return (
    <>
      <FastImage source={poster} style={StyleSheet.absoluteFill as any} contentFit="contain" />
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls={false} />
      <Pressable onPress={onTap} style={StyleSheet.absoluteFill}>
        {paused ? (
          <View style={s.center} pointerEvents="box-none">
            <Pressable onPress={onToggleMute} style={s.pausedMute} hitSlop={10}>
              {muted ? <VolumeX size={20} color="#FFF" /> : <Volume2 size={20} color="#FFF" />}
            </Pressable>
            <View style={s.bigPlay} pointerEvents="none">
              <Play size={34} color="#FFF" fill="#FFF" />
            </View>
          </View>
        ) : null}
      </Pressable>
      {muted && !paused ? (
        <Pressable onPress={onToggleMute} style={s.mutedPill} hitSlop={8}>
          <VolumeX size={14} color="#FFF" />
        </Pressable>
      ) : null}

      {scrub !== null ? (
        <View style={s.scrubTime} pointerEvents="none">
          <Text style={s.scrubText}>
            {fmt(scrub * time.dur)} <Text style={{ color: "rgba(255,255,255,.6)" }}>/ {fmt(time.dur)}</Text>
          </Text>
        </View>
      ) : null}
      <View style={s.barHit} onLayout={e => setBarW(e.nativeEvent.layout.width || 1)} {...pan.panHandlers}>
        <View style={[s.barTrack, scrub !== null && s.barTrackBig]}>
          <View style={[s.barFill, { width: `${progress * 100}%` }]} />
        </View>
        {scrub !== null ? <View style={[s.knob, { left: `${progress * 100}%` }]} /> : null}
      </View>
    </>
  );
}

function ReelMenu({
  post,
  speed,
  onSpeed,
  onClose,
  onOpenProfile,
  actions
}: {
  post: FeedPost;
  speed: number;
  onSpeed: (n: number) => void;
  onClose: () => void;
  onOpenProfile: (u: string) => void;
  actions: ReelsActions;
}) {
  const who = post.creatorUsername || post.creatorName;
  const mine = actions.isMine(post);
  const Row = ({ icon, text, sub, onPress, danger }: { icon: React.ReactNode; text: string; sub?: string; onPress: () => void; danger?: boolean }) => (
    <Pressable onPress={onPress} style={({ pressed }) => [s.menuRow, pressed && { backgroundColor: "rgba(255,255,255,.06)" }]}>
      {icon}
      <View style={{ flex: 1 }}>
        <Text style={[s.menuText, danger && { color: "#FF5A5F" }]}>{text}</Text>
        {sub ? <Text style={s.menuSub}>{sub}</Text> : null}
      </View>
    </Pressable>
  );
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={s.menuBack} onPress={onClose} />
      <View style={s.menu}>
        <View style={s.grabber} />
        <View style={s.menuHead}>
          <Text style={s.menuTitle}>Opções</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <X size={20} color="#FFF" />
          </Pressable>
        </View>
        <Row
          icon={<Music2 size={20} color="#FFF" />}
          text={`Áudio original · ${who}`}
          sub="Ver o perfil de quem publicou"
          onPress={() => onOpenProfile(who)}
        />
        {actions.onAssemble ? (
          <Row
            icon={<Layers size={20} color="#FFF" />}
            text="Montar parecido com minhas peças"
            sub="Usa este look como referência no guarda-roupa"
            onPress={() => {
              onClose();
              actions.onAssemble?.(post);
            }}
          />
        ) : null}
        <View style={s.menuRow}>
          <Gauge size={20} color="#FFF" />
          <Text style={[s.menuText, { flex: 1 }]}>Velocidade</Text>
          <View style={s.speeds}>
            {SPEEDS.map(v => (
              <Pressable key={v} onPress={() => onSpeed(v)} style={[s.speed, speed === v && s.speedOn]}>
                <Text style={[s.speedText, speed === v && { color: "#000" }]}>{String(v).replace(".", ",")}x</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {!mine ? (
          <>
            <Row
              icon={<ThumbsUp size={20} color="#FFF" />}
              text="Tenho interesse"
              sub="Mostrar mais looks como este"
              onPress={() => {
                onClose();
                toast("Vamos mostrar mais looks como este");
              }}
            />
            <Row
              icon={<ThumbsDown size={20} color="#FFF" />}
              text="Não tenho interesse"
              sub="Mostrar menos looks como este"
              onPress={async () => {
                onClose();
                try {
                  const ni = await markNotInterested(post);
                  actions.onNotInterested?.(post, ni);
                  toast("Ok, vamos mostrar menos looks assim");
                } catch {}
              }}
            />
            <Row
              icon={<Flag size={20} color="#FF5A5F" />}
              text="Denunciar"
              danger
              onPress={async () => {
                onClose();
                if (await askReport(post)) actions.onRemoved?.(post.id);
              }}
            />
          </>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  reel: { width: "100%", backgroundColor: "#000", overflow: "hidden" },
  center: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 260, backgroundColor: "rgba(0,0,0,.28)" },
  top: { position: "absolute", top: topPad(16), left: 8, right: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topTitle: { color: "#FFF", fontSize: 17, fontWeight: "700" },
  bigPlay: { width: 74, height: 74, borderRadius: 37, backgroundColor: "rgba(0,0,0,.45)", alignItems: "center", justifyContent: "center", paddingLeft: 4 },
  pausedMute: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,.45)", alignItems: "center", justifyContent: "center", marginBottom: 18 },
  mutedPill: { position: "absolute", top: topPad(16) + 54, right: 16, width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(0,0,0,.5)", alignItems: "center", justifyContent: "center" },
  side: { position: "absolute", right: 10, bottom: 120, alignItems: "center", gap: 18 },
  sideBtn: { alignItems: "center", gap: 4, minWidth: 48 },
  sideLabel: { color: "#FFF", fontSize: 12, fontWeight: "600", textShadowColor: "rgba(0,0,0,.5)", textShadowRadius: 4 },
  info: { position: "absolute", left: 14, right: 84, bottom: 44, gap: 8 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  author: { flexDirection: "row", alignItems: "center", gap: 9, flexShrink: 1 },
  avatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: "rgba(255,255,255,.6)", backgroundColor: "#333" },
  authorName: { color: "#FFF", fontWeight: "700", fontSize: 14, flexShrink: 1 },
  follow: { borderWidth: 1, borderColor: "rgba(255,255,255,.8)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  followText: { color: "#FFF", fontWeight: "600", fontSize: 13 },
  caption: { color: "#FFF", fontSize: 14, lineHeight: 19 },
  audio: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,.14)", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, maxWidth: "100%" },
  audioText: { color: "#FFF", fontSize: 12, fontWeight: "500", flexShrink: 1 },
  barHit: { position: "absolute", left: 0, right: 0, bottom: 14, height: 26, justifyContent: "center" },
  barTrack: { height: 2, backgroundColor: "rgba(255,255,255,.3)" },
  barTrackBig: { height: 5, borderRadius: 3 },
  barFill: { height: "100%", backgroundColor: "#FFF" },
  knob: { position: "absolute", width: 14, height: 14, borderRadius: 7, backgroundColor: "#FFF", marginLeft: -7, top: 6 },
  scrubTime: { position: "absolute", left: 0, right: 0, bottom: 64, alignItems: "center" },
  scrubText: { color: "#FFF", fontSize: 22, fontWeight: "700", textShadowColor: "rgba(0,0,0,.6)", textShadowRadius: 6 },
  menuBack: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,.45)" },
  menu: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#1A1B1F", borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 34, paddingTop: 8 },
  grabber: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,.25)", marginBottom: 6 },
  menuHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 8 },
  menuTitle: { color: "#FFF", fontWeight: "700", fontSize: 16 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 13 },
  menuText: { color: "#FFF", fontSize: 15, fontWeight: "500" },
  menuSub: { color: "rgba(255,255,255,.55)", fontSize: 12, marginTop: 2 },
  speeds: { flexDirection: "row", gap: 4 },
  speed: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: "rgba(255,255,255,.1)" },
  speedOn: { backgroundColor: "#FFF" },
  speedText: { color: "#FFF", fontSize: 12, fontWeight: "600" }
});
