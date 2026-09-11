/**
 * MediHealth AI proxy.
 *
 * Holds the NVIDIA NIM and ElevenLabs keys server-side so they never ship
 * inside the APK. Three constrained routes — no generic chat passthrough — so
 * a leaked URL can only invoke the two medication prompts or the narration
 * TTS, and each provider's own rate limits are the ceiling on abuse.
 */

interface Env {
  // Regenerate with `npx wrangler types` after changing wrangler.jsonc.
  NIM_API_KEY: string;
  NIM_MODEL?: string;
  /** ElevenLabs TTS — set via `wrangler secret put ELEVENLABS_API_KEY`. */
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_MODEL?: string;
  /** Optional shared secret; clients send it as the `x-mh-secret` header. */
  APP_SHARED_SECRET?: string;
}

const NIM_CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const DEFAULT_MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning';
const ELEVEN_TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
// Verified live on the account's free plan (2026-09-12). Library/premade
// voices are API-blocked for free users (HTTP 402); these two are
// account-generated and explicitly allowed.
const ELEVEN_AR_VOICE = 'K4SybEwQgIRIMC8IxWw3'; // Maher — Arabic
const ELEVEN_EN_VOICE = '9DT1q8jLn9ChAfylPFH0'; // Luna — English
const ELEVEN_DEFAULT_MODEL = 'eleven_multilingual_v2';
const MAX_BODY_BYTES = 8 * 1024 * 1024; // images arrive as base64; 8 MB is generous

/**
 * Voice-command interpreter prompt. Validated live against this exact wording
 * on 2026-09-12: 7/8 cases correct in Arabic + English (the one miss was an
 * upstream 503, not a misclassification). Covers dialects ("وين سجل",
 * "روح الكاميرا"), walkthrough control, and demo sign-in.
 */
const VOICE_SYSTEM_PROMPT = `You interpret voice commands for the MediHealth medication-safety app. Reply ONLY with JSON: {"action":"...","target":"..."}. Actions: navigate (open a screen; target exactly one of: dashboard, medications, scanner, history, profile, reminders, analyze), walk_next (advance the onboarding walkthrough), walk_repeat (repeat the current narration), walk_stop (stop narration or skip the walkthrough), demo_login (sign in with the demo account), unknown (not a command for this app). Understand Arabic and English, including dialects and paraphrases. Examples:
افتح الأدوية -> {"action":"navigate","target":"medications"}
وين سجل التحليلات -> {"action":"navigate","target":"history"}
روح الكاميرا -> {"action":"navigate","target":"scanner"}
التالي -> {"action":"walk_next","target":""}
كرر -> {"action":"walk_repeat","target":""}
أعد من جديد -> {"action":"walk_repeat","target":""}
توقف -> {"action":"walk_stop","target":""}
كفى خلاص -> {"action":"walk_stop","target":""}
open the scanner -> {"action":"navigate","target":"scanner"}
go to my medications -> {"action":"navigate","target":"medications"}
next please -> {"action":"walk_next","target":""}
stop it -> {"action":"walk_stop","target":""}
sign in with the demo account -> {"action":"demo_login","target":""}
use the demo -> {"action":"demo_login","target":""}
what is metformin -> {"action":"unknown","target":""}
مرحبا كيف حالك -> {"action":"unknown","target":""}`;

const VOICE_ACTIONS = ['navigate', 'walk_next', 'walk_repeat', 'walk_stop', 'demo_login', 'unknown'];
const NAV_TARGETS = ['dashboard', 'medications', 'scanner', 'history', 'profile', 'reminders', 'analyze'];

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, x-mh-secret',
};

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

function fail(message: string, status: number): Response {
  return json({ error: message }, status);
}

async function secretsEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  // Length mismatch short-circuits; length is not the secret.
  if (ab.byteLength !== bb.byteLength) return false;
  return crypto.subtle.timingSafeEqual(ab, bb);
}

async function authorized(request: Request, env: Env): Promise<boolean> {
  if (!env.APP_SHARED_SECRET) return true;
  const provided = request.headers.get('x-mh-secret') || '';
  return secretsEqual(provided, env.APP_SHARED_SECRET);
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > MAX_BODY_BYTES) throw new HttpError('Payload too large', 413);
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (!body || typeof body !== 'object') throw new Error('not an object');
    return body;
  } catch {
    throw new HttpError('Request body must be a JSON object', 400);
  }
}

/**
 * One NVIDIA call with retry/backoff — upstream intermittently returns 429/5xx
 * while staying healthy seconds later. Retries those; auth and bad-request
 * failures fail fast. Error text is written for the patient reading it.
 */
async function callNim(env: Env, payload: Record<string, unknown>): Promise<string> {
  const body = JSON.stringify({ model: env.NIM_MODEL || DEFAULT_MODEL, ...payload });
  let lastError = new HttpError('The AI service is temporarily unavailable. Please try again in a moment.', 502);

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 700 * attempt));
    let response: Response;
    try {
      response = await fetch(NIM_CHAT_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${env.NIM_API_KEY}`,
        },
        body,
        signal: AbortSignal.timeout(60000),
      });
    } catch {
      lastError = new HttpError('The AI service could not be reached. Check your connection and try again.', 502);
      continue;
    }

    if (response.ok) {
      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new HttpError('The AI service returned no content.', 502);
      }
      return content;
    }

    if (response.status === 401 || response.status === 403) {
      throw new HttpError('The AI service rejected the configured key.', 502);
    }
    if (response.status === 400) {
      throw new HttpError('The AI service rejected the request as malformed.', 400);
    }
    lastError = new HttpError(
      response.status === 429
        ? 'Rate limit reached. Please wait a minute and try again.'
        : 'The AI service is temporarily overloaded. Please try again in a moment.',
      response.status === 429 ? 429 : 502,
    );
  }
  throw lastError;
}

async function analyze(env: Env, body: Record<string, unknown>): Promise<string> {
  const medications = body.medications;
  if (
    !Array.isArray(medications) ||
    medications.length === 0 ||
    !medications.every((m) => typeof m === 'string' && m.trim().length > 0)
  ) {
    throw new HttpError('medications must be a non-empty array of strings', 400);
  }
  const symptoms = typeof body.symptoms === 'string' ? body.symptoms : '';
  const notes = typeof body.notes === 'string' ? body.notes : '';
  const isAr = body.language === 'ar';

  const systemPrompt = `You are a medication safety AI assistant. Analyze the medication list and provide a safety assessment.
Return ONLY valid JSON with this structure:
{
  "score": (0-100 number),
  "interactions": [{"drug": "...", "severity": "low|moderate|high", "description": "..."}],
  "sideEffects": [{"symptom": "...", "likelihood": "common|uncommon|rare", "description": "..."}],
  "foodInteractions": [{"food": "...", "advice": "..."}],
  "safetyConcerns": ["..."],
  "recommendations": ["..."]
}
Be thorough but evidence-based. ${
    isAr
      ? 'You MUST write ALL text in Arabic — every description, advice, concern, and recommendation. Use proper medical Arabic terminology. Only drug names may remain in English.'
      : 'You MUST write ALL text in English. Only drug names may differ.'
  }`;

  const userMsg = `Medications: ${(medications as string[]).join(', ')}${symptoms ? `\nSymptoms: ${symptoms}` : ''}${notes ? `\nNotes: ${notes}` : ''}`;

  return callNim(env, {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMsg },
    ],
    temperature: 0.3,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
  });
}

async function extract(env: Env, body: Record<string, unknown>): Promise<string> {
  const imageData = body.imageData;
  if (typeof imageData !== 'string' || !imageData.startsWith('data:image/')) {
    throw new HttpError('imageData must be a base64 data URL', 400);
  }

  return callNim(env, {
    messages: [
      { role: 'system', content: 'You are a medication information extraction system. Return ONLY valid JSON array.' },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: imageData } },
          {
            type: 'text',
            text: 'Extract medication names, dosages, active ingredients. Return JSON array: [{"name":"","dosage":"","activeIngredient":""}]. If unreadable return [].',
          },
        ],
      },
    ],
    max_tokens: 2000,
  });
}

/**
 * ElevenLabs TTS — returns `{ audio: <base64 mp3> }` JSON. The ElevenLabs key
 * never leaves the server, same pattern as the NIM key. Voice is chosen by
 * `lang`; both voices verified live on the account's free plan.
 */
async function tts(env: Env, body: Record<string, unknown>): Promise<Response> {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) {
    throw new HttpError('text is required', 400);
  }
  if (!env.ELEVENLABS_API_KEY) {
    throw new HttpError('ELEVENLABS_API_KEY is not set. Run: wrangler secret put ELEVENLABS_API_KEY', 500);
  }
  const voiceId = body.lang === 'ar' ? ELEVEN_AR_VOICE : ELEVEN_EN_VOICE;

  const upstream = await fetch(`${ELEVEN_TTS_URL}/${voiceId}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'xi-api-key': env.ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text,
      model_id: env.ELEVENLABS_MODEL || ELEVEN_DEFAULT_MODEL,
      output_format: 'mp3_44100_128',
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (upstream.status === 402) {
    throw new HttpError('The TTS service has no quota left. Check elevenlabs.io billing.', 502);
  }
  if (upstream.status === 401 || upstream.status === 403) {
    throw new HttpError('The TTS service rejected the configured key.', 502);
  }
  if (!upstream.ok) {
    throw new HttpError(`The TTS service is unavailable (HTTP ${upstream.status}).`, 502);
  }

  return json({ audio: arrayBufferToBase64(await upstream.arrayBuffer()) });
}

/** Chunked so a long sentence cannot blow the call stack via spread. */
function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * AI voice-command interpretation. The model sees the whole bilingual space
 * (dialects, paraphrases) that keyword matching cannot; the allowlist below
 * guarantees the client only ever receives a known action/target pair.
 */
async function voice(env: Env, body: Record<string, unknown>): Promise<Response> {
  const transcript = typeof body.transcript === 'string' ? body.transcript.trim() : '';
  if (!transcript) {
    throw new HttpError('transcript is required', 400);
  }
  const content = await callNim(env, {
    messages: [
      { role: 'system', content: VOICE_SYSTEM_PROMPT },
      { role: 'user', content: transcript },
    ],
    temperature: 0,
    max_tokens: 120,
    response_format: { type: 'json_object' },
  });

  let parsed: { action?: string; target?: string };
  try {
    parsed = JSON.parse(content);
  } catch {
    return json({ action: 'unknown', target: '' });
  }
  const action = VOICE_ACTIONS.includes(parsed.action ?? '') ? parsed.action! : 'unknown';
  const target =
    action === 'navigate' && NAV_TARGETS.includes(parsed.target ?? '') ? parsed.target! : '';
  return json({ action, target });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
      }

      if (request.method !== 'POST') return fail('Use POST', 405);
      if (!(await authorized(request, env))) return fail('Unauthorized', 401);
      if (!env.NIM_API_KEY) {
        return fail('NIM_API_KEY is not set. Run: wrangler secret put NIM_API_KEY', 500);
      }

      const url = new URL(request.url);
      const body = await readJson(request);

      switch (url.pathname.replace(/\/+$/, '')) {
        case '/analyze':
          return json({ content: await analyze(env, body) });
        case '/extract':
          return json({ content: await extract(env, body) });
        case '/tts':
          return tts(env, body);
        case '/voice':
          return voice(env, body);
        default:
          return fail('Not found. Routes: POST /analyze, POST /extract, POST /tts, POST /voice', 404);
      }
    } catch (e) {
      if (e instanceof HttpError) return fail(e.message, e.status);
      console.error('Unhandled worker error:', e);
      return fail('Internal error', 500);
    }
  },
};
