import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Small line above the title, e.g. a section eyebrow. */
  eyebrow?: string;
  right?: React.ReactNode;
  /** Renders title/subtitle right-aligned in RTL automatically. */
  centered?: boolean;
  style?: ViewStyle;
}

/**
 * Replaces the `paddingTop: 56` magic number copy-pasted across every screen.
 * That hardcoded value under-padded tall-status-bar devices and over-padded
 * notched ones, since it ignored the real safe area.
 */
export function ScreenHeader({ title, subtitle, eyebrow, right, centered, style }: ScreenHeaderProps) {
  const { colors, font, isRTL, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.row,
        {
          paddingTop: insets.top + spacing.lg,
          paddingBottom: spacing.md,
          paddingStart: spacing.xl,
          paddingEnd: spacing.xl,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        },
        style,
      ]}
    >
      <View style={styles.textBlock}>
        {eyebrow ? (
          <Text
            style={[
              font.micro,
              { color: colors.primary, textTransform: 'uppercase', marginBottom: 4 },
              { textAlign: centered ? 'center' : isRTL ? 'right' : 'left' },
            ]}
          >
            {eyebrow}
          </Text>
        ) : null}
        <Text
          style={[
            font.display,
            { color: colors.text },
            { textAlign: centered ? 'center' : isRTL ? 'right' : 'left' },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[
              font.caption,
              { color: colors.textSecondary, marginTop: 4 },
              { textAlign: centered ? 'center' : isRTL ? 'right' : 'left' },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center' },
  textBlock: { flex: 1 },
  right: { marginLeft: 12, flexShrink: 0 },
});

export default ScreenHeader;
