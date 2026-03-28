from app.models.sos_event import SOSTriggerRequest


class TwilioService:
    """Stub for Twilio SMS operations."""

    @staticmethod
    async def send_emergency_sms(payload: SOSTriggerRequest) -> None:
        """Send emergency SMS to all registered contacts via Twilio."""
        # TODO: Initialize Twilio client and send SMS
        # client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        # for contact in contacts:
        #     client.messages.create(
        #         body=f"SOS Alert! Location: {payload.location}",
        #         from_=settings.twilio_from_phone,
        #         to=contact.phone,
        #     )
        pass
