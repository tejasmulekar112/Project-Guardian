import time

from firebase_admin import firestore, messaging

from app.models.sos_event import SOSTriggerRequest


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
        doc_ref.set({
            "user_id": payload.user_id,
            "latitude": payload.location.latitude,
            "longitude": payload.location.longitude,
            "accuracy_meters": payload.location.accuracy_meters,
            "trigger_type": payload.trigger_type.value,
            "message": payload.message,
            "status": "triggered",
            "created_at": time.time(),
            "updated_at": time.time(),
        })
        return event_id

    @staticmethod
    async def get_user_contacts(user_id: str) -> list[dict]:
        """Get emergency contacts for a user from Firestore."""
        db = FirebaseService._db()
        doc = db.collection("users").document(user_id).get()
        if not doc.exists:
            return []
        data = doc.to_dict()
        return data.get("emergency_contacts", [])

    @staticmethod
    async def get_user_profile(user_id: str) -> dict | None:
        """Get user profile from Firestore."""
        db = FirebaseService._db()
        doc = db.collection("users").document(user_id).get()
        if not doc.exists:
            return None
        return doc.to_dict() | {"uid": user_id}

    @staticmethod
    async def upsert_user_profile(user_id: str, display_name: str, phone: str) -> None:
        """Create or update user profile in Firestore."""
        db = FirebaseService._db()
        db.collection("users").document(user_id).set(
            {"display_name": display_name, "phone": phone},
            merge=True,
        )

    @staticmethod
    async def set_emergency_contacts(user_id: str, contacts: list[dict]) -> None:
        """Replace all emergency contacts for a user."""
        db = FirebaseService._db()
        db.collection("users").document(user_id).set(
            {"emergency_contacts": contacts},
            merge=True,
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
                messaging.send(message)
                sent_count += 1
            except Exception:
                pass
        return sent_count
