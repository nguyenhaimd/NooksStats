import React, { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { LeagueData } from '../types';
import { BarChart2, Percent } from 'lucide-react';

interface HistoryChartProps {
  data: LeagueData;
}

export const HistoryChart: React.FC<HistoryChartProps> = ({ data }) => {
  const [metric, setMetric] = useState<'points' | 'winPct'>('points');

  // Transform data for chart
  const chartData = data.seasons.map(season => {
    const entry: any = { year: season.year };
    season.standings.forEach(s => {
      const mgr = data.managers.find(m => m.id === s.managerId);
      if (mgr) {
        if (metric === 'points') {
            entry[mgr.name] = s.stats.pointsFor;
        } else {
            const total = s.stats.wins + s.stats.losses + s.stats.ties || 1;
            entry[mgr.name] = Number(((s.stats.wins / total) * 100).toFixed(1));
        }
      }
    });
    return entry;
  });

  // Pick top 5 managers (most active or most points) to display to avoid clutter
  // Simple heuristic: Managers with most seasons
  const mgrSeasons = new Map<string, number>();
  data.seasons.forEach(s => s.standings.forEach(st => mgrSeasons.set(st.managerId, (mgrSeasons.get(st.managerId)||0)+1)));
  
  const topManagers = data.managers
    .filter(m => (mgrSeasons.get(m.id) || 0) > 1) // Must have played more than 1 season
    .sort((a,b) => (mgrSeasons.get(b.id)||0) - (mgrSeasons.get(a.id)||0))
    .slice(0, 6);

  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl">
      <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-100">{metric === 'points' ? 'Points History' : 'Win % History'}</h3>
          <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
             <button 
                onClick={() => setMetric('points')}
                className={`p-2 rounded flex items-center gap-2 text-xs font-bold transition-colors ${metric === 'points' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
             >
                <BarChart2 className="w-3 h-3" /> Points
             </button>
             <button 
                onClick={() => setMetric('winPct')}
                className={`p-2 rounded flex items-center gap-2 text-xs font-bold transition-colors ${metric === 'winPct' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
             >
                <Percent className="w-3 h-3" /> Win %
             </button>
          </div>
      </div>
      
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
            <XAxis dataKey="year" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" domain={['auto', 'auto']} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
              itemStyle={{ color: '#e2e8f0' }}
            />
            <Legend />
            {topManagers.map((mgr, idx) => (
              <Line 
                key={mgr.id}
                type="monotone" 
                dataKey={mgr.name} 
                stroke={`hsl(${idx * 55 + 200}, 80%, 60%)`} 
                strokeWidth={2}
                dot={{ r: 3, fill: `hsl(${idx * 55 + 200}, 80%, 60%)` }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
