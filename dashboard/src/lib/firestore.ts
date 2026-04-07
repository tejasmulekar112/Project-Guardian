import { doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { SOSStatus } from '@guardian/shared-schemas';

export async function updateEventStatus(
  eventId: string,
  status: SOSStatus,
): Promise<void> {
  const ref = doc(db, 'sos_events', eventId);
  await updateDoc(ref, { status, updated_at: Date.now() });
}

export async function setUserDisabled(
  uid: string,
  disabled: boolean,
): Promise<void> {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { disabled });
}

export async function setUserAdmin(
  uid: string,
  isAdmin: boolean,
): Promise<void> {
  const ref = doc(db, 'admins', uid);
  if (isAdmin) {
    await setDoc(ref, { role: 'admin', updated_at: Date.now() });
  } else {
    await deleteDoc(ref);
  }
}
