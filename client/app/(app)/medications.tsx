import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Card } from '../../src/components/Card';
import { Icon } from '../../src/components/Icon';
import { Badge } from '../../src/components/Badge';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { EmptyState } from '../../src/components/EmptyState';
import { ErrorState } from '../../src/components/ErrorState';
import { SkeletonCard } from '../../src/components/Skeleton';

type Med = { id?: string; $id: string; name: string; dosage?: string; activeIngredient?: string; isActive?: boolean; form?: string };

export default function MedicationsScreen() {
  const { t, isRTL } = useLanguage();
  const { colors, font, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['medications'],
    queryFn: () => api.get('/medications'),
  });

  const all: Med[] = data?.medications || [];

  // Search never existed here; a library of 40 medications was a scroll-only list.
  const medications = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (m) =>
        m.name?.toLowerCase().includes(q) ||
        m.activeIngredient?.toLowerCase().includes(q) ||
        m.dosage?.toLowerCase().includes(q),
    );
  }, [all, query]);

  const activeCount = all.filter((m) => m.isActive !== false).length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={t('medications')}
        subtitle={`${activeCount} ${t('active')} · ${all.length} ${t('medications')}`}
        right={
          <Button
            title={t('addMedication')}
            onPress={() => router.push('/(app)/medications/add')}
            fullWidth={false}
            size="sm"
            icon="plus"
            style={{ paddingHorizontal: 12, height: 38 }}
          />
        }
      />

      {all.length > 3 ? (
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
        data={medications}
        keyExtractor={(item) => item.id || item.$id}
        contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: insets.bottom + 90 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          isLoading ? (
            <SkeletonCard count={4} />
          ) : isError ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : all.length === 0 ? (
            <EmptyState
              icon="medications"
              title={t('noMedications')}
              description={t('noMedicationsDesc')}
              actionLabel={t('addFirstMedication')}
              onAction={() => router.push('/(app)/medications/add')}
            />
          ) : (
            <EmptyState icon="search" title={t('noResults')} description={t('nothingHere')} />
          )
        }
        renderItem={({ item }) => {
          const isActive = item.isActive !== false;
          const id = item.id || item.$id;
          return (
            <TouchableOpacity
              onPress={() => router.push(`/(app)/medications/${id}`)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={item.name}
            >
              <Card elevation="none" style={{ marginBottom: 10, padding: 14 }} accent={isActive ? 'primary' : undefined}>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.icon, { backgroundColor: isActive ? colors.primarySoft : colors.surfaceMuted, borderRadius: radius.md }]}>
                    <Icon name="medication" size={18} color={isActive ? colors.onPrimarySoft : colors.textMuted} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[font.subtitle, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text
                      style={[font.caption, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left', marginTop: 2 }]}
                      numberOfLines={1}
                    >
                      {[item.dosage, item.activeIngredient].filter(Boolean).join(' · ') || '—'}
                    </Text>
                  </View>

                  <Badge
                    label={isActive ? t('active') : t('inactive')}
                    tone={isActive ? 'success' : 'neutral'}
                    size="sm"
                  />
                  <Icon name={isRTL ? 'chevronLeft' : 'chevronRight'} size={17} color={colors.textMuted} />
                </View>
              </Card>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
});
