from dataclasses import dataclass

from .config import CONFIDENCE_THRESHOLD, DEFAULT_DISTRESS_KEYWORDS


@dataclass
class DetectionResult:
    detected: bool
    transcript: str
    matched_keyword: str | None
    confidence: float


class DistressDetector:
    """Detect distress keywords in audio using OpenAI Whisper."""

    def __init__(
        self,
        keywords: list[str] | None = None,
        confidence_threshold: float = CONFIDENCE_THRESHOLD,
    ) -> None:
        self.keywords = keywords or DEFAULT_DISTRESS_KEYWORDS
        self.confidence_threshold = confidence_threshold

    async def detect_from_audio(self, audio_path: str) -> DetectionResult:
        """Transcribe audio and check for distress keywords."""
        # TODO: Implement with OpenAI Whisper API
        # client = openai.AsyncOpenAI()
        # with open(audio_path, "rb") as f:
        #     transcript = await client.audio.transcriptions.create(
        #         model="whisper-1", file=f
        #     )
        # return self._check_keywords(transcript.text)
        return DetectionResult(
            detected=False,
            transcript="",
            matched_keyword=None,
            confidence=0.0,
        )

    def _check_keywords(self, transcript: str) -> DetectionResult:
        """Check transcript for distress keywords."""
        transcript_lower = transcript.lower()
        for keyword in self.keywords:
            if keyword in transcript_lower:
                return DetectionResult(
                    detected=True,
                    transcript=transcript,
                    matched_keyword=keyword,
                    confidence=1.0,
                )
        return DetectionResult(
            detected=False,
            transcript=transcript,
            matched_keyword=None,
            confidence=0.0,
        )
