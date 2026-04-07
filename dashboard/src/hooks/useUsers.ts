import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

interface UserRecord {
  uid: string;
  email: string;
  displayName: string;
  phone: string;
  disabled?: boolean;
  emergencyContacts: Array<{
    name: string;
    phone: string;
    relationship: string;
  }>;
}

export function useUsers() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      })) as UserRecord[];
      setUsers(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return { users, loading };
}

export type { UserRecord };
