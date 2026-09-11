import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  padded?: boolean;
  /** `flat` drops the shadow — use for cards stacked inside a busy list. */
  elevation?: 'none' | 'card' | 'raised';
  /** Adds a colored left/right edge to flag severity. RTL-aware. */
  accent?: 'success' | 'warning' | 'danger' | 'primary';
}

const ACCENTS = {
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  primary: 'primary',
} as const;

export function Card({ children, style, padded = true, elevation = 'card', accent }: CardProps) {
  const { colors, shadows, radius, isRTL } = useTheme();

  const accentStyle: ViewStyle | undefined = accent
    ? {
        borderLeftWidth: isRTL ? 0 : 4,
        borderRightWidth: isRTL ? 4 : 0,
        borderLeftColor: accent === 'primary' ? colors.primary : colors[ACCENTS[accent]],
        borderRightColor: accent === 'primary' ? colors.primary : colors[ACCENTS[accent]],
      }
    : undefined;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
        },
        elevation !== 'none' && shadows[elevation],
        accentStyle,
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  padded: { padding: 16 },
});

export default Card;
