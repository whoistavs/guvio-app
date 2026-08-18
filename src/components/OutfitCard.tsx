import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import {
  Shirt,
  Sparkles,
  Briefcase,
  Footprints,
  Circle,
  Crown,
  Heart,
  PartyPopper,
} from "lucide-react-native";
import { OutfitStyle } from "../data/mockData";

interface StyleCardProps {
  styleItem: OutfitStyle;
  isSelected?: boolean;
  onPress: () => void;
}

export const StyleCard: React.FC<StyleCardProps> = ({
  styleItem,
  isSelected,
  onPress,
}) => {
  const getIcon = (iconName: string) => {
    const size = 26;
    const strokeWidth = 1.4;
    const color = isSelected ? "#FFFFFF" : "#1A1A1A";

    switch (iconName) {
      case "shirt":
        return <Shirt size={size} color={color} strokeWidth={strokeWidth} />;
      case "cap":
        return <Sparkles size={size} color={color} strokeWidth={strokeWidth} />;
      case "tshirt":
        return <Briefcase size={size} color={color} strokeWidth={strokeWidth} />;
      case "shoe":
        return <Footprints size={size} color={color} strokeWidth={strokeWidth} />;
      case "circle":
        return <Circle size={size} color={color} strokeWidth={strokeWidth} />;
      case "jacket":
        return <Crown size={size} color={color} strokeWidth={strokeWidth} />;
      case "heart":
        return <Heart size={size} color={color} strokeWidth={strokeWidth} />;
      case "party":
        return <PartyPopper size={size} color={color} strokeWidth={strokeWidth} />;
      default:
        return <Shirt size={size} color={color} strokeWidth={strokeWidth} />;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.styleCard, isSelected && styles.styleCardSelected]}
    >
      <View style={styles.iconContainer}>{getIcon(styleItem.iconName)}</View>
      <Text style={[styles.styleTitle, isSelected && styles.styleTitleSelected]}>
        {styleItem.title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  styleCard: {
    width: "47%",
    backgroundColor: "#FAFAFA",
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  styleCardSelected: {
    backgroundColor: "#000000",
    borderColor: "#000000",
  },
  iconContainer: {
    marginBottom: 12,
  },
  styleTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0D0D0D",
  },
  styleTitleSelected: {
    color: "#FFFFFF",
  },
});
