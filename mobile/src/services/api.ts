import type { SOSTriggerRequest, SOSTriggerResponse } from '@guardian/shared-schemas';
import { auth } from './firebase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Not authenticated');
  }
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
}

export async function triggerSOS(payload: SOSTriggerRequest): Promise<SOSTriggerResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_URL}/sos/trigger`, {
    method: 'POST',
    headers,
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

export async function registerFcmToken(token: string): Promise<void> {
  const headers = await getAuthHeaders();
  await fetch(`${API_URL}/users/me/fcm-token`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ token }),
  });
}
