import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMutation } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Input } from '../../src/components/Input';
import { Icon } from '../../src/components/Icon';
import { Badge } from '../../src/components/Badge';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ErrorState } from '../../src/components/ErrorState';

type Detected = { name: string; dosage?: string; activeIngredient?: string };

export default function ScannerScreen() {
  const { t, isRTL, language } = useLanguage();
  const { colors, font, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const [image, setImage] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState('');
  const [notes, setNotes] = useState('');
  const [detected, setDetected] = useState<Detected[]>([]);
  const [showFullImage, setShowFullImage] = useState(false);

  const pickImage = async (useCamera: boolean) => {
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!perm.granted) {
      Alert.alert(
        t('permissionRequired'),
        useCamera
          ? language === 'ar'
            ? 'امنح التطبيق إذن الكاميرا من إعدادات النظام لمسح الأدوية.'
            : 'Grant camera access in system settings to scan medications.'
          : language === 'ar'
            ? 'امنح التطبيق إذن الصور من إعدادات النظام.'
            : 'Grant photo access in system settings.',
      );
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });

    if (!result.canceled && result.assets[0]?.base64) {
      setImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
      setDetected([]);
    }
  };

  const clear = () => {
    setImage(null);
    setDetected([]);
  };

  const extractMutation = useMutation({
    mutationFn: () => api.post('/scan/extract', { imageData: image }),
    onSuccess: (data) => {
      const meds: Detected[] = data.medications || [];
      setDetected(meds);
      if (meds.length === 0) {
        Alert.alert(t('noResults'), language === 'ar' ? 'لم يتم التعرف على أدوية — جرّب صورة أوضح.' : 'No medications recognized — try a sharper photo.');
      }
    },
  });

  const scanMutation = useMutation({
    mutationFn: () => api.post('/scan/analyze', { imageData: image, symptoms, notes, language }),
    onSuccess: (data) => {
      router.push({
        pathname: '/(app)/analysis/[id]',
        params: { id: data.report.id, result: JSON.stringify(data.result) },
      });
    },
  });

  const busy = extractMutation.isPending || scanMutation.isPending;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader title={t('scanMedication')} subtitle={t('onboarding2Desc')} />

      <View style={{ padding: spacing.xl, paddingTop: spacing.sm }}>
        {/* ── Capture zone ─────────────────────────────────────── */}
        {!image ? (
          <TouchableOpacity
            onPress={() => pickImage(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('takePhoto')}
            style={[
              styles.dropzone,
              { borderColor: colors.borderStrong, borderRadius: radius.xl, backgroundColor: colors.surface },
            ]}
          >
            <View style={[styles.dropIcon, { backgroundColor: colors.primarySoft, borderRadius: radius.lg }]}>
              <Icon name="camera" size={30} color={colors.onPrimarySoft} />
            </View>
            <Text style={[font.title, { color: colors.text, marginTop: 14, textAlign: 'center' }]}>{t('takePhoto')}</Text>
            <Text style={[font.caption, { color: colors.textSecondary, marginTop: 6, textAlign: 'center', paddingHorizontal: 20 }]}>
              {language === 'ar' ? 'وجّه الكاميرا إلى علبة الدواء أو الوصفة' : 'Point at a medicine box or prescription'}
            </Text>
          </TouchableOpacity>
        ) : (
          <Card padded={false} style={{ overflow: 'hidden', marginBottom: spacing.lg }}>
            <View style={{ position: 'relative' }}>
              <Image
                source={{ uri: image }}
                style={{ width: '100%', height: showFullImage ? 420 : 220 }}
                resizeMode={showFullImage ? 'contain' : 'cover'}
              />
              <TouchableOpacity
                onPress={() => setShowFullImage((v) => !v)}
                accessibilityRole="button"
                style={[styles.zoomPill, { backgroundColor: colors.overlay, borderRadius: radius.pill }]}
              >
                <Icon name="search" size={14} color="#FFF" />
                <Text style={styles.zoomText}>{showFullImage ? (language === 'ar' ? 'تصغير' : 'Shrink') : language === 'ar' ? 'تكبير' : 'Zoom'}</Text>
              </TouchableOpacity>
            </View>

            <View style={{ padding: 14, flexDirection: isRTL ? 'row-reverse' : 'row', gap: 8 }}>
              <Button title={t('takePhoto')} onPress={() => pickImage(true)} variant="outline" size="sm" style={{ flex: 1 }} fullWidth={false} icon="camera" />
              <Button title={t('uploadImage')} onPress={() => pickImage(false)} variant="ghost" size="sm" style={{ flex: 1 }} fullWidth={false} icon="gallery" />
              <TouchableOpacity
                onPress={clear}
                accessibilityRole="button"
                accessibilityLabel={t('delete')}
                style={[styles.iconBtn, { borderColor: colors.border, borderRadius: radius.md }]}
              >
                <Icon name="delete" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* ── Detected medications ─────────────────────────────── */}
        {detected.length > 0 ? (
          <Card style={{ marginBottom: spacing.lg }} accent="primary">
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Icon name="check" size={17} color={colors.primary} />
              <Text style={[font.subtitle, { color: colors.text, flex: 1 }]}>{t('detectedMedications')}</Text>
              <Badge label={`${detected.length}`} tone="primary" size="sm" />
            </View>
            {detected.map((m, i) => (
              <View
                key={`${m.name}-${i}`}
                style={[styles.detectedRow, { borderBottomColor: colors.border }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[font.body, { color: colors.text, fontWeight: '700' }]}>{m.name}</Text>
                  {m.dosage || m.activeIngredient ? (
                    <Text style={[font.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                      {[m.dosage, m.activeIngredient].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </View>
                <Icon name="medication" size={17} color={colors.textMuted} />
              </View>
            ))}
          </Card>
        ) : null}

        {image && detected.length === 0 && !extractMutation.isPending ? (
          <Text style={[font.caption, { color: colors.textMuted, textAlign: isRTL ? 'right' : 'left', marginBottom: spacing.md }]}>
            {language === 'ar'
              ? 'اضغط «تعرّف» لقراءة الأدوية من الصورة قبل التحليل.'
              : 'Tap "Identify medications" to read the medications from the photo before analyzing.'}
          </Text>
        ) : null}

        {/* ── Optional context ─────────────────────────────────── */}
        <Input
          label={language === 'ar' ? 'الأعراض (اختياري)' : 'Symptoms (optional)'}
          value={symptoms}
          onChangeText={setSymptoms}
          icon="heart"
          multiline
          placeholder={language === 'ar' ? 'دوخة، غثيان...' : 'Dizziness, nausea...'}
        />
        <Input
          label={t('notes')}
          value={notes}
          onChangeText={setNotes}
          icon="notes"
          multiline
          placeholder={language === 'ar' ? 'ملاحظات إضافية...' : 'Additional notes...'}
        />

        {/* ── Actions ──────────────────────────────────────────── */}
        {extractMutation.isError ? <ErrorState error={extractMutation.error} compact /> : null}
        {scanMutation.isError ? <ErrorState error={scanMutation.error} compact /> : null}

        {image ? (
          <View style={{ gap: 10 }}>
            <Button
              title={extractMutation.isPending ? t('analyzing') : t('scanIdentify')}
              onPress={() => extractMutation.mutate()}
              variant="soft"
              icon="search"
              loading={extractMutation.isPending}
            />
            <Button
              title={scanMutation.isPending ? t('analyzing') : t('runAnalysis')}
              onPress={() => scanMutation.mutate()}
              loading={scanMutation.isPending}
              disabled={busy && !scanMutation.isPending}
              icon="bulb"
            />
          </View>
        ) : (
          <Button
            title={t('uploadImage')}
            onPress={() => pickImage(false)}
            variant="outline"
            icon="gallery"
          />
        )}

        <TouchableOpacity onPress={() => router.push('/(app)/history')} style={{ marginTop: spacing.xl }} accessibilityRole="link">
          <Text style={{ color: colors.primary, textAlign: 'center', fontWeight: '700', fontSize: 14 }}>
            {t('analysisHistory')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dropzone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  dropIcon: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  zoomPill: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  zoomText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  iconBtn: {
    borderWidth: 1,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
