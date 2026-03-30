import { useState } from 'react';
import { useUsers } from '../hooks/useUsers';
import { useEvents } from '../hooks/useEvents';
import { NavLayout } from '../components/NavLayout';
import type { UserRecord } from '../hooks/useUsers';

export function UsersPage() {
  const { users, loading: usersLoading } = useUsers();
  const { events, loading: eventsLoading } = useEvents();
  const [expandedUid, setExpandedUid] = useState<string | null>(null);

  const eventCountByUser = new Map<string, number>();
  for (const event of events) {
    eventCountByUser.set(event.userId, (eventCountByUser.get(event.userId) ?? 0) + 1);
  }

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
        <h2 className="text-lg font-semibold text-white mb-3">Registered Users</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-400 uppercase border-b border-gray-700">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">UID</th>
                <th className="px-3 py-2">SOS Events</th>
                <th className="px-3 py-2">Phone</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <UserRow
                  key={user.uid}
                  user={user}
                  eventCount={eventCountByUser.get(user.uid) ?? 0}
                  expanded={expandedUid === user.uid}
                  onToggle={() =>
                    setExpandedUid(expandedUid === user.uid ? null : user.uid)
                  }
                />
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-gray-400">
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
  onToggle,
}: {
  user: UserRecord;
  eventCount: number;
  expanded: boolean;
  onToggle: () => void;
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
      </tr>
      {expanded && user.emergencyContacts?.length > 0 && (
        <tr>
          <td colSpan={4} className="px-6 py-3 bg-gray-750">
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
