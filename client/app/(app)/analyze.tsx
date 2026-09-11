import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Icon } from '../../src/components/Icon';
import { Badge } from '../../src/components/Badge';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ErrorState } from '../../src/components/ErrorState';

/** Parse a comma-separated field into a clean, deduped med list. */
function parseMeds(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[,،\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
}

export default function ManualAnalyzeScreen() {
  const { t, isRTL, language } = useLanguage();
  const { colors, font, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const [medications, setMedications] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [notes, setNotes] = useState('');

  const list = parseMeds(medications);
  const canSubmit = list.length >= 1;

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/analysis/analyze', {
        medications: list,
        symptoms,
        notes,
        language,
      }),
    onSuccess: (data) => {
      // Pass the result inline: the report was just written, and re-fetching it
      // by id raced the write on slow links and showed an empty report.
      router.push({
        pathname: '/(app)/analysis/[id]',
        params: { id: data.report.id, result: JSON.stringify(data.result) },
      });
    },
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('manualAnalysis')} subtitle={t('reviewBeforeCombining')} />

        <View style={{ padding: spacing.xl, paddingTop: spacing.sm }}>
          <Input
            label={t('medications')}
            value={medications}
            onChangeText={setMedications}
            icon="medications"
            multiline
            autoCorrect={false}
            placeholder={language === 'ar' ? 'مثال: Metformin, Aspirin, Atorvastatin' : 'e.g. Metformin, Aspirin, Atorvastatin'}
            hint={language === 'ar' ? 'افصل بين الأدوية بفاصلة' : 'Separate each medication with a comma'}
          />

          {/* Live token list — confirms what the AI will actually receive,
              since the comma-split silently drops empty entries. */}
          {list.length > 0 ? (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={[font.micro, { color: colors.textMuted, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }]}>
                {t('medicationsInMix').toUpperCase()} · {list.length}
              </Text>
              <View style={styles.chips}>
                {list.map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setMedications(list.filter((x) => x !== m).join(', '))}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${m}`}
                  >
                    <Badge label={m} tone="primary" icon="close" size="sm" style={{ marginBottom: 6 }} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          <Input
            label={language === 'ar' ? 'الأعراض' : 'Symptoms'}
            value={symptoms}
            onChangeText={setSymptoms}
            icon="heart"
            multiline
            placeholder={language === 'ar' ? 'دوخة، غثيان، ألم معدة...' : 'Dizziness, nausea, stomach pain...'}
          />
          <Input
            label={t('notes')}
            value={notes}
            onChangeText={setNotes}
            icon="notes"
            multiline
            placeholder={language === 'ar' ? 'حالات مرضية مزمنة، حمل، حساسية...' : 'Chronic conditions, pregnancy, allergies...'}
          />

          <View
            style={[
              styles.note,
              { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: radius.lg },
            ]}
          >
            <Icon name="info" size={16} color={colors.textSecondary} />
            <Text style={[font.caption, { color: colors.textSecondary, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>
              {t('scoreExplainer')}
            </Text>
          </View>

          {mutation.isError ? <ErrorState error={mutation.error} compact /> : null}

          <Button
            title={mutation.isPending ? t('analyzing') : t('runAnalysis')}
            onPress={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!canSubmit}
            icon="bulb"
            style={{ marginTop: spacing.md }}
          />

          <Button
            title={t('scanMedication')}
            onPress={() => router.push('/(app)/scanner')}
            variant="ghost"
            icon="scan"
            size="sm"
            style={{ marginTop: 8 }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
});
