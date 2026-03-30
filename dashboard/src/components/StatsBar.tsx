interface StatsBarProps {
  totalEvents: number;
  activeEvents: number;
  eventsToday: number;
  totalUsers: number;
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <p className="text-sm text-gray-400">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export function StatsBar({ totalEvents, activeEvents, eventsToday, totalUsers }: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="Total SOS Events" value={totalEvents} color="text-white" />
      <StatCard label="Active Events" value={activeEvents} color="text-red-400" />
      <StatCard label="Events Today" value={eventsToday} color="text-yellow-400" />
      <StatCard label="Registered Users" value={totalUsers} color="text-blue-400" />
    </div>
  );
}
