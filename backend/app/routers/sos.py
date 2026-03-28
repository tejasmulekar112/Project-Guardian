import uuid

from fastapi import APIRouter

from app.models.sos_event import SOSStatus, SOSTriggerRequest, SOSTriggerResponse

router = APIRouter()


@router.post("/trigger", response_model=SOSTriggerResponse)
async def trigger_sos(payload: SOSTriggerRequest) -> SOSTriggerResponse:
    """SOS Flow: Trigger -> store in Firestore -> notify via FCM -> SMS via Twilio."""
    event_id = str(uuid.uuid4())

    # TODO: Store event in Firestore
    # await FirebaseService.create_sos_event(payload, event_id)

    # TODO: Send FCM push to emergency contacts
    # await FirebaseService.notify_contacts(payload.user_id, event_id)

    # TODO: Send SMS via Twilio
    # await TwilioService.send_emergency_sms(payload)

    return SOSTriggerResponse(event_id=event_id, status=SOSStatus.DISPATCHED)
