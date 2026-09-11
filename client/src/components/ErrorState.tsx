import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Icon } from './Icon';
import { Button } from './Button';

interface ErrorStateProps {
  /** Raw error message from the thrown Error; sanitized before display. */
  error?: unknown;
  onRetry?: () => void;
  compact?: boolean;
}

/**
 * The app previously had zero error UI: a failed query left the screen silently
 * stuck or blank, and a failed mutation showed nothing at all. This is the
 * shared fallback for both.
 */
export function ErrorState({ error, onRetry, compact }: ErrorStateProps) {
  const { colors, font, radius, isRTL, spacing } = useTheme();
  const { t } = useLanguage();

  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const detail = raw.length > 140 ? `${raw.slice(0, 140)}…` : raw;

  if (compact) {
    return (
      <View
        style={[
          styles.inline,
          { backgroundColor: colors.dangerSoft, borderColor: colors.border, borderRadius: radius.md },
        ]}
      >
        <Icon name="alert" size={16} color={colors.onDangerSoft} />
        <Text style={[font.caption, { color: colors.onDangerSoft, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>
          {detail || t('error')}
        </Text>
        {onRetry ? (
          <Text onPress={onRetry} style={[font.label, { color: colors.onDangerSoft }]}>
            {t('retry')}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Icon name="alert" size={compact ? 22 : 38} color={colors.danger} />
      <Text style={[font.title, { color: colors.text, marginTop: spacing.md, textAlign: isRTL ? 'right' : 'center' }]}>
        {t('error')}
      </Text>
      {detail ? (
        <Text
          style={[
            font.caption,
            { color: colors.textSecondary, marginTop: 6, textAlign: isRTL ? 'right' : 'center' },
          ]}
        >
          {detail}
        </Text>
      ) : null}
      {onRetry ? (
        <Button title={t('tryAgain')} onPress={onRetry} variant="outline" size="sm" fullWidth={false} icon="refresh" style={{ marginTop: spacing.xl }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 12,
  },
});

export default ErrorState;
