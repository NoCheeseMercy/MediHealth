import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../../src/services/api';
import { useLanguage } from '../../../src/contexts/LanguageContext';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { Card } from '../../../src/components/Card';
import { Icon, type IconName } from '../../../src/components/Icon';
import { Badge, severityTone, type Tone } from '../../../src/components/Badge';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { EmptyState } from '../../../src/components/EmptyState';
import { ErrorState } from '../../../src/components/ErrorState';
import { Skeleton } from '../../../src/components/Skeleton';
import { SafetyScoreBadge } from '../../../src/components/SafetyScoreBadge';
import { formatRelative } from '../../../src/utils/format';

type Item = Record<string, string>;

/** One titled group of findings, with severity chips where the model supplied them. */
function FindingGroup({
  icon,
  title,
  items,
  emptyLabel,
  accent = 'primary',
  tone,
}: {
  icon: IconName;
  title: string;
  items: Item[];
  emptyLabel?: string;
  accent?: 'primary' | 'warning' | 'danger';
  tone?: (item: Item) => { tone: Tone; label: string };
}) {
  const { colors, font, isRTL } = useTheme();
  const has = items.length > 0;

  return (
    <Card
      elevation="none"
      accent={has ? accent : undefined}
      style={{ marginBottom: 12 }}
    >
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 9, marginBottom: has ? 12 : 0 }}>
        <Icon
          name={icon}
          size={17}
          color={
            has
              ? accent === 'danger'
                ? colors.danger
                : accent === 'warning'
                  ? colors.warning
                  : colors.primary
              : colors.textMuted
          }
        />
        <Text style={[font.subtitle, { color: colors.text, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>{title}</Text>
        {has ? <Badge label={`${items.length}`} tone="neutral" size="sm" /> : null}
      </View>

      {!has ? (
        <Text style={[font.caption, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
          {emptyLabel || '—'}
        </Text>
      ) : (
        items.map((item, i) => {
          const meta = tone?.(item);
          const body =
            item.description || item.advice || item.symptom || item.text || item.effect || '';
          const heading = item.drug || item.food || item.symptom || item.text || '';

          return (
            <View
              key={i}
              style={{
                paddingVertical: 10,
                borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              }}
            >
              <View
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: body && heading ? 4 : 0,
                }}
              >
                <Text style={[font.body, { color: colors.text, fontWeight: '700', flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>
                  {heading}
                </Text>
                {meta ? <Badge label={meta.label} tone={meta.tone} size="sm" /> : null}
              </View>
              {body && body !== heading ? (
                <Text style={[font.body, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>{body}</Text>
              ) : null}
            </View>
          );
        })
      )}
    </Card>
  );
}

export default function AnalysisDetailScreen() {
  const { id, result: resultParam } = useLocalSearchParams<{ id: string; result?: string }>();
  const { t, isRTL } = useLanguage();
  const { colors, font, radius, spacing, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['analysis', id],
    queryFn: () => api.get(`/analysis/${id}`),
    enabled: !!id && !resultParam,
  });

  // The scanner/analyze flow hands the result over as a URL param. JSON.parse on
  // that was unguarded — a malformed param white-screened the whole route.
  const inline = useMemo<{ ok: boolean; value?: any }>(() => {
    if (!resultParam || typeof resultParam !== 'string') return { ok: false };
    try {
      return { ok: true, value: JSON.parse(resultParam) };
    } catch {
      return { ok: false };
    }
  }, [resultParam]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title={t('analysisResults')} />
        <View style={{ padding: spacing.xl, gap: 12 }}>
          <Skeleton height={110} radius={radius.xl} />
          <Skeleton height={72} radius={radius.lg} />
          <Skeleton lines={4} height={13} radius={radius.sm} />
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 56 }}>
        <ErrorState error={error} onRetry={refetch} />
      </View>
    );
  }

  const report = data?.report;
  const result = inline.ok ? inline.value : report?.results || {};

  // A genuinely empty result means the write failed upstream. Say so rather
  // than rendering five empty sections that look like a clean bill of health.
  const hasAnything =
    result &&
    Object.keys(result).length > 0 &&
    (result.interactions?.length ||
      result.sideEffects?.length ||
      result.foodInteractions?.length ||
      result.safetyConcerns?.length ||
      result.recommendations?.length ||
      typeof result.score === 'number');

  const score: number | null = typeof result.score === 'number' ? result.score : typeof report?.safetyScore === 'number' ? report.safetyScore : null;
  const names: string[] = report?.medications?.names || result.medications || [];
  const sevLabel = (s?: string) =>
    s === 'high' ? t('highRisk') : s === 'moderate' ? t('moderateRisk') : s === 'low' ? t('lowRisk') : s || '';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={t('analysisResults')}
        eyebrow={report?.createdAt ? formatRelative(report.createdAt, isRTL, t) : t('analysisResults')}
        right={
          <TouchableOpacity
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('back')}
            style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.pill }]}
          >
            <Icon name={isRTL ? 'chevronRight' : 'chevronLeft'} size={19} color={colors.text} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {/* ── Score ─────────────────────────────────────────────── */}
        <Card
          elevation="none"
          style={{ alignItems: 'center', paddingVertical: 22, marginBottom: 12 }}
          accent={score === null ? undefined : score >= 80 ? 'success' : score >= 60 ? 'warning' : 'danger'}
        >
          <SafetyScoreBadge score={score} size="lg" />
          <Text style={[font.caption, { color: colors.textSecondary, marginTop: 12, textAlign: 'center', paddingHorizontal: 16 }]}>
            {score === null ? t('noScoreYet') : t('scoreExplainer')}
          </Text>

          {names.length > 0 ? (
            <View style={[styles.namesWrap, { marginTop: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
              <Text style={[font.micro, { color: colors.textMuted, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }]}>
                {t('medicationsInMix').toUpperCase()}
              </Text>
              <View style={styles.chips}>
                {names.map((n) => (
                  <Badge key={n} label={n} tone="neutral" size="sm" />
                ))}
              </View>
            </View>
          ) : null}
        </Card>

        {/* ── Unverified banner (this build has no source verification) ── */}
        {result.verificationMessage ? (
          <View style={[styles.banner, { backgroundColor: colors.warningSoft, borderColor: colors.border, borderRadius: radius.lg }]}>
            <Icon name="alert" size={17} color={colors.onWarningSoft} />
            <Text style={[font.caption, { color: colors.onWarningSoft, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>
              {result.verificationMessage}
            </Text>
          </View>
        ) : (
          <View style={[styles.banner, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: radius.lg }]}>
            <Icon name="shieldOff" size={17} color={colors.textSecondary} />
            <Text style={[font.caption, { color: colors.textSecondary, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>
              {t('verificationNote')}
            </Text>
          </View>
        )}

        {/* ── Findings ──────────────────────────────────────────── */}
        <View style={{ marginTop: 12 }}>
          {hasAnything ? (
            <>
              <FindingGroup
                icon="shieldAlert"
                title={t('interactions')}
                items={result.interactions || []}
                emptyLabel={t('noKnownInteractions')}
                tone={(i) => ({ tone: severityTone(i.severity), label: sevLabel(i.severity) })}
              />
              <FindingGroup
                icon="alert"
                title={t('safetyConcerns')}
                accent="danger"
                items={(result.safetyConcerns || []).map((s: string) => ({ text: s }))}
              />
              <FindingGroup
                icon="info"
                title={t('sideEffects')}
                accent="warning"
                items={(result.sideEffects || []).map((s: Item) => ({ ...s, heading: s.symptom }))}
                tone={(i) => ({
                  tone: i.likelihood === 'common' ? 'warning' : i.likelihood === 'rare' ? 'neutral' : 'info',
                  label: i.likelihood === 'common' ? t('common') : i.likelihood === 'rare' ? t('rare') : i.likelihood === 'uncommon' ? t('uncommon') : i.likelihood || '',
                })}
              />
              <FindingGroup
                icon="food"
                title={t('foodInteractions')}
                items={(result.foodInteractions || []).map((f: Item) => ({ ...f, heading: f.food }))}
              />
              <FindingGroup
                icon="bulb"
                title={t('recommendations')}
                items={(result.recommendations || []).map((s: string) => ({ text: s }))}
              />
            </>
          ) : (
            <EmptyState
              icon="clipboard"
              title={t('noResults')}
              description={t('connectionHelp')}
              actionLabel={t('tryAgain')}
              onAction={() => router.replace('/(app)/analyze')}
            />
          )}
        </View>

        {/* ── Disclaimer ────────────────────────────────────────── */}
        <View
          style={[
            styles.disclaimer,
            { backgroundColor: colors.dangerSoft, borderColor: colors.border, borderRadius: radius.lg, marginTop: 8 },
          ]}
        >
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Icon name="stethoscope" size={16} color={colors.onDangerSoft} />
            <Text style={[font.label, { color: colors.onDangerSoft }]}>{t('disclaimer')}</Text>
          </View>
          <Text style={[font.caption, { color: colors.onDangerSoft, textAlign: isRTL ? 'right' : 'left', lineHeight: 20 }]}>
            {result.disclaimer || t('disclaimerText')}
          </Text>
          <Text style={[font.caption, { color: colors.onDangerSoft, marginTop: 8, fontWeight: '700', textAlign: isRTL ? 'right' : 'left' }]}>
            {t('confirmWithPharmacist')}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 13,
    borderWidth: StyleSheet.hairlineWidth,
  },
  namesWrap: { alignSelf: 'stretch' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  disclaimer: { padding: 16, borderWidth: StyleSheet.hairlineWidth, marginTop: 12 },
});
