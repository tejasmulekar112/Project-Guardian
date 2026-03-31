import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { SOSStatus } from '@guardian/shared-schemas';

export async function updateEventStatus(
  eventId: string,
  status: SOSStatus,
): Promise<void> {
  const ref = doc(db, 'sos_events', eventId);
  await updateDoc(ref, { status, updated_at: Date.now() });
}
