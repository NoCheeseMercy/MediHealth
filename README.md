# MediHealth AI

AI-powered medication safety assistant — React Native (Expo) app with a
Cloudflare Worker AI proxy, Appwrite for auth and data, and NVIDIA NIM
(StepFun 3.7 Flash) for analysis.

## Architecture

```
Expo app (client/)  ──HTTPS──►  Cloudflare Worker (worker/)  ──►  NVIDIA NIM API
       │                            holds NIM key as a secret
       └──────Appwrite SDK (auth, database)──────►  Appwrite Cloud
```

The NVIDIA API key lives **only** in the Worker as a Cloudflare secret. It is
never compiled into the app bundle (`EXPO_PUBLIC_*` variables are inlined into
the APK and readable by anyone who unzips it — don't put keys there).

`server/` contains a fully-written Express API (including an OpenFDA /
MedlinePlus / Drugs.com verification service). It is **not currently wired
into the mobile app** — the client talks to Appwrite and the Worker directly.
It is kept for a planned source-verification feature.

## Stack

| Layer | Technology |
|-------|------------|
| Mobile | React Native, Expo 53, Expo Router, React Query |
| AI proxy | Cloudflare Workers (free tier) |
| AI | NVIDIA NIM — `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` |
| Database & Auth | Appwrite |

## Quick Start

### 1. Deploy the AI proxy (~10 min, free)

Follow `worker/README.md`:

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put NIM_API_KEY   # paste your nvapi-... key from build.nvidia.com
npx wrangler deploy
```

### 2. Mobile App

```bash
cd client
npm install
cp .env.example .env
# set EXPO_PUBLIC_AI_PROXY_URL to the wrangler deploy URL
npx expo start
```

### 3. Demo Account

| Field | Value |
|-------|-------|
| Email | `demo@medihealth.app` |
| Password | `Demo123!` |

Tap **Enter Demo** on the login screen.

## Features

- AI medication analysis — interactions, side effects, food interactions,
  safety score with explicit "not assessed" state (no invented scores)
- AI Vision medication scanner (photo → extract medications → analyze)
- Medication library with search, forms, date ranges, edit & delete
- Smart reminders with local notifications and dose taken/skipped logging
- Analysis & scan history with severity filters
- Arabic (default, full RTL) + English
- Light/dark/system themes

Source verification against official drug labels (OpenFDA, MedlinePlus,
Drugs.com) is implemented in `server/src/services/webResearch.service.ts` but
not yet reachable from the app — the analysis screen labels results as
"AI-generated / unverified" until that ships.

## Project Structure

```
MediHealth/
├── client/           # Expo React Native app
│   ├── app/          # Expo Router screens
│   └── src/          # Components, theme, contexts, services
├── worker/           # Cloudflare Worker — AI proxy (holds the NIM key)
├── server/           # Express API — written but not wired into the app yet
└── docs/             # Database schema
```

## Environment Variables

- `client/.env.example` — app-side config (`EXPO_PUBLIC_AI_PROXY_URL`, optional
  shared secret)
- `worker/` secrets — `NIM_API_KEY` (required), `APP_SHARED_SECRET` (optional)

Never commit `.env`, `.dev.vars`, or keystores. Anything prefixed
`EXPO_PUBLIC_` ships inside the APK.

## Database (Appwrite Collections)

- `user_profiles` — fullName, email, preferredLanguage
- `user_medications` — user medications
- `reminders` / `reminder_completions`
- `analysis_reports` — AI analysis history
- `scan_histories` — vision scan history

## Security

- NVIDIA key stored as a Cloudflare Worker secret, never in the app bundle
- Worker exposes only two constrained routes (`/analyze`, `/extract`) — no
  general chat passthrough; NVIDIA's ~40 RPM free-tier limit caps abuse
- `*.keystore` / `*.jks` gitignored; Android release-signing passwords read
  from `~/.gradle/gradle.properties` or env vars, not committed
- Appwrite handles auth and password hashing

## License

MIT License
