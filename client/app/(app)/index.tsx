import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Card } from '../../src/components/Card';
import { Icon, type IconName } from '../../src/components/Icon';
import { Button } from '../../src/components/Button';
import { Badge } from '../../src/components/Badge';
import { EmptyState } from '../../src/components/EmptyState';
import { ErrorState } from '../../src/components/ErrorState';
import { Skeleton, SkeletonCard } from '../../src/components/Skeleton';
import { SafetyScoreBadge } from '../../src/components/SafetyScoreBadge';
import { formatRelative, formatTime, timeToMinutes, initials } from '../../src/utils/format';

/** A quick-action tile: icon + label + destination. */
function ActionTile({
  icon,
  label,
  caption,
  onPress,
  accent,
}: {
  icon: IconName;
  label: string;
  caption: string;
  onPress: () => void;
  accent: string;
}) {
  const { colors, font, radius, isRTL, shadows } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${label} — ${caption}`}
      style={[
        styles.tile,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
        },
        shadows.card,
      ]}
    >
      <View style={[styles.tileIcon, { backgroundColor: accent }]}>
        <Icon name={icon} size={20} color={colors.onPrimary} />
      </View>
      <Text
        style={[font.subtitle, { color: colors.text, marginTop: 10, textAlign: isRTL ? 'right' : 'left' }]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text style={[font.caption, { color: colors.textSecondary, marginTop: 2, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={2}>
        {caption}
      </Text>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const { t, isRTL } = useLanguage();
  const { colors, font, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/profile/dashboard'),
  });

  const firstName = user?.fullName?.trim().split(/\s+/)[0] || '';

  const meds = data?.activeMedications || [];
  const reminders = data?.upcomingReminders || [];
  const analyses = data?.recentAnalyses || [];

  // Honesty fix: the old code did `data?.safetyScore ?? 85`, which showed every
  // new user a green "85 / Safe" shield they had never earned. Null now flows
  // through to an explicit "not assessed" state.
  const rawScore = data?.safetyScore;
  const score: number | null = typeof rawScore === 'number' && Number.isFinite(rawScore) ? rawScore : null;

  // Today's dose progress from the reminder list, without pretending we have
  // completion data we don't collect on this screen.
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const todays = reminders.filter((r: any) => timeToMinutes(r.time) >= 0);
  const nextDose = [...todays]
    .sort((a: any, b: any) => timeToMinutes(a.time) - timeToMinutes(b.time))
    .find((r: any) => timeToMinutes(r.time) >= nowMin);
  const remaining = todays.filter((r: any) => timeToMinutes(r.time) >= nowMin).length;

  const latestAnalysis = analyses[0];

  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={{ height: insets.top + 148 }} />
        <View style={{ padding: spacing.xl, gap: 14 }}>
          <Skeleton height={18} width="45%" radius={radius.sm} />
          <Skeleton height={96} radius={radius.xl} />
          <SkeletonCard count={3} />
        </View>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 60 }]}>
        <ErrorState error={error} onRetry={refetch} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />
      }
    >
      {/* ── Hero ─────────────────────────────────────────────── */}
      <LinearGradient
        colors={[colors.heroFrom, colors.heroTo]}
        style={[styles.hero, { paddingTop: insets.top + spacing['2xl'] }]}
      >
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={[font.micro, { color: 'rgba(255,255,255,0.72)' }]}>
              {t('overview').toUpperCase()}
            </Text>
            <Text style={[styles.greeting, { textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
              {firstName ? `${t('welcome')}، ${firstName}` : t('welcome')}
            </Text>
            <Text style={[styles.heroSub, { textAlign: isRTL ? 'right' : 'left' }]}>{t('tagline')}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(app)/settings')}
            accessibilityRole="button"
            accessibilityLabel={t('profile')}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{initials(user?.fullName)}</Text>
          </TouchableOpacity>
        </View>

        {/* Score lives inside the hero so the most important number is above the fold. */}
        <View style={styles.heroScoreRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroLabel, { textAlign: isRTL ? 'right' : 'left' }]}>{t('safetyScore')}</Text>
            <Text style={[styles.heroHint, { textAlign: isRTL ? 'right' : 'left' }]}>
              {score === null ? t('noScoreYet') : t('scoreExplainer')}
            </Text>
          </View>
          <SafetyScoreBadge score={score} size="md" />
        </View>
      </LinearGradient>

      <View style={{ padding: spacing.xl, marginTop: -20 }}>
        {/* ── Quick actions ──────────────────────────────────── */}
        <Text style={[font.label, { color: colors.textSecondary, marginBottom: spacing.md, textAlign: isRTL ? 'right' : 'left' }]}>
          {t('quickActions').toUpperCase()}
        </Text>
        <View style={[styles.actionsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <ActionTile
            icon="scan"
            label={t('quickScan')}
            caption={t('scanMedication')}
            onPress={() => router.push('/(app)/scanner')}
            accent={colors.primary}
          />
          <ActionTile
            icon="medications"
            label={t('addMedication')}
            caption={t('activeMedications')}
            onPress={() => router.push('/(app)/medications/add')}
            accent={colors.secondary}
          />
        </View>

        {/* ── Today's doses ──────────────────────────────────── */}
        <View style={[styles.sectionHead, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text style={[font.title, { color: colors.text }]}>{t('dosesToday')}</Text>
          <TouchableOpacity onPress={() => router.push('/(app)/reminders')} accessibilityRole="link">
            <Text style={[font.caption, { color: colors.primary, fontWeight: '700' }]}>{t('viewAll')}</Text>
          </TouchableOpacity>
        </View>

        {todays.length === 0 ? (
          <Card elevation="none" style={{ backgroundColor: colors.surfaceMuted, borderColor: colors.border }}>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="clock" size={18} color={colors.textMuted} />
              <Text style={[font.caption, { color: colors.textSecondary, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>
                {t('noDosesToday')}
              </Text>
            </View>
          </Card>
        ) : (
          <>
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Badge
                label={`${remaining} ${t('upcoming')}`}
                tone={remaining > 0 ? 'primary' : 'success'}
                icon={remaining > 0 ? 'clock' : 'checkAll'}
                size="sm"
              />
              {nextDose ? (
                <Text style={[font.caption, { color: colors.textSecondary }]}>
                  {t('nextDose')}: {formatTime(nextDose.time)}
                </Text>
              ) : null}
            </View>
            {todays.slice(0, 3).map((r: any) => (
              <Card key={r.id || r.$id} elevation="none" style={{ marginBottom: 8, padding: 14 }}>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.timePill, { backgroundColor: colors.surfaceMuted, borderRadius: radius.md }]}>
                    <Text style={[font.subtitle, { color: colors.text }]}>{formatTime(r.time)}</Text>
                  </View>
                  <Text
                    style={[font.body, { color: colors.text, fontWeight: '600', flex: 1, textAlign: isRTL ? 'right' : 'left' }]}
                    numberOfLines={1}
                  >
                    {r.medication?.name || t('medications')}
                  </Text>
                  {timeToMinutes(r.time) < nowMin ? (
                    <Icon name="check" size={17} color={colors.success} />
                  ) : (
                    <Icon name="clock" size={16} color={colors.textMuted} />
                  )}
                </View>
              </Card>
            ))}
          </>
        )}

        {/* ── Active medications ─────────────────────────────── */}
        <View style={[styles.sectionHead, { flexDirection: isRTL ? 'row-reverse' : 'row', marginTop: spacing.xl }]}>
          <Text style={[font.title, { color: colors.text }]}>
            {t('activeMedications')} ({meds.length})
          </Text>
          {meds.length > 0 ? (
            <TouchableOpacity onPress={() => router.push('/(app)/medications')} accessibilityRole="link">
              <Text style={[font.caption, { color: colors.primary, fontWeight: '700' }]}>{t('viewAll')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {meds.length === 0 ? (
          <EmptyState
            icon="medications"
            title={t('noMedications')}
            description={t('noMedicationsDesc')}
            actionLabel={t('addFirstMedication')}
            onAction={() => router.push('/(app)/medications/add')}
          />
        ) : (
          meds.slice(0, 4).map((m: any) => (
            <TouchableOpacity
              key={m.id || m.$id}
              onPress={() => router.push(`/(app)/medications/${m.id || m.$id}`)}
              activeOpacity={0.75}
              accessibilityRole="button"
            >
              <Card elevation="none" style={{ marginBottom: 8, padding: 14 }}>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.medIcon, { backgroundColor: colors.primarySoft, borderRadius: radius.md }]}>
                    <Icon name="medication" size={17} color={colors.onPrimarySoft} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[font.subtitle, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]}
                      numberOfLines={1}
                    >
                      {m.name}
                    </Text>
                    {m.dosage ? (
                      <Text style={[font.caption, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
                        {m.dosage}
                      </Text>
                    ) : null}
                  </View>
                  <Icon name={isRTL ? 'chevronLeft' : 'chevronRight'} size={18} color={colors.textMuted} />
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}

        {/* ── Recent analyses ────────────────────────────────── */}
        <View style={[styles.sectionHead, { flexDirection: isRTL ? 'row-reverse' : 'row', marginTop: spacing.xl }]}>
          <Text style={[font.title, { color: colors.text }]}>{t('recentAnalysis')}</Text>
          {analyses.length > 0 ? (
            <TouchableOpacity onPress={() => router.push('/(app)/history')} accessibilityRole="link">
              <Text style={[font.caption, { color: colors.primary, fontWeight: '700' }]}>{t('viewAll')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {analyses.length === 0 ? (
          <Card elevation="none" style={{ backgroundColor: colors.surfaceMuted, borderColor: colors.border }}>
            <EmptyState
              icon="clipboard"
              title={t('noHistory')}
              description={t('noHistoryDesc')}
              actionLabel={t('runFirstAnalysis')}
              onAction={() => router.push('/(app)/analyze')}
            />
          </Card>
        ) : (
          analyses.slice(0, 3).map((a: any) => {
            const names: string[] = a.medications?.names || [];
            const id = a.id || a.$id;
            return (
              <TouchableOpacity
                key={id}
                onPress={() => router.push(`/(app)/analysis/${id}`)}
                activeOpacity={0.75}
                accessibilityRole="button"
              >
                <Card elevation="none" style={{ marginBottom: 8, padding: 14 }}>
                  <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
                    <SafetyScoreBadge score={a.safetyScore} size="sm" compact />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[font.subtitle, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]}
                        numberOfLines={1}
                      >
                        {names.slice(0, 2).join(', ') || t('analysisResults')}
                      </Text>
                      <Text style={[font.caption, { color: colors.textMuted, textAlign: isRTL ? 'right' : 'left' }]}>
                        {names.length > 2 ? `+${names.length - 2} · ` : ''}
                        {formatRelative(a.createdAt, isRTL, t)}
                      </Text>
                    </View>
                    <Icon name={isRTL ? 'chevronLeft' : 'chevronRight'} size={18} color={colors.textMuted} />
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
        )}

        {/* ── Disclaimer ─────────────────────────────────────── */}
        <View
          style={[
            styles.disclaimer,
            { backgroundColor: colors.warningSoft, borderColor: colors.border, borderRadius: radius.lg, marginTop: spacing.xl },
          ]}
        >
          <Icon name="stethoscope" size={17} color={colors.onWarningSoft} />
          <Text style={[font.caption, { color: colors.onWarningSoft, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>
            {t('disclaimerText')}
          </Text>
        </View>

        <Button
          title={t('newSafetyAssessment')}
          onPress={() => router.push('/(app)/analyze')}
          variant="soft"
          icon="bulb"
          style={{ marginTop: spacing.lg }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 34,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  greeting: { fontSize: 25, fontWeight: '800', color: '#FFF', letterSpacing: -0.6, marginTop: 4 },
  heroSub: { fontSize: 13.5, color: 'rgba(255,255,255,0.8)', marginTop: 4, lineHeight: 19 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
  heroScoreRow: {
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    gap: 14,
    flexDirection: 'row',
  },
  heroLabel: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  heroHint: { fontSize: 12, color: 'rgba(255,255,255,0.74)', marginTop: 3, lineHeight: 17 },
  actionsRow: { gap: 12 },
  tile: { flex: 1, padding: 16, borderWidth: StyleSheet.hairlineWidth },
  tileIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sectionHead: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  timePill: { minWidth: 56, alignItems: 'center', paddingVertical: 7, paddingHorizontal: 8 },
  medIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
