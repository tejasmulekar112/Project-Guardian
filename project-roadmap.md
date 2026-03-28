# Project Guardian — Roadmap

## Phase 1: Core SOS & Location (Weeks 1–3)
- [ ] FastAPI backend with /sos/trigger endpoint
- [ ] Firebase Auth integration (registration, login)
- [ ] Firestore schema for SOS events and user profiles
- [ ] Twilio SMS dispatch to emergency contacts
- [ ] React Native app with SOS button and location permissions
- [ ] Google Maps live location tracking on trigger
- [ ] FCM push notifications to emergency contacts
- [ ] Emergency contact management UI

## Phase 2: AI Voice Integration (Weeks 4–6)
- [ ] OpenAI Whisper integration for distress keyword detection
- [ ] Background audio monitoring service (opt-in)
- [ ] Voice-activated SOS trigger
- [ ] Configurable trigger phrases per user
- [ ] False-positive reduction (confirmation prompt with timeout)
- [ ] Audio preprocessing pipeline

## Phase 3: Evidence & Cloud Upload (Weeks 7–9)
- [ ] Auto-record audio/video on SOS trigger
- [ ] Firebase Storage upload pipeline
- [ ] Evidence timeline (attach media to SOS events)
- [ ] Offline-first: queue uploads when connectivity lost
- [ ] End-to-end encryption for media uploads
- [ ] Evidence viewing in app

## Phase 4: Admin Dashboard (Weeks 10–12)
- [ ] Web dashboard (React) for organization admins
- [ ] Real-time SOS event monitoring map
- [ ] User and contact management
- [ ] Analytics: response times, event heatmaps
- [ ] Role-based access control
- [ ] Export reports (PDF/CSV)
