import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../../src/services/api';
import { useLanguage } from '../../../src/contexts/LanguageContext';
import { useTheme } from '../../../src/contexts/ThemeContext';
import { Input } from '../../../src/components/Input';
import { Button } from '../../../src/components/Button';
import { Badge } from '../../../src/components/Badge';
import { ScreenHeader } from '../../../src/components/ScreenHeader';
import { ErrorState } from '../../../src/components/ErrorState';

/** Free-text date field that accepts 2026-01-15 or DD/MM/YYYY and stores ISO. */
function normalizeDate(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  const iso = /^\d{4}-\d{1,2}(-\d{1,2})?$/.test(v) ? v : null;
  if (iso) {
    const [y, m, d] = iso.split('-');
    return [y, m.padStart(2, '0'), (d || '01').padStart(2, '0')].join('-');
  }
  const slash = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (slash) {
    const [, d, m, y] = slash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const t = Date.parse(v);
  return Number.isNaN(t) ? '' : new Date(t).toISOString().slice(0, 10);
}

const FORMS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Drops', 'Inhaler', 'Patch'] as const;

export default function AddMedicationScreen() {
  const { t, isRTL, language } = useLanguage();
  const { colors, font, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const isEdit = !!id;

  const [form, setForm] = useState({
    name: '',
    dosage: '',
    activeIngredient: '',
    form: '',
    instructions: '',
    prescribedBy: '',
    startDate: '',
    endDate: '',
    notes: '',
  });
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Prefill when editing — previously `medications/[id]` had an "edit" label in
  // translations but no edit screen existed at all.
  const { data: existing } = useQuery({
    queryKey: ['medication', id],
    queryFn: () => api.get(`/medications/${id}`),
    enabled: isEdit,
  });

  const prefilled = useRef(false);
  useEffect(() => {
    const m = existing?.medication;
    if (!m || prefilled.current) return;
    prefilled.current = true;
    setForm({
      name: m.name || '',
      dosage: m.dosage || '',
      activeIngredient: m.activeIngredient || '',
      form: m.form || '',
      instructions: m.instructions || '',
      prescribedBy: m.prescribedBy || '',
      startDate: (m.startDate || '').slice(0, 10),
      endDate: (m.endDate || '').slice(0, 10),
      notes: m.notes || '',
    });
    if (typeof m.isActive === 'boolean') setIsActive(m.isActive);
  }, [existing]);

  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = language === 'ar' ? 'اسم الدواء مطلوب' : 'Medication name is required';
    if (form.startDate && !normalizeDate(form.startDate))
      next.startDate = language === 'ar' ? 'تاريخ غير صالح (مثال: 2026-01-15)' : 'Invalid date (e.g. 2026-01-15)';
    if (form.endDate && !normalizeDate(form.endDate))
      next.endDate = language === 'ar' ? 'تاريخ غير صالح (مثال: 2026-02-15)' : 'Invalid date (e.g. 2026-02-15)';
    if (form.startDate && form.endDate && normalizeDate(form.endDate) < normalizeDate(form.startDate))
      next.endDate = language === 'ar' ? 'تاريخ الانتهاء يجب أن يكون بعد البداية' : 'End date must be after the start date';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        name: form.name.trim(),
        startDate: normalizeDate(form.startDate),
        endDate: normalizeDate(form.endDate),
        isActive,
      };
      return isEdit ? api.put(`/medications/${id}`, payload) : api.post('/medications', payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['medications'] });
      qc.invalidateQueries({ queryKey: ['medication', id] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      router.back();
    },
  });

  const submit = () => {
    if (validate()) mutation.mutate();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title={isEdit ? t('editMedication') : t('addMedication')} subtitle={t('medicationDetails')} />

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Input label={t('medications') + ' *'} value={form.name} onChangeText={(v) => set('name', v)} icon="medications" autoCapitalize="words" error={errors.name} placeholder={language === 'ar' ? 'مثال: Metformin' : 'e.g. Metformin'} />
        <Input label={t('dosage')} value={form.dosage} onChangeText={(v) => set('dosage', v)} icon="tune" autoCapitalize="none" placeholder={language === 'ar' ? 'مثال: 500mg مرتين يوميًا' : 'e.g. 500 mg twice daily'} />
        <Input label={t('activeIngredient')} value={form.activeIngredient} onChangeText={(v) => set('activeIngredient', v)} icon="bulb" autoCapitalize="none" placeholder={language === 'ar' ? 'المادة الفعالة' : 'Active ingredient'} />

        {/* Dosage form picker — was a free-text field, so "tab"/"Tablet"/"tablet"
            all coexisted and grouped as three different forms. */}
        <Text style={[font.label, { color: colors.textSecondary, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }]}>{t('form')}</Text>
        <View style={styles.chips}>
          {FORMS.map((f) => {
            const on = form.form === f;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => set('form', on ? '' : f)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: on ? colors.primarySoft : colors.surfaceMuted,
                    borderColor: on ? colors.primary : colors.border,
                    borderRadius: radius.pill,
                  },
                ]}
              >
                <Text style={[font.caption, { color: on ? colors.onPrimarySoft : colors.textSecondary, fontWeight: on ? '700' : '500' }]}>{f}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Input label={t('instructions')} value={form.instructions} onChangeText={(v) => set('instructions', v)} icon="notes" multiline placeholder={language === 'ar' ? 'مع الطعام، قبل النوم...' : 'With food, at bedtime...'} style={{ marginTop: spacing.lg }} />
        <Input label={t('prescribedBy')} value={form.prescribedBy} onChangeText={(v) => set('prescribedBy', v)} icon="profile" autoCapitalize="words" />

        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Input label={t('startDate')} value={form.startDate} onChangeText={(v) => set('startDate', v)} icon="schedule" autoCapitalize="none" placeholder="2026-01-15" error={errors.startDate} />
          </View>
          <View style={{ flex: 1 }}>
            <Input label={t('endDate')} value={form.endDate} onChangeText={(v) => set('endDate', v)} icon="schedule" autoCapitalize="none" placeholder="2026-02-15" error={errors.endDate} />
          </View>
        </View>

        <Input label={t('notes')} value={form.notes} onChangeText={(v) => set('notes', v)} icon="clipboard" multiline />

        {/* Active toggle */}
        <TouchableOpacity
          onPress={() => setIsActive((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: isActive }}
          style={[styles.toggleRow, { borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[font.subtitle, { color: colors.text }]}>{t('status')}</Text>
            <Text style={[font.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              {isActive ? t('active') : t('inactive')}
            </Text>
          </View>
          <Badge label={isActive ? t('active') : t('inactive')} tone={isActive ? 'success' : 'neutral'} icon={isActive ? 'check' : 'close'} size="sm" />
        </TouchableOpacity>

        {mutation.isError ? <View style={{ marginTop: spacing.md }}><ErrorState error={mutation.error} compact /></View> : null}

        <Button title={t('save')} onPress={submit} loading={mutation.isPending} icon="check" style={{ marginTop: spacing.xl }} />
        <Button title={t('cancel')} onPress={() => router.back()} variant="ghost" style={{ marginTop: 8 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderWidth: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth, marginTop: 4 },
});
