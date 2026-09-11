import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Icon, type IconName } from './Icon';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: IconName;
  /** Optional primary action — empty screens that tell you what to do next
   *  outperform ones that just announce nothing is there. */
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, icon = 'medications', actionLabel, onAction }: EmptyStateProps) {
  const { colors, font, radius, isRTL, spacing } = useTheme();

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconRing,
          { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: radius.pill },
        ]}
      >
        <Icon name={icon} size={30} color={colors.textMuted} />
      </View>

      <Text style={[font.title, { color: colors.text, textAlign: isRTL ? 'right' : 'center' }]}>{title}</Text>

      {description ? (
        <Text
          style={[
            font.caption,
            { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'center', marginTop: 6, paddingHorizontal: spacing.lg },
          ]}
        >
          {description}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} variant="soft" size="sm" fullWidth={false} style={{ marginTop: spacing.xl }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  iconRing: {
    width: 72,
    height: 72,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
});

export default EmptyState;
