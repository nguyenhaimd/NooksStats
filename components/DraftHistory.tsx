import React, { useState, useMemo } from 'react';
import { LeagueData } from '../types';
import { Search, Filter } from 'lucide-react';

interface DraftHistoryProps {
  data: LeagueData;
  token: string;
}

export const DraftHistory: React.FC<DraftHistoryProps> = ({ data }) => {
  const [selectedYear, setSelectedYear] = useState<number>(data.seasons[data.seasons.length - 1].year);
  const [searchTerm, setSearchTerm] = useState('');

  const availableYears = data.seasons.map(s => s.year).sort((a, b) => b - a);
  const activeSeason = data.seasons.find(s => s.year === selectedYear);

  const filteredPicks = useMemo(() => {
    if (!activeSeason?.draft) return [];
    
    return activeSeason.draft.filter(pick => {
      const mgr = data.managers.find(m => m.id === pick.managerId);
      const mgrName = mgr ? mgr.name.toLowerCase() : '';
      const term = searchTerm.toLowerCase();
      const pName = pick.player || "Unknown Player";

      return mgrName.includes(term) || 
             pName.toLowerCase().includes(term) ||
             pick.pick.toString() === term;
    });
  }, [activeSeason, searchTerm, data.managers]);

  if (!activeSeason) return <div>No data</div>;

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden animate-in fade-in duration-500">
      {/* Header / Controls */}
      <div className="p-6 border-b border-slate-700 bg-slate-800/50 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Filter className="w-5 h-5 text-emerald-400" />
            Draft History
          </h3>
          <p className="text-slate-400 text-xs mt-1 flex items-center gap-2">
             {activeSeason.draft ? `${activeSeason.draft.length} picks recorded` : 'No draft data available'}
          </p>
        </div>

        <div className="flex gap-3 w-full md:w-auto">
           <select 
             value={selectedYear}
             onChange={(e) => setSelectedYear(parseInt(e.target.value))}
             className="bg-slate-900 text-white border border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none"
           >
             {availableYears.map(y => <option key={y} value={y}>{y} Season</option>)}
           </select>

           <div className="relative flex-1 md:w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
             <input 
               type="text" 
               placeholder="Search manager or player..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full bg-slate-900 pl-10 pr-4 py-2 rounded-lg border border-slate-600 text-white focus:ring-2 focus:ring-emerald-500 outline-none placeholder-slate-600"
             />
           </div>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-x-auto">
        {!activeSeason.draft || activeSeason.draft.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            Draft data not available for this season.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-4 w-24">Pick</th>
                <th className="px-6 py-4">Round</th>
                <th className="px-6 py-4">Manager</th>
                <th className="px-6 py-4">Player</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredPicks.map((pick) => {
                 const mgr = data.managers.find(m => m.id === pick.managerId);
                 
                 return (
                   <tr key={`${pick.round}-${pick.pick}`} className="hover:bg-slate-700/30 transition-colors">
                     <td className="px-6 py-4">
                       <span className="font-mono text-emerald-400 font-bold">#{pick.pick}</span>
                     </td>
                     <td className="px-6 py-4 text-slate-400">
                       {pick.round}
                     </td>
                     <td className="px-6 py-4">
                       <div className="flex items-center gap-3">
                         {mgr && <img src={mgr.avatar} className="w-6 h-6 rounded-full" alt="" />}
                         <span className="text-slate-200 font-medium">{mgr ? mgr.name : 'Unknown'}</span>
                       </div>
                     </td>
                     <td className="px-6 py-4 text-slate-300">
                       <span className="text-white font-medium">{pick.player}</span>
                     </td>
                   </tr>
                 );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
