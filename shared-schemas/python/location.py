from pydantic import BaseModel

from .sos_event import GeoLocation


class LocationUpdate(BaseModel):
    user_id: str
    location: GeoLocation
    timestamp: float
    battery_level: float | None = None
