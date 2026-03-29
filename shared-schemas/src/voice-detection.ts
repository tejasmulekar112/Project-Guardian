export interface VoiceDetectionResult {
  detected: boolean;
  transcript: string;
  keyword: string | null;
  confidence: number;
}
