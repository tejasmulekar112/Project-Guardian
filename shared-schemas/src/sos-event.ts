export type SOSStatus = 'triggered' | 'dispatched' | 'acknowledged' | 'resolved';
export type TriggerType = 'manual' | 'voice' | 'shake' | 'voice_background';

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
}

export interface SOSTriggerRequest {
  userId: string;
  location: GeoLocation;
  triggerType: TriggerType;
  message?: string;
}

export interface SOSTriggerResponse {
  eventId: string;
  status: SOSStatus;
}

export interface SOSEventEvidence {
  type: 'audio' | 'video' | 'photo';
  url: string;
  filename: string;
  createdAt: number;
}

export interface SOSEvent {
  id: string;
  userId: string;
  location: GeoLocation;
  triggerType: TriggerType;
  status: SOSStatus;
  message?: string;
  createdAt: number;
  updatedAt: number;
  evidence?: SOSEventEvidence[];
}
