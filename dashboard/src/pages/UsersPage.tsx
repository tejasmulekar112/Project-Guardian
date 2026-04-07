import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useUsers } from '../hooks/useUsers';
import { useEvents } from '../hooks/useEvents';
import { NavLayout } from '../components/NavLayout';
import { setUserDisabled, setUserAdmin } from '../lib/firestore';
import type { UserRecord } from '../hooks/useUsers';

export function UsersPage() {
  const { users, loading: usersLoading } = useUsers();
  const { events, loading: eventsLoading } = useEvents();
  const [expandedUid, setExpandedUid] = useState<string | null>(null);
  const [adminUids, setAdminUids] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Listen to admins collection
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'admins'), (snapshot) => {
      setAdminUids(new Set(snapshot.docs.map((doc) => doc.id)));
    });
    return unsubscribe;
  }, []);

  const eventCountByUser = new Map<string, number>();
  for (const event of events) {
    eventCountByUser.set(event.userId, (eventCountByUser.get(event.userId) ?? 0) + 1);
  }

  const handleToggleDisabled = async (user: UserRecord) => {
    const newDisabled = !user.disabled;
    const action = newDisabled ? 'disable' : 'enable';
    if (!window.confirm(`Are you sure you want to ${action} ${user.email}?`)) return;
    setActionLoading(user.uid);
    try {
      await setUserDisabled(user.uid, newDisabled);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAdmin = async (uid: string, email: string) => {
    const isAdmin = adminUids.has(uid);
    const action = isAdmin ? 'remove admin role from' : 'grant admin role to';
    if (!window.confirm(`${action} ${email}?`)) return;
    setActionLoading(uid);
    try {
      await setUserAdmin(uid, !isAdmin);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setActionLoading(null);
    }
  };

  if (usersLoading || eventsLoading) {
    return (
      <NavLayout>
        <p className="text-gray-400">Loading users...</p>
      </NavLayout>
    );
  }

  return (
    <NavLayout>
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">Registered Users</h2>
          <span className="text-sm text-gray-400">{users.length} users</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-400 uppercase border-b border-gray-700">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">UID</th>
                <th className="px-3 py-2">SOS Events</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <UserRow
                  key={user.uid}
                  user={user}
                  eventCount={eventCountByUser.get(user.uid) ?? 0}
                  expanded={expandedUid === user.uid}
                  isAdmin={adminUids.has(user.uid)}
                  isLoading={actionLoading === user.uid}
                  onToggle={() =>
                    setExpandedUid(expandedUid === user.uid ? null : user.uid)
                  }
                  onToggleDisabled={() => handleToggleDisabled(user)}
                  onToggleAdmin={() => handleToggleAdmin(user.uid, user.email)}
                />
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-gray-400">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </NavLayout>
  );
}

function UserRow({
  user,
  eventCount,
  expanded,
  isAdmin,
  isLoading,
  onToggle,
  onToggleDisabled,
  onToggleAdmin,
}: {
  user: UserRecord;
  eventCount: number;
  expanded: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  onToggle: () => void;
  onToggleDisabled: () => void;
  onToggleAdmin: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-gray-700 hover:bg-gray-700/50 cursor-pointer transition-colors"
      >
        <td className="px-3 py-2 text-white">{user.email ?? user.displayName}</td>
        <td className="px-3 py-2 text-gray-400 font-mono text-xs">{user.uid}</td>
        <td className="px-3 py-2 text-gray-300">{eventCount}</td>
        <td className="px-3 py-2 text-gray-300">{user.phone ?? '—'}</td>
        <td className="px-3 py-2">
          {isAdmin ? (
            <span className="text-xs font-medium text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded-full">
              Admin
            </span>
          ) : (
            <span className="text-xs text-gray-500">User</span>
          )}
        </td>
        <td className="px-3 py-2">
          {user.disabled ? (
            <span className="text-xs font-medium text-red-400 bg-red-900/30 px-2 py-0.5 rounded-full">
              Disabled
            </span>
          ) : (
            <span className="text-xs font-medium text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full">
              Active
            </span>
          )}
        </td>
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2">
            <button
              onClick={onToggleDisabled}
              disabled={isLoading}
              className={`text-xs px-2 py-1 rounded font-medium transition-colors disabled:opacity-50 ${
                user.disabled
                  ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50'
                  : 'bg-red-900/30 text-red-400 hover:bg-red-900/50'
              }`}
            >
              {user.disabled ? 'Enable' : 'Disable'}
            </button>
            <button
              onClick={onToggleAdmin}
              disabled={isLoading}
              className={`text-xs px-2 py-1 rounded font-medium transition-colors disabled:opacity-50 ${
                isAdmin
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  : 'bg-blue-900/30 text-blue-400 hover:bg-blue-900/50'
              }`}
            >
              {isAdmin ? 'Remove Admin' : 'Make Admin'}
            </button>
          </div>
        </td>
      </tr>
      {expanded && user.emergencyContacts?.length > 0 && (
        <tr>
          <td colSpan={7} className="px-6 py-3 bg-gray-750">
            <p className="text-xs text-gray-400 mb-2 font-medium uppercase">
              Emergency Contacts
            </p>
            <ul className="space-y-1">
              {user.emergencyContacts.map((contact, i) => (
                <li key={i} className="text-sm text-gray-300">
                  {contact.name} ({contact.relationship}) — {contact.phone}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
