from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

security = HTTPBearer(auto_error=False)


async def verify_firebase_token(
    credentials: HTTPAuthorizationCredentials | None = Security(security),
) -> dict:
    """Verify Firebase Auth ID token from Authorization header."""
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing authorization header")

    token = credentials.credentials

    # TODO: Verify token with firebase_admin
    # from firebase_admin import auth
    # try:
    #     decoded = auth.verify_id_token(token)
    #     return decoded
    # except Exception:
    #     raise HTTPException(status_code=401, detail="Invalid token")

    return {"uid": "stub-user", "token": token}
