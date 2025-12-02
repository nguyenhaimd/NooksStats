import React, { useMemo } from 'react';
import { 
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, 
  Tooltip, Legend, CartesianGrid, ReferenceLine, BarChart, Bar, Cell 
} from 'recharts';
import { LeagueData } from '../types';
import { Target, TrendingUp, Skull, Zap, Trophy, Medal, AlertTriangle } from 'lucide-react';

interface AdvancedStatsProps {
  data: LeagueData;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl">
        <p className="font-bold text-white mb-1">{data.name}</p>
        <div className="text-xs space-y-1">
          <p className="text-indigo-400">Avg PF: <span className="text-white">{data.y.toFixed(1)}</span></p>
          <p className="text-purple-400">Avg PA: <span className="text-white">{data.x.toFixed(1)}</span></p>
          <p className="text-slate-500 italic mt-1">{data.quadrant}</p>
        </div>
      </div>
    );
  }
  return null;
};

export const AdvancedStats: React.FC<AdvancedStatsProps> = ({ data }) => {
  
  // --- 1. Luck Quadrant Data ---
  const luckData = useMemo(() => {
    let totalPF = 0;
    let totalPA = 0;
    let managerCounts = 0;

    const mgrStats = data.managers.map(mgr => {
      let mPF = 0;
      let mPA = 0;
      let mGames = 0;

      data.seasons.forEach(s => {
        const stand = s.standings.find(st => st.managerId === mgr.id);
        if (stand) {
          mPF += stand.stats.pointsFor;
          mPA += stand.stats.pointsAgainst;
          // Approximate games from wins/losses/ties to get per-game average
          mGames += (stand.stats.wins + stand.stats.losses + stand.stats.ties);
        }
      });

      if (mGames === 0) return null;

      const avgPF = mPF / mGames;
      const avgPA = mPA / mGames;

      totalPF += avgPF;
      totalPA += avgPA;
      managerCounts++;

      return {
        id: mgr.id,
        name: mgr.name,
        x: avgPA, // Points Against (Luck axis)
        y: avgPF, // Points For (Skill axis)
        games: mGames
      };
    }).filter(x => x !== null) as any[];

    const leagueAvgPF = totalPF / (managerCounts || 1);
    const leagueAvgPA = totalPA / (managerCounts || 1);

    // Assign Quadrants
    mgrStats.forEach(stat => {
      if (stat.y >= leagueAvgPF && stat.x <= leagueAvgPA) stat.quadrant = "The Juggernaut (Good & Lucky)";
      else if (stat.y >= leagueAvgPF && stat.x > leagueAvgPA) stat.quadrant = "The Glass Cannon (Good but Unlucky)";
      else if (stat.y < leagueAvgPF && stat.x <= leagueAvgPA) stat.quadrant = "The Sleeper (Bad but Lucky)";
      else stat.quadrant = "The Sacko (Bad & Unlucky)";
    });

    return { mgrStats, leagueAvgPF, leagueAvgPA };
  }, [data]);

  // --- 2. Playoff Efficiency Data ---
  const playoffData = useMemo(() => {
    return data.managers.map(mgr => {
      let seasons = 0;
      let playoffs = 0;
      let finals = 0; // Requires game data usually, but we can infer from rank <= 2
      let titles = 0;

      data.seasons.forEach(s => {
        const stand = s.standings.find(st => st.managerId === mgr.id);
        if (stand) {
          seasons++;
          if (stand.stats.isPlayoff) playoffs++;
          if (stand.stats.rank <= 2) finals++;
          if (stand.stats.isChampion) titles++;
        }
      });

      if (seasons < 2) return null; // Filter out temp managers

      return {
        name: mgr.name,
        seasons,
        playoffs,
        finals,
        titles,
        conversionRate: playoffs > 0 ? (titles / playoffs) * 100 : 0
      };
    })
    .filter(x => x !== null)
    .sort((a: any, b: any) => b.titles - a.titles || b.playoffs - a.playoffs)
    .slice(0, 10); // Top 10
  }, [data]);

  // --- 3. Game Margins (Require synced game data) ---
  const gameMargins = useMemo(() => {
    const allGames: any[] = [];
    let hasData = false;

    data.seasons.forEach(s => {
      if (s.games && s.games.length > 0) {
        hasData = true;
        s.games.forEach(g => {
          // Ignore ties for margins
          if (g.teamA.points === 0 || g.teamB.points === 0) return; // Skip dead weeks
          
          const diff = Math.abs(g.teamA.points - g.teamB.points);
          const winner = g.teamA.points > g.teamB.points ? g.teamA : g.teamB;
          const loser = g.teamA.points > g.teamB.points ? g.teamB : g.teamA;
          
          // Get Manager Names
          const winMgr = data.managers.find(m => m.id === winner.managerId)?.name || 'Unknown';
          const loseMgr = data.managers.find(m => m.id === loser.managerId)?.name || 'Unknown';

          allGames.push({
            year: s.year,
            week: g.week,
            diff,
            winner: winMgr,
            loser: loseMgr,
            score: `${Math.max(g.teamA.points, g.teamB.points).toFixed(1)} - ${Math.min(g.teamA.points, g.teamB.points).toFixed(1)}`
          });
        });
      }
    });

    if (!hasData) return null;

    return {
      closest: allGames.sort((a,b) => a.diff - b.diff).slice(0, 5),
      blowouts: allGames.sort((a,b) => b.diff - a.diff).slice(0, 5)
    };
  }, [data]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* ROW 1: Luck Chart */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
             <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-400" />
              The Luck Quadrant
            </h3>
            <p className="text-slate-400 text-sm mt-1">
              Avg Points For vs Avg Points Against (All-Time)
            </p>
          </div>
          <div className="flex gap-2 text-[10px] uppercase font-bold text-slate-500">
             <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Juggernaut</div>
             <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> Glass Cannon</div>
             <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> Sleeper</div>
             <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Sacko</div>
          </div>
        </div>
        
        <div className="h-[400px] w-full bg-slate-900/50 rounded-lg p-4 border border-slate-700/50 relative">
          {/* Quadrant Labels Background */}
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none opacity-10">
              <div className="flex items-start justify-start p-4 text-yellow-500 font-black uppercase tracking-widest text-xs">The Sleepers<br/>(Lucky)</div>
              <div className="flex items-start justify-end p-4 text-emerald-500 font-black uppercase tracking-widest text-xs text-right">The Juggernauts<br/>(Dominant)</div>
              <div className="flex items-end justify-start p-4 text-red-500 font-black uppercase tracking-widest text-xs">The Sackos<br/>(Bad Luck)</div>
              <div className="flex items-end justify-end p-4 text-indigo-500 font-black uppercase tracking-widest text-xs text-right">Glass Cannons<br/>(Unlucky)</div>
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis 
                type="number" 
                dataKey="x" 
                name="Points Against" 
                stroke="#94a3b8" 
                fontSize={12} 
                label={{ value: 'Avg Points Against (Luck)', position: 'bottom', fill: '#64748b', fontSize: 10 }}
                domain={['auto', 'auto']}
              />
              <YAxis 
                type="number" 
                dataKey="y" 
                name="Points For" 
                stroke="#94a3b8" 
                fontSize={12} 
                label={{ value: 'Avg Points For (Skill)', angle: -90, position: 'left', fill: '#64748b', fontSize: 10 }}
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              
              <ReferenceLine x={luckData.leagueAvgPA} stroke="#e2e8f0" strokeDasharray="3 3" opacity={0.3} />
              <ReferenceLine y={luckData.leagueAvgPF} stroke="#e2e8f0" strokeDasharray="3 3" opacity={0.3} />

              <Scatter name="Managers" data={luckData.mgrStats} fill="#8884d8">
                {luckData.mgrStats.map((entry, index) => {
                   let fill = '#ef4444'; // Red (Sacko)
                   if (entry.y >= luckData.leagueAvgPF && entry.x <= luckData.leagueAvgPA) fill = '#10b981'; // Emerald (Jug)
                   else if (entry.y >= luckData.leagueAvgPF && entry.x > luckData.leagueAvgPA) fill = '#6366f1'; // Indigo (Cannon)
                   else if (entry.y < luckData.leagueAvgPF && entry.x <= luckData.leagueAvgPA) fill = '#eab308'; // Yellow (Sleeper)

                   return <Cell key={`cell-${index}`} fill={fill} stroke="white" strokeWidth={1} />;
                })}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ROW 2 LEFT: Playoff Efficiency */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl p-6">
           <div className="mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Playoff Efficiency
              </h3>
              <p className="text-slate-400 text-sm">Appearances vs Titles</p>
           </div>
           
           <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={playoffData} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" fontSize={10} hide />
                    <YAxis dataKey="name" type="category" stroke="#e2e8f0" fontSize={11} width={100} tick={{fill: '#e2e8f0'}} />
                    <Tooltip 
                      cursor={{fill: '#334155', opacity: 0.2}}
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    />
                    <Legend iconSize={8} fontSize={10} />
                    <Bar dataKey="playoffs" name="Playoff Apps" stackId="a" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} />
                    <Bar dataKey="titles" name="Titles" stackId="a" fill="#fbbf24" radius={[0, 4, 4, 0]} barSize={12} />
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* ROW 2 RIGHT: Historical Margins */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl p-6 flex flex-col">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Record Book
              </h3>
              <p className="text-slate-400 text-sm">Historical Matchup Margins</p>
            </div>

            {!gameMargins ? (
               <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-700 rounded-xl bg-slate-900/30">
                  <AlertTriangle className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-slate-400 text-sm">Matchup data not found.</p>
                  <p className="text-xs text-slate-500 mt-1">Run a sync to populate historical game scores.</p>
               </div>
            ) : (
               <div className="flex-1 grid grid-cols-1 gap-4 overflow-y-auto max-h-[300px] custom-scrollbar pr-2">
                  {/* Closest */}
                  <div>
                     <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1">
                        <Medal className="w-3 h-3" /> Heartbreakers (Closest)
                     </h4>
                     <div className="space-y-2">
                        {gameMargins.closest.map((g: any, i: number) => (
                           <div key={i} className="bg-slate-900/50 p-2 rounded text-xs border border-slate-700/50 flex justify-between items-center">
                              <div>
                                 <span className="text-white font-bold">{g.diff.toFixed(2)} pts</span>
                                 <div className="text-slate-500">{g.year} W{g.week}</div>
                              </div>
                              <div className="text-right">
                                 <div className="text-emerald-500">{g.winner}</div>
                                 <div className="text-red-500">{g.loser}</div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>

                  {/* Blowouts */}
                  <div>
                     <h4 className="text-xs font-bold uppercase tracking-wider text-red-400 mb-2 flex items-center gap-1">
                        <Skull className="w-3 h-3" /> Blowouts (Biggest)
                     </h4>
                     <div className="space-y-2">
                        {gameMargins.blowouts.map((g: any, i: number) => (
                           <div key={i} className="bg-slate-900/50 p-2 rounded text-xs border border-slate-700/50 flex justify-between items-center">
                              <div>
                                 <span className="text-white font-bold">{g.diff.toFixed(0)} pts</span>
                                 <div className="text-slate-500">{g.year} W{g.week}</div>
                              </div>
                              <div className="text-right">
                                 <div className="text-emerald-500">{g.winner}</div>
                                 <div className="text-red-500">{g.loser}</div>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
            )}
        </div>
      </div>

    </div>
  );
};