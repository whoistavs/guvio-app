import React, { useState, useEffect } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Bookmark, Camera, Clock3, Grid3X3, Heart, ImagePlus, Lock, LogOut, MapPin, MessageCircle, MoreHorizontal, Moon, Settings, UserX, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { FeedPost, UserProfile } from "../data/mockData";
import { ScreenHeader } from "./ScreenHeader";
import { useAppTheme } from "../context/AppTheme";
import { loadSavedProfile, saveProfile, INITIAL_USER_PROFILE, loadSavedPosts } from "../services/storage";
import { getSavedAuthSession } from "../services/auth";

function Grid({ posts, colors, onSelectPost }: { posts: FeedPost[]; colors: any; onSelectPost?: (p: FeedPost) => void }) {
  if (posts.length === 0) {
    return (
      <View style={s.emptyGrid}>
        <Grid3X3 size={32} color={colors.muted} />
        <Text style={{ color: colors.text, fontWeight: "800", marginTop: 8 }}>Nenhuma publicação ainda</Text>
        <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 4 }}>
          Seus looks publicados no feed aparecerão aqui no estilo grade do Instagram.
        </Text>
      </View>
    );
  }
  return (
    <View style={s.grid}>
      {posts.map(p => (
        <Pressable key={p.id} onPress={() => onSelectPost?.(p)} style={s.tileWrap}>
          <Image source={{ uri: p.image }} style={s.tile} />
        </Pressable>
      ))}
    </View>
  );
}

export function PublicProfileView({ profile, onBack, onMessage }: { profile: UserProfile; onBack: () => void; onMessage: () => void }) {
  const { colors } = useAppTheme();
  const [follow, setFollow] = useState(false);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 110 }}>
      <ScreenHeader title={`@${profile.username}`} onBack={onBack} />
      <View style={s.top}>
        <Image source={{ uri: profile.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200" }} style={s.bigAvatar} />
        <View style={s.stats}>
          <Stat v="0" l="posts" colors={colors} />
          <Stat v={profile.followers.toLocaleString("pt-BR")} l="seguidores" colors={colors} />
          <Stat v="0" l="seguindo" colors={colors} />
        </View>
      </View>
      <View style={s.bio}>
        <Text style={[s.display, { color: colors.text }]}>{profile.displayName}</Text>
        <Text style={{ color: colors.muted }}>{profile.location}</Text>
      </View>
      <View style={s.actions}>
        <Pressable onPress={() => setFollow(!follow)} style={[s.btn, { backgroundColor: follow ? colors.surface2 : colors.text }]}>
          <Text style={{ color: follow ? colors.text : colors.bg, fontWeight: "800" }}>{follow ? "Seguindo" : "Seguir"}</Text>
        </Pressable>
        <Pressable onPress={onMessage} style={[s.btn, { backgroundColor: colors.surface }]}>
          <MessageCircle size={17} color={colors.icon} />
          <Text style={{ color: colors.text, fontWeight: "800" }}>Mensagem</Text>
        </Pressable>
      </View>
      <View style={[s.tab, { borderTopColor: colors.border }]}>
        <Grid3X3 size={20} color={colors.icon} />
      </View>
      <Grid posts={[]} colors={colors} />
    </ScrollView>
  );
}

function Stat({ v, l, colors }: { v: string; l: string; colors: any }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ color: colors.text, fontWeight: "900", fontSize: 15 }}>{v}</Text>
      <Text style={{ color: colors.muted, fontSize: 10 }}>{l}</Text>
    </View>
  );
}

export function MyProfileView({ onSettings }: { onSettings: () => void }) {
  const { colors } = useAppTheme();
  const [profile, setProfileState] = useState<UserProfile>(INITIAL_USER_PROFILE);
  const [userPosts, setUserPosts] = useState<FeedPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Edit fields
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editAvatar, setEditAvatar] = useState("");

  useEffect(() => {
    getSavedAuthSession().then(session => {
      const uId = session?.user?.email || session?.user?.id;
      setCurrentUserId(uId);
      loadSavedProfile(uId).then(p => {
        setProfileState(p);
        setEditName(p.displayName);
        setEditUsername(p.username);
        setEditLocation(p.location);
        setEditAvatar(p.avatar);
      });
    });

    loadSavedPosts().then(allPosts => {
      setUserPosts(allPosts);
    });
  }, []);

  const pickAvatar = async (useCamera: boolean) => {
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permissão", "Precisamos de acesso à câmera.");
          return;
        }
        const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
        if (!res.canceled && res.assets && res.assets.length > 0) {
          setEditAvatar(res.assets[0].uri);
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permissão", "Precisamos de acesso à galeria.");
          return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
        if (!res.canceled && res.assets && res.assets.length > 0) {
          setEditAvatar(res.assets[0].uri);
        }
      }
    } catch (e) {
      Alert.alert("Erro", "Falha ao carregar imagem.");
    }
  };

  const handleSaveProfile = () => {
    const updated: UserProfile = {
      ...profile,
      displayName: editName.trim() || profile.displayName,
      username: editUsername.trim() || profile.username,
      location: editLocation.trim() || profile.location,
      avatar: editAvatar || profile.avatar
    };
    setProfileState(updated);
    saveProfile(updated, currentUserId);
    setEditModalVisible(false);
  };

  return (
    <>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 110 }}>
        <ScreenHeader title={`@${profile.username}`} right={<Pressable onPress={onSettings}><MoreHorizontal size={25} color={colors.icon} /></Pressable>} />
        <View style={s.top}>
          <Image source={{ uri: profile.avatar }} style={s.bigAvatar} />
          <View style={s.stats}>
            <Stat v={userPosts.length.toString()} l="posts" colors={colors} />
            <Stat v={profile.followers.toString()} l="seguidores" colors={colors} />
            <Stat v="0" l="seguindo" colors={colors} />
          </View>
        </View>
        <View style={s.bio}>
          <Text style={[s.display, { color: colors.text }]}>{profile.displayName}</Text>
          <Text style={{ color: colors.muted }}>{profile.location} · Explorando moda pelo mundo 🌎</Text>
        </View>
        <Pressable onPress={() => setEditModalVisible(true)} style={[s.edit, { backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.text, fontWeight: "800" }}>Editar perfil</Text>
        </Pressable>
        <View style={[s.tab, { borderTopColor: colors.border }]}>
          <Grid3X3 size={20} color={colors.icon} />
        </View>
        <Grid posts={userPosts} colors={colors} onSelectPost={setSelectedPost} />
      </ScrollView>

      {/* Instagram-style Post Viewer Modal */}
      <Modal visible={!!selectedPost} transparent animationType="slide" onRequestClose={() => setSelectedPost(null)}>
        <View style={s.modalBack}>
          <View style={[s.postModal, { backgroundColor: colors.bg }]}>
            <View style={s.postHeader}>
              <Image source={{ uri: profile.avatar }} style={s.postAvatar} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "900", fontSize: 13 }}>@{profile.username}</Text>
                {selectedPost?.city ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <MapPin size={11} color={colors.muted} />
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{selectedPost.city}, {selectedPost.country}</Text>
                  </View>
                ) : null}
              </View>
              <Pressable onPress={() => setSelectedPost(null)}>
                <X size={24} color={colors.icon} />
              </Pressable>
            </View>

            {selectedPost ? <Image source={{ uri: selectedPost.image }} style={s.postImg} /> : null}

            <View style={s.postBody}>
              <View style={{ flexDirection: "row", gap: 14, alignItems: "center", marginBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Heart size={20} color={colors.icon} />
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>{selectedPost?.likes || 0}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <MessageCircle size={20} color={colors.icon} />
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>{selectedPost?.commentsCount || 0}</Text>
                </View>
              </View>
              {selectedPost?.caption ? (
                <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18 }}>
                  <Text style={{ fontWeight: "900" }}>@{profile.username} </Text>
                  {selectedPost.caption}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <View style={s.modalBack}>
          <View style={[s.modal, { backgroundColor: colors.bg }]}>
            <View style={{ width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={[s.modalH, { color: colors.text }]}>Editar perfil</Text>
              <Pressable onPress={() => setEditModalVisible(false)}>
                <X size={22} color={colors.icon} />
              </Pressable>
            </View>

            <Image source={{ uri: editAvatar }} style={s.avatarEditImg} />

            <View style={s.pickers}>
              <Pressable onPress={() => pickAvatar(true)} style={[s.pickerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Camera size={16} color={colors.icon} />
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 11 }}>Tirar foto</Text>
              </Pressable>
              <Pressable onPress={() => pickAvatar(false)} style={[s.pickerBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <ImagePlus size={16} color={colors.icon} />
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 11 }}>Galeria</Text>
              </Pressable>
            </View>

            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Nome de exibição"
              placeholderTextColor={colors.muted}
              style={[s.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            />
            <TextInput
              value={editUsername}
              onChangeText={setEditUsername}
              placeholder="Nome de usuário (@)"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              style={[s.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            />
            <TextInput
              value={editLocation}
              onChangeText={setEditLocation}
              placeholder="Localização (ex: Campinas, Brasil)"
              placeholderTextColor={colors.muted}
              style={[s.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            />

            <Pressable onPress={handleSaveProfile} style={[s.saveBtn, { backgroundColor: colors.text }]}>
              <Text style={{ color: colors.bg, fontWeight: "900" }}>Salvar alterações</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function SettingsView({ onBack, onOpen, onSignOut }: { onBack: () => void; onOpen: (x: string) => void; onSignOut?: () => void }) {
  const { colors, dark, toggle } = useAppTheme();
  const rows = [
    { id: "saved", l: "Salvos", i: Bookmark },
    { id: "activity", l: "Sua atividade", i: Clock3 },
    { id: "blocked", l: "Bloqueados", i: UserX }
  ];

  const handleConfirmSignOut = () => {
    Alert.alert("Sair da conta", "Deseja encerrar a sessão da sua conta no Guvio?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Sair", style: "destructive", onPress: onSignOut }
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Configurações" onBack={onBack} />
      {rows.map(r => {
        const I = r.i;
        return (
          <Pressable key={r.id} onPress={() => onOpen(r.id)} style={[s.setting, { borderBottomColor: colors.border }]}>
            <I size={21} color={colors.icon} />
            <Text style={[s.settingText, { color: colors.text }]}>{r.l}</Text>
          </Pressable>
        );
      })}
      <View style={[s.setting, { borderBottomColor: colors.border }]}>
        <Moon size={21} color={colors.icon} />
        <Text style={[s.settingText, { color: colors.text }]}>Modo noturno</Text>
        <Switch value={dark} onValueChange={toggle} />
      </View>
      {onSignOut ? (
        <Pressable onPress={handleConfirmSignOut} style={[s.setting, { borderBottomColor: colors.border, marginTop: 12 }]}>
          <LogOut size={21} color="#FF3B30" />
          <Text style={[s.settingText, { color: "#FF3B30", fontWeight: "800" }]}>Sair da conta</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SimpleSettingsPage({ kind, onBack }: { kind: string; onBack: () => void }) {
  const { colors } = useAppTheme();
  const [savedPosts, setSavedPosts] = useState<FeedPost[]>([]);

  useEffect(() => {
    if (kind === "saved") {
      loadSavedPosts().then(posts => {
        setSavedPosts(posts.filter(p => p.isSaved));
      });
    }
  }, [kind]);

  const title = kind === "saved" ? "Salvos" : kind === "activity" ? "Sua atividade" : "Bloqueados";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title={title} onBack={onBack} />
      {kind === "saved" ? (
        <Grid posts={savedPosts} colors={colors} />
      ) : kind === "activity" ? (
        <View style={s.info}>
          <Clock3 size={38} color={colors.icon} />
          <Text style={[s.infoBig, { color: colors.text }]}>0 min</Text>
          <Text style={{ color: colors.muted, textAlign: "center" }}>Sua atividade no Guvio iniciou agora</Text>
        </View>
      ) : (
        <View style={s.info}>
          <UserX size={38} color={colors.icon} />
          <Text style={[s.infoBig, { color: colors.text }]}>Nenhum usuário bloqueado</Text>
          <Text style={{ color: colors.muted, textAlign: "center" }}>Perfis bloqueados aparecerão aqui.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: 22, paddingTop: 12 },
  bigAvatar: { width: 88, height: 88, borderRadius: 44 },
  stats: { flex: 1, flexDirection: "row", justifyContent: "space-around" },
  bio: { paddingHorizontal: 22, paddingTop: 14, gap: 3 },
  display: { fontSize: 14, fontWeight: "900" },
  actions: { flexDirection: "row", gap: 8, paddingHorizontal: 22, marginTop: 14 },
  btn: { flex: 1, minHeight: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  edit: { marginHorizontal: 22, marginTop: 14, minHeight: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tab: { height: 52, marginTop: 18, borderTopWidth: 1, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  tileWrap: { width: "33.333%", aspectRatio: 1, borderWidth: 0.5, borderColor: "rgba(255,255,255,.2)" },
  tile: { width: "100%", height: "100%", backgroundColor: "#222" },
  emptyGrid: { alignItems: "center", justifyContent: "center", padding: 40, width: "100%" },
  setting: { minHeight: 58, flexDirection: "row", alignItems: "center", paddingHorizontal: 20, gap: 14, borderBottomWidth: 1 },
  settingText: { fontSize: 14, fontWeight: "700", flex: 1 },
  info: { alignItems: "center", padding: 40, gap: 12 },
  infoBig: { fontSize: 22, fontWeight: "900" },
  modalBack: { flex: 1, backgroundColor: "rgba(0,0,0,.65)", alignItems: "center", justifyContent: "center", padding: 18 },
  modal: { width: "100%", maxWidth: 380, borderRadius: 24, padding: 20, alignItems: "center", gap: 10 },
  postModal: { width: "100%", maxWidth: 420, borderRadius: 24, overflow: "hidden" },
  postHeader: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  postAvatar: { width: 36, height: 36, borderRadius: 18 },
  postImg: { width: "100%", aspectRatio: 1, backgroundColor: "#111" },
  postBody: { padding: 16 },
  modalH: { fontSize: 20, fontWeight: "900" },
  avatarEditImg: { width: 90, height: 90, borderRadius: 45, marginVertical: 6 },
  pickers: { flexDirection: "row", gap: 10, marginBottom: 8, width: "100%" },
  pickerBtn: { flex: 1, height: 40, borderWidth: 1, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  input: { width: "100%", height: 44, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, fontSize: 13, marginBottom: 4 },
  saveBtn: { width: "100%", height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", marginTop: 8 }
});
