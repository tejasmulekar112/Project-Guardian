import uuid

from fastapi import APIRouter, Depends

from app.middleware.auth import verify_firebase_token
from app.models.sos_event import SOSStatus, SOSTriggerRequest, SOSTriggerResponse
from app.services.firebase_service import FirebaseService
from app.services.location_service import LocationService

router = APIRouter()


@router.post("/trigger", response_model=SOSTriggerResponse)
async def trigger_sos(
    payload: SOSTriggerRequest,
    user: dict = Depends(verify_firebase_token),
) -> SOSTriggerResponse:
    """SOS Flow: Trigger -> Firestore -> Twilio SMS -> FCM push."""
    event_id = str(uuid.uuid4())

    # 1. Store event in Firestore
    await FirebaseService.create_sos_event(payload, event_id)

    # 2. Get maps URL for notifications
    maps_url = await LocationService.get_maps_url(
        payload.location.latitude, payload.location.longitude
    )

    # TODO (Task 5): Wire Twilio SMS
    # TODO (Task 6): Wire FCM push — await FirebaseService.notify_contacts(user["uid"], event_id, maps_url)

    return SOSTriggerResponse(event_id=event_id, status=SOSStatus.DISPATCHED)
