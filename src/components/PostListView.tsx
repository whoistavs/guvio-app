import React, { useEffect, useRef, useState } from "react";
import { FlatList, View } from "react-native";
import { FeedPost } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { ScreenHeader } from "./ScreenHeader";
import { PostCard } from "./PostDetailView";
import { loadSavedProfile } from "../services/storage";

/**
 * Lista de looks (igual ao Instagram ao tocar numa foto da grade do perfil):
 * abre no look tocado e dá para rolar para os outros do mesmo perfil.
 */
export function PostListView({
  posts: initial,
  startId,
  title = "Publicações",
  onBack,
  onOpenProfile,
  onOpenTag,
  onDeleted
}: {
  posts: FeedPost[];
  startId: string;
  title?: string;
  onBack: () => void;
  onOpenProfile?: (username: string) => void;
  onOpenTag?: (tag: string) => void;
  onDeleted?: (postId: string) => void;
}) {
  const { colors } = useAppTheme();
  const [posts, setPosts] = useState(initial);
  const [myId, setMyId] = useState<string | null>(null);
  const startIndex = Math.max(0, initial.findIndex(p => p.id === startId));
  // posição de cada look na lista, para abrir já no look tocado
  const offsets = useRef<Record<number, number>>({});
  const [ready, setReady] = useState(startIndex === 0);
  const list = useRef<FlatList<FeedPost>>(null);

  useEffect(() => {
    loadSavedProfile()
      .then(p => setMyId(p.id))
      .catch(() => {});
  }, []);

  // se a medida demorar, mostra assim mesmo
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(t);
  }, [ready]);

  // rola até o look tocado somando a altura dos looks de cima. As fotos podem mudar
  // a altura logo depois de aparecer, então refaz a conta até tudo parar (a lista fica
  // invisível nesse meio tempo, então não dá para ver o pulo)
  const opened = useRef(Date.now());
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tryJump = () => {
    if (ready || startIndex === 0) return;
    let y = 0;
    for (let i = 0; i < startIndex; i++) {
      const h = offsets.current[i];
      if (h === undefined) return;
      y += h;
    }
    list.current?.scrollToOffset({ offset: y, animated: false });
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => setReady(true), Date.now() - opened.current > 800 ? 0 : 300);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={title} onBack={onBack} />
      <FlatList
        ref={list}
        style={{ opacity: ready ? 1 : 0 }}
        data={posts}
        keyExtractor={p => p.id}
        initialNumToRender={startIndex + 2}
        maxToRenderPerBatch={4}
        windowSize={9}
        contentContainerStyle={{ paddingBottom: 60 }}
        onScrollToIndexFailed={info => {
          // ainda não mediu tudo: chega perto e tenta de novo
          list.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
          setTimeout(() => {
            try {
              list.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0 });
            } catch {}
          }, 120);
        }}
        renderItem={({ item, index }) => (
          <View
            onLayout={e => {
              offsets.current[index] = e.nativeEvent.layout.height;
              if (index <= startIndex) tryJump();
            }}
            style={{ paddingBottom: 14 }}
          >
            <PostCard
              post={item}
              myId={myId}
              onChange={u => setPosts(prev => prev.map(p => (p.id === u.id ? u : p)))}
              onOpenProfile={onOpenProfile}
              onOpenTag={onOpenTag}
              onDeleted={id => {
                setPosts(prev => prev.filter(p => p.id !== id));
                onDeleted?.(id);
              }}
              onGone={() => setPosts(prev => prev.filter(p => p.id !== item.id))}
            />
          </View>
        )}
      />
    </View>
  );
}
