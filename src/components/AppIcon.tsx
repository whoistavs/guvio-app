import React from "react";
import {
  Award,
  Briefcase,
  CircleDot,
  Contrast,
  Crown,
  Gem,
  Globe2,
  Heart,
  Layers,
  Luggage,
  Palette,
  Recycle,
  Shirt,
  Sprout,
  Star,
  Sun,
  Target,
  Trophy,
  Tv,
  Building2
} from "lucide-react-native";

const MAP = {
  contrast: Contrast,
  recycle: Recycle,
  layers: Layers,
  palette: Palette,
  briefcase: Briefcase,
  pattern: CircleDot,
  city: Building2,
  retro: Tv,
  gem: Gem,
  sun: Sun,
  sprout: Sprout,
  ten: Award,
  medal: Award,
  luggage: Luggage,
  globe: Globe2,
  heart: Heart,
  star: Star,
  target: Target,
  trophy: Trophy,
  crown: Crown,
  shirt: Shirt
};
export type AppIconName = keyof typeof MAP;

/** ícone por nome (desafios e conquistas guardam só o nome) */
export function AppIcon({ name, size = 18, color, strokeWidth = 1.8 }: { name: string; size?: number; color: string; strokeWidth?: number }) {
  const I = (MAP as any)[name] || Star;
  return <I size={size} color={color} strokeWidth={strokeWidth} />;
}
