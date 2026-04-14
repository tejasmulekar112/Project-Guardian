import asyncio
import logging
import time

from firebase_admin import firestore, messaging

from app.models.sos_event import SOSTriggerRequest

logger = logging.getLogger(__name__)


class FirebaseService:
    """Firebase Firestore and FCM operations."""

    @staticmethod
    def _db():
        return firestore.client()

    @staticmethod
    async def create_sos_event(payload: SOSTriggerRequest, event_id: str) -> str:
        """Store an SOS event in Firestore."""
        db = FirebaseService._db()
        doc_ref = db.collection("sos_events").document(event_id)
        data = {
            "user_id": payload.userId,
            "latitude": payload.location.latitude,
            "longitude": payload.location.longitude,
            "accuracy_meters": payload.location.accuracyMeters,
            "trigger_type": payload.triggerType.value,
            "message": payload.message,
            "status": "triggered",
            "created_at": time.time(),
            "updated_at": time.time(),
        }
        await asyncio.to_thread(doc_ref.set, data)
        return event_id

    @staticmethod
    async def get_user_contacts(user_id: str) -> list[dict]:
        """Get emergency contacts for a user from Firestore."""
        db = FirebaseService._db()
        doc = await asyncio.to_thread(
            db.collection("users").document(user_id).get
        )
        if not doc.exists:
            return []
        data = doc.to_dict()
        return data.get("emergency_contacts", [])

    @staticmethod
    async def get_user_profile(user_id: str) -> dict | None:
        """Get user profile from Firestore."""
        db = FirebaseService._db()
        doc = await asyncio.to_thread(
            db.collection("users").document(user_id).get
        )
        if not doc.exists:
            return None
        return doc.to_dict() | {"uid": user_id}

    @staticmethod
    async def upsert_user_profile(user_id: str, display_name: str, phone: str) -> None:
        """Create or update user profile in Firestore."""
        db = FirebaseService._db()
        doc_ref = db.collection("users").document(user_id)
        await asyncio.to_thread(
            doc_ref.set, {"display_name": display_name, "phone": phone}, True
        )

    @staticmethod
    async def set_emergency_contacts(user_id: str, contacts: list[dict]) -> None:
        """Replace all emergency contacts for a user."""
        db = FirebaseService._db()
        doc_ref = db.collection("users").document(user_id)
        await asyncio.to_thread(
            doc_ref.set, {"emergency_contacts": contacts}, True
        )

    @staticmethod
    async def update_fcm_token(user_id: str, token: str) -> None:
        """Register or update FCM push token for a user."""
        db = FirebaseService._db()
        doc_ref = db.collection("users").document(user_id)
        await asyncio.to_thread(
            doc_ref.set, {"fcm_token": token}, True
        )

    @staticmethod
    async def update_event_analysis(event_id: str, analysis: dict) -> None:
        """Update an SOS event with Gemini AI analysis."""
        db = FirebaseService._db()
        doc_ref = db.collection("sos_events").document(event_id)
        await asyncio.to_thread(
            doc_ref.set, {"ai_analysis": analysis, "updated_at": time.time()}, True
        )

    @staticmethod
    async def notify_contacts(user_id: str, event_id: str, maps_url: str) -> int:
        """Send FCM push notifications to emergency contacts that have FCM tokens."""
        contacts = await FirebaseService.get_user_contacts(user_id)
        sent_count = 0
        for contact in contacts:
            fcm_token = contact.get("fcm_token")
            if not fcm_token:
                continue
            message = messaging.Message(
                notification=messaging.Notification(
                    title="SOS Alert!",
                    body=f"Emergency! Location: {maps_url}",
                ),
                token=fcm_token,
            )
            try:
                await asyncio.to_thread(messaging.send, message)
                sent_count += 1
            except Exception as e:
                logger.warning("FCM send failed for contact: %s", e)
        return sent_count
