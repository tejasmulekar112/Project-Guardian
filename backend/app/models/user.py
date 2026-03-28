from pydantic import BaseModel


class EmergencyContactRequest(BaseModel):
    name: str
    phone: str
    relationship: str


class UserProfileRequest(BaseModel):
    display_name: str
    phone: str


class UserProfileResponse(BaseModel):
    uid: str
    display_name: str
    phone: str
    emergency_contacts: list[EmergencyContactRequest]


class EmergencyContactResponse(BaseModel):
    contacts: list[EmergencyContactRequest]
