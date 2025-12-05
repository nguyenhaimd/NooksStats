import React, { useMemo } from 'react';
import { 
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, 
  Tooltip, Legend, CartesianGrid, ReferenceLine, BarChart, Bar, Cell 
} from 'recharts';
import { LeagueData } from '../types';
import { Target, TrendingUp, Skull, Zap, Trophy, Medal, AlertTriangle, Activity, Flame, Swords, Star } from 'lucide-react';

interface AdvancedStatsProps {
  data: LeagueData;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl z-50">
        <p className="font-bold text-white mb-1">{data.name}</p>
        <div className="text-xs space-y-1">
          {data.quadrant ? (
             <>
                <p className="text-indigo-400">Avg PF: <span className="text-white">{data.y.toFixed(1)}</span></p>
                <p className="text-purple-400">Avg PA: <span className="text-white">{data.x.toFixed(1)}</span></p>
                <p className="text-slate-500 italic mt-1">{data.quadrant}</p>
             </>
          ) : (
             <>
                <p className="text-indigo-400">Consistency: <span className="text-white">±{data.stdDev.toFixed(1)} pts</span></p>
                <p className="text-slate-500">Avg Score: {data.avg.toFixed(1)}</p>
             </>
          )}
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
        x: avgPA, 
        y: avgPF, 
        games: mGames
      };
    }).filter(x => x !== null) as any[];

    const leagueAvgPF = totalPF / (managerCounts || 1);
    const leagueAvgPA = totalPA / (managerCounts || 1);

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
      let finals = 0;
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

      if (seasons < 1) return null;

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
    .slice(0, 10); 
  }, [data]);

  // --- 3. Game Margins & Scores & Luck ---
  const gameStats = useMemo(() => {
    const allGames: any[] = [];
    const scoresByManager: Record<string, number[]> = {};
    const outcomesByManager: Record<string, {result: 'W'|'L'|'T', date: number}[]> = {};
    
    // Schedule Luck (All-Play) Variables
    const allPlayRecords: Record<string, { wins: number, losses: number, actualWins: number, actualLosses: number }> = {};
    const weeklyHighs: Record<string, number> = {};

    let hasData = false;

    data.managers.forEach(m => {
        scoresByManager[m.id] = [];
        outcomesByManager[m.id] = [];
        allPlayRecords[m.id] = { wins: 0, losses: 0, actualWins: 0, actualLosses: 0 };
        weeklyHighs[m.id] = 0;
    });

    data.seasons.forEach(s => {
      if (s.games && s.games.length > 0) {
        hasData = true;
        
        // Group games by week to analyze "The Gauntlet" (All-Play)
        const weeks: Record<number, {managerId: string, points: number}[]> = {};

        // Sort games by week
        const sortedGames = [...s.games].sort((a,b) => a.week - b.week);

        sortedGames.forEach(g => {
          if (g.teamA.points === 0 && g.teamB.points === 0) return;
          
          // Collection for All-Play
          if (!weeks[g.week]) weeks[g.week] = [];
          weeks[g.week].push({ managerId: g.teamA.managerId, points: g.teamA.points });
          weeks[g.week].push({ managerId: g.teamB.managerId, points: g.teamB.points });

          // Basic Stats
          const diff = Math.abs(g.teamA.points - g.teamB.points);
          const winner = g.teamA.points >= g.teamB.points ? g.teamA : g.teamB;
          const loser = g.teamA.points >= g.teamB.points ? g.teamB : g.teamA;
          
          const winMgr = data.managers.find(m => m.id === winner.managerId)?.name || 'Unknown';
          const loseMgr = data.managers.find(m => m.id === loser.managerId)?.name || 'Unknown';

          // For Margins
          allGames.push({
            year: s.year,
            week: g.week,
            diff,
            winner: winMgr,
            loser: loseMgr,
            score: `${Math.max(g.teamA.points, g.teamB.points).toFixed(1)} - ${Math.min(g.teamA.points, g.teamB.points).toFixed(1)}`
          });

          // For Consistency
          if (scoresByManager[g.teamA.managerId]) scoresByManager[g.teamA.managerId].push(g.teamA.points);
          if (scoresByManager[g.teamB.managerId]) scoresByManager[g.teamB.managerId].push(g.teamB.points);

          // For Actual Records & Streaks
          const dateProxy = s.year * 100 + g.week;
          const isTie = Math.abs(g.teamA.points - g.teamB.points) < 0.01;

          if (outcomesByManager[g.teamA.managerId]) {
              let res: 'W'|'L'|'T' = isTie ? 'T' : (g.teamA.points > g.teamB.points ? 'W' : 'L');
              outcomesByManager[g.teamA.managerId].push({ result: res, date: dateProxy });
              if (res === 'W') allPlayRecords[g.teamA.managerId].actualWins++;
              if (res === 'L') allPlayRecords[g.teamA.managerId].actualLosses++;
          }
          if (outcomesByManager[g.teamB.managerId]) {
              let res: 'W'|'L'|'T' = isTie ? 'T' : (g.teamB.points > g.teamA.points ? 'W' : 'L');
              outcomesByManager[g.teamB.managerId].push({ result: res, date: dateProxy });
              if (res === 'W') allPlayRecords[g.teamB.managerId].actualWins++;
              if (res === 'L') allPlayRecords[g.teamB.managerId].actualLosses++;
          }
        });

        // --- All-Play Calculation per Week ---
        Object.values(weeks).forEach(weekScores => {
            if (weekScores.length < 2) return;
            
            // Find Weekly High
            const maxScore = Math.max(...weekScores.map(w => w.points));
            weekScores.filter(w => w.points === maxScore).forEach(w => {
                 if (weeklyHighs[w.managerId] !== undefined) weeklyHighs[w.managerId]++;
            });

            // Compare everyone vs everyone
            for (let i = 0; i < weekScores.length; i++) {
                const p1 = weekScores[i];
                if (!allPlayRecords[p1.managerId]) continue;

                for (let j = 0; j < weekScores.length; j++) {
                    if (i === j) continue;
                    const p2 = weekScores[j];
                    if (p1.points > p2.points) allPlayRecords[p1.managerId].wins++;
                    else if (p1.points < p2.points) allPlayRecords[p1.managerId].losses++;
                }
            }
        });
      }
    });

    if (!hasData) return null;

    // --- Consistency Logic ---
    const consistency = Object.entries(scoresByManager).map(([id, scores]) => {
        if (scores.length < 10) return null; // Need sample size
        const avg = scores.reduce((a,b) => a+b,0) / scores.length;
        const variance = scores.reduce((a,b) => a + Math.pow(b - avg, 2), 0) / scores.length;
        const stdDev = Math.sqrt(variance);
        const mgr = data.managers.find(m => m.id === id);
        return { name: mgr?.name || id, stdDev, avg };
    }).filter(x => x !== null).sort((a,b) => a!.stdDev - b!.stdDev);

    // --- Streaks Logic ---
    const streaks = Object.entries(outcomesByManager).map(([id, outcomes]) => {
        outcomes.sort((a,b) => a.date - b.date);
        let maxW = 0, currentW = 0;
        let maxL = 0, currentL = 0;
        
        outcomes.forEach(o => {
            if (o.result === 'W') {
                currentW++;
                currentL = 0;
                maxW = Math.max(maxW, currentW);
            } else if (o.result === 'L') {
                currentL++;
                currentW = 0;
                maxL = Math.max(maxL, currentL);
            } else {
                currentW = 0;
                currentL = 0;
            }
        });
        
        const mgr = data.managers.find(m => m.id === id);
        return { name: mgr?.name || id, maxW, maxL, avatar: mgr?.avatar };
    }).sort((a,b) => b.maxW - a.maxW);

    // --- Schedule Luck Logic ---
    const luckStats = Object.entries(allPlayRecords).map(([id, rec]) => {
         const totalActual = rec.actualWins + rec.actualLosses || 1;
         const totalAllPlay = rec.wins + rec.losses || 1;
         
         const actualPct = (rec.actualWins / totalActual) * 100;
         const allPlayPct = (rec.wins / totalAllPlay) * 100;
         const luckFactor = actualPct - allPlayPct;
         
         const mgr = data.managers.find(m => m.id === id);
         return { 
             id, 
             name: mgr?.name || 'Unknown', 
             avatar: mgr?.avatar,
             actualPct, 
             allPlayPct, 
             luckFactor,
             actualRec: `${rec.actualWins}-${rec.actualLosses}`,
             allPlayRec: `${rec.wins}-${rec.losses}`,
             weeklyHighs: weeklyHighs[id] || 0
         };
    }).filter(x => x.allPlayPct > 0).sort((a,b) => b.luckFactor - a.luckFactor);

    return {
      closest: allGames.sort((a,b) => a.diff - b.diff).slice(0, 5),
      blowouts: allGames.sort((a,b) => b.diff - a.diff).slice(0, 5),
      consistency,
      streaks: streaks.slice(0, 6),
      luckStats,
      topWeeklyHighs: luckStats.sort((a,b) => b.weeklyHighs - a.weeklyHighs).slice(0, 5)
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
          <div className="flex gap-2 text-[10px] uppercase font-bold text-slate-500 hidden sm:flex">
             <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Juggernaut</div>
             <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500"></span> Glass Cannon</div>
             <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> Sleeper</div>
             <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Sacko</div>
          </div>
        </div>
        
        <div className="h-[400px] w-full bg-slate-900/50 rounded-lg p-4 border border-slate-700/50 relative">
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
                   let fill = '#ef4444'; 
                   if (entry.y >= luckData.leagueAvgPF && entry.x <= luckData.leagueAvgPA) fill = '#10b981';
                   else if (entry.y >= luckData.leagueAvgPF && entry.x > luckData.leagueAvgPA) fill = '#6366f1';
                   else if (entry.y < luckData.leagueAvgPF && entry.x <= luckData.leagueAvgPA) fill = '#eab308';

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
                      itemStyle={{ color: '#e2e8f0' }}
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

            {!gameStats ? (
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
                        {gameStats.closest.map((g: any, i: number) => (
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
                        {gameStats.blowouts.map((g: any, i: number) => (
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

      {gameStats && (
        <>
            {/* ROW 3: Schedule Luck / The Gauntlet */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl p-6">
                 <div className="mb-6">
                   <h3 className="text-xl font-bold text-white flex items-center gap-2">
                     <Swords className="w-5 h-5 text-indigo-400" />
                     The Gauntlet (Schedule Luck)
                   </h3>
                   <p className="text-slate-400 text-sm">Actual Win % vs "All-Play" Win % (Playing every team every week)</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                            <tr>
                                <th className="px-4 py-3">Manager</th>
                                <th className="px-4 py-3 text-center">Actual Win %</th>
                                <th className="px-4 py-3 text-center">All-Play %</th>
                                <th className="px-4 py-3 text-center">Luck Factor</th>
                                <th className="px-4 py-3">Luck Bar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30 text-sm">
                            {gameStats.luckStats.map(stat => (
                                <tr key={stat.id} className="hover:bg-slate-700/20">
                                    <td className="px-4 py-3 font-medium text-white">{stat.name}</td>
                                    <td className="px-4 py-3 text-center text-slate-300">
                                        {stat.actualPct.toFixed(1)}% <span className="text-slate-600 text-[10px] block">({stat.actualRec})</span>
                                    </td>
                                    <td className="px-4 py-3 text-center text-slate-300">
                                        {stat.allPlayPct.toFixed(1)}% <span className="text-slate-600 text-[10px] block">({stat.allPlayRec})</span>
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold">
                                        <span className={stat.luckFactor > 0 ? 'text-emerald-400' : 'text-red-400'}>
                                            {stat.luckFactor > 0 ? '+' : ''}{stat.luckFactor.toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 w-1/3">
                                        <div className="w-full h-2 bg-slate-700 rounded-full relative overflow-hidden flex">
                                            <div className="w-1/2 flex justify-end">
                                                {stat.luckFactor < 0 && (
                                                    <div 
                                                        className="h-full bg-red-500 rounded-l-full" 
                                                        style={{ width: `${Math.min(Math.abs(stat.luckFactor) * 2, 50)}%` }} 
                                                    />
                                                )}
                                            </div>
                                            <div className="w-1/2 flex justify-start border-l border-slate-600">
                                                {stat.luckFactor > 0 && (
                                                     <div 
                                                        className="h-full bg-emerald-500 rounded-r-full" 
                                                        style={{ width: `${Math.min(stat.luckFactor * 2, 50)}%` }} 
                                                    />
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex justify-between text-[8px] text-slate-500 mt-1 px-1">
                                            <span>Unlucky</span>
                                            <span>Lucky</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* ROW 4 LEFT: Consistency */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl p-6">
                    <div className="mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-400" />
                        The Rock
                    </h3>
                    <p className="text-slate-400 text-sm">Most Consistent Scorers (Lowest Std Dev)</p>
                    </div>
                    <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={gameStats.consistency.slice(0, 8)} layout="vertical" margin={{ left: 40, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                            <XAxis type="number" stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `±${v}`} />
                            <YAxis dataKey="name" type="category" stroke="#e2e8f0" fontSize={11} width={100} tick={{fill: '#e2e8f0'}} />
                            <Tooltip 
                                cursor={{fill: '#334155', opacity: 0.2}}
                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                                itemStyle={{ color: '#e2e8f0' }}
                                formatter={(val: number) => [`±${val.toFixed(2)} pts`, "Std Dev"]}
                            />
                            <Bar dataKey="stdDev" fill="#818cf8" radius={[0, 4, 4, 0]} barSize={16} />
                        </BarChart>
                    </ResponsiveContainer>
                    </div>
                </div>

                {/* ROW 4 RIGHT: Streaks & Weekly Highs */}
                <div className="space-y-4">
                     {/* Weekly Highs */}
                    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl p-6">
                         <div className="mb-4">
                             <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Star className="w-5 h-5 text-yellow-400" />
                                Weekly Dominance
                             </h3>
                             <p className="text-slate-400 text-sm">Most "Highest Score of the Week"</p>
                         </div>
                         <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                             {gameStats.topWeeklyHighs.map((stat, idx) => (
                                 <div key={idx} className="shrink-0 bg-slate-900/50 p-3 rounded-lg border border-yellow-500/20 min-w-[100px] flex flex-col items-center">
                                      <div className="text-2xl font-black text-yellow-500 mb-1">{stat.weeklyHighs}</div>
                                      <div className="text-xs text-white text-center font-bold truncate max-w-[80px]">{stat.name}</div>
                                 </div>
                             ))}
                         </div>
                    </div>

                     {/* Streaks */}
                    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl p-6">
                        <div className="mb-4">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Flame className="w-5 h-5 text-orange-500" />
                                The Streak
                            </h3>
                            <p className="text-slate-400 text-sm">Longest Consecutive Wins (All-Time)</p>
                        </div>
                        <div className="space-y-2">
                            {gameStats.streaks.map((s: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-3 p-2 bg-slate-900/50 rounded-lg border border-slate-700/50">
                                    <div className="text-lg font-black text-slate-600 w-6 text-center">{idx + 1}</div>
                                    <img src={s.avatar} alt="" className="w-8 h-8 rounded-full border border-slate-600" />
                                    <div className="flex-1">
                                        <div className="font-bold text-white text-sm">{s.name}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-orange-500 leading-none">{s.maxW}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
      )}

    </div>
  );
};