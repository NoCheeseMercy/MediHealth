# MediHealth AI Proxy (Cloudflare Worker)

Holds the NVIDIA NIM key server-side so it never ships inside the APK. The
mobile app calls this Worker; the Worker calls NVIDIA.

## One-time setup (~10 minutes, free)

```bash
cd worker
npm install
npx wrangler login          # opens a browser; creates your free Cloudflare account if needed
npx wrangler secret put NIM_API_KEY
# paste your nvapi-... key from https://build.nvidia.com/settings when prompted
```

Optional hardening — require a shared secret header from the app:

```bash
npx wrangler secret put APP_SHARED_SECRET
# generate one with: node -e "console.log(crypto.randomUUID())"
# then set EXPO_PUBLIC_AI_SHARED_SECRET to the same value in client/.env
```

## Deploy

```bash
npx wrangler deploy
# prints a URL like https://medihealth-ai-proxy.<your-subdomain>.workers.dev
```

## Point the app at it

In `client/.env`:

```
EXPO_PUBLIC_AI_PROXY_URL=https://medihealth-ai-proxy.<your-subdomain>.workers.dev
# only if you set APP_SHARED_SECRET above:
EXPO_PUBLIC_AI_SHARED_SECRET=<same value>
```

Then rebuild the app. The old `EXPO_PUBLIC_NIM_API_KEY` is no longer read —
remove it from any CI/EAS secret so the key can't leak through a build log.

## Routes

| Route | Body | Returns |
|-------|------|---------|
| `POST /analyze` | `{ medications: string[], symptoms?, notes?, language }` | `{ content }` — JSON string with score/interactions/etc. |
| `POST /extract` | `{ imageData: "data:image/jpeg;base64,..." }` | `{ content }` — JSON array string |

Both enforce the request shapes, cap body size at 8 MB, and map NVIDIA errors
to honest messages. No other routes exist — the Worker cannot be used as a
general-purpose chat relay.

Free-tier reality check: Cloudflare's free plan allows 100k requests/day, and
NVIDIA's free tier throttles to roughly 40 requests/minute **per key**. The
429 path passes that through to the app with a friendly message.
