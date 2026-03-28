import type { SOSTriggerRequest, SOSTriggerResponse } from '@guardian/shared-schemas';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function triggerSOS(payload: SOSTriggerRequest): Promise<SOSTriggerResponse> {
  const response = await fetch(`${API_URL}/sos/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`SOS trigger failed: ${response.status}`);
  }

  return response.json() as Promise<SOSTriggerResponse>;
}

export async function healthCheck(): Promise<{ status: string }> {
  const response = await fetch(`${API_URL}/health`);
  return response.json() as Promise<{ status: string }>;
}
