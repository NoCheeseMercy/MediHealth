import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Linking, Platform, Switch } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuth } from '../../src/contexts/AuthContext';
import { authService } from '../../src/services/auth';
import { ensureNotificationPermissions } from '../../src/services/notification';
import { isNarrationEnabled, setNarrationEnabled, deviceNarrationLang } from '../../src/services/narration';
import type { ThemeMode } from '../../src/theme/tokens';
import { Card } from '../../src/components/Card';
import { Icon, type IconName } from '../../src/components/Icon';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Badge } from '../../src/components/Badge';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { ErrorState } from '../../src/components/ErrorState';

function SectionLabel({ children }: { children: string }) {
  const { colors, font, isRTL } = useTheme();
  return (
    <Text style={[font.micro, { color: colors.textMuted, marginBottom: 10, textAlign: isRTL ? 'right' : 'left' }]}>
      {children.toUpperCase()}
    </Text>
  );
}

function OptionPill({
  icon,
  label,
  selected,
  onPress,
}: {
  icon: IconName;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, font, radius, isRTL } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      activeOpacity={0.75}
      style={[
        styles.pill,
        {
          backgroundColor: selected ? colors.primarySoft : colors.surfaceMuted,
          borderColor: selected ? colors.primary : colors.border,
          borderRadius: radius.lg,
          flexDirection: isRTL ? 'row-reverse' : 'row',
        },
      ]}
    >
      <Icon name={icon} size={17} color={selected ? colors.onPrimarySoft : colors.textMuted} />
      <Text style={[font.caption, { color: selected ? colors.onPrimarySoft : colors.textSecondary, fontWeight: selected ? '700' : '500', flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>
        {label}
      </Text>
      {selected ? <Icon name="check" size={15} color={colors.primary} /> : null}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { t, isRTL, language, setLanguage } = useLanguage();
  const { colors, font, radius, spacing, mode, setMode, isDark } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [narrOn, setNarrOn] = useState<boolean | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    isNarrationEnabled().then(setNarrOn);
  }, []);

  const passwordScore = (p: string) => {
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };

  const changePassword = async () => {
    setErr('');
    setDone(false);
    if (!currentPassword || !newPassword) {
      setErr(isRTL ? 'أدخل كلمة المرور الحالية والجديدة' : 'Enter both the current and new password');
      return;
    }
    if (newPassword.length < 8) {
      setErr(isRTL ? 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' : 'New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirm) {
      setErr(isRTL ? 'كلمتا المرور غير متطابقتين' : 'New passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setDone(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      Alert.alert(t('done'), t('passwordChanged'));
    } catch (e) {
      // Appwrite rejects a wrong current password with 401; surface that as a
      // field error instead of a bare "error" toast.
      const msg = e instanceof Error ? e.message : '';
      setErr(
        /password|401|Invalid credentials|Wrong/i.test(msg)
          ? isRTL
            ? 'كلمة المرور الحالية غير صحيحة'
            : 'Current password is incorrect'
          : msg || t('error'),
      );
    } finally {
      setBusy(false);
    }
  };

  const themeOptions: { key: ThemeMode; icon: IconName; label: string }[] = [
    { key: 'light', icon: 'sun', label: t('lightMode') },
    { key: 'dark', icon: 'moon', label: t('darkModeValue') },
    { key: 'system', icon: 'auto', label: t('systemMode') },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t('settings')} />

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {/* ── Appearance ───────────────────────────────────────── */}
        <SectionLabel>{t('darkMode')}</SectionLabel>
        <Card elevation="none" style={{ marginBottom: spacing.xl }}>
          <View style={[styles.pillGroup, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {themeOptions.map((o) => (
              <View key={o.key} style={{ flex: 1 }}>
                <OptionPill icon={o.icon} label={o.label} selected={mode === o.key} onPress={() => setMode(o.key)} />
              </View>
            ))}
          </View>
          <Text style={[font.caption, { color: colors.textMuted, marginTop: 10, textAlign: isRTL ? 'right' : 'left' }]}>
            {mode === 'system'
              ? isRTL
                ? `النظام حاليًا: ${isDark ? 'داكن' : 'فاتح'}`
                : `System is currently ${isDark ? 'dark' : 'light'}`
              : null}
          </Text>
        </Card>

        {/* ── Language ─────────────────────────────────────────── */}
        <SectionLabel>{t('language')}</SectionLabel>
        <Card elevation="none" style={{ marginBottom: spacing.xl }}>
          <View style={[styles.pillGroup, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={{ flex: 1 }}>
              <OptionPill icon="language" label="العربية" selected={language === 'ar'} onPress={() => setLanguage('ar')} />
            </View>
            <View style={{ flex: 1 }}>
              <OptionPill icon="language" label="English" selected={language === 'en'} onPress={() => setLanguage('en')} />
            </View>
          </View>
        </Card>

        {/* ── Narration ────────────────────────────────────────── */}
        <SectionLabel>{t('voiceControl')}</SectionLabel>
        <Card elevation="none" style={{ marginBottom: spacing.xl }}>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={[font.subtitle, { color: colors.text }]}>{t('voiceControl')}</Text>
              <Text style={[font.caption, { color: colors.textSecondary, marginTop: 2, textAlign: isRTL ? 'right' : 'left' }]}>
                {narrOn === null
                  ? '…'
                  : narrOn
                    ? deviceNarrationLang() === 'ar'
                      ? 'مفعّل — يقرأ الجولات بالعربية'
                      : 'On — narrates in English'
                    : deviceNarrationLang() === 'ar'
                      ? 'موقوف'
                      : 'Off'}
              </Text>
            </View>
            <Switch
              value={narrOn === true}
              onValueChange={(v) => {
                setNarrOn(v);
                setNarrationEnabled(v);
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surfaceRaised}
              ios_backgroundColor={colors.border}
            />
          </View>
        </Card>

        {/* ── Notifications ────────────────────────────────────── */}
        <SectionLabel>{t('notifications')}</SectionLabel>
        <Card elevation="none" style={{ marginBottom: spacing.xl }}>
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={[font.subtitle, { color: colors.text }]}>{t('enableNotifications')}</Text>
              <Text style={[font.caption, { color: colors.textSecondary, marginTop: 2, textAlign: isRTL ? 'right' : 'left' }]}>
                {isRTL ? 'ضروري لتذكيرات الجرعات' : 'Required for dose reminders'}
              </Text>
            </View>
            <Button
              title={t('settings')}
              variant="outline"
              size="sm"
              fullWidth={false}
              icon="reminders"
              onPress={async () => {
                const ok = await ensureNotificationPermissions();
                if (!ok && Platform.OS === 'android') Linking.openSettings();
                Alert.alert(
                  t('notifications'),
                  ok
                    ? isRTL ? 'الإشعارات مفعّلة' : 'Notifications are enabled'
                    : isRTL ? 'الإشعارات مرفوضة — فعّلها من إعدادات النظام' : 'Notifications are blocked — enable them in system settings',
                );
              }}
            />
          </View>
        </Card>

        {/* ── Account ──────────────────────────────────────────── */}
        <SectionLabel>{t('changePassword')}</SectionLabel>
        <Card elevation="none" style={{ marginBottom: spacing.xl }}>
          <Input label={t('currentPassword')} value={currentPassword} onChangeText={setCurrentPassword} secure icon="lock" autoCapitalize="none" />
          <Input
            label={t('newPassword')}
            value={newPassword}
            onChangeText={(v) => { setNewPassword(v); setErr(''); }}
            secure
            icon="lock"
            autoCapitalize="none"
            hint={isRTL ? '8 أحرف على الأقل' : 'At least 8 characters'}
          />

          {/* Strength meter — the previous form accepted "1" as a password. */}
          {newPassword ? (
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 5, marginTop: -6, marginBottom: 14 }}>
              {[1, 2, 3, 4].map((i) => {
                const filled = passwordScore(newPassword) >= i;
                const tone = i <= 2 ? colors.danger : i === 3 ? colors.warning : colors.success;
                return (
                  <View
                    key={i}
                    style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: filled ? tone : colors.border }}
                  />
                );
              })}
            </View>
          ) : null}

          <Input label={t('confirmPassword')} value={confirm} onChangeText={(v) => { setConfirm(v); setErr(''); }} secure icon="lock" autoCapitalize="none" />

          {err ? <View style={{ marginBottom: 12 }}><ErrorState error={err} compact /></View> : null}
          {done && !err ? (
            <Badge label={t('passwordChanged')} tone="success" icon="check" size="sm" style={{ marginBottom: 12 }} />
          ) : null}

          <Button title={t('saveChanges')} onPress={changePassword} loading={busy} icon="check" />
        </Card>

        {/* ── About ────────────────────────────────────────────── */}
        <Card elevation="none">
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <Icon name="heart" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[font.subtitle, { color: colors.text }]}>{t('appName')} AI</Text>
              <Text style={[font.caption, { color: colors.textMuted }]}>v1.0.0</Text>
            </View>
          </View>
          <Text style={[font.caption, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left', lineHeight: 20 }]}>
            {t('disclaimerText')}
          </Text>
          <Text style={[font.caption, { color: colors.onPrimarySoft, fontWeight: '700', marginTop: 8, textAlign: isRTL ? 'right' : 'left' }]}>
            {t('confirmWithPharmacist')}
          </Text>
        </Card>

        <Button title={t('back')} onPress={() => router.back()} variant="ghost" icon={isRTL ? 'chevronRight' : 'chevronLeft'} style={{ marginTop: spacing.lg }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pillGroup: { gap: 8 },
  pill: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    alignItems: 'center',
    gap: 8,
  },
});
