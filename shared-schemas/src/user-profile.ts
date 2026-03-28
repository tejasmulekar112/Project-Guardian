export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  phone: string;
  emergencyContacts: EmergencyContact[];
}
