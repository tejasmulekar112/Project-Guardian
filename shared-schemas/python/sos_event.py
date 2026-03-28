from enum import Enum

from pydantic import BaseModel


class SOSStatus(str, Enum):
    TRIGGERED = "triggered"
    DISPATCHED = "dispatched"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"


class TriggerType(str, Enum):
    MANUAL = "manual"
    VOICE = "voice"
    SHAKE = "shake"


class GeoLocation(BaseModel):
    latitude: float
    longitude: float
    accuracy_meters: float | None = None


class SOSTriggerRequest(BaseModel):
    user_id: str
    location: GeoLocation
    trigger_type: TriggerType = TriggerType.MANUAL
    message: str | None = None


class SOSTriggerResponse(BaseModel):
    event_id: str
    status: SOSStatus
