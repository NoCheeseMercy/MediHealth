import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { Card } from '../../src/components/Card';
import { Icon, type IconName } from '../../src/components/Icon';
import { Badge } from '../../src/components/Badge';
import { Button } from '../../src/components/Button';
import { ScreenHeader } from '../../src/components/ScreenHeader';
import { SafetyScoreBadge } from '../../src/components/SafetyScoreBadge';
import { initials } from '../../src/utils/format';

function MenuRow({
  icon,
  label,
  hint,
  onPress,
  danger,
  chevron = true,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  onPress: () => void;
  danger?: boolean;
  chevron?: boolean;
}) {
  const { colors, font, isRTL, spacing } = useTheme();
  const fg = danger ? colors.danger : colors.text;
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.7}
      style={[styles.row, { flexDirection: isRTL ? 'row-reverse' : 'row', paddingVertical: spacing.md }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: danger ? colors.dangerSoft : colors.surfaceMuted }]}>
        <Icon name={icon} size={17} color={danger ? colors.onDangerSoft : colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[font.subtitle, { color: fg, textAlign: isRTL ? 'right' : 'left' }]}>{label}</Text>
        {hint ? (
          <Text style={[font.caption, { color: colors.textMuted, marginTop: 1, textAlign: isRTL ? 'right' : 'left' }]} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
      {chevron ? <Icon name={isRTL ? 'chevronLeft' : 'chevronRight'} size={18} color={colors.textMuted} /> : null}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { t, isRTL } = useLanguage();
  const { colors, font, radius, spacing, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const { data } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get('/profile/dashboard') });
  const meds: any[] = data?.activeMedications || [];
  const analyses: any[] = data?.recentAnalyses || [];
  const rawScore = data?.safetyScore;
  const score: number | null = typeof rawScore === 'number' && Number.isFinite(rawScore) ? rawScore : null;

  const isDemo = user?.email === 'demo@medihealth.app';

  const handleLogout = () => {
    Alert.alert(t('logout'), isRTL ? 'هل تريد تسجيل الخروج؟' : 'Are you sure you want to log out?', [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('logout'),
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t('profile')} />

      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.sm, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {/* ── Identity card ────────────────────────────────────── */}
        <Card elevation="none" style={{ alignItems: 'center', paddingVertical: 24, marginBottom: 12 }}>
          <View style={[styles.avatar, { backgroundColor: colors.primary, borderRadius: radius.pill }]}>
            <Text style={styles.avatarText}>{initials(user?.fullName)}</Text>
          </View>
          <Text style={[styles.name, { color: colors.text, textAlign: isRTL ? 'right' : 'center' }]} numberOfLines={1}>
            {user?.fullName || t('profile')}
          </Text>
          <Text style={[font.caption, { color: colors.textSecondary, marginTop: 4, textAlign: isRTL ? 'right' : 'center' }]} numberOfLines={1}>
            {user?.email}
          </Text>
          {isDemo ? <Badge label={t('demoNote')} tone="info" icon="bookmark" size="sm" style={{ marginTop: 10 }} /> : null}

          {/* Counts, so the profile says something about the account rather than
              being only a logout button. */}
          <View style={[styles.stats, { flexDirection: isRTL ? 'row-reverse' : 'row', marginTop: 18, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <View style={styles.stat}>
              <Text style={[font.title, { color: colors.text }]}>{meds.length}</Text>
              <Text style={[font.micro, { color: colors.textMuted, marginTop: 2 }]}>{t('medications').toUpperCase()}</Text>
            </View>
            <View style={[styles.dividerV, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[font.title, { color: colors.text }]}>{analyses.length}</Text>
              <Text style={[font.micro, { color: colors.textMuted, marginTop: 2 }]}>{t('analysisHistory').toUpperCase()}</Text>
            </View>
            <View style={[styles.dividerV, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <SafetyScoreBadge score={score} size="sm" compact />
            </View>
          </View>
        </Card>

        {/* ── Navigation ───────────────────────────────────────── */}
        <Card elevation="none" style={{ marginBottom: 12, paddingVertical: 4 }}>
          <MenuRow icon="medications" label={t('medications')} hint={`${meds.length}`} onPress={() => router.push('/(app)/medications')} />
          <View style={[styles.sep, { backgroundColor: colors.border }]} />
          <MenuRow icon="reminders" label={t('reminders')} onPress={() => router.push('/(app)/reminders')} />
          <View style={[styles.sep, { backgroundColor: colors.border }]} />
          <MenuRow icon="history" label={t('analysisHistory')} hint={`${analyses.length}`} onPress={() => router.push('/(app)/history')} />
          <View style={[styles.sep, { backgroundColor: colors.border }]} />
          <MenuRow icon="scan" label={t('scanMedication')} onPress={() => router.push('/(app)/scanner')} />
        </Card>

        <Card elevation="none" style={{ marginBottom: spacing.xl, paddingVertical: 4 }}>
          <MenuRow icon="settings" label={t('settings')} hint={isDark ? t('darkModeValue') : t('lightMode')} onPress={() => router.push('/(app)/settings')} />
        </Card>

        {/* ── Medical disclaimer, always visible ───────────────── */}
        <View style={[styles.disclaimer, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: radius.lg }]}>
          <Icon name="stethoscope" size={16} color={colors.textSecondary} />
          <Text style={[font.caption, { color: colors.textSecondary, flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>
            {t('disclaimerText')}
          </Text>
        </View>

        <Button title={t('logout')} onPress={handleLogout} variant="danger" icon="logout" style={{ marginTop: spacing.lg }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 74, height: 74, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 27, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  name: { fontSize: 21, fontWeight: '800', marginTop: 14, letterSpacing: -0.4 },
  stats: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'space-around' },
  stat: { alignItems: 'center', flex: 1 },
  dividerV: { width: StyleSheet.hairlineWidth, height: 30 },
  row: { alignItems: 'center', gap: 12 },
  rowIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  sep: { height: StyleSheet.hairlineWidth },
  disclaimer: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderWidth: StyleSheet.hairlineWidth },
});
