import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Switch } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';
import { ensureNotificationPermissions, scheduleMedicationReminder, cancelMedicationReminder } from '../../src/services/notification';
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
import { formatTime, timeToMinutes } from '../../src/utils/format';

type Medication = { id?: string; $id: string; name: string; dosage?: string };
type Reminder = {
  id?: string;
  $id?: string;
  time: string;
  frequency?: string;
  isActive?: boolean;
  medicationId?: string;
  medication?: { id?: string; name?: string; dosage?: string } | null;
};

/** Hour/minute stepper — a text box that silently rejected "8:5" was the old UX. */
function TimeField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const { colors, font, radius, isRTL } = useTheme();
  const [h, m] = value.split(':').map((x) => Number(x) || 0);

  const bump = (dh: number, dm: number) => {
    let nh = h + dh;
    let nm = m + dm;
    if (nm < 0) { nm = 45; nh -= 1; }
    if (nm > 59) { nm = 15; nh += 1; }
    nh = (nh + 24) % 24;
    onChange(`${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`);
  };

  const Stepper = ({ dir }: { dir: 1 | -1 }) => (
    <TouchableOpacity
      onPress={() => bump(dir, 0)}
      accessibilityRole="button"
      accessibilityLabel={dir === 1 ? 'Later' : 'Earlier'}
      style={[styles.stepBtn, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, borderRadius: radius.md }]}
    >
      <Icon name={dir === 1 ? 'chevronRight' : 'chevronLeft'} size={16} color={colors.text} style={{ transform: [{ rotate: dir === 1 ? '-90deg' : '90deg' }] }} />
    </TouchableOpacity>
  );

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[font.label, { color: colors.textSecondary, marginBottom: 6, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 }}>
        <Stepper dir={-1} />
        <View style={[styles.timeDisplay, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: radius.md }]}>
          <Text style={[styles.timeText, { color: colors.text }]}>{formatTime(value)}</Text>
        </View>
        <Stepper dir={1} />
        <TouchableOpacity
          onPress={() => bump(0, 15)}
          style={[styles.quickBtn, { borderColor: colors.border, borderRadius: radius.pill }]}
          accessibilityRole="button"
        >
          <Text style={[font.caption, { color: colors.primary, fontWeight: '700' }]}>+15</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function RemindersScreen() {
  const { t, isRTL, language } = useLanguage();
  const { colors, font, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ medicationId?: string }>();

  const [selectedMedicationId, setSelectedMedicationId] = useState(params.medicationId || '');
  const [time, setTime] = useState('08:00');
  const [showForm, setShowForm] = useState(!params.medicationId);
  const [notice, setNotice] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => api.get('/reminders'),
  });

  const { data: medsData } = useQuery({
    queryKey: ['medications'],
    queryFn: () => api.get('/medications'),
  });

  const medications: Medication[] = medsData?.medications || [];
  const reminders: Reminder[] = data?.reminders || [];

  const selectedMedication = useMemo(
    () => medications.find((m) => (m.id || m.$id) === selectedMedicationId),
    [medications, selectedMedicationId],
  );

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/reminders', {
        medicationId: selectedMedicationId,
        medicationName: selectedMedication?.name || '',
        time,
        frequency: 'daily',
      }),
    onSuccess: async (res) => {
      const reminder = res.reminder;
      // Permission used to be requested inside scheduleMedicationReminder with no
      // feedback — if the user declined, the reminder saved but never fired, and
      // nothing told them their medication schedule was silently broken.
      const granted = await ensureNotificationPermissions();
      if (granted) {
        await scheduleMedicationReminder({
          id: reminder.id || reminder.$id,
          time: reminder.time,
          language,
          medication: selectedMedication ? { name: selectedMedication.name, dosage: selectedMedication.dosage } : reminder.medication,
        });
      } else {
        setNotice(
          language === 'ar'
            ? 'تم الحفظ، لكن لن يصلك تنبيه لأن إذن الإشعارات مرفوض. فعّله من إعدادات النظام.'
            : 'Saved, but you will not get a notification — enable notifications in system settings.',
        );
      }
      setSelectedMedicationId('');
      setTime('08:00');
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ['reminders'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await api.patch(`/reminders/${id}`, { isActive: active });
      if (active) {
        const granted = await ensureNotificationPermissions();
        const r = reminders.find((x) => (x.id || x.$id) === id);
        if (granted && r) {
          await scheduleMedicationReminder({
            id,
            time: r.time,
            language,
            medication: r.medication ? { name: r.medication.name, dosage: r.medication.dosage } : null,
          });
        }
      } else {
        await cancelMedicationReminder(id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reminders'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const logMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'taken' | 'missed' }) =>
      api.post(`/reminders/${id}/complete`, { status }),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ['reminders'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setNotice(
        vars.status === 'taken'
          ? language === 'ar' ? 'تم تسجيل الجرعة ✓' : 'Dose logged'
          : language === 'ar' ? 'تم تسجيل التخطي' : 'Marked as missed',
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/reminders/${id}`);
      await cancelMedicationReminder(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reminders'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const submit = async () => {
    if (!selectedMedicationId) {
      Alert.alert(t('error'), t('selectMedication'));
      return;
    }
    if (!/^\d{1,2}:\d{2}$/.test(time)) {
      Alert.alert(t('error'), t('invalidTime'));
      return;
    }
    createMutation.mutate();
  };

  const sorted = useMemo(
    () => [...reminders].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)),
    [reminders],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={t('reminders')}
        subtitle={`${reminders.filter((r) => r.isActive !== false).length} ${t('active')}`}
        right={
          medications.length > 0 ? (
            <Button
              title={t('addReminder')}
              onPress={() => setShowForm((v) => !v)}
              fullWidth={false}
              size="sm"
              icon="plus"
              style={{ paddingHorizontal: 12, height: 38 }}
            />
          ) : undefined
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {notice ? (
          <View style={[styles.notice, { backgroundColor: colors.warningSoft, borderColor: colors.border, borderRadius: radius.lg }]}>
            <Icon name="alert" size={16} color={colors.onWarningSoft} />
            <Text style={[font.caption, { color: colors.onWarningSoft, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>{notice}</Text>
            <TouchableOpacity onPress={() => setNotice(null)} accessibilityLabel="Dismiss" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="close" size={15} color={colors.onWarningSoft} />
            </TouchableOpacity>
          </View>
        ) : null}

        {showForm && medications.length > 0 ? (
          <Card elevation="none" style={{ marginBottom: spacing.lg }} accent="primary">
            <Text style={[font.subtitle, { color: colors.text, marginBottom: 12, textAlign: isRTL ? 'right' : 'left' }]}>
              {t('addReminder')}
            </Text>

            <Text style={[font.label, { color: colors.textSecondary, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }]}>
              {t('selectMedication')}
            </Text>
            <View style={styles.chips}>
              {medications.map((med) => {
                const id = med.id || med.$id;
                const on = selectedMedicationId === id;
                return (
                  <TouchableOpacity
                    key={id}
                    onPress={() => setSelectedMedicationId(id)}
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
                    <Text style={[font.caption, { color: on ? colors.onPrimarySoft : colors.textSecondary, fontWeight: on ? '700' : '500' }]} numberOfLines={1}>
                      {med.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TimeField label={t('time')} value={time} onChange={setTime} />

            <Button title={t('save')} onPress={submit} loading={createMutation.isPending} icon="check" />
            {createMutation.isError ? <View style={{ marginTop: 10 }}><ErrorState error={createMutation.error} compact /></View> : null}
          </Card>
        ) : null}

        {isLoading ? (
          <SkeletonCard count={3} />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : sorted.length === 0 ? (
          <EmptyState
            icon="reminders"
            title={t('noResults')}
            description={medications.length === 0 ? t('noMedicationsDesc') : t('noDosesToday')}
            actionLabel={medications.length === 0 ? t('addFirstMedication') : t('addReminder')}
            onAction={() => (medications.length === 0 ? router.push('/(app)/medications/add') : setShowForm(true))}
          />
        ) : (
          sorted.map((r) => {
            const id = r.id || r.$id || '';
            const active = r.isActive !== false;
            const mins = timeToMinutes(r.time);
            const upcoming = active && mins >= nowMin;

            return (
              <Card
                key={id}
                elevation="none"
                accent={active ? (upcoming ? 'primary' : undefined) : undefined}
                style={{ marginBottom: 10, padding: 14, opacity: active ? 1 : 0.62 }}
              >
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.timeBox, { backgroundColor: active ? colors.primarySoft : colors.surfaceMuted, borderRadius: radius.md }]}>
                    <Text style={[font.subtitle, { color: active ? colors.onPrimarySoft : colors.textMuted }]}>
                      {formatTime(r.time)}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[font.subtitle, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
                      {r.medication?.name || t('medications')}
                    </Text>
                    <Text style={[font.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                      {r.frequency === 'weekly' ? t('daysOfWeek') : t('daily')}
                      {r.medication?.dosage ? ` · ${r.medication.dosage}` : ''}
                    </Text>
                  </View>

                  <Switch
                    value={active}
                    onValueChange={(v) => toggleMutation.mutate({ id, active: v })}
                    accessibilityLabel={t('status')}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.surfaceRaised}
                    ios_backgroundColor={colors.border}
                  />
                </View>

                {active ? (
                  <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8, marginTop: 12 }}>
                    <Button
                      title={t('markTaken')}
                      onPress={() => logMutation.mutate({ id, status: 'taken' })}
                      variant="soft"
                      size="sm"
                      icon="check"
                      style={{ flex: 1 }}
                    />
                    <Button
                      title={t('markSkipped')}
                      onPress={() => logMutation.mutate({ id, status: 'missed' })}
                      variant="outline"
                      size="sm"
                      icon="close"
                      style={{ flex: 1 }}
                    />
                    <TouchableOpacity
                      onPress={() =>
                        Alert.alert(t('delete'), t('deleteConfirmation'), [
                          { text: t('cancel'), style: 'cancel' },
                          { text: t('delete'), style: 'destructive', onPress: () => deleteMutation.mutate(id) },
                        ])
                      }
                      accessibilityRole="button"
                      accessibilityLabel={t('delete')}
                      style={[styles.delBtn, { borderColor: colors.border, borderRadius: radius.md }]}
                    >
                      <Icon name="delete" size={16} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 13,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 14,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderWidth: 1, maxWidth: '100%' },
  timeBox: { minWidth: 62, alignItems: 'center', paddingVertical: 9, paddingHorizontal: 10 },
  timeDisplay: { borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
  timeText: { fontSize: 19, fontWeight: '800', fontVariant: ['tabular-nums'] },
  stepBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  quickBtn: { borderWidth: 1, paddingHorizontal: 11, paddingVertical: 7 },
  delBtn: { borderWidth: 1, width: 38, alignItems: 'center', justifyContent: 'center' },
});
