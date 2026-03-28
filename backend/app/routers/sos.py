import uuid

from fastapi import APIRouter, Depends

from app.middleware.auth import verify_firebase_token
from app.models.sos_event import SOSStatus, SOSTriggerRequest, SOSTriggerResponse

router = APIRouter()


@router.post("/trigger", response_model=SOSTriggerResponse)
async def trigger_sos(
    payload: SOSTriggerRequest,
    user: dict = Depends(verify_firebase_token),
) -> SOSTriggerResponse:
    """SOS Flow: Trigger -> store in Firestore -> notify via FCM -> SMS via Twilio."""
    event_id = str(uuid.uuid4())

    # TODO (Task 3): Wire Firestore storage
    # TODO (Task 5): Wire Twilio SMS
    # TODO (Task 6): Wire FCM push

    return SOSTriggerResponse(event_id=event_id, status=SOSStatus.DISPATCHED)
