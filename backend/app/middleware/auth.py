from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from firebase_admin import auth

security = HTTPBearer(auto_error=False)


async def verify_firebase_token(
    credentials: HTTPAuthorizationCredentials | None = Security(security),
) -> dict:
    """Verify Firebase Auth ID token from Authorization header."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    try:
        decoded = auth.verify_id_token(credentials.credentials)
    except auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Token verification failed")

    return decoded
