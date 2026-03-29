from twilio.rest import Client

from app.config import settings
from app.models.sos_event import SOSTriggerRequest
from app.services.location_service import LocationService


class TwilioService:
    """Twilio SMS operations."""

    @staticmethod
    def _client() -> Client:
        return Client(settings.twilio_account_sid, settings.twilio_auth_token)

    @staticmethod
    async def send_emergency_sms(
        payload: SOSTriggerRequest,
        contacts: list[dict],
    ) -> int:
        """Send emergency SMS to all contacts. Returns number of messages sent."""
        if not settings.twilio_account_sid or not settings.twilio_from_phone:
            return 0

        maps_url = await LocationService.get_maps_url(
            payload.location.latitude, payload.location.longitude
        )
        body = f"🚨 SOS ALERT! Emergency triggered. Location: {maps_url}"
        if payload.message:
            body += f"\nMessage: {payload.message}"

        client = TwilioService._client()
        sent = 0
        for contact in contacts:
            phone = contact.get("phone")
            if not phone:
                continue
            try:
                client.messages.create(
                    body=body,
                    from_=settings.twilio_from_phone,
                    to=phone,
                )
                sent += 1
            except Exception:
                pass  # Log and continue — don't fail the SOS
        return sent
