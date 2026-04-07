import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useEvents } from '../hooks/useEvents';
import { useUsers } from '../hooks/useUsers';
import { NavLayout } from '../components/NavLayout';
import { exportEventsToCSV } from '../lib/csv-export';
import { exportEventsToPDF } from '../lib/pdf-export';
import type { SOSEvent } from '@guardian/shared-schemas';

const STATUS_COLORS: Record<string, string> = {
  triggered: '#EF4444',
  dispatched: '#EAB308',
  acknowledged: '#3B82F6',
  resolved: '#22C55E',
};

const TOOLTIP_STYLE = {
  backgroundColor: '#1F2937',
  border: '1px solid #374151',
  borderRadius: 6,
  color: '#fff',
  fontSize: 13,
};

function computeResponseTimes(events: SOSEvent[]) {
  const resolved = events.filter((e) => e.status === 'resolved' && e.updatedAt && e.createdAt);
  if (resolved.length === 0) return { avg: 0, min: 0, max: 0, count: 0 };

  const times = resolved.map((e) => e.updatedAt - e.createdAt);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  return {
    avg: Math.round(avg / 1000),
    min: Math.round(Math.min(...times) / 1000),
    max: Math.round(Math.max(...times) / 1000),
    count: resolved.length,
  };
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
}

export function AnalyticsPage() {
  const { events, loading: eventsLoading } = useEvents();
  const { users, loading: usersLoading } = useUsers();

  const userEmails = useMemo(
    () => new Map(users.map((u) => [u.uid, u.email ?? u.displayName ?? u.uid])),
    [users],
  );

  const responseTimes = useMemo(() => computeResponseTimes(events), [events]);

  const statusData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) {
      counts.set(event.status, (counts.get(event.status) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [events]);

  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, '0')}:00`,
      count: 0,
    }));
    for (const event of events) {
      const h = new Date(event.createdAt).getHours();
      const entry = hours[h];
      if (entry) entry.count++;
    }
    return hours;
  }, [events]);

  const weeklyData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = days.map((day) => ({ day, count: 0 }));
    for (const event of events) {
      const d = new Date(event.createdAt).getDay();
      const entry = counts[d];
      if (entry) entry.count++;
    }
    return counts;
  }, [events]);

  if (eventsLoading || usersLoading) {
    return (
      <NavLayout>
        <p className="text-gray-400">Loading analytics...</p>
      </NavLayout>
    );
  }

  return (
    <NavLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Analytics</h1>
          <div className="flex gap-3">
            <button
              onClick={() => exportEventsToCSV(events, userEmails)}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-md transition-colors"
            >
              Export CSV
            </button>
            <button
              onClick={() => exportEventsToPDF(events, userEmails)}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-md transition-colors"
            >
              Export PDF
            </button>
          </div>
        </div>

        {/* Response Time Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatCard label="Avg Response Time" value={formatDuration(responseTimes.avg)} />
          <StatCard label="Fastest Response" value={formatDuration(responseTimes.min)} />
          <StatCard label="Slowest Response" value={formatDuration(responseTimes.max)} />
          <StatCard label="Resolved Events" value={String(responseTimes.count)} />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status breakdown */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Status Breakdown</h3>
            {statusData.length === 0 ? (
              <p className="text-gray-400 text-sm">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#8884d8'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Events by day of week */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Events by Day of Week</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="day" tick={{ fill: '#9CA3AF', fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" fill="#F87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Events by hour */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Events by Hour of Day</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="hour"
                tick={{ fill: '#9CA3AF', fontSize: 10 }}
                tickLine={false}
                interval={2}
              />
              <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" fill="#60A5FA" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </NavLayout>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <p className="text-xs text-gray-400 uppercase font-medium">{label}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}
