import React from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { Globe } from "lucide-react-native";

/** abre o link da bio no navegador (aceita "meusite.com" sem https) */
export function openBioLink(url: string) {
  const clean = url.trim();
  if (!clean) return;
  const full = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
  Linking.openURL(full).catch(() => {});
}

export function BioLink({ url }: { url?: string }) {
  if (!url) return null;
  return (
    <Pressable onPress={() => openBioLink(url)} hitSlop={6} style={{ alignSelf: "flex-start" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
        <Globe size={12} color="#0095F6" />
        <Text style={{ color: "#0095F6", fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
          {url.replace(/^https?:\/\//i, "").replace(/\/$/, "")}
        </Text>
      </View>
    </Pressable>
  );
}
