import json
import logging
import os

import firebase_admin
from firebase_admin import credentials

from app.config import settings

logger = logging.getLogger(__name__)


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
        try:
            cred = credentials.Certificate(json.loads(json_str))
        except json.JSONDecodeError as e:
            logger.error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON: %s", e)
            raise ValueError("FIREBASE_SERVICE_ACCOUNT_JSON contains invalid JSON") from e
    else:
        path = settings.firebase_service_account_path
        if not os.path.isfile(path):
            raise FileNotFoundError(
                f"Firebase service account file not found: {path}. "
                "Set FIREBASE_SERVICE_ACCOUNT_JSON env var or fix the path."
            )
        cred = credentials.Certificate(path)

    firebase_admin.initialize_app(cred, {
        "projectId": settings.firebase_project_id,
    })
    logger.info("Firebase Admin SDK initialized (project: %s)", settings.firebase_project_id)
