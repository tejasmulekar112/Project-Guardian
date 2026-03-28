# CLAUDE.md — Project Guardian

AI-powered smart mobile safety system.

## Quick Reference

### Mobile (React Native / Expo)
```bash
cd mobile && npx expo start          # Start dev server
npm run typecheck --workspace=mobile  # TypeScript check
npm run lint --workspace=mobile       # ESLint
npm run test --workspace=mobile       # Jest tests
```

### Backend (FastAPI / Python)
```bash
cd backend && poetry run uvicorn app.main:app --reload  # Start dev server
cd backend && poetry run pytest                         # Run tests
cd backend && poetry run ruff check .                   # Lint
cd backend && poetry run ruff format .                  # Format
```

### AI Services
```bash
cd ai-services && poetry install      # Install deps
cd ai-services && poetry run pytest   # Run tests
```

### Storybook (Component Mockups)
```bash
npm run storybook                     # Launch at localhost:6006
npm run build-storybook --workspace=mobile  # Static build
```

### Utility Scripts
```bash
bash scripts/check-stack.sh           # Verify prerequisites
bash scripts/deploy-ai-model.sh      # Init Whisper environment (stub)
bash scripts/simulate-sos.sh         # Send mock SOS to backend
```

## Code Style

### Mobile (TypeScript)
- **Strict TypeScript** — `strict: true`, `noUncheckedIndexedAccess`, `noImplicitReturns`
- Functional components with explicit `React.FC` typing
- Named exports only (no default exports except App.tsx entry point)
- Import API types from `@guardian/shared-schemas`
- Path aliases: `@/*` maps to `./src/*`

### Backend (Python)
- **PEP8** enforced via Ruff (line-length 88)
- Type hints on all function signatures
- Pydantic models for all request/response shapes
- Async handlers by default
- Ruff lint rules: E, F, I, N, W

## System Architecture

### SOS Flow
```
1. TRIGGER    → User presses SOS button (or voice/shake detected)
2. FASTAPI    → POST /sos/trigger receives event with location
3. FIREBASE   → Event stored in Firestore, FCM push sent to contacts
4. TWILIO     → Emergency SMS dispatched to registered contacts
5. TRACKING   → Live location stream via Google Maps API
```

### Data Flow
```
Mobile App → POST /sos/trigger → Firestore (event record)
                               → FCM (push notification to contacts)
                               → Twilio (SMS alert to contacts)
Mobile App → Google Maps API (live location tracking)
```

### API Endpoints
- `GET  /health` — Health check
- `POST /sos/trigger` — Trigger SOS event (accepts SOSTriggerRequest, returns SOSTriggerResponse)

## Project Structure
```
/mobile          — React Native (Expo managed workflow)
/backend         — FastAPI (Python, Poetry)
/ai-services     — Whisper voice detection (Phase 2)
/shared-schemas  — TypeScript + Python type definitions
/scripts         — DevOps and utility scripts
```

## Environment Setup
1. Run `bash scripts/check-stack.sh` to verify prerequisites
2. Copy `.env.example` → `.env` in root, `/backend`, and `/mobile`
3. Fill in Firebase, Twilio, and Google Maps credentials
4. Backend: `cd backend && poetry install`
5. Mobile: `npm install` (from root — installs all workspaces)
6. Start backend: `cd backend && poetry run uvicorn app.main:app --reload`
7. Start mobile: `cd mobile && npx expo start`
