import os
import tempfile
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from app.middleware.auth import verify_firebase_token
from app.models.sos_event import SOSStatus, SOSTriggerRequest, SOSTriggerResponse
from app.services.firebase_service import FirebaseService
from app.services.location_service import LocationService
from app.services.twilio_service import TwilioService
from app.services.whisper_service import WhisperService
from app.config import settings

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

    return SOSTriggerResponse(eventId=event_id, status=SOSStatus.DISPATCHED)


@router.post("/voice-detect")
async def voice_detect(
    file: UploadFile,
    user: dict = Depends(verify_firebase_token),
) -> dict:
    """Transcribe audio and detect distress keywords."""
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OpenAI API key not configured")

    # Save uploaded file to temp
    suffix = os.path.splitext(file.filename or "audio.m4a")[1] or ".m4a"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = await WhisperService.detect(tmp_path)
        return result
    finally:
        os.unlink(tmp_path)
