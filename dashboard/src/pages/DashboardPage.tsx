import { useEvents } from '../hooks/useEvents';
import { useUsers } from '../hooks/useUsers';
import { useStats } from '../hooks/useStats';
import { StatsBar } from '../components/StatsBar';
import { ActivityFeed } from '../components/ActivityFeed';
import { EventsTable } from '../components/EventsTable';
import { NavLayout } from '../components/NavLayout';

export function DashboardPage() {
  const { events, loading: eventsLoading } = useEvents();
  const { users, loading: usersLoading } = useUsers();
  const stats = useStats(events, users.length);

  const userEmails = new Map(users.map((u) => [u.uid, u.email ?? u.displayName]));

  if (eventsLoading || usersLoading) {
    return (
      <NavLayout>
        <p className="text-gray-400">Loading dashboard...</p>
      </NavLayout>
    );
  }

  return (
    <NavLayout>
      <div className="space-y-6">
        <StatsBar
          totalEvents={stats.totalEvents}
          activeEvents={stats.activeEvents}
          eventsToday={stats.eventsToday}
          totalUsers={stats.totalUsers}
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <EventsTable events={events} userEmails={userEmails} />
          </div>
          <div>
            <ActivityFeed events={events} userEmails={userEmails} />
          </div>
        </div>
      </div>
    </NavLayout>
  );
}
