import React, { useMemo } from 'react';
import { LeagueData } from '../types';
import { Flame, Snowflake, TrendingUp, TrendingDown, Target, Scale, Zap, ShieldAlert } from 'lucide-react';

interface LeagueRecordsProps {
  data: LeagueData;
}

export const LeagueRecords: React.FC<LeagueRecordsProps> = ({ data }) => {
  const records = useMemo(() => {
    let maxSeasonPF = { mgr: '', val: 0, year: 0, avatar: '' };
    let minSeasonPF = { mgr: '', val: 99999, year: 0, avatar: '' };
    let bestAvgRank = { mgr: '', val: 99, avatar: '' };
    let mostSackos = { mgr: '', val: 0, avatar: '' };
    
    const mgrStats: Record<string, { ranks: number[], sackos: number }> = {};
    
    // Initialize stats
    data.managers.forEach(m => mgrStats[m.id] = { ranks: [], sackos: 0 });

    data.seasons.forEach(season => {
      const numTeams = season.standings.length;
      season.standings.forEach(entry => {
        const mgr = data.managers.find(m => m.id === entry.managerId);
        if (!mgr) return;

        // Single Season High PF
        if (entry.stats.pointsFor > maxSeasonPF.val) {
          maxSeasonPF = { mgr: mgr.name, val: entry.stats.pointsFor, year: season.year, avatar: mgr.avatar };
        }

        // Single Season Low PF
        if (entry.stats.pointsFor < minSeasonPF.val && entry.stats.pointsFor > 0) {
          minSeasonPF = { mgr: mgr.name, val: entry.stats.pointsFor, year: season.year, avatar: mgr.avatar };
        }

        // Sackos (Last Place)
        if (entry.stats.rank === numTeams) {
          mgrStats[entry.managerId].sackos += 1;
        }

        mgrStats[entry.managerId].ranks.push(entry.stats.rank);
      });
    });

    // Find Best Avg Rank
    Object.entries(mgrStats).forEach(([id, stats]) => {
      if (stats.ranks.length === 0) return;
      const avg = stats.ranks.reduce((a, b) => a + b, 0) / stats.ranks.length;
      const mgr = data.managers.find(m => m.id === id);
      if (avg < bestAvgRank.val && mgr) {
        bestAvgRank = { mgr: mgr.name, val: avg, avatar: mgr.avatar };
      }
      
      // Check Sacko King
      if (stats.sackos > mostSackos.val && mgr) {
        mostSackos = { mgr: mgr.name, val: stats.sackos, avatar: mgr.avatar };
      }
    });

    return { maxSeasonPF, minSeasonPF, bestAvgRank, mostSackos };
  }, [data]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* High Score Card */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-orange-500/20 hover:border-orange-500/50 transition-colors group">
        <div className="flex justify-between items-start mb-2">
          <div className="p-2 bg-orange-500/10 rounded-lg group-hover:bg-orange-500/20 transition-colors">
            <Flame className="w-5 h-5 text-orange-500" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400/80">Highest Score</span>
        </div>
        <div className="flex items-center gap-3">
           <img src={records.maxSeasonPF.avatar} alt="" className="w-10 h-10 rounded-full border border-slate-600" />
           <div>
             <div className="text-xl font-bold text-white leading-none">{records.maxSeasonPF.val.toFixed(0)}</div>
             <div className="text-xs text-slate-400 mt-1">{records.maxSeasonPF.mgr} ('{records.maxSeasonPF.year.toString().slice(2)})</div>
           </div>
        </div>
      </div>

      {/* Low Score Card */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-cyan-500/20 hover:border-cyan-500/50 transition-colors group">
        <div className="flex justify-between items-start mb-2">
          <div className="p-2 bg-cyan-500/10 rounded-lg group-hover:bg-cyan-500/20 transition-colors">
            <Snowflake className="w-5 h-5 text-cyan-500" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400/80">Lowest Score</span>
        </div>
        <div className="flex items-center gap-3">
           <img src={records.minSeasonPF.avatar} alt="" className="w-10 h-10 rounded-full border border-slate-600" />
           <div>
             <div className="text-xl font-bold text-white leading-none">{records.minSeasonPF.val.toFixed(0)}</div>
             <div className="text-xs text-slate-400 mt-1">{records.minSeasonPF.mgr} ('{records.minSeasonPF.year.toString().slice(2)})</div>
           </div>
        </div>
      </div>

      {/* Efficiency Card */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-emerald-500/20 hover:border-emerald-500/50 transition-colors group">
        <div className="flex justify-between items-start mb-2">
          <div className="p-2 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
            <Target className="w-5 h-5 text-emerald-500" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">Best Avg Rank</span>
        </div>
        <div className="flex items-center gap-3">
           <img src={records.bestAvgRank.avatar} alt="" className="w-10 h-10 rounded-full border border-slate-600" />
           <div>
             <div className="text-xl font-bold text-white leading-none">#{records.bestAvgRank.val.toFixed(1)}</div>
             <div className="text-xs text-slate-400 mt-1">{records.bestAvgRank.mgr} (Career)</div>
           </div>
        </div>
      </div>

       {/* Sacko Card */}
       <div className="bg-slate-800/50 rounded-xl p-4 border border-red-500/20 hover:border-red-500/50 transition-colors group">
        <div className="flex justify-between items-start mb-2">
          <div className="p-2 bg-red-500/10 rounded-lg group-hover:bg-red-500/20 transition-colors">
            <TrendingDown className="w-5 h-5 text-red-500" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-400/80">Most Last Places</span>
        </div>
        <div className="flex items-center gap-3">
           <img src={records.mostSackos.avatar} alt="" className="w-10 h-10 rounded-full border border-slate-600" />
           <div>
             <div className="text-xl font-bold text-white leading-none">{records.mostSackos.val}</div>
             <div className="text-xs text-slate-400 mt-1">{records.mostSackos.mgr}</div>
           </div>
        </div>
      </div>
    </div>
  );
};