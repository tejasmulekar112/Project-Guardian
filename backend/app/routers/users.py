from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.middleware.auth import verify_firebase_token
from app.models.user import (
    EmergencyContactRequest,
    EmergencyContactResponse,
    UserProfileRequest,
    UserProfileResponse,
)
from app.services.firebase_service import FirebaseService

router = APIRouter()


@router.get("/me", response_model=UserProfileResponse)
async def get_profile(user: dict = Depends(verify_firebase_token)) -> UserProfileResponse:
    """Get the current user's profile."""
    uid = user["uid"]
    profile = await FirebaseService.get_user_profile(uid)
    if profile is None:
        return UserProfileResponse(
            uid=uid, display_name="", phone="", emergency_contacts=[]
        )
    return UserProfileResponse(
        uid=uid,
        display_name=profile.get("display_name", ""),
        phone=profile.get("phone", ""),
        emergency_contacts=[
            EmergencyContactRequest(**c)
            for c in profile.get("emergency_contacts", [])
        ],
    )


@router.put("/me")
async def update_profile(
    body: UserProfileRequest,
    user: dict = Depends(verify_firebase_token),
) -> dict[str, str]:
    """Update the current user's profile."""
    await FirebaseService.upsert_user_profile(user["uid"], body.display_name, body.phone)
    return {"status": "updated"}


@router.get("/me/contacts", response_model=EmergencyContactResponse)
async def get_contacts(user: dict = Depends(verify_firebase_token)) -> EmergencyContactResponse:
    """Get emergency contacts."""
    contacts = await FirebaseService.get_user_contacts(user["uid"])
    return EmergencyContactResponse(
        contacts=[EmergencyContactRequest(**c) for c in contacts]
    )


@router.put("/me/contacts")
async def set_contacts(
    body: EmergencyContactResponse,
    user: dict = Depends(verify_firebase_token),
) -> dict[str, str]:
    """Replace all emergency contacts."""
    await FirebaseService.set_emergency_contacts(
        user["uid"],
        [c.model_dump() for c in body.contacts],
    )
    return {"status": "updated"}


class FcmTokenRequest(BaseModel):
    token: str


@router.put("/me/fcm-token")
async def register_fcm_token(
    body: FcmTokenRequest,
    user: dict = Depends(verify_firebase_token),
) -> dict[str, str]:
    """Register or update FCM push token for the current user."""
    db = FirebaseService._db()
    db.collection("users").document(user["uid"]).set(
        {"fcm_token": body.token},
        merge=True,
    )
    return {"status": "registered"}
