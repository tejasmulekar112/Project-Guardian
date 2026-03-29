import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import type { EmergencyContact } from '@guardian/shared-schemas';
import { firebaseApp } from './firebase';

const db = getFirestore(firebaseApp);

export async function getContacts(userId: string): Promise<EmergencyContact[]> {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return [];
  const data = snap.data();
  return (data?.emergency_contacts as EmergencyContact[]) ?? [];
}

export async function setContacts(userId: string, contacts: EmergencyContact[]): Promise<void> {
  await setDoc(doc(db, 'users', userId), { emergency_contacts: contacts }, { merge: true });
}
