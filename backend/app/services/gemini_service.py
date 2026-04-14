import asyncio
import logging

import google.generativeai as genai

from app.config import settings

logger = logging.getLogger(__name__)

EMERGENCY_ANALYSIS_PROMPT = """You are an AI safety assistant for Project Guardian, an emergency response system.
Analyze the following SOS event and provide a brief, actionable emergency assessment.

Event Details:
- Trigger Type: {trigger_type}
- Message/Transcript: {message}
- Location: {latitude}, {longitude}
- Time: {timestamp}

Provide your analysis in this exact JSON format:
{{
  "severity": "critical" | "high" | "medium" | "low",
  "emergency_type": "assault" | "accident" | "medical" | "natural_disaster" | "harassment" | "unknown",
  "recommended_action": "brief 1-sentence action for responders",
  "context_summary": "brief 1-sentence summary of the situation"
}}

Respond ONLY with the JSON object, no other text."""


class GeminiService:
    """Google Gemini AI for emergency context analysis."""

    @staticmethod
    def _configure():
        if not settings.gemini_api_key:
            return None
        genai.configure(api_key=settings.gemini_api_key)
        return genai.GenerativeModel("gemini-2.0-flash")

    @staticmethod
    async def analyze_emergency(
        trigger_type: str,
        message: str | None,
        latitude: float,
        longitude: float,
        timestamp: str | None = None,
    ) -> dict | None:
        """Analyze an SOS event using Gemini to classify severity and type."""
        model = GeminiService._configure()
        if model is None:
            logger.info("Gemini API key not configured, skipping analysis")
            return None

        prompt = EMERGENCY_ANALYSIS_PROMPT.format(
            trigger_type=trigger_type,
            message=message or "No message provided",
            latitude=latitude,
            longitude=longitude,
            timestamp=timestamp or "Unknown",
        )

        try:
            response = await asyncio.to_thread(
                model.generate_content, prompt
            )
            text = response.text.strip()
            # Parse JSON from response
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()

            import json
            analysis = json.loads(text)
            logger.info("Gemini analysis: severity=%s, type=%s",
                        analysis.get("severity"), analysis.get("emergency_type"))
            return analysis
        except Exception as e:
            logger.warning("Gemini analysis failed: %s", e)
            return None

    @staticmethod
    async def generate_alert_message(
        trigger_type: str,
        message: str | None,
        user_name: str | None = None,
    ) -> str | None:
        """Generate an enhanced alert message using Gemini."""
        model = GeminiService._configure()
        if model is None:
            return None

        prompt = (
            f"Generate a concise, urgent emergency alert message (max 160 chars for SMS) "
            f"for this SOS event. Trigger: {trigger_type}. "
            f"User message: {message or 'None'}. "
            f"User name: {user_name or 'A Guardian user'}. "
            f"Include urgency level. Respond with ONLY the alert message text."
        )

        try:
            response = await asyncio.to_thread(
                model.generate_content, prompt
            )
            return response.text.strip()[:160]
        except Exception as e:
            logger.warning("Gemini alert generation failed: %s", e)
            return None
