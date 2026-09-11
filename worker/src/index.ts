/**
 * MediHealth AI proxy.
 *
 * Holds the NVIDIA NIM key server-side so it never ships inside the APK.
 * Two constrained routes — no generic chat passthrough — so a leaked URL can
 * only invoke the two medication prompts, and NVIDIA's own ~40 RPM free-tier
 * limit is the ceiling on abuse.
 */

interface Env {
  // Regenerate with `npx wrangler types` after changing wrangler.jsonc.
  NIM_API_KEY: string;
  NIM_MODEL?: string;
  /** Optional shared secret; clients send it as the `x-mh-secret` header. */
  APP_SHARED_SECRET?: string;
}

const NIM_CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const DEFAULT_MODEL = 'stepfun-ai/step-3.7-flash';
const MAX_BODY_BYTES = 8 * 1024 * 1024; // images arrive as base64; 8 MB is generous

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

/** One NVIDIA call; maps upstream failures to honest client-facing errors. */
async function callNim(env: Env, payload: Record<string, unknown>): Promise<string> {
  const response = await fetch(NIM_CHAT_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.NIM_API_KEY}`,
    },
    body: JSON.stringify({ model: env.NIM_MODEL || DEFAULT_MODEL, ...payload }),
    signal: AbortSignal.timeout(60000),
  });

  if (response.status === 429) {
    throw new HttpError('Rate limit reached. Please wait a minute and try again.', 429);
  }
  if (response.status === 401 || response.status === 403) {
    throw new HttpError('The AI service rejected the configured key.', 502);
  }
  if (!response.ok) {
    throw new HttpError(`The AI service is unavailable (HTTP ${response.status}).`, 502);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new HttpError('The AI service returned no content.', 502);
  }
  return content;
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
Be thorough but evidence-based. ${isAr ? 'Respond in Arabic.' : 'Respond in English.'}`;

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
        default:
          return fail('Not found. Routes: POST /analyze, POST /extract', 404);
      }
    } catch (e) {
      if (e instanceof HttpError) return fail(e.message, e.status);
      console.error('Unhandled worker error:', e);
      return fail('Internal error', 500);
    }
  },
};
