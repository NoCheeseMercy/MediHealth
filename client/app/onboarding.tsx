import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Alert,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../src/contexts/LanguageContext';
import { Button } from '../src/components/Button';
import { Icon } from '../src/components/Icon';
import {
  isNarrationEnabled,
  isWalkthroughDone,
  setWalkthroughDone,
  setNarrationEnabled,
  setPendingLoginNarration,
  deviceNarrationLang,
  narrText,
  speakSequence,
  stopSpeaking,
  startListening,
  stopListening,
  matchCommand,
} from '../src/services/narration';

const { width } = Dimensions.get('window');

/**
 * Onboarding walkthrough with spoken narration.
 *
 * Narration plays DURING the slides (this was the requirement — the previous
 * build narrated on the dashboard after onboarding had already ended), in the
 * DEVICE language, and the walkthrough is voice-controlled: next / repeat /
 * stop via the mic button. When it ends the user is asked whether to disable
 * narration. The ElevenLabs-backed speech queue lives in narration.ts; this
 * file only scripts what is said and when.
 */
export default function OnboardingScreen() {
  const { t, isRTL } = useLanguage();
  const narrLang = deviceNarrationLang();

  const [index, setIndex] = useState(0);
  const [narrating, setNarrating] = useState(false);
  const [listening, setListening] = useState(false);
  const [repeatTick, setRepeatTick] = useState(0);

  const ref = useRef<FlatList>(null);
  const stopListenRef = useRef<(() => void) | null>(null);
  const indexRef = useRef(0);
  const narratingRef = useRef(false);

  const slides = [
    { title: t('onboarding1Title'), desc: t('onboarding1Desc'), emoji: '🧠' },
    { title: t('onboarding2Title'), desc: t('onboarding2Desc'), emoji: '📷' },
    { title: t('onboarding3Title'), desc: t('onboarding3Desc'), emoji: '⏰' },
    { title: t('onboarding4Title'), desc: t('onboarding4Desc'), emoji: '📊' },
  ];

  // ── Narration gate: first openers with narration enabled hear the tour ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [enabled, done] = await Promise.all([isNarrationEnabled(), isWalkthroughDone()]);
      if (cancelled || !enabled || done) return;
      narratingRef.current = true;
      setNarrating(true);
    })();
    return () => {
      cancelled = true;
      stopListening();
      stopSpeaking();
    };
  }, []);

  // ── Narrate the current slide whenever it becomes visible ──────────────
  useEffect(() => {
    indexRef.current = index;
    if (!narrating) return;

    const script: string[] = [];
    if (index === 0) script.push(narrText('narrIntro'));
    script.push(`${narrText(`onboarding${index + 1}Title`)}. ${narrText(`onboarding${index + 1}Desc`)}`);
    if (index === slides.length - 1) script.push(narrText('narrVoiceHint'));

    stopSpeaking();
    // Let the swipe settle before the voice starts over it.
    const timer = setTimeout(() => speakSequence(script, narrLang), 450);
    return () => {
      clearTimeout(timer);
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, narrating, narrLang, repeatTick]);

  // ── End of walkthrough ─────────────────────────────────────────────────
  // narrateSignin=true keeps the AI voice going: end card, disable question,
  // then the sign-in screen narrates on arrival (login consumes the flag).
  const finish = useCallback(
    (narrateSignin: boolean) => {
      stopListenRef.current?.();
      stopListenRef.current = null;
      setListening(false);
      stopListening();
      stopSpeaking();
      narratingRef.current = false;
      setNarrating(false);

      const goLogin = async () => {
        await setWalkthroughDone();
        await AsyncStorage.setItem('onboarding_complete', '1');
        router.replace('/login');
      };

      void (async () => {
        const enabled = narrateSignin && (await isNarrationEnabled());
        if (!enabled) {
          await goLogin();
          return;
        }
        await speakSequence([narrText('narrEnd')], narrLang);
        Alert.alert(narrText('narrAskDisable'), undefined, [
          {
            text: narrText('narrKeep'),
            style: 'cancel',
            onPress: async () => {
              await setPendingLoginNarration();
              await goLogin();
            },
          },
          {
            text: narrText('narrDisable'),
            style: 'destructive',
            onPress: async () => {
              await setNarrationEnabled(false);
              await goLogin();
            },
          },
        ]);
      })();
    },
    [narrLang],
  );

  // ── Voice control during the walkthrough ───────────────────────────────
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
      onFinal: (transcript) => {
        const cmd = matchCommand(transcript);
        if (cmd === 'next') {
          if (indexRef.current >= slides.length - 1) finish(true);
          else ref.current?.scrollToIndex({ index: indexRef.current + 1, animated: true });
        } else if (cmd === 'repeat') {
          setRepeatTick((v) => v + 1);
        } else if (cmd === 'stop') {
          finish(true);
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

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.min(slides.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / width))));
  };

  return (
    <LinearGradient colors={['#0F766E', '#0E7490']} style={styles.container}>
      <TouchableOpacity
        style={[styles.skip, isRTL && styles.skipRtl]}
        onPress={() => finish(false)}
        accessibilityRole="button"
      >
        <Text style={styles.skipText}>{t('skip')}</Text>
      </TouchableOpacity>

      <FlatList
        ref={ref}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <Text style={styles.emoji}>{item.emoji}</Text>
            <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'center' }]}>{item.title}</Text>
            <Text style={[styles.desc, { textAlign: isRTL ? 'right' : 'center' }]}>{item.desc}</Text>
          </View>
        )}
      />

      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      {listening ? (
        <View style={[styles.listeningPill, { bottom: 148 }]}>
          <Text style={styles.listeningText}>{narrText('narrListening')}</Text>
        </View>
      ) : null}

      {narrating ? (
        <TouchableOpacity
          onPress={toggleListening}
          accessibilityRole="button"
          accessibilityLabel={narrText('narrListening')}
          accessibilityState={{ busy: listening }}
          style={[styles.micFab, listening && styles.micFabActive]}
        >
          <Icon name="microphone" size={20} color={listening ? '#FFF' : 'rgba(255,255,255,0.85)'} />
        </TouchableOpacity>
      ) : null}

      <View style={styles.footer}>
        <Button
          title={index === slides.length - 1 ? t('getStarted') : t('next')}
          onPress={() => {
            if (index === slides.length - 1) finish(true);
            else ref.current?.scrollToIndex({ index: index + 1, animated: true });
          }}
          variant="secondary"
          style={{ backgroundColor: '#FFF', borderColor: '#FFF' }}
          textStyle={{ color: '#0F766E' }}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skip: { position: 'absolute', top: 56, right: 24, zIndex: 10 },
  skipRtl: { right: undefined, left: 24 },
  skipText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 80 },
  emoji: { fontSize: 80, marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '800', color: '#FFF', marginBottom: 16 },
  desc: { fontSize: 17, color: 'rgba(255,255,255,0.9)', lineHeight: 26 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { width: 24, backgroundColor: '#FFF' },
  footer: { padding: 24, paddingBottom: 48 },
  micFab: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 128,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  micFabActive: { backgroundColor: '#FFF' },
  listeningPill: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 10,
  },
  listeningText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
});
