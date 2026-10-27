import React, { useEffect, useRef } from "react";
import { Animated, DimensionValue, StyleSheet, View } from "react-native";
import { useAppTheme } from "../context/AppTheme";

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: any;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = 20,
  borderRadius = 8,
  style,
}) => {
  const { colors, dark } = useAppTheme();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  const baseColor = dark ? "#23262D" : "#E2E2E6";

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
          opacity,
        },
        style,
      ]}
    />
  );
};

export const FeedPostSkeleton: React.FC = () => {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Header Skeleton */}
      <View style={styles.header}>
        <Skeleton width={42} height={42} borderRadius={21} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Skeleton width="45%" height={14} borderRadius={4} />
          <Skeleton width="30%" height={10} borderRadius={4} style={{ marginTop: 6 }} />
        </View>
      </View>

      {/* Image Skeleton */}
      <Skeleton width="100%" height={320} borderRadius={16} style={{ marginVertical: 12 }} />

      {/* Action Row Skeleton */}
      <View style={styles.actions}>
        <Skeleton width={32} height={32} borderRadius={16} />
        <Skeleton width={32} height={32} borderRadius={16} style={{ marginLeft: 12 }} />
        <Skeleton width={32} height={32} borderRadius={16} style={{ marginLeft: 12 }} />
      </View>

      {/* Captions Skeleton */}
      <Skeleton width="70%" height={12} borderRadius={4} style={{ marginTop: 10 }} />
      <Skeleton width="40%" height={10} borderRadius={4} style={{ marginTop: 6 }} />
    </View>
  );
};

export const ProfileSkeleton: React.FC = () => {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.profileContainer, { backgroundColor: colors.bg }]}>
      <Skeleton width={90} height={90} borderRadius={45} style={{ alignSelf: "center" }} />
      <Skeleton width="50%" height={18} borderRadius={6} style={{ alignSelf: "center", marginTop: 14 }} />
      <Skeleton width="35%" height={12} borderRadius={4} style={{ alignSelf: "center", marginTop: 6 }} />
      
      <View style={styles.statsRow}>
        <Skeleton width={70} height={40} borderRadius={10} />
        <Skeleton width={70} height={40} borderRadius={10} />
        <Skeleton width={70} height={40} borderRadius={10} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileContainer: {
    padding: 24,
    width: "100%",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
  },
});
