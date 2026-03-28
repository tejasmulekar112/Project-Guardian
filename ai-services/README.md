# AI Services — Whisper Voice Detection

Phase 2 component for Project Guardian.

## Purpose
Detect distress keywords and phrases in audio using OpenAI Whisper, enabling voice-activated SOS triggers.

## Planned Features
- Real-time audio transcription via Whisper API
- Configurable distress keyword detection
- Confidence scoring for trigger decisions
- False-positive reduction with confirmation timeout

## Setup
```bash
cd ai-services
poetry install
```

## Environment
Requires `OPENAI_API_KEY` in `.env` or environment.
