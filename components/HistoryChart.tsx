import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { LeagueData } from '../types';

interface HistoryChartProps {
  data: LeagueData;
}

export const HistoryChart: React.FC<HistoryChartProps> = ({ data }) => {
  // Transform data for chart: array of objects { year: 2011, ManagerA: 1400, ManagerB: 1200 ... }
  const chartData = data.seasons.map(season => {
    const entry: any = { year: season.year };
    season.standings.forEach(s => {
      const mgr = data.managers.find(m => m.id === s.managerId);
      if (mgr) {
        entry[mgr.name] = s.stats.pointsFor;
      }
    });
    return entry;
  });

  // Pick top 5 managers to display to avoid clutter
  const topManagers = data.managers.slice(0, 5);

  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl">
      <h3 className="text-xl font-bold text-slate-100 mb-4">Points History (Top 5 Managers)</h3>
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="year" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
              itemStyle={{ color: '#e2e8f0' }}
            />
            <Legend />
            {topManagers.map((mgr, idx) => (
              <Line 
                key={mgr.id}
                type="monotone" 
                dataKey={mgr.name} 
                stroke={`hsl(${idx * 45 + 180}, 70%, 50%)`} 
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};