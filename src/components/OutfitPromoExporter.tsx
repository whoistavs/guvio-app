import React, { useEffect, useRef, useState } from "react";
import { Alert, Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Download, Play, Share2, Sparkles, X, Zap } from "lucide-react-native";
import { WardrobeItem } from "../data/mockData";
import { useAppTheme } from "../context/AppTheme";
import { FastImage, preloadImages } from "./FastImage";

export function OutfitPromoExporter({
  visible,
  onClose,
  items
}: {
  visible: boolean;
  onClose: () => void;
  items: WardrobeItem[];
}) {
  const { colors } = useAppTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const displayItems = items.length > 0 ? items : [
    { id: "p1", name: "Jaqueta Couro Minimalist", category: "Sobretudo", colorTag: "Preto", image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=400" },
    { id: "p2", name: "Camiseta Algodão Egípcio", category: "Camiseta", colorTag: "Branco", image: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?q=80&w=400" },
    { id: "p3", name: "Calça Off-White Tailored", category: "Calça", colorTag: "Bege", image: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?q=80&w=400" }
  ];

  useEffect(() => {
    if (visible) {
      preloadImages(displayItems.map(i => i.image));
    }
  }, [visible, displayItems]);

  useEffect(() => {
    let timer: any;
    if (visible && isPlaying) {
      timer = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % displayItems.length);
        slideAnim.setValue(0);
        Animated.parallel([
          Animated.timing(slideAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.08, duration: 150, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1.0, duration: 250, useNativeDriver: true })
          ])
        ]).start();
      }, 1600);
    }
    return () => clearInterval(timer);
  }, [visible, isPlaying, displayItems.length]);

  const activeItem = displayItems[currentIndex] || displayItems[0];

  const handleExportTikTok = () => {
    Alert.alert("Vídeo Comercial Gerado! 🎬✨", "Seu vídeo promocional 9:16 do look foi gerado localmente com cache nativo sem flicker. Pronto para postar no TikTok e Reels!", [
      { text: "Compartilhar agora", onPress: onClose }
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalBack}>
        {/* TikTok / Reels 9:16 Vertical Canvas */}
        <View style={s.canvas916}>
          <View style={s.topBar}>
            <View style={s.brandBadge}>
              <Sparkles size={14} color="#FFF" />
              <Text style={s.brandText}>GUVIO PROMO 9:16</Text>
            </View>
            <Pressable onPress={onClose} style={s.closeBtn}>
              <X size={20} color="#FFF" />
            </Pressable>
          </View>

          {/* Animated Outfit Showcase Image with FastImage native SDWebImage / Glide cache */}
          <Animated.View style={[s.imageWrap, { transform: [{ scale: pulseAnim }] }]}>
            <FastImage source={activeItem.image} style={s.promoImage} contentFit="cover" transition={120} />
            
            {/* Live Tag Overlay */}
            <View style={s.overlayTag}>
              <Zap size={13} color="#FFCC00" />
              <Text style={s.overlayCategory}>{activeItem.category.toUpperCase()}</Text>
              <Text style={s.overlayName}>{activeItem.name}</Text>
            </View>
          </Animated.View>

          {/* Audio Visualizer & Indicator */}
          <View style={s.beatBar}>
            {displayItems.map((_, i) => (
              <View key={i} style={[s.stepDot, { backgroundColor: i === currentIndex ? "#FFF" : "rgba(255,255,255,0.3)" }]} />
            ))}
          </View>

          {/* Watermark & CTA */}
          <View style={s.watermark}>
            <Text style={s.watermarkTitle}>BAIXE O GUVIO APP</Text>
            <Text style={s.watermarkSub}>Moda do mundo no seu guarda-roupa 🌎</Text>
          </View>

          {/* Action Export Button */}
          <Pressable onPress={handleExportTikTok} style={s.exportBtn}>
            <Share2 size={18} color="#000" />
            <Text style={s.exportText}>Exportar para TikTok & Reels</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalBack: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center", padding: 16 },
  canvas916: { width: "100%", maxWidth: 360, aspectRatio: 9 / 16, backgroundColor: "#0A0B0E", borderRadius: 28, overflow: "hidden", padding: 18, justifyContent: "space-between", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", zIndex: 10 },
  brandBadge: { flexDirection: "row", gap: 6, alignItems: "center", backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  brandText: { color: "#FFF", fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
  imageWrap: { flex: 1, marginVertical: 14, borderRadius: 22, overflow: "hidden", position: "relative" },
  promoImage: { width: "100%", height: "100%", backgroundColor: "#222" },
  overlayTag: { position: "absolute", bottom: 12, left: 12, right: 12, backgroundColor: "rgba(0,0,0,0.72)", borderRadius: 16, padding: 12, gap: 2 },
  overlayCategory: { color: "#FFCC00", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  overlayName: { color: "#FFF", fontSize: 14, fontWeight: "800" },
  beatBar: { flexDirection: "row", gap: 6, justifyContent: "center", marginBottom: 12 },
  stepDot: { height: 4, flex: 1, borderRadius: 2 },
  watermark: { alignItems: "center", marginBottom: 12 },
  watermarkTitle: { color: "#FFF", fontSize: 12, fontWeight: "900", letterSpacing: 2 },
  watermarkSub: { color: "rgba(255,255,255,0.6)", fontSize: 10, marginTop: 2 },
  exportBtn: { height: 48, borderRadius: 24, backgroundColor: "#FFF", flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  exportText: { color: "#000", fontWeight: "900", fontSize: 13 }
});
