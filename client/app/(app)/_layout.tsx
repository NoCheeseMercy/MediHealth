import React, { useEffect, useRef, useState } from 'react';
import { Redirect, Tabs, router } from 'expo-router';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useLanguage } from '../../src/contexts/LanguageContext';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { Icon, type IconName } from '../../src/components/Icon';
import {
  deviceNarrationLang,
  narrText,
  startListening,
  stopListening,
  interpretCommand,
  requestAnswer,
  stopSpeaking,
} from '../../src/services/narration';

function TabIcon({ name, color, focused, activeBg }: { name: IconName; color: string; focused: boolean; activeBg: string }) {
  return (
    <View style={[styles.iconWrap, focused && { backgroundColor: activeBg, borderRadius: 14 }]}>
      {/* Shape changes as well as color, so active state survives grayscale and
          color-blindness where a tint swap alone would not. */}
      <Icon name={name} size={focused ? 22 : 21} color={color} />
    </View>
  );
}

const NAV_ROUTES: Record<string, string> = {
  scan: '/(app)/scanner',
  medications: '/(app)/medications',
  reminders: '/(app)/reminders',
  history: '/(app)/history',
  profile: '/(app)/profile',
  analyze: '/(app)/analyze',
  dashboard: '/(app)',
};

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const { colors, isRTL, font, radius, shadows } = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();

  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const stopListenRef = useRef<(() => void) | null>(null);
  const answerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const narrLang = deviceNarrationLang();

  useEffect(() => () => {
    stopListenRef.current?.();
    stopListening();
    if (answerTimerRef.current) clearTimeout(answerTimerRef.current);
  }, []);

  const showAnswer = (text: string) => {
    setAnswer(text);
    if (answerTimerRef.current) clearTimeout(answerTimerRef.current);
    answerTimerRef.current = setTimeout(() => setAnswer(null), 10000);
  };

  const toggleListening = () => {
    if (stopListenRef.current) {
      stopListenRef.current();
      stopListenRef.current = null;
      setListening(false);
      return;
    }
    setListening(true);
    stopListenRef.current = startListening({
      lang: narrLang,
      onFinal: async (transcript) => {
        setBusy(true);
        try {
          const cmd = await interpretCommand(transcript, false);
          switch (cmd.action) {
            case 'navigate':
              if (cmd.target && NAV_ROUTES[cmd.target]) {
                router.push(NAV_ROUTES[cmd.target] as never);
              }
              break;
            case 'ask': {
              const ans = await requestAnswer(transcript);
              if (ans) showAnswer(ans);
              break;
            }
            case 'walk_stop':
              // Already signed in, so walkthrough actions are meaningless —
              // except stop, which usefully cancels a spoken answer.
              stopSpeaking();
              break;
            default:
              break;
          }
        } finally {
          setBusy(false);
        }
      },
      onError: (message) => {
        if (message === 'mic-permission' || /recognized|unavailable|service/i.test(message)) {
          setListening(false);
          stopListenRef.current?.();
          stopListenRef.current = null;
          Alert.alert(narrText('narrMicError'));
        }
      },
    });
  };

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const tabHeight = 62 + Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 0);

  const screens: { name: string; label: string; icon: IconName }[] = [
    { name: 'index', label: t('dashboard'), icon: 'home' },
    { name: 'medications', label: t('medications'), icon: 'medications' },
    { name: 'scanner', label: t('scanMedication'), icon: 'scan' },
    { name: 'history', label: t('analysisHistory'), icon: 'history' },
    { name: 'profile', label: t('profile'), icon: 'profile' },
  ];

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarItemStyle: { paddingTop: 6 },
          tabBarLabelStyle: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0, marginBottom: 4 },
          tabBarStyle: {
            backgroundColor: colors.backgroundElevated,
            borderTopColor: colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: tabHeight,
            paddingTop: 6,
            paddingBottom: insets.bottom,
            elevation: 10,
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: -2 },
          },
        }}
      >
        {screens.map((s) => (
          <Tabs.Screen
            key={s.name}
            name={s.name}
            options={{
              title: s.label,
              tabBarLabel: s.label,
              tabBarIcon: ({ color, focused }) => (
                <TabIcon name={s.icon} color={color} focused={focused} activeBg={colors.primarySoft} />
              ),
            }}
          />
        ))}

        {/* Detail & flow screens live in this group but stay off the tab bar. */}
        {['analysis/[id]', 'medications/[id]', 'medications/add', 'reminders', 'settings', 'analyze'].map((name) => (
          <Tabs.Screen key={name} name={name} options={{ href: null }} />
        ))}

        <Tabs.Screen name="+not-found" options={{ href: null }} />
      </Tabs>

      {/* Voice-control mic, floating above the tab bar. Also drives walkthrough
          next/stop/repeat while the first-open tour is playing. */}
      <TouchableOpacity
        onPress={toggleListening}
        accessibilityRole="button"
        accessibilityLabel={t('voiceControl')}
        accessibilityState={{ busy: listening }}
        style={[
          styles.micFab,
          {
            bottom: tabHeight + 10,
            backgroundColor: listening ? colors.primary : colors.backgroundElevated,
            borderColor: listening ? colors.primary : colors.borderStrong,
          },
        ]}
      >
        <Icon name="microphone" size={21} color={listening ? colors.onPrimary : colors.textSecondary} />
      </TouchableOpacity>

      {listening ? (
        <View
          pointerEvents="none"
          style={[styles.listeningPill, { bottom: tabHeight + 66, backgroundColor: colors.overlay }]}
        >
          <Text style={styles.listeningText}>
            {busy ? narrText('narrThinking') : narrText('narrListening')}
          </Text>
        </View>
      ) : null}

      {/* Spoken answer to a voice question — shown so the user can read what the
          assistant said, auto-dismisses, or tap to stop. */}
      {answer ? (
        <TouchableOpacity
          onPress={stopSpeaking}
          accessibilityRole="button"
          style={[
            styles.answerCard,
            {
              bottom: tabHeight + 66,
              backgroundColor: colors.surface,
              borderColor: colors.primary,
              borderRadius: radius.lg,
            },
            shadows.raised,
          ]}
        >
          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 10 }}>
            <Icon name="bulb" size={18} color={colors.primary} />
            <Text
              style={[
                font.caption,
                { color: colors.text, flex: 1, textAlign: isRTL ? 'right' : 'left', lineHeight: 21 },
              ]}
            >
              {answer}
            </Text>
          </View>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 46,
    height: 30,
  },
  micFab: {
    position: 'absolute',
    alignSelf: 'center',
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  listeningPill: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  listeningText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  answerCard: {
    position: 'absolute',
    alignSelf: 'stretch',
    marginHorizontal: 20,
    borderWidth: 1.5,
    padding: 14,
  },
});
