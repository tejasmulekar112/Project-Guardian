export type EvidenceType = 'audio' | 'video' | 'photo';

export type EvidenceUploadStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

export interface EvidenceItem {
  type: EvidenceType;
  filename: string;
  localUri: string;
  uploadStatus: EvidenceUploadStatus;
  url?: string;
  createdAt: number;
}

export interface EvidenceManifest {
  eventId: string;
  userId: string;
  items: EvidenceItem[];
}
