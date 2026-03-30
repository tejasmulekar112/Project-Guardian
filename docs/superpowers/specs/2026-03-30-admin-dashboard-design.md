# Phase 4A: Admin Dashboard — Design Spec

## Overview

A React web dashboard for a single admin to monitor SOS events in real-time, view evidence, and see registered users. Connects directly to Firebase (Auth, Firestore, Storage) — no backend involvement. Deployed via Firebase Hosting.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | Phase 4A (core dashboard) | Map, analytics, RBAC, export deferred to Phase 4B |
| Users | Single admin | No multi-admin or multi-org needed yet |
| Location | `/dashboard` workspace in monorepo | Separate UI from mobile, shares shared-schemas |
| Framework | Vite + React + TypeScript + TailwindCSS | Fast dev, utility-class styling for admin UIs |
| Data access | Direct Firestore via Firebase JS SDK | Real-time updates via onSnapshot, no backend needed |
| Auth | Firebase Auth email/password + admin whitelist | Same auth system as mobile, whitelist in Firestore |
| Deployment | Firebase Hosting | Same ecosystem, free tier, single deploy command |

## Authentication

- Firebase Auth email/password sign-in on `/login` page
- After sign-in, check Firestore `admins` collection for the user's UID
- Document exists at `admins/{uid}` → admin access granted
- Document does not exist → show "Access Denied", sign out
- Admin whitelist managed by manually adding documents to Firestore `admins` collection via Firebase Console

## Pages

### Login Page (`/login`)

- Email and password fields
- Sign-in button
- Error display for invalid credentials
- Redirects to `/` on successful admin auth

### Dashboard Home (`/`)

Three sections:

**Summary Stats Bar (top):**
- Total SOS events (all time)
- Active events (status = `triggered` or `dispatched`)
- Events today
- Total registered users
- All stats update in real-time via Firestore `onSnapshot`

**Recent Activity Feed (sidebar or top section):**
- Live feed showing new SOS events as they arrive
- Each entry: user email, trigger type (manual/voice), timestamp, status badge
- New events appear at the top with a subtle highlight animation
- Shows last 10 events, auto-updates via `onSnapshot`

**Events Table (main area):**
- Columns: timestamp, user email, trigger type, status, location (lat/lng), actions
- Sortable by timestamp (newest first by default)
- Status shown as colored badges: red (triggered), yellow (dispatched), green (resolved)
- Click any row to navigate to `/events/:eventId` detail page
- Simple text filter to search by user email

### Event Detail Page (`/events/:eventId`)

**Event Info:**
- Event ID, timestamp, user email, trigger type, status
- Location displayed as latitude/longitude coordinates (map deferred to Phase 4B)
- Message field (e.g., "Voice detected: help me")

**Evidence Section:**
- List of evidence files from the event's `evidence` array in Firestore
- Audio: play button with inline audio player
- Video: video player with controls
- Photos: thumbnail grid, click to view fullscreen
- Each item shows filename, type, and timestamp
- Files loaded directly from Firebase Storage download URLs

**Back button** to return to dashboard home.

### Users Page (`/users`)

- Table with columns: email, UID, number of SOS events, last active date
- Data sourced from Firestore `users` collection
- Click a row to see that user's emergency contacts (from `users/{uid}.emergency_contacts`)
- Read-only — admin can view but not modify user data

## Firestore Data Access

**Existing collections read by dashboard:**
- `sos_events` — all SOS event documents (real-time subscription)
- `users` — user profiles and emergency contacts

**New collection:**
- `admins/{uid}` — documents with admin UIDs (just needs to exist, no fields required)

**Firestore security rules must be updated** to allow admin reads across all events and users while preserving existing mobile app access. Rules use the `admins` collection as a whitelist.

Firestore rules addition:
```
match /admins/{uid} {
  allow read: if request.auth != null && request.auth.uid == uid;
}
match /sos_events/{eventId} {
  allow read: if request.auth != null && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
}
match /users/{userId} {
  allow read: if request.auth != null && (request.auth.uid == userId || exists(/databases/$(database)/documents/admins/$(request.auth.uid)));
}
```

## File Structure

```
/dashboard
  ├── index.html
  ├── vite.config.ts
  ├── tailwind.config.js
  ├── tsconfig.json
  ├── package.json
  └── src/
      ├── main.tsx                      — React entry point
      ├── App.tsx                       — Router setup
      ├── config/firebase.ts            — Firebase init
      ├── hooks/useAuth.ts              — Admin auth hook (sign in, sign out, admin check)
      ├── hooks/useEvents.ts            — Real-time SOS events from Firestore
      ├── hooks/useUsers.ts             — Users list from Firestore
      ├── hooks/useStats.ts             — Summary stats computed from events
      ├── components/ProtectedRoute.tsx  — Admin whitelist gate
      ├── components/StatsBar.tsx        — Summary stat counters
      ├── components/ActivityFeed.tsx    — Live event feed
      ├── components/EventsTable.tsx     — Sortable events table
      ├── components/EvidencePlayer.tsx  — Audio/video/photo viewer
      ├── pages/LoginPage.tsx
      ├── pages/DashboardPage.tsx
      ├── pages/EventDetailPage.tsx
      └── pages/UsersPage.tsx
```

## New Dependencies

| Package | Purpose |
|---------|---------|
| `react` | UI framework |
| `react-dom` | DOM rendering |
| `react-router-dom` | Client-side routing |
| `firebase` | Auth, Firestore, Storage access |
| `tailwindcss` | Utility-class CSS styling |
| `@tailwindcss/vite` | TailwindCSS Vite plugin |

## Deployment

- Firebase Hosting configured in `firebase.json` at project root
- Build output: `dashboard/dist`
- Deploy command: `firebase deploy --only hosting`
- Firebase CLI must be installed (`npm install -g firebase-tools`)
- Firebase project already configured (same project as mobile app)

## Modified Files

| File | Change |
|------|--------|
| `package.json` (root) | Add `dashboard` to workspaces |

## Out of Scope (Phase 4B)

- Real-time SOS event monitoring map
- Analytics: response times, event heatmaps
- Role-based access control (multiple admin roles)
- Export reports (PDF/CSV)
- Multi-organization support
- Admin write operations (resolving events, managing users)
