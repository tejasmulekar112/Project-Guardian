import json
import os

import firebase_admin
from firebase_admin import credentials

from app.config import settings


def init_firebase() -> None:
    """Initialize Firebase Admin SDK. Safe to call multiple times.

    Supports two modes:
    - FIREBASE_SERVICE_ACCOUNT_JSON env var (JSON string, for cloud deployment)
    - FIREBASE_SERVICE_ACCOUNT_PATH file path (for local development)
    """
    if firebase_admin._apps:
        return

    json_str = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if json_str:
        cred = credentials.Certificate(json.loads(json_str))
    else:
        cred = credentials.Certificate(settings.firebase_service_account_path)

    firebase_admin.initialize_app(cred, {
        "projectId": settings.firebase_project_id,
    })
