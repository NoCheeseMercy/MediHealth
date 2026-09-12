import * as Speech from 'expo-speech';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { ExpoSpeechRecognitionModule, type ExpoSpeechRecognitionResultEvent } from 'expo-speech-recognition';
import { translations } from '../constants/i18n/translations';

/**
 * Narration + voice control.
 *
 * Narration audio comes from the Worker's /tts route (ElevenLabs, key held
 * server-side) and is cached on disk per sentence. Any failure — no proxy
 * configured, no credits, offline — falls back to the on-device TTS engine so
 * the walkthrough never goes silent.
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
  if (!on) stopSpeaking();
}

export async function isWalkthroughDone(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.walkthroughDone)) === 'true';
}

export async function setWalkthroughDone() {
  await AsyncStorage.setItem(KEYS.walkthroughDone, 'true');
}

// ── High-quality TTS: ElevenLabs via the Worker proxy ───────────────

const audioModeReady = setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);

/** djb2 — short cache-safe filename per (lang, text) pair. */
function hash32(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Cancels the in-flight/playing utterance and resolves its promise. */
let activeAbort: (() => void) | null = null;
/** Set by stopSpeaking() to break running speakSequence loops. */
let seqAborted = false;

async function fetchTtsAudio(text: string, lang: NarrationLang): Promise<string> {
  const base = process.env.EXPO_PUBLIC_AI_PROXY_URL;
  if (!base) throw new Error('no-proxy');

  const fileUri = `${FileSystem.cacheDirectory || ''}mh-tts-${hash32(`${lang}:${text}`)}.mp3`;
  const info = await FileSystem.getInfoAsync(fileUri);
  if (info.exists) return fileUri;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const shared = process.env.EXPO_PUBLIC_AI_SHARED_SECRET;
  if (shared) headers['x-mh-secret'] = shared;

  // Manual AbortController timer — AbortSignal.timeout does not exist in Hermes.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/+$/, '')}/tts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ text, lang }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`tts-http-${res.status}`);
  const data = (await res.json()) as { audio?: string };
  if (!data.audio) throw new Error('tts-empty');
  await FileSystem.writeAsStringAsync(fileUri, data.audio, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return fileUri;
}

/** Plays one cached MP3; resolves on finish or when aborted. */
function playFile(fileUri: string): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      activeAbort = null;
      try {
        sub.remove();
      } catch { /* already removed */ }
      try {
        p.release();
      } catch { /* already released */ }
      resolve();
    };
    const p = createAudioPlayer(fileUri);
    const sub = p.addListener('playbackStatusUpdate', (st: { didJustFinish?: boolean }) => {
      if (st?.didJustFinish) finish();
    });
    activeAbort = finish;
    p.play();
  });
}

/**
 * Speaks one utterance: ElevenLabs audio when possible, device TTS otherwise.
 * Resolves when the utterance finishes or is superseded/stopped.
 */
export async function speak(text: string, lang: NarrationLang = deviceNarrationLang()): Promise<void> {
  if (!text) return;
  // Supersede anything already speaking.
  if (activeAbort) {
    const a = activeAbort;
    activeAbort = null;
    a();
  }
  Speech.stop();
  try {
    await audioModeReady;
    const fileUri = await fetchTtsAudio(text, lang);
    await playFile(fileUri);
  } catch {
    // Fallback: on-device engine (no proxy, no credits, offline, file error).
    await new Promise<void>((resolve) => {
      Speech.speak(text, {
        language: lang === 'ar' ? 'ar-SA' : 'en-US',
        rate: lang === 'ar' ? 0.92 : 0.98,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: () => resolve(),
      });
    });
  }
}

export function stopSpeaking() {
  seqAborted = true;
  if (activeAbort) {
    const a = activeAbort;
    activeAbort = null;
    a();
  }
  Speech.stop();
}

/** Narrate a sequence one sentence at a time; breakable by stopSpeaking(). */
export async function speakSequence(
  texts: string[],
  lang: NarrationLang = deviceNarrationLang(),
  onAllDone?: () => void,
) {
  seqAborted = false;
  for (const t of texts.filter(Boolean)) {
    if (seqAborted) return;
    await speak(t, lang);
  }
  if (!seqAborted) onAllDone?.();
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

// ── AI command interpretation ───────────────────────────────────────

export interface VoiceAction {
  action: 'navigate' | 'walk_next' | 'walk_repeat' | 'walk_stop' | 'demo_login' | 'ask' | 'unknown';
  target?: string;
}

/**
 * Interprets a transcript through the Worker's AI /voice route (bilingual,
 * dialect-tolerant). Falls back to local keyword matching when the proxy is
 * unreachable, so the mic still navigates offline.
 */
export async function interpretCommand(transcript: string, narrating: boolean): Promise<VoiceAction> {
  const base = process.env.EXPO_PUBLIC_AI_PROXY_URL;
  if (base) {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const shared = process.env.EXPO_PUBLIC_AI_SHARED_SECRET;
      if (shared) headers['x-mh-secret'] = shared;
      // Hermes has no AbortSignal.timeout — manual controller timer.
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(`${base.replace(/\/+$/, '')}/voice`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ transcript }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = (await res.json()) as VoiceAction;
        if (data?.action) return data;
      }
    } catch {
      /* fall through to local matching */
    }
  }

  const cmd = matchCommand(transcript);
  if (cmd === 'next') return { action: narrating ? 'walk_next' : 'unknown' };
  if (cmd === 'repeat') return { action: 'walk_repeat' };
  if (cmd === 'stop') return { action: 'walk_stop' };
  if (!narrating) {
    const nav = matchNavCommand(transcript);
    if (nav) return { action: 'navigate', target: nav };
  }
  if (/demo|تجريبي|تجربة/i.test(transcript)) return { action: 'demo_login' };
  // Offline question detection: interrogatives or a question mark mean the
  // user wants an answer, not navigation.
  if (/؟|\?/.test(transcript) ||
    /^(what|how|why|when|where|who|can|could|does|do|is|are|tell|explain)\b/i.test(transcript.trim()) ||
    /^(إيه|ما|هل|كيف|ليه|ليش|متى|فين|أين|مين|عرف|اشرح|قول|إزاي|ازاى|طري)/.test(transcript.trim())) {
    return { action: 'ask' };
  }
  return { action: 'unknown' };
}

/**
 * Asks the spoken assistant a question and speaks the answer. The Worker's
 * /chat route answers in the requested language with a 1-3-sentence
 * conversational style. Returns the answer text (for the on-screen card) or
 * null when nothing could be retrieved.
 */
export async function requestAnswer(question: string): Promise<string | null> {
  const base = process.env.EXPO_PUBLIC_AI_PROXY_URL;
  if (!base) return null;
  const lang = deviceNarrationLang();
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const shared = process.env.EXPO_PUBLIC_AI_SHARED_SECRET;
    if (shared) headers['x-mh-secret'] = shared;
    // Hermes has no AbortSignal.timeout — manual controller timer.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    let res: Response;
    try {
      res = await fetch(`${base.replace(/\/+$/, '')}/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ question, lang }),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return null;
    const data = (await res.json()) as { answer?: string };
    const answer = (data.answer || '').trim();
    if (!answer) return null;
    void speak(answer, lang);
    return answer;
  } catch {
    return null;
  }
}

// ── Walkthrough → sign-in handoff ───────────────────────────────────

const PENDING_LOGIN_KEY = 'narration_pending_login';

/** Onboarding calls this when the user keeps narration on at the tour's end. */
export async function setPendingLoginNarration() {
  await AsyncStorage.setItem(PENDING_LOGIN_KEY, 'true');
}

/** Login consumes the flag once; true means "narrate the sign-in screen now". */
export async function consumePendingLoginNarration(): Promise<boolean> {
  const v = (await AsyncStorage.getItem(PENDING_LOGIN_KEY)) === 'true';
  if (v) await AsyncStorage.removeItem(PENDING_LOGIN_KEY);
  return v;
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
