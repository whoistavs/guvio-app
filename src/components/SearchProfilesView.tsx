import React, { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BadgeCheck, Search, Users, X } from "lucide-react-native";
import { MOCK_PROFILES, UserProfile } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";

const n = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function SearchProfilesView({ onOpenProfile }: { onOpenProfile: (p: UserProfile) => void }) {
  const { colors } = useAppTheme();
  const [q, setQ] = useState("");
  const [following, setFollowing] = useState<string[]>([]);
  const list = useMemo(
    () => (q ? MOCK_PROFILES.filter(p => n(`${p.displayName} ${p.username} ${p.location}`).includes(n(q))) : MOCK_PROFILES),
    [q]
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={s.content}>
      <Text style={[s.h, { color: colors.text }]}>Pesquisar</Text>
      <View style={[s.search, { backgroundColor: colors.surface }]}>
        <Search size={18} color={colors.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Pesquisar por nome, @username ou cidade"
          placeholderTextColor={colors.muted}
          style={[s.input, { color: colors.text }]}
        />
        {q ? (
          <Pressable onPress={() => setQ("")}>
            <X size={16} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <Text style={[s.label, { color: colors.muted }]}>{q ? "RESULTADOS" : "COMUNIDADE GUVIO"}</Text>

      {list.length === 0 ? (
        <View style={s.empty}>
          <Users size={38} color={colors.muted} />
          <Text style={{ color: colors.text, fontWeight: "800", marginTop: 8 }}>Nenhum perfil encontrado</Text>
          <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center", marginTop: 4 }}>
            Novos membros da comunidade aparecerão aqui à medida que se cadastrarem.
          </Text>
        </View>
      ) : (
        list.map(p => (
          <Pressable key={p.id} onPress={() => onOpenProfile(p)} style={s.row}>
            <Image source={{ uri: p.avatar }} style={s.avatar} />
            <View style={{ flex: 1 }}>
              <View style={s.name}>
                <Text style={[s.user, { color: colors.text }]}>@{p.username}</Text>
                {p.verified ? <BadgeCheck size={15} color={colors.icon} /> : null}
              </View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {p.displayName} · {p.location}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>
                {p.followers.toLocaleString("pt-BR")} seguidores
              </Text>
            </View>
            <Pressable
              onPress={e => {
                e.stopPropagation?.();
                setFollowing(v => (v.includes(p.id) ? v.filter(x => x !== p.id) : [...v, p.id]));
              }}
              style={[s.follow, { backgroundColor: following.includes(p.id) ? colors.surface2 : colors.text }]}
            >
              <Text style={{ color: following.includes(p.id) ? colors.text : colors.bg, fontWeight: "800", fontSize: 11 }}>
                {following.includes(p.id) ? "Seguindo" : "Seguir"}
              </Text>
            </Pressable>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 120, maxWidth: 700, width: "100%", alignSelf: "center" },
  h: { fontSize: 28, fontWeight: "900", letterSpacing: -0.8, marginBottom: 18 },
  search: { height: 46, borderRadius: 14, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 9 },
  input: { flex: 1, height: "100%", fontSize: 14 },
  label: { fontSize: 10, fontWeight: "800", letterSpacing: 1.3, marginTop: 24, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 11 },
  avatar: { width: 54, height: 54, borderRadius: 27, marginRight: 12 },
  name: { flexDirection: "row", alignItems: "center", gap: 4 },
  user: { fontSize: 14, fontWeight: "800" },
  follow: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
  empty: { alignItems: "center", justifyContent: "center", padding: 40, width: "100%" }
});
