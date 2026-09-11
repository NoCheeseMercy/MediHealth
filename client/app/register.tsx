import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/contexts/AuthContext';
import { useLanguage } from '../src/contexts/LanguageContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { Input } from '../src/components/Input';
import { Button } from '../src/components/Button';
import { Icon } from '../src/components/Icon';
import { ErrorState } from '../src/components/ErrorState';

export default function RegisterScreen() {
  const { register } = useAuth();
  const { t, isRTL, language } = useLanguage();
  const { colors, font, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const score = (p: string) => {
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p)) s++;
    if (/[0-9]/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = language === 'ar' ? 'الاسم مطلوب' : 'Name is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      e.email = language === 'ar' ? 'بريد إلكتروني غير صالح' : 'Enter a valid email address';
    if (password.length < 8) e.password = language === 'ar' ? '8 أحرف على الأقل' : 'At least 8 characters';
    if (password !== confirm) e.confirm = language === 'ar' ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match';
    setErrors(e);
    setSubmitError('');
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await register(email.trim(), password, fullName.trim(), language);
      router.replace('/(app)');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      // An "email taken" failure belongs next to the email field; anything else
      // (offline, quota, server) is a whole-form error.
      if (/existing|user.*exists|duPLICATE|مستخدم/i.test(msg)) {
        setErrors((prev) => ({ ...prev, email: language === 'ar' ? 'هذا البريد مسجّل بالفعل' : 'This email is already registered' }));
      } else {
        setSubmitError(/network|fetch|timeout/i.test(msg) ? t('connectionHelp') : msg || t('error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const clear = (k: string) => setErrors((e) => ({ ...e, [k]: '' }));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 40, paddingHorizontal: spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[font.micro, { color: colors.primary, marginBottom: 6 }]}>{t('appName').toUpperCase()}</Text>
        <Text style={[font.display, { color: colors.text, marginBottom: 6, textAlign: isRTL ? 'right' : 'left' }]}>
          {t('register')}
        </Text>
        <Text style={[font.caption, { color: colors.textSecondary, marginBottom: 26, textAlign: isRTL ? 'right' : 'left' }]}>
          {t('welcomeSubtitle')}
        </Text>

        <Input label={t('fullName')} value={fullName} onChangeText={(v) => { setFullName(v); clear('fullName'); }} icon="profile" autoCapitalize="words" error={errors.fullName} />
        <Input label={t('email')} value={email} onChangeText={(v) => { setEmail(v); clear('email'); }} icon="email" keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={errors.email} />
        <Input label={t('password')} value={password} onChangeText={(v) => { setPassword(v); clear('password'); }} icon="lock" secure autoCapitalize="none" error={errors.password} />

        {password ? (
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 5, marginTop: -8, marginBottom: 16 }}>
            {[1, 2, 3, 4].map((i) => {
              const filled = score(password) >= i;
              const tone = i <= 2 ? colors.danger : i === 3 ? colors.warning : colors.success;
              return <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: filled ? tone : colors.border }} />;
            })}
          </View>
        ) : null}

        <Input label={t('confirmPassword')} value={confirm} onChangeText={(v) => { setConfirm(v); clear('confirm'); }} icon="lock" secure autoCapitalize="none" error={errors.confirm} />

        {/* Field-level errors above; this catches transport/quota failures. */}
        {submitError ? (
          <View style={{ marginBottom: 14 }}>
            <ErrorState error={submitError} compact />
          </View>
        ) : null}

        <Button title={t('signUp')} onPress={handleRegister} loading={loading} icon="check" />

        <View style={[styles.footer, { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'center' }]}>
          <Text style={[font.body, { color: colors.textSecondary }]}>{t('hasAccount')} </Text>
          <Link href="/login">
            <Text style={[font.body, { color: colors.primary, fontWeight: '800' }]}>{t('signIn')}</Text>
          </Link>
        </View>

        <View style={[styles.note, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: radius.lg }]}>
          <Icon name="shield" size={15} color={colors.textSecondary} />
          <Text style={[font.caption, { color: colors.textSecondary, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>
            {language === 'ar'
              ? 'تُحفظ بياناتك في حسابك ولا تُشارك مع أي طرف آخر.'
              : 'Your data stays in your own account and is not shared with anyone else.'}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingBottom: 48 },
  footer: { alignItems: 'center', marginTop: 22 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, padding: 13, borderWidth: StyleSheet.hairlineWidth, marginTop: 26 },
});
