import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Icon, type IconName } from './Icon';

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  label: string;
  tone?: Tone;
  icon?: IconName;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

/**
 * Severity / status chip used across interactions, reminders and medication
 * rows. Replaces the scattered inline `backgroundColor: '#FEF3C7'` literals.
 */
export function Badge({ label, tone = 'neutral', icon, size = 'md', style }: BadgeProps) {
  const { colors, radius, isRTL } = useTheme();

  const tones: Record<Tone, { fg: string; bg: string }> = {
    neutral: { fg: colors.textSecondary, bg: colors.surfaceMuted },
    primary: { fg: colors.onPrimarySoft, bg: colors.primarySoft },
    success: { fg: colors.onSuccessSoft, bg: colors.successSoft },
    warning: { fg: colors.onWarningSoft, bg: colors.warningSoft },
    danger: { fg: colors.onDangerSoft, bg: colors.dangerSoft },
    info: { fg: colors.onSecondarySoft, bg: colors.secondarySoft },
  };

  const t = tones[tone];
  const dim = { sm: 11, md: 12 }[size];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: t.bg,
          borderRadius: radius.pill,
          paddingHorizontal: size === 'sm' ? 8 : 11,
          paddingVertical: size === 'sm' ? 3 : 5,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={dim} color={t.fg} /> : null}
      <Text style={[styles.text, { color: t.fg, fontSize: dim }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Maps an AI-returned severity string onto a tone, tolerating typos from the model. */
export function severityTone(severity?: string): Tone {
  switch ((severity || '').toLowerCase()) {
    case 'high':
    case 'severe':
    case 'major':
    case 'contraindicated':
      return 'danger';
    case 'moderate':
    case 'moderate-major':
    case 'significant':
      return 'warning';
    case 'low':
    case 'minor':
    case 'mild':
      return 'info';
    default:
      return 'neutral';
  }
}

export function SeverityBadge({ severity, label }: { severity?: string; label: string }) {
  return <Badge label={label} tone={severityTone(severity)} icon="shieldAlert" size="sm" />;
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  text: { fontWeight: '700', letterSpacing: 0 },
});

export default Badge;
