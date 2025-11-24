import React, { useMemo, useState } from 'react';
import { LeagueData } from '../types';
import { Trophy, ArrowUpDown, ChevronUp, ChevronDown, Medal, AlertCircle } from 'lucide-react';

interface StandingsTableProps {
  data: LeagueData;
}

type SortField = 'legacyScore' | 'wins' | 'winPct' | 'pf' | 'titles' | 'avgRank' | 'playoffPct';

export const StandingsTable: React.FC<StandingsTableProps> = ({ data }) => {
  const [sortField, setSortField] = useState<SortField>('legacyScore');
  const [sortDesc, setSortDesc] = useState(true);

  const allTimeStats = useMemo(() => {
    const stats: Record<string, { 
      wins: number; 
      losses: number; 
      pf: number; 
      titles: number;
      seasons: number;
      playoffApps: number;
      ranks: number[];
      sackos: number;
    }> = {};

    data.managers.forEach(m => {
      stats[m.id] = { wins: 0, losses: 0, pf: 0, titles: 0, seasons: 0, playoffApps: 0, ranks: [], sackos: 0 };
    });

    data.seasons.forEach(s => {
      const numTeams = s.standings.length;
      s.standings.forEach(stand => {
        if (stats[stand.managerId]) {
          stats[stand.managerId].wins += stand.stats.wins;
          stats[stand.managerId].losses += stand.stats.losses;
          stats[stand.managerId].pf += stand.stats.pointsFor;
          stats[stand.managerId].seasons += 1;
          stats[stand.managerId].ranks.push(stand.stats.rank);
          
          if (stand.stats.isChampion) {
            stats[stand.managerId].titles += 1;
          }
          if (stand.stats.isPlayoff) {
            stats[stand.managerId].playoffApps += 1;
          }
          if (stand.stats.rank === numTeams) {
            stats[stand.managerId].sackos += 1;
          }
        }
      });
    });

    return Object.entries(stats)
      .map(([id, stat]) => {
        const winPctVal = stat.wins / (stat.wins + stat.losses || 1);
        const avgRankVal = stat.ranks.reduce((a, b) => a + b, 0) / (stat.seasons || 1);
        const playoffPctVal = stat.playoffApps / (stat.seasons || 1);
        
        // Arbitrary Legacy Score Formula: (Titles * 10) + (Playoffs * 2) + (Wins * 0.5)
        // Normalized roughly to 0-100 range
        const legacyScore = (stat.titles * 10) + (stat.playoffApps * 3) + (stat.wins * 0.5);

        return {
          ...stat,
          manager: data.managers.find(m => m.id === id)!,
          winPct: winPctVal,
          winPctDisplay: winPctVal.toFixed(3),
          avgRank: avgRankVal,
          playoffPct: playoffPctVal,
          legacyScore
        };
      })
      .filter(s => s.seasons > 0) // Filter out managers with no history if any
      .sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        return sortDesc ? (valB > valA ? 1 : -1) : (valA > valB ? 1 : -1);
      });
  }, [data, sortField, sortDesc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortField(field);
      setSortDesc(field !== 'avgRank'); // Default asc for rank, desc for others
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30 ml-1 inline" />;
    return sortDesc ? <ChevronDown className="w-3 h-3 ml-1 inline" /> : <ChevronUp className="w-3 h-3 ml-1 inline" />;
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
      <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Medal className="w-5 h-5 text-indigo-400" />
            Career Stats
          </h3>
          <p className="text-slate-400 text-xs mt-1">
            Ranking based on Legacy Score (Titles x 10 + Playoffs x 3 + Wins x 0.5)
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded">2011 - Present</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider font-semibold">
            <tr>
              <th className="px-6 py-4">Manager</th>
              <th className="px-4 py-4 text-center cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => handleSort('legacyScore')}>
                Legacy <SortIcon field="legacyScore" />
              </th>
              <th className="px-4 py-4 text-center cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => handleSort('titles')}>
                Titles <SortIcon field="titles" />
              </th>
              <th className="px-4 py-4 text-center cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => handleSort('wins')}>
                Wins <SortIcon field="wins" />
              </th>
               <th className="px-4 py-4 text-center cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => handleSort('winPct')}>
                Win % <SortIcon field="winPct" />
              </th>
              <th className="px-4 py-4 text-center cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => handleSort('playoffPct')}>
                Playoff % <SortIcon field="playoffPct" />
              </th>
               <th className="px-4 py-4 text-center cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => handleSort('avgRank')}>
                Avg Rank <SortIcon field="avgRank" />
              </th>
              <th className="px-6 py-4 text-right cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => handleSort('pf')}>
                Total Points <SortIcon field="pf" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {allTimeStats.map((row, idx) => (
              <tr key={row.manager.id} className="hover:bg-indigo-500/5 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 font-mono text-xs w-4">{(idx + 1)}</span>
                    <div className="relative">
                      <img src={row.manager.avatar} alt="" className="w-9 h-9 rounded-full bg-slate-700 object-cover border border-slate-600 group-hover:border-indigo-400 transition-colors" />
                      {row.titles > 0 && (
                        <div className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                          {row.titles}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-200 text-sm">{row.manager.name}</div>
                      <div className="text-[10px] text-slate-500">{row.seasons} Seasons</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="inline-block px-2 py-1 rounded bg-indigo-500/10 text-indigo-300 font-bold text-sm">
                    {row.legacyScore.toFixed(1)}
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  {row.titles > 0 ? (
                    <span className="text-yellow-400 font-bold flex items-center justify-center gap-1">
                      <Trophy className="w-3 h-3" /> {row.titles}
                    </span>
                  ) : <span className="text-slate-700">-</span>}
                </td>
                <td className="px-4 py-4 text-center text-slate-300 text-sm">
                  {row.wins}
                </td>
                <td className="px-4 py-4 text-center">
                  <div className="flex flex-col items-center">
                    <span className={`text-sm font-bold ${
                      row.winPct > 0.6 ? 'text-emerald-400' : 
                      row.winPct < 0.4 ? 'text-red-400' : 'text-slate-400'
                    }`}>
                      {row.winPctDisplay}
                    </span>
                    <div className="w-12 h-1 bg-slate-700 rounded-full mt-1 overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${row.winPct > 0.5 ? 'bg-emerald-500' : 'bg-red-500'}`} 
                        style={{ width: `${row.winPct * 100}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-center text-sm text-slate-300">
                  {(row.playoffPct * 100).toFixed(0)}%
                </td>
                 <td className="px-4 py-4 text-center text-sm text-slate-300">
                  #{row.avgRank.toFixed(1)}
                </td>
                <td className="px-6 py-4 text-right font-mono text-slate-300 text-sm">
                  {row.pf.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};