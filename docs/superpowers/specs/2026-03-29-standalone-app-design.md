# Standalone App Deployment Design

**Date:** 2026-03-29
**Status:** Approved

## Problem

The app currently requires Expo Go on the same WiFi network as the dev machine. We need it to work as a standalone APK from any network.

## Architecture

```
Mobile App (standalone APK)
  ├── Firebase Auth        → direct (already client-side)
  ├── Firestore            → direct (contacts CRUD, SOS event storage)
  └── HTTPS POST           → Render (FastAPI backend)
                               ├── Twilio SMS dispatch
                               └── FCM push notifications
```

## Changes

### 1. Move Contacts CRUD to Mobile (direct Firestore)

Currently contacts go through FastAPI (`GET/PUT /users/me/contacts`). Move this to use the Firebase JS SDK directly from the mobile app.

- Add Firestore read/write functions in `mobile/src/services/firestore.ts`
- `getContacts(userId)` — reads `users/{userId}` doc, returns `emergency_contacts` array
- `setContacts(userId, contacts)` — writes `emergency_contacts` to `users/{userId}` doc
- Update `ContactsScreen.tsx` to use Firestore functions instead of API calls
- Remove `getContacts()` and `setContacts()` from `api.ts`

### 2. Simplify Backend

Backend only needs to handle the SOS trigger (Twilio SMS + FCM push). Remove:
- `users` router (contacts now handled client-side)
- Keep: `health` router, `sos` router

SOS trigger endpoint stays the same — mobile sends POST with auth token, backend verifies token, sends SMS + FCM.

### 3. Deploy to Render

- Add `render.yaml` (Blueprint) or configure via Render dashboard
- Add `Dockerfile` (already exists in backend/)
- Set environment variables on Render: Firebase credentials, Twilio keys
- Free tier: 750 hours/month, auto-sleep after 15 min inactivity (first request wakes it ~30s cold start)

### 4. Build Standalone APK

- Install EAS CLI: `npm install -g eas-cli`
- Create `eas.json` with preview profile (APK, not AAB)
- Run `eas build --platform android --profile preview`
- Download APK and install on any Android phone

## Firestore Security Rules

Since mobile now writes directly to Firestore, add security rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /sos_events/{eventId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
    }
  }
}
```

## Environment

- **Mobile `.env`**: `EXPO_PUBLIC_API_URL` set to Render URL (e.g., `https://guardian-api.onrender.com`)
- **Render env vars**: `FIREBASE_SERVICE_ACCOUNT_PATH`, `TWILIO_*`, `GOOGLE_MAPS_API_KEY`

## What Stays the Same

- Firebase Auth flow (login/register)
- SOS button + location capture
- All existing UI screens
- Tracking screen with maps
- Backend SOS trigger logic (Twilio + FCM)
