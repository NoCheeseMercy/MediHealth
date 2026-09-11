import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  /** Rows of shimmering bars — a list placeholder in one component. */
  lines?: number;
  style?: object;
}

/**
 * A blank screen with a spinner reads as "nothing happened". A skeleton reads
 * as "content is arriving", and it stops the layout jump when data lands —
 * every screen used a full-page spinner before, so each one collapsed and
 * re-expanded on load.
 */
export function Skeleton({ width = '100%', height = 16, radius = 8, lines, style }: SkeletonProps) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const opacity = pulse;

  if (lines) {
    return (
      <View style={style}>
        {Array.from({ length: lines }).map((_, i) => (
          <Animated.View
            key={i}
            style={[
              styles.block,
              {
                backgroundColor: colors.border,
                opacity,
                borderRadius: radius,
                height,
                width: i === lines - 1 ? '62%' : '100%',
                marginBottom: 8,
              },
            ]}
          />
        ))}
      </View>
    );
  }

  return (
    <Animated.View style={[styles.block, { backgroundColor: colors.border, opacity, borderRadius: radius, width, height }, style]} />
  );
}

/** Pre-composed card skeleton matching the dashboard/medication row shape. */
export function SkeletonCard({ count = 3 }: { count?: number }) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: StyleSheet.hairlineWidth,
            borderRadius: radius.lg,
            padding: 16,
          }}
        >
          <Skeleton height={16} width="55%" radius={radius.sm} />
          <Skeleton height={12} width="34%" radius={radius.sm} style={{ marginTop: 10 }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { overflow: 'hidden' },
});

export default Skeleton;
