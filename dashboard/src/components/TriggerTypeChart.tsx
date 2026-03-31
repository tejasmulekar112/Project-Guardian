import { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';
import type { SOSEvent } from '@guardian/shared-schemas';

interface TriggerTypeChartProps {
  events: SOSEvent[];
}

const COLORS: Record<string, string> = {
  manual: '#F87171',
  voice: '#FBBF24',
  shake: '#60A5FA',
};

export function TriggerTypeChart({ events }: TriggerTypeChartProps) {
  const data = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) {
      counts.set(event.triggerType, (counts.get(event.triggerType) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [events]);

  if (data.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Trigger Types</h3>
        <p className="text-gray-400 text-sm">No data yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-white mb-3">Trigger Types</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={COLORS[entry.name] ?? '#8884d8'}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: 6,
              color: '#fff',
              fontSize: 13,
            }}
          />
          <Legend
            wrapperStyle={{ color: '#9CA3AF', fontSize: 13 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
