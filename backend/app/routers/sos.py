import uuid

from fastapi import APIRouter, Depends

from app.middleware.auth import verify_firebase_token
from app.models.sos_event import SOSStatus, SOSTriggerRequest, SOSTriggerResponse
from app.services.firebase_service import FirebaseService
from app.services.location_service import LocationService
from app.services.twilio_service import TwilioService

router = APIRouter()


@router.post("/trigger", response_model=SOSTriggerResponse)
async def trigger_sos(
    payload: SOSTriggerRequest,
    user: dict = Depends(verify_firebase_token),
) -> SOSTriggerResponse:
    """SOS Flow: Trigger -> Firestore -> Twilio SMS -> FCM push."""
    event_id = str(uuid.uuid4())
    user_id = user["uid"]

    # 1. Store event in Firestore
    await FirebaseService.create_sos_event(payload, event_id)

    # 2. Get emergency contacts
    contacts = await FirebaseService.get_user_contacts(user_id)

    # 3. Get maps URL
    maps_url = await LocationService.get_maps_url(
        payload.location.latitude, payload.location.longitude
    )

    # 4. Send SMS to contacts
    await TwilioService.send_emergency_sms(payload, contacts)

    # 5. Send FCM push to contacts with app installed
    await FirebaseService.notify_contacts(user_id, event_id, maps_url)

    return SOSTriggerResponse(event_id=event_id, status=SOSStatus.DISPATCHED)
