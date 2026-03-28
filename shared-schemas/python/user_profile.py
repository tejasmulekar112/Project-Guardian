from pydantic import BaseModel


class EmergencyContact(BaseModel):
    name: str
    phone: str
    relationship: str


class UserProfile(BaseModel):
    uid: str
    display_name: str
    phone: str
    emergency_contacts: list[EmergencyContact]
