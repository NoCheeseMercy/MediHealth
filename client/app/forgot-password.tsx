import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '../src/contexts/LanguageContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { Input } from '../src/components/Input';
import { Button } from '../src/components/Button';
import { Icon } from '../src/components/Icon';
import { ErrorState } from '../src/components/ErrorState';

export default function ForgotPasswordScreen() {
  const { t, isRTL } = useLanguage();
  const { colors, font, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(isRTL ? 'أدخل بريدًا إلكترونيًا صالحًا' : 'Enter a valid email address');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { authService } = await import('../src/services/auth');
      await authService.forgotPassword(email.trim());
      setSent(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(/network|fetch|timeout/i.test(msg) ? t('connectionHelp') : msg || t('error'));
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
          {t('forgotPassword')}
        </Text>
        <Text style={[font.body, { color: colors.textSecondary, marginBottom: 26, textAlign: isRTL ? 'right' : 'left' }]}>
          {isRTL
            ? 'أدخل بريدك وسنرسل رابط إعادة تعيين كلمة المرور.'
            : 'Enter your email and we will send a password reset link.'}
        </Text>

        {sent ? (
          <View style={[styles.sentCard, { backgroundColor: colors.successSoft, borderColor: colors.border, borderRadius: radius.lg }]}>
            <Icon name="check" size={22} color={colors.onSuccessSoft} />
            <Text style={[font.body, { color: colors.onSuccessSoft, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>
              {isRTL
                ? 'إذا كان الحساب موجودًا، فسيصلك بريد يحتوي رابط إعادة التعيين. افتحه على هذا الجهاز لإكمال العملية.'
                : 'If an account exists, a reset link is on its way. Open it on this device to finish.'}
            </Text>
          </View>
        ) : null}

        <Input
          label={t('email')}
          value={email}
          onChangeText={(v) => { setEmail(v); setError(''); }}
          icon="email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          error={error && /بريد|email/i.test(error) ? error : undefined}
        />

        {error && !/بريد|email/i.test(error) ? (
          <View style={{ marginBottom: 14 }}>
            <ErrorState error={error} compact />
          </View>
        ) : null}

        <Button title={t('submit')} onPress={submit} loading={loading} icon="email" />
        {sent ? (
          <Button title={t('back')} onPress={() => router.back()} variant="ghost" style={{ marginTop: 10 }} />
        ) : null}

        <View style={[styles.footer, { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'center' }]}>
          <Text style={[font.body, { color: colors.textSecondary }]}>{t('hasAccount')} </Text>
          <Link href="/login">
            <Text style={[font.body, { color: colors.primary, fontWeight: '800' }]}>{t('signIn')}</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingBottom: 48 },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', marginLeft: -8, marginBottom: 10 },
  sentCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 15, borderWidth: StyleSheet.hairlineWidth, marginBottom: 18 },
  footer: { alignItems: 'center', marginTop: 24 },
});
