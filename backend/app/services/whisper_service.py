import os
import tempfile

from openai import AsyncOpenAI

from app.config import settings

DEFAULT_DISTRESS_KEYWORDS = [
    "help",
    "help me",
    "emergency",
    "call the police",
    "someone help",
    "i'm in danger",
    "save me",
    "stop",
]


class WhisperService:
    """Detect distress keywords in audio using OpenAI Whisper."""

    @staticmethod
    def _client() -> AsyncOpenAI:
        return AsyncOpenAI(api_key=settings.openai_api_key)

    @staticmethod
    async def detect(audio_path: str) -> dict:
        """Transcribe audio and check for distress keywords."""
        client = WhisperService._client()

        with open(audio_path, "rb") as f:
            transcript = await client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
            )

        text = transcript.text.strip()
        if not text:
            return {
                "detected": False,
                "transcript": "",
                "keyword": None,
                "confidence": 0.0,
            }

        return WhisperService._check_keywords(text)

    @staticmethod
    def _check_keywords(transcript: str) -> dict:
        """Check transcript for distress keywords."""
        transcript_lower = transcript.lower()
        for keyword in DEFAULT_DISTRESS_KEYWORDS:
            if keyword in transcript_lower:
                return {
                    "detected": True,
                    "transcript": transcript,
                    "keyword": keyword,
                    "confidence": 1.0,
                }
        return {
            "detected": False,
            "transcript": transcript,
            "keyword": None,
            "confidence": 0.0,
        }
