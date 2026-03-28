import type { GeoLocation } from './sos-event';

export type { GeoLocation };

export interface LocationUpdate {
  userId: string;
  location: GeoLocation;
  timestamp: number;
  batteryLevel?: number;
}
