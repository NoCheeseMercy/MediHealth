import * as Speech from 'expo-speech';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExpoSpeechRecognitionModule, type ExpoSpeechRecognitionResultEvent } from 'expo-speech-recognition';
import { translations } from '../constants/i18n/translations';

/**
 * Narration + voice control.
 *
 * Narration language is the DEVICE language (not the app language) per
 * requirement — a device set to Arabic narrates in Arabic even if the user
 * later flips the in-app UI to English.
 */

export type NarrationLang = 'ar' | 'en';

const KEYS = {
  enabled: 'narration_enabled',
  walkthroughDone: 'narration_walkthrough_done',
};

export function deviceNarrationLang(): NarrationLang {
  try {
    const locale = Localization.getLocales()[0]?.languageCode?.toLowerCase();
    return locale === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

export async function isNarrationEnabled(): Promise<boolean> {
  const v = await AsyncStorage.getItem(KEYS.enabled);
  return v === null ? true : v === 'true'; // first openers get narration by default
}

export async function setNarrationEnabled(on: boolean) {
  await AsyncStorage.setItem(KEYS.enabled, String(on));
  if (!on) Speech.stop();
}

export async function isWalkthroughDone(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.walkthroughDone)) === 'true';
}

export async function setWalkthroughDone() {
  await AsyncStorage.setItem(KEYS.walkthroughDone, 'true');
}

export function speak(text: string, lang: NarrationLang = deviceNarrationLang()) {
  if (!text) return;
  Speech.stop();
  Speech.speak(text, {
    language: lang === 'ar' ? 'ar-SA' : 'en-US',
    rate: lang === 'ar' ? 0.92 : 0.98,
    pitch: 1.0,
  });
}

export function stopSpeaking() {
  Speech.stop();
}

/**
 * Narrate a sequence one sentence at a time. `onStopped` halts the chain (user
 * disabled narration or navigated away); only a natural `onDone` continues.
 */
export function speakSequence(texts: string[], lang: NarrationLang = deviceNarrationLang(), onAllDone?: () => void) {
  const items = texts.filter(Boolean);
  let i = 0;
  const next = () => {
    if (i >= items.length) {
      onAllDone?.();
      return;
    }
    const text = items[i++];
    Speech.speak(text, {
      language: lang === 'ar' ? 'ar-SA' : 'en-US',
      rate: lang === 'ar' ? 0.92 : 0.98,
      onDone: next,
      onStopped: () => { /* chain intentionally halted */ },
    });
  };
  next();
}

/** Lookup in the DEVICE narration language, independent of the app UI language. */
export function narrText(key: string): string {
  const lang = deviceNarrationLang();
  const dict = (translations as Record<string, Record<string, string>>)[lang] || translations.en;
  return dict[key] ?? translations.en[key as keyof typeof translations.en] ?? key;
}

// ── Command matching ────────────────────────────────────────────────

const NEXT_WORDS = ['next', 'التالي', 'التالى', 'كمل', 'كمّل', 'continue'];
const STOP_WORDS = ['stop', 'توقف', 'قف', 'إيقاف', 'كفى', 'خلاص'];
const REPEAT_WORDS = ['repeat', 'أعد', 'اعد', 'again', 'مرة أخرى'];

export function matchCommand(transcript: string): 'next' | 'stop' | 'repeat' | null {
  const t = (transcript || '').trim().toLowerCase();
  if (!t) return null;
  if (NEXT_WORDS.some((w) => t.includes(w))) return 'next';
  if (STOP_WORDS.some((w) => t.includes(w))) return 'stop';
  if (REPEAT_WORDS.some((w) => t.includes(w))) return 'repeat';
  return null;
}

/** Voice navigation phrases, bilingual, tuned for what ASR actually hears. */
const NAV_COMMANDS: { key: string; words: string[] }[] = [
  { key: 'scan', words: ['scan', 'camera', 'مسح', 'امسح', 'الكاميرا'] },
  { key: 'medications', words: ['medication', 'medicine', 'أدويتي', 'الأدوية', 'أدوية', 'الدواء'] },
  { key: 'reminders', words: ['reminder', 'reminders', 'alarm', 'تذكير', 'التذكيرات', 'المنبه'] },
  { key: 'history', words: ['history', 'السجل', 'التحليلات', 'التحليل السابق'] },
  { key: 'profile', words: ['profile', 'settings', 'حسابي', 'الملف', 'الإعدادات'] },
  { key: 'analyze', words: ['analyze', 'analysis', 'تحليل جديد', 'حلل'] },
  { key: 'dashboard', words: ['home', 'dashboard', 'الرئيسية', 'الرئيسيه'] },
];

export function matchNavCommand(transcript: string): string | null {
  const t = (transcript || '').trim().toLowerCase();
  if (!t) return null;
  for (const c of NAV_COMMANDS) {
    if (c.words.some((w) => t.includes(w))) return c.key;
  }
  return null;
}

// ── Listening loop ──────────────────────────────────────────────────

interface ListenHandlers {
  lang: NarrationLang;
  /** Called with each FINAL transcript. */
  onFinal: (transcript: string) => void;
  onError?: (message: string) => void;
}

/**
 * Runs one recognition pass after another until the returned stop() is called.
 * Single-instance: any previous loop is stopped first.
 */
export function startListening(handlers: ListenHandlers): () => void {
  stopListening();

  let stopped = false;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;

  const startPass = () => {
    if (stopped) return;
    try {
      ExpoSpeechRecognitionModule.start({
        lang: handlers.lang === 'ar' ? 'ar-SA' : 'en-US',
        interimResults: false,
        maxAlternatives: 1,
        continuous: false,
      });
    } catch (e) {
      handlers.onError?.(e instanceof Error ? e.message : String(e));
    }
  };

  const subs = [
    ExpoSpeechRecognitionModule.addListener('result', (e: ExpoSpeechRecognitionResultEvent) => {
      if (stopped || !e.isFinal || !e.results?.length) return;
      // Web-Speech-compatible shape: results[0][0].transcript; tolerate a flat
      // { transcript } entry too.
      const first = e.results[0] as unknown as { transcript?: string } | { 0?: { transcript?: string } };
      const text = (first as { transcript?: string }).transcript ?? (first as { 0?: { transcript?: string } })[0]?.transcript;
      if (text) handlers.onFinal(text);
    }),
    ExpoSpeechRecognitionModule.addListener('error', (e: { error?: string }) => {
      // "no-speech" and "aborted" are normal between passes; surface the rest.
      if (e?.error && e.error !== 'no-speech' && e.error !== 'aborted') {
        handlers.onError?.(e.error);
      }
    }),
    ExpoSpeechRecognitionModule.addListener('end', () => {
      if (stopped) return;
      restartTimer = setTimeout(startPass, 300);
    }),
  ];

  const ensureStarted = async () => {
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        handlers.onError?.('mic-permission');
        return;
      }
      startPass();
    } catch (e) {
      handlers.onError?.(e instanceof Error ? e.message : String(e));
    }
  };

  void ensureStarted();

  activeStop = () => {
    stopped = true;
    if (restartTimer) clearTimeout(restartTimer);
    subs.forEach((s) => s.remove());
    try { ExpoSpeechRecognitionModule.stop(); } catch { /* already idle */ }
  };
  return activeStop;
}

let activeStop: (() => void) | null = null;

/** Stops whatever listening loop is running, if any. */
export function stopListening() {
  if (activeStop) {
    const s = activeStop;
    activeStop = null;
    s();
  }
}
