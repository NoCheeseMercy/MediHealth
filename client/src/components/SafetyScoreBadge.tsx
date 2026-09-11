import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Icon, type IconName } from './Icon';

/**
 * Tier definitions. Note the deliberate 4-tier split: the old version lumped
 * everything under 40 into "High Risk" with no separation between "ask your
 * pharmacist" and "this combination is dangerous".
 */
type Tier = 'safe' | 'monitor' | 'caution' | 'danger';

function tierFor(score: number): Tier {
  if (score >= 80) return 'safe';
  if (score >= 60) return 'monitor';
  if (score >= 40) return 'caution';
  return 'danger';
}

const TIER_META: Record<Tier, { icon: IconName; ar: string; en: string }> = {
  safe: { icon: 'shield', ar: 'آمن', en: 'Safe' },
  monitor: { icon: 'info', ar: 'مراقبة', en: 'Monitor' },
  caution: { icon: 'shieldAlert', ar: 'توخي الحذر', en: 'Caution' },
  danger: { icon: 'alert', ar: 'خطر مرتفع', en: 'High Risk' },
};

interface SafetyScoreBadgeProps {
  /**
   * Pass null/undefined when there is genuinely no assessment. The component
   * then renders an explicit "not assessed" state rather than inventing a
   * number — the previous version defaulted a bare `score` of 70/85, which put
   * a green "Safe" shield in front of a patient who had never run an analysis.
   */
  score?: number | null;
  size?: 'sm' | 'md' | 'lg';
  /** Hides the numeric label, for dense rows. */
  compact?: boolean;
}

export function SafetyScoreBadge({ score, size = 'md', compact }: SafetyScoreBadgeProps) {
  const { language } = useLanguage();
  const { colors, radius, isRTL } = useTheme();

  const hasScore = typeof score === 'number' && Number.isFinite(score);
  const value = hasScore ? Math.max(0, Math.min(100, Math.round(score as number))) : null;
  const tier = value === null ? null : tierFor(value);
  const meta = tier ? TIER_META[tier] : null;

  const palette: Record<Tier, { fg: string; bg: string }> = {
    safe: { fg: colors.tierSafe, bg: colors.tierSafeSoft },
    monitor: { fg: colors.tierMonitor, bg: colors.tierMonitorSoft },
    caution: { fg: colors.tierCaution, bg: colors.tierCautionSoft },
    danger: { fg: colors.tierDanger, bg: colors.tierDangerSoft },
  };

  const sizeMap = {
    sm: { box: 60, num: 22, label: 10, icon: 15, pad: 8 },
    md: { box: 92, num: 32, label: 12, icon: 18, pad: 12 },
    lg: { box: 124, num: 44, label: 14, icon: 22, pad: 16 },
  } as const;
  const s = sizeMap[size];

  // ── No-data state ────────────────────────────────────────────────
  if (value === null || tier === null) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.border,
            borderRadius: radius.lg,
            minWidth: s.box,
            padding: s.pad,
          },
        ]}
      >
        <Icon name="shieldOff" size={s.icon} color={colors.textMuted} />
        <Text
          style={[
            { color: colors.textMuted, fontWeight: '800', fontSize: s.num, marginTop: 2 },
            styles.center,
          ]}
        >
          —
        </Text>
        {!compact ? (
          <Text style={[styles.label, { color: colors.textMuted, fontSize: s.label }]}>
            {language === 'ar' ? 'غير مُقيَّم' : 'Not assessed'}
          </Text>
        ) : null}
      </View>
    );
  }

  const c = palette[tier];

  return (
    <View
      accessibilityLabel={
        language === 'ar'
          ? `درجة الأمان ${value} من 100 — ${meta!.ar}`
          : `Safety score ${value} out of 100 — ${meta!.en}`
      }
      style={[
        styles.container,
        { backgroundColor: c.bg, borderRadius: radius.lg, minWidth: s.box, padding: s.pad },
      ]}
    >
      <Icon name={meta!.icon} size={s.icon} color={c.fg} />
      <Text style={[{ color: c.fg, fontSize: s.num }, styles.number, styles.center]}>
        {value}
      </Text>
      {!compact ? (
        <>
          <Text style={[styles.label, { color: c.fg, fontSize: s.label }]}>
            {language === 'ar' ? meta!.ar : meta!.en}
          </Text>
          {/* Proportion track — reads faster than the raw number alone. */}
          <View
            style={[
              styles.track,
              { backgroundColor: colors.overlay, borderRadius: radius.pill, alignSelf: isRTL ? 'flex-end' : 'flex-start' },
            ]}
          >
            <View
              style={{
                width: `${value}%` as `${number}%`,
                height: 3,
                backgroundColor: c.fg,
                borderRadius: radius.pill,
              }}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  number: { fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  label: { fontWeight: '700', marginTop: 2, textAlign: 'center' },
  center: { textAlign: 'center' },
  track: { width: '80%', height: 3, marginTop: 8, overflow: 'hidden' },
});

export default SafetyScoreBadge;
