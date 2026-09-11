import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../../src/services/api';
import { useLanguage } from '../../../src/contexts/LanguageContext';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { Card } from '../../../src/components/Card';
import { Icon } from '../../../src/components/Icon';
import { Badge } from '../../../src/components/Badge';
import { Button } from '../../../src/components/Button';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { ErrorState } from '../../../src/components/ErrorState';
import { Skeleton } from '../../../src/components/Skeleton';
import { formatDate } from '../../../src/utils/format';

function Field({ label, value }: { label: string; value?: string }) {
  const { colors, font, isRTL } = useTheme();
  if (!value) return null;
  return (
    <View style={styles.field}>
      <Text style={[font.micro, { color: colors.textMuted, textAlign: isRTL ? 'right' : 'left' }]}>{label.toUpperCase()}</Text>
      <Text style={[font.body, { color: colors.text, marginTop: 3, textAlign: isRTL ? 'right' : 'left' }]}>{value}</Text>
    </View>
  );
}

export default function MedicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, isRTL, language } = useLanguage();
  const { colors, font, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['medication', id],
    queryFn: () => api.get(`/medications/${id}`),
  });

  const analyzeMutation = useMutation({
    mutationFn: () => api.post('/analysis/analyze', { medications: [data.medication.name], language }),
    onSuccess: (res) => {
      router.push({
        pathname: '/(app)/analysis/[id]',
        params: { id: res.report.id, result: JSON.stringify(res.result) },
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/medications/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medications'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      router.back();
    },
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title={t('medicationDetails')} />
        <View style={{ padding: spacing.xl, gap: 12 }}>
          <Skeleton height={80} radius={radius.xl} />
          <Skeleton lines={5} height={14} radius={radius.sm} />
        </View>
      </View>
    );
  }

  // The old version read `med.name` right after the loading branch, so a failed
  // fetch (deleted doc, bad id, offline) threw `undefined is not an object`
  // and crashed the route instead of showing an error.
  const med = data?.medication;
  if (isError || !med) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title={t('medicationDetails')} />
        <ErrorState error={error} onRetry={refetch} />
      </View>
    );
  }

  const isActive = med.isActive !== false;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={med.name}
        eyebrow={t('medicationDetails')}
        right={
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Badge label={isActive ? t('active') : t('inactive')} tone={isActive ? 'success' : 'neutral'} size="sm" />
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <Card elevation="none" style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <View style={[styles.icon, { backgroundColor: colors.primarySoft, borderRadius: radius.md }]}>
              <Icon name="medication" size={20} color={colors.onPrimarySoft} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[font.subtitle, { color: colors.text }]}>{med.dosage || t('dosage')}</Text>
              {med.form ? (
                <Text style={[font.caption, { color: colors.textSecondary, marginTop: 2 }]}>{med.form}</Text>
              ) : null}
            </View>
          </View>
        </Card>

        <Card elevation="none" style={{ marginBottom: 12 }}>
          <Field label={t('activeIngredient')} value={med.activeIngredient} />
          <Field label={t('instructions')} value={med.instructions} />
          <Field label={t('prescribedBy')} value={med.prescribedBy} />
          <Field label={t('startDate')} value={med.startDate ? formatDate(med.startDate, isRTL) : ''} />
          <Field label={t('endDate')} value={med.endDate ? formatDate(med.endDate, isRTL) : ''} />
          <Field label={t('notes')} value={med.notes} />
          {med.dosage || med.activeIngredient ? null : (
            <Text style={[font.caption, { color: colors.textMuted, textAlign: isRTL ? 'right' : 'left' }]}>{t('nothingHere')}</Text>
          )}
        </Card>

        {analyzeMutation.isError ? (
          <View style={{ marginBottom: 12 }}>
            <ErrorState error={analyzeMutation.error} compact />
          </View>
        ) : null}

        <Button
          title={t('runAnalysis')}
          onPress={() => analyzeMutation.mutate()}
          loading={analyzeMutation.isPending}
          icon="bulb"
        />
        <Button
          title={t('editMedication')}
          onPress={() => router.push({ pathname: '/(app)/medications/add', params: { id } })}
          variant="outline"
          icon="edit"
          style={{ marginTop: 10 }}
        />
        <Button
          title={t('delete')}
          variant="ghost"
          icon="delete"
          textStyle={{ color: colors.danger }}
          style={{ marginTop: 10 }}
          onPress={() =>
            Alert.alert(t('delete'), t('deleteConfirmation'), [
              { text: t('cancel'), style: 'cancel' },
              { text: t('delete'), style: 'destructive', onPress: () => deleteMutation.mutate() },
            ])
          }
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  field: { marginBottom: 14 },
});
