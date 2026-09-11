# MediHealth AI - Build & Deployment Guide

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Expo CLI: `npm install -g eas-cli`
- Docker (for backend)

### 1. Backend Setup

```bash
cd server
npm install
cp .env.example .env
# Edit .env with your Appwrite credentials (already filled in .env)

# Setup Appwrite collections
npm run setup:appwrite

# Seed demo data
npm run seed:demo

# Start dev server
npm run dev
```

### 2. Frontend Setup

```bash
cd client
npm install
```

### 3. Build APK

```bash
# Login to Expo
eas login

# Build APK
eas build --platform android --profile preview
```

This generates an APK you can download and install on any Android device.

### 4. Run Locally

```bash
# Terminal 1: Start backend
cd server && npm run dev

# Terminal 2: Start Expo
cd client && npm start
```

Then press `a` for Android or `i` for iOS.

## Environment Variables

### Backend (.env)
- APPWRITE_ENDPOINT - Appwrite cloud endpoint
- APPWRITE_PROJECT_ID - Your project ID
- APPWRITE_API_KEY - Server API key
- APPWRITE_DATABASE_ID - Your database ID
- JWT_SECRET - Secret for JWT tokens
- NIM_API_KEY - NVIDIA NIM API key
- NIM_MODEL - AI model (stepfun-ai/step-3.7-flash)

## Demo Account
- Email: demo@medihealth.app
- Password: Demo123!

## Architecture

```
MediHealth/
├── server/           # Express + Appwrite backend
│   ├── src/
│   │   ├── routes/   # API endpoints
│   │   ├── services/ # AI, Web Research, Appwrite DB
│   │   ├── ai/       # System prompts
│   │   └── middleware/
│   └── prisma/       # Legacy (being migrated to Appwrite)
├── client/           # React Native / Expo frontend
│   ├── app/          # Screens (Expo Router)
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/ # Auth, Language, Theme
│   │   └── services/ # API client
│   └── assets/
└── Dockerfile.server # Production server image
```

## Tech Stack

- **Frontend**: React Native, Expo Router, NativeWind, React Query
- **Backend**: Express, TypeScript, Appwrite
- **AI**: NVIDIA NIM (StepFun 3.7 Flash)
- **Auth**: JWT + Appwrite
- **Languages**: Arabic (RTL) + English

## Features

- AI Medication Analysis
- Camera Medication Scanner
- Smart Reminders
- Analysis History
- Bilingual (AR/EN)
- Dark Mode
- Demo Mode for judges
