from enum import Enum

from pydantic import BaseModel, Field


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
    accuracyMeters: float | None = None


class SOSTriggerRequest(BaseModel):
    userId: str
    location: GeoLocation
    triggerType: TriggerType = TriggerType.MANUAL
    message: str | None = None


class SOSTriggerResponse(BaseModel):
    eventId: str
    status: SOSStatus
