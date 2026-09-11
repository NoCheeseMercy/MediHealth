import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Card } from '../../src/components/Card';
import { Icon } from '../../src/components/Icon';
import { Badge } from '../../src/components/Badge';
import { Input } from '../../src/components/Input';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { EmptyState } from '../../src/components/EmptyState';
import { ErrorState } from '../../src/components/ErrorState';
import { SkeletonCard } from '../../src/components/Skeleton';
import { SafetyScoreBadge } from '../../src/components/SafetyScoreBadge';
import { formatRelative } from '../../src/utils/format';

type Report = {
  id: string;
  medications?: { names?: string[] };
  symptoms?: string;
  safetyScore?: number;
  riskLevel?: string;
  createdAt: string;
};

type Filter = 'all' | 'low' | 'moderate' | 'high';

export default function HistoryScreen() {
  const { t, isRTL } = useLanguage();
  const { colors, font, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['analysis-history'],
    queryFn: () => api.get('/analysis'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/analysis/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['analysis-history'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: Error) => Alert.alert(t('error'), e.message),
  });

  const all: Report[] = data?.reports || [];

  const reports = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((r) => {
      if (filter !== 'all') {
        const s = r.safetyScore;
        const tier: Filter = s == null ? 'all' : s >= 75 ? 'low' : s >= 50 ? 'moderate' : 'high';
        // Unscored reports only appear under "all" — inventing a tier for them
        // would be the same fabrication the score default used to make.
        if (tier !== filter || s == null) return false;
      }
      if (!q) return true;
      const names = (r.medications?.names || []).join(' ').toLowerCase();
      return names.includes(q) || (r.symptoms || '').toLowerCase().includes(q);
    });
  }, [all, query, filter]);

  const filters: { key: Filter; label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }[] = [
    { key: 'all', label: t('history'), tone: 'neutral' },
    { key: 'low', label: t('lowRisk'), tone: 'success' },
    { key: 'moderate', label: t('moderateRisk'), tone: 'warning' },
    { key: 'high', label: t('highRisk'), tone: 'danger' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t('analysisHistory')} subtitle={`${all.length} ${t('analysisResults')}`} />

      {all.length > 0 ? (
        <View style={{ paddingHorizontal: spacing.xl, marginTop: -4 }}>
          <Input
            value={query}
            onChangeText={setQuery}
            icon="search"
            autoCapitalize="none"
            placeholder={t('search')}
            style={{ minHeight: 46, paddingVertical: 11 }}
          />
        </View>
      ) : null}

      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + 90 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />
        }
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          all.length > 0 ? (
            <View style={[styles.filterRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              {filters.map((f) => {
                const on = filter === f.key;
                return (
                  <TouchableOpacity
                    key={f.key}
                    onPress={() => setFilter(f.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: on ? colors.primarySoft : colors.surfaceMuted,
                        borderColor: on ? colors.primary : colors.border,
                        borderRadius: radius.pill,
                      },
                    ]}
                  >
                    <Text style={[font.caption, { color: on ? colors.onPrimarySoft : colors.textSecondary, fontWeight: on ? '700' : '500' }]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ paddingTop: spacing.md }}>
              <SkeletonCard count={4} />
            </View>
          ) : isError ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : all.length === 0 ? (
            <EmptyState
              icon="clipboard"
              title={t('noHistory')}
              description={t('noHistoryDesc')}
              actionLabel={t('runFirstAnalysis')}
              onAction={() => router.push('/(app)/analyze')}
            />
          ) : (
            <EmptyState icon="search" title={t('noResults')} description={t('nothingHere')} />
          )
        }
        renderItem={({ item }) => {
          const names = item.medications?.names || [];
          const score = typeof item.safetyScore === 'number' ? item.safetyScore : null;
          return (
            <Card elevation="none" accent={score === null ? undefined : score >= 75 ? 'success' : score >= 50 ? 'warning' : 'danger'} style={{ marginBottom: 10, padding: 0, overflow: 'hidden' }}>
              <TouchableOpacity
                onPress={() => router.push(`/(app)/analysis/${item.id}`)}
                activeOpacity={0.75}
                accessibilityRole="button"
                style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12, padding: 14 }}
              >
                <SafetyScoreBadge score={score} size="sm" compact />
                <View style={{ flex: 1 }}>
                  <Text style={[font.subtitle, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
                    {names.slice(0, 2).join(', ') || t('analysisResults')}
                  </Text>
                  <Text style={[font.caption, { color: colors.textMuted, marginTop: 3, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
                    {names.length > 2 ? `+${names.length - 2} · ` : ''}
                    {formatRelative(item.createdAt, isRTL, t)}
                  </Text>
                </View>
                <Icon name={isRTL ? 'chevronLeft' : 'chevronRight'} size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <View style={[styles.footer, { borderTopColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                {item.symptoms ? (
                  <Text style={[font.caption, { color: colors.textSecondary, flex: 1 }]} numberOfLines={1}>
                    {t('sideEffects')}: {item.symptoms}
                  </Text>
                ) : (
                  <View style={{ flex: 1 }} />
                )}
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert(t('delete'), t('deleteConfirmation'), [
                      { text: t('cancel'), style: 'cancel' },
                      { text: t('delete'), style: 'destructive', onPress: () => removeMutation.mutate(item.id) },
                    ])
                  }
                  accessibilityRole="button"
                  accessibilityLabel={t('delete')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ padding: 6 }}
                >
                  <Icon name="delete" size={16} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: { gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: 13, paddingVertical: 7, borderWidth: 1 },
  footer: { alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
});
