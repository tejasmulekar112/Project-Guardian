from app.models.sos_event import SOSTriggerRequest


class FirebaseService:
    """Stub for Firebase Firestore and FCM operations."""

    @staticmethod
    async def create_sos_event(payload: SOSTriggerRequest, event_id: str) -> str:
        """Store an SOS event in Firestore."""
        # TODO: Initialize firebase_admin and write to Firestore
        # db = firestore.client()
        # doc_ref = db.collection("sos_events").document(event_id)
        # doc_ref.set(payload.model_dump() | {"status": "triggered", ...})
        return event_id

    @staticmethod
    async def notify_contacts(user_id: str, event_id: str) -> None:
        """Send FCM push notifications to the user's emergency contacts."""
        # TODO: Look up user's contacts, send FCM messages
        pass
