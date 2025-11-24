import React, { useState } from 'react';
import { LeagueData, Transaction } from '../types';
import { ArrowRightLeft, Plus, Trash2, UserPlus } from 'lucide-react';

interface TransactionLogProps {
  data: LeagueData;
}

export const TransactionLog: React.FC<TransactionLogProps> = ({ data }) => {
  const [selectedYear, setSelectedYear] = useState<number>(data.seasons[data.seasons.length - 1].year);
  
  const availableYears = data.seasons.map(s => s.year).sort((a, b) => b - a);
  const activeSeason = data.seasons.find(s => s.year === selectedYear);

  if (!activeSeason) return <div>No data</div>;

  const transactions = activeSeason.transactions || [];

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden animate-in fade-in duration-500">
      <div className="p-6 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-blue-400" />
          Transaction Log
        </h3>
        <select 
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="bg-slate-900 text-white border border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
        >
          {availableYears.map(y => <option key={y} value={y}>{y} Season</option>)}
        </select>
      </div>

      <div className="max-h-[600px] overflow-y-auto">
        {transactions.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No transactions available for this period.
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {transactions.map((txn) => (
              <div key={txn.id} className="p-4 hover:bg-slate-700/20 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs text-slate-500 font-mono">
                    {new Date(txn.date).toLocaleDateString()}
                  </span>
                  <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                    {txn.type}
                  </span>
                </div>
                
                <div className="space-y-2">
                  {txn.players.map((p, idx) => {
                    const mgr = data.managers.find(m => m.id === p.managerId);
                    return (
                      <div key={idx} className="flex items-center gap-3">
                        {p.type === 'add' ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <Plus className="w-3 h-3 text-emerald-500" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </div>
                        )}
                        <div className="flex-1">
                          <span className="text-slate-200 font-medium text-sm">{p.name}</span>
                          <span className="text-slate-500 text-xs mx-2">
                             {p.type === 'add' ? 'to' : 'from'}
                          </span>
                          <span className="text-indigo-400 text-xs font-semibold">
                            {mgr ? mgr.name : 'Waivers'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};