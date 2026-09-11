import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/contexts/AuthContext';
import { useLanguage } from '../src/contexts/LanguageContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { Input } from '../src/components/Input';
import { Button } from '../src/components/Button';
import { ErrorState } from '../src/components/ErrorState';

export default function LoginScreen() {
  const { login } = useAuth();
  const { t, isRTL } = useLanguage();
  const { colors, font, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError(isRTL ? 'أدخل البريد الإلكتروني وكلمة المرور' : 'Enter your email and password');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/(app)');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(
        /password|Invalid|401|wrong/i.test(msg)
          ? isRTL ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' : 'Incorrect email or password'
          : /network|Failed to fetch|timeout|abort/i.test(msg)
            ? t('connectionHelp')
            : msg || t('error'),
      );
    } finally {
      setLoading(false);
    }
  };

  const enterDemo = async () => {
    setError('');
    setLoading(true);
    try {
      await login('demo@medihealth.app', 'Demo123!');
      router.replace('/(app)');
    } catch (e) {
      Alert.alert(t('error'), e instanceof Error ? e.message : 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <LinearGradient
          colors={[colors.heroFrom, colors.heroTo]}
          style={[styles.header, { paddingTop: insets.top + 46 }]}
        >
          <View style={styles.logoMark}>
            <Ionicons name="medkit" size={30} color="#FFF" />
          </View>
          <Text style={styles.appName}>{t('appName')}</Text>
          <Text style={styles.tagline}>{t('tagline')}</Text>
        </LinearGradient>

        <View style={[styles.form, { paddingHorizontal: spacing.xl }]}>
          <Text style={[font.title, { color: colors.text, marginBottom: spacing.lg, textAlign: isRTL ? 'right' : 'left' }]}>
            {t('signIn')}
          </Text>

          <Input
            label={t('email')}
            value={email}
            onChangeText={(v) => { setEmail(v); setError(''); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            icon="email"
            placeholder="email@example.com"
          />
          <Input
            label={t('password')}
            value={password}
            onChangeText={(v) => { setPassword(v); setError(''); }}
            secure
            icon="lock"
            autoComplete="password"
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />

          {error ? <View style={{ marginBottom: 14 }}><ErrorState error={error} compact /></View> : null}

          <Button title={t('signIn')} onPress={handleLogin} loading={loading} icon="logout" />

          <Link href="/forgot-password" asChild>
            <TouchableOpacity style={{ alignItems: 'center', marginTop: 14 }} accessibilityRole="link">
              <Text style={[font.caption, { color: colors.primary, fontWeight: '700' }]}>{t('forgotPassword')}</Text>
            </TouchableOpacity>
          </Link>

          <View style={[styles.divider, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={[styles.line, { backgroundColor: colors.border }]} />
            <Text style={[font.caption, { color: colors.textMuted, marginHorizontal: 12 }]}>{t('or')}</Text>
            <View style={[styles.line, { backgroundColor: colors.border }]} />
          </View>

          {/* Demo entry kept, but demoted to a quiet text button — a pre-filled
              shared account is a demo affordance, not the primary path. */}
          <TouchableOpacity onPress={enterDemo} accessibilityRole="button" style={{ alignItems: 'center' }}>
            <Text style={[font.caption, { color: colors.textSecondary, fontWeight: '700' }]}>
              {t('enterDemo')} · {t('demoSubtitle')}
            </Text>
          </TouchableOpacity>

          <View style={[styles.footer, { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'center' }]}>
            <Text style={[font.body, { color: colors.textSecondary }]}>{t('noAccount')} </Text>
            <Link href="/register">
              <Text style={[font.body, { color: colors.primary, fontWeight: '800' }]}>{t('signUp')}</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },
  header: {
    paddingBottom: 42,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  logoMark: {
    width: 62,
    height: 62,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  appName: { fontSize: 30, fontWeight: '800', color: '#FFF', letterSpacing: -0.8 },
  tagline: { fontSize: 14.5, color: 'rgba(255,255,255,0.85)', marginTop: 6 },
  form: { paddingTop: 28 },
  divider: { alignItems: 'center', marginVertical: 22 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  footer: { alignItems: 'center' },
});
