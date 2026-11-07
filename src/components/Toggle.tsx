import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";

/** Chave liga/desliga própria (a nativa fica desalinhada no iOS mais novo) */
export function Toggle({
  value,
  onValueChange,
  activeColor = "#34C759",
  inactiveColor = "#787880"
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  activeColor?: string;
  inactiveColor?: string;
}) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: value ? 1 : 0, useNativeDriver: false, speed: 20, bounciness: 6 }).start();
  }, [value]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 22] });
  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [inactiveColor + "55", activeColor]
  });

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      hitSlop={10}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <Animated.View style={[s.track, { backgroundColor }]}>
        <Animated.View style={[s.thumb, { transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  track: { width: 51, height: 31, borderRadius: 16, justifyContent: "center" },
  thumb: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: "#FFF",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2
  }
});
