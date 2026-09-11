import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authService } from '../src/services/auth';
import { useLanguage } from '../src/contexts/LanguageContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { Input } from '../src/components/Input';
import { Button } from '../src/components/Button';
import { Icon } from '../src/components/Icon';
import { ErrorState } from '../src/components/ErrorState';

export default function ResetPasswordScreen() {
  const { userId, secret } = useLocalSearchParams<{ userId?: string; secret?: string }>();
  const { t, isRTL } = useLanguage();
  const { colors, font, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Appwrite recovery emails carry userId + secret as query params. Without both
  // there is nothing to reset — the old screen asked for an email and a numeric
  // "code" that Appwrite never sends, so this flow could never succeed.
  const linkValid = !!userId && !!secret;

  const submit = async () => {
    if (newPassword.length < 8) {
      setError(isRTL ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirm) {
      setError(isRTL ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authService.resetPassword(userId!, secret!, newPassword);
      router.replace('/login');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(/expired|invalid/i.test(msg)
        ? isRTL ? 'انتهت صلاحية الرابط — اطلب رابطًا جديدًا.' : 'This link has expired — request a new one.'
        : msg || t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 48, paddingHorizontal: spacing.xl }]} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('back')} style={styles.backBtn}>
          <Icon name={isRTL ? 'chevronRight' : 'chevronLeft'} size={22} color={colors.text} />
        </TouchableOpacity>

        <Text style={[font.micro, { color: colors.primary, marginBottom: 6 }]}>{t('appName').toUpperCase()}</Text>
        <Text style={[font.display, { color: colors.text, marginBottom: 8, textAlign: isRTL ? 'right' : 'left' }]}>
          {t('newPassword')}
        </Text>

        {!linkValid ? (
          <>
            <View style={[styles.sentCard, { backgroundColor: colors.warningSoft, borderColor: colors.border, borderRadius: radius.lg }]}>
              <Icon name="alert" size={20} color={colors.onWarningSoft} />
              <Text style={[font.body, { color: colors.onWarningSoft, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>
                {isRTL
                  ? 'هذه الصفحة تحتاج فتحها من رابط إعادة التعيين المرسل إلى بريدك.'
                  : 'This page needs to be opened from the reset link sent to your email.'}
              </Text>
            </View>
            <Button title={t('forgotPassword')} onPress={() => router.replace('/forgot-password')} icon="email" />
          </>
        ) : (
          <>
            <Input
              label={t('newPassword')}
              value={newPassword}
              onChangeText={(v) => { setNewPassword(v); setError(''); }}
              icon="lock"
              secure
              autoCapitalize="none"
              hint={isRTL ? '8 أحرف على الأقل' : 'At least 8 characters'}
            />
            <Input
              label={t('confirmPassword')}
              value={confirm}
              onChangeText={(v) => { setConfirm(v); setError(''); }}
              icon="lock"
              secure
              autoCapitalize="none"
              error={error || undefined}
            />
            {error ? <View style={{ marginBottom: 14 }}><ErrorState error={error} compact /></View> : null}
            <Button title={t('submit')} onPress={submit} loading={loading} icon="check" />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingBottom: 48 },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', marginLeft: -8, marginBottom: 10 },
  sentCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 15, borderWidth: StyleSheet.hairlineWidth, marginBottom: 18 },
});
