import type { SOSTriggerRequest, SOSTriggerResponse } from '@guardian/shared-schemas';
import { auth } from './firebase';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
console.log('API_URL configured as:', API_URL);

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Not authenticated');
  }
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'ngrok-skip-browser-warning': 'true',
  };
}

export async function triggerSOS(payload: SOSTriggerRequest): Promise<SOSTriggerResponse> {
  const headers = await getAuthHeaders();
  const url = `${API_URL}/sos/trigger`;
  const body = JSON.stringify(payload);
  console.log('SOS REQUEST URL:', url);
  console.log('SOS REQUEST BODY:', body);
  console.log('SOS REQUEST HEADERS:', JSON.stringify(headers));

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.log('SOS ERROR RESPONSE:', response.status, errorBody);
    throw new Error(`SOS trigger failed: ${response.status} - ${errorBody}`);
  }

  return response.json() as Promise<SOSTriggerResponse>;
}

export async function healthCheck(): Promise<{ status: string }> {
  const response = await fetch(`${API_URL}/health`, {
    headers: { 'ngrok-skip-browser-warning': 'true' },
  });
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

