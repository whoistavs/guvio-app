import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { theme } from "../styles/theme";

interface ScrollIndicatorProps {
  onPress?: () => void;
}

export const ScrollIndicator: React.FC<ScrollIndicatorProps> = ({ onPress }) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.button}>
        <ChevronDown size={22} color={theme.colors.textMuted} strokeWidth={1.5} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  button: {
    padding: theme.spacing.xs,
  },
});
