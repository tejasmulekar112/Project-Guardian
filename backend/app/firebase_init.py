import firebase_admin
from firebase_admin import credentials

from app.config import settings


def init_firebase() -> None:
    """Initialize Firebase Admin SDK. Safe to call multiple times."""
    if firebase_admin._apps:
        return
    cred = credentials.Certificate(settings.firebase_service_account_path)
    firebase_admin.initialize_app(cred, {
        "projectId": settings.firebase_project_id,
    })
