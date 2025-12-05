
import React, { useState, useMemo } from 'react';
import { LeagueData } from '../types';
import { Trophy, Swords, TrendingUp, AlertCircle, Database } from 'lucide-react';
import { ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid, AreaChart, Area } from 'recharts';

interface VersusProps {
  data: LeagueData;
  token?: string; // Made optional as it's no longer critical for H2H
}

const StatBar = ({ label, valA, valB, unit = '', reverse = false, decimals = 0 }: { label: string, valA: number, valB: number, unit?: string, reverse?: boolean, decimals?: number }) => {
    const total = valA + valB || 1;
    const pctA = valA === 0 && valB === 0 ? 50 : (valA / total) * 100;
    
    const isWinA = reverse ? valA < valB : valA > valB;
    const isWinB = reverse ? valB < valA : valB > valA;
    const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

    return (
        <div className="mb-5 group">
            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                <span className={`transition-colors ${isWinA ? 'text-indigo-400 scale-110 origin-left' : ''}`}>{fmt(valA)}{unit}</span>
                <span className="text-slate-500 group-hover:text-slate-300 transition-colors">{label}</span>
                <span className={`transition-colors ${isWinB ? 'text-purple-400 scale-110 origin-right' : ''}`}>{fmt(valB)}{unit}</span>
            </div>
            <div className="h-2.5 bg-slate-800/50 rounded-full overflow-hidden flex relative shadow-inner">
                 <div 
                    className={`h-full transition-all duration-700 ease-out ${isWinA ? 'bg-gradient-to-r from-indigo-600 to-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-indigo-500/30'}`} 
                    style={{ width: `${pctA}%` }} 
                 />
                 <div className="w-0.5 h-full bg-slate-900/80 z-10" />
                 <div 
                    className={`h-full flex-1 transition-all duration-700 ease-out ${isWinB ? 'bg-gradient-to-l from-purple-600 to-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-purple-500/30'}`} 
                 />
            </div>
        </div>
    );
};

const TrophyCase = ({ count, colorClass }: { count: number, colorClass: string }) => {
    if (count === 0) return <div className="h-8 w-8 rounded-full bg-slate-800/50 border border-slate-700 flex items-center justify-center text-slate-600">-</div>;
    return (
        <div className="flex flex-wrap justify-center gap-1 max-w-[120px]">
            {Array.from({ length: count }).map((_, i) => (
                 <Trophy key={i} className={`w-5 h-5 ${colorClass} drop-shadow-md`} fill="currentColor" />
            ))}
        </div>
    );
};

const CustomTooltip = ({ active, payload, label, managerA, managerB }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const matchups = data.matchups || [];
        const hasData = data.hasData;

        return (
            <div className="bg-slate-900/95 backdrop-blur border border-slate-700 p-4 rounded-xl shadow-2xl min-w-[240px] z-50 animate-in fade-in zoom-in-95 duration-200">
                <div className="font-bold text-slate-200 mb-3 border-b border-slate-700 pb-2 flex justify-between items-center">
                    <span>{data.year} Season</span>
                    {hasData && matchups.length > 0 && (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-600">
                           {matchups.length} Matchups
                        </span>
                    )}
                </div>

                {/* Seasonal Totals */}
                <div className="space-y-2 mb-4">
                    <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                             <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></div>
                             <span className="text-slate-300 font-medium">{managerA.name}</span>
                        </div>
                        <span className="text-white font-mono font-bold">{data[managerA.name].toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                             <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]"></div>
                             <span className="text-slate-300 font-medium">{managerB.name}</span>
                        </div>
                        <span className="text-white font-mono font-bold">{data[managerB.name].toLocaleString()}</span>
                    </div>
                </div>

                {/* H2H Games */}
                {hasData ? (
                    matchups.length > 0 ? (
                        <div className="bg-black/30 rounded-lg p-3 space-y-2 border border-slate-800">
                            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1 flex items-center gap-1.5">
                                <Swords className="w-3 h-3" /> Head-to-Head
                            </div>
                            {matchups.map((m: any, idx: number) => (
                                <div key={idx} className="text-xs">
                                    <div className="flex justify-between text-slate-500 text-[10px] mb-1">
                                    <span>Week {m.week}</span>
                                    {m.isPlayoffs && <span className="text-yellow-500 font-bold flex items-center gap-1"><Trophy className="w-3 h-3" /> Playoffs</span>}
                                    </div>
                                    <div className="flex justify-between items-center bg-slate-800/80 rounded px-2 py-1.5 border border-slate-700/50">
                                        <span className={`font-mono font-bold ${m.myScore > m.oppScore ? 'text-indigo-400' : 'text-slate-400'}`}>
                                            {m.myScore.toFixed(1)}
                                        </span>
                                        <span className="text-slate-600 text-[10px] px-1">vs</span>
                                        <span className={`font-mono font-bold ${m.oppScore > m.myScore ? 'text-purple-400' : 'text-slate-400'}`}>
                                            {m.oppScore.toFixed(1)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-[10px] text-slate-600 italic text-center py-1">
                            No direct matchups this season
                        </div>
                    )
                ) : (
                    <div className="flex items-center gap-2 text-[10px] text-red-400 bg-red-500/10 p-2 rounded">
                        <Database className="w-3 h-3" />
                        Game data missing for this year
                    </div>
                )}
            </div>
        );
    }
    return null;
};

export const Versus: React.FC<VersusProps> = ({ data }) => {
  const [managerAId, setManagerAId] = useState<string>(data.managers[0]?.id || '');
  const [managerBId, setManagerBId] = useState<string>(data.managers[1]?.id || '');
  
  const managerA = data.managers.find(m => m.id === managerAId);
  const managerB = data.managers.find(m => m.id === managerBId);

  const comparison = useMemo(() => {
    if (!managerA || !managerB) return null;

    let statsA = { wins: 0, losses: 0, titles: 0, points: 0, playoffApps: 0, seasons: 0, bestRank: 99, ranks: [] as number[] };
    let statsB = { wins: 0, losses: 0, titles: 0, points: 0, playoffApps: 0, seasons: 0, bestRank: 99, ranks: [] as number[] };
    
    const chartData: any[] = [];
    
    // H2H Record (Calculated directly from stored games)
    let h2hWins = 0;
    let h2hLosses = 0;
    let h2hTies = 0;
    const matchups: any[] = [];
    let hasMatchupData = false;

    data.seasons.forEach(season => {
      const standA = season.standings.find(s => s.managerId === managerA.id);
      const standB = season.standings.find(s => s.managerId === managerB.id);

      const seasonMatchups: any[] = [];
      const seasonHasData = season.games && season.games.length > 0;

      // Calculate Direct Matchups if games are present in league data
      if (seasonHasData) {
          hasMatchupData = true;
          season.games!.forEach(g => {
              let myTeam, oppTeam;
              if (g.teamA.managerId === managerA.id && g.teamB.managerId === managerB.id) {
                  myTeam = g.teamA;
                  oppTeam = g.teamB;
              } else if (g.teamB.managerId === managerA.id && g.teamA.managerId === managerB.id) {
                  myTeam = g.teamB;
                  oppTeam = g.teamA;
              }

              if (myTeam && oppTeam) {
                  let result = 'T';
                  if (myTeam.points > oppTeam.points) { h2hWins++; result='W'; }
                  else if (myTeam.points < oppTeam.points) { h2hLosses++; result='L'; }
                  else h2hTies++;

                  const matchupRecord = {
                      year: season.year,
                      week: g.week,
                      result,
                      myScore: myTeam.points,
                      oppScore: oppTeam.points,
                      isPlayoffs: g.isPlayoffs
                  };

                  matchups.push(matchupRecord);
                  seasonMatchups.push(matchupRecord);
              }
          });
      }

      if (standA && standB) {
        chartData.push({
          year: season.year,
          [managerA.name]: standA.stats.pointsFor,
          [managerB.name]: standB.stats.pointsFor,
          matchups: seasonMatchups.sort((a,b) => a.week - b.week),
          hasData: seasonHasData
        });
      }

      if (standA) {
        statsA.wins += standA.stats.wins;
        statsA.losses += standA.stats.losses;
        statsA.points += standA.stats.pointsFor;
        statsA.seasons++;
        statsA.ranks.push(standA.stats.rank);
        if (standA.stats.isChampion) statsA.titles++;
        if (standA.stats.isPlayoff) statsA.playoffApps++;
        statsA.bestRank = Math.min(statsA.bestRank, standA.stats.rank);
      }

      if (standB) {
        statsB.wins += standB.stats.wins;
        statsB.losses += standB.stats.losses;
        statsB.points += standB.stats.pointsFor;
        statsB.seasons++;
        statsB.ranks.push(standB.stats.rank);
        if (standB.stats.isChampion) statsB.titles++;
        if (standB.stats.isPlayoff) statsB.playoffApps++;
        statsB.bestRank = Math.min(statsB.bestRank, standB.stats.rank);
      }
    });

    const avgRankA = statsA.ranks.length ? (statsA.ranks.reduce((a,b) => a+b, 0) / statsA.ranks.length) : 0;
    const avgRankB = statsB.ranks.length ? (statsB.ranks.reduce((a,b) => a+b, 0) / statsB.ranks.length) : 0;
    
    const winPctA = (statsA.wins / (statsA.wins + statsA.losses || 1)) * 100;
    const winPctB = (statsB.wins / (statsB.wins + statsB.losses || 1)) * 100;

    return { statsA, statsB, winPctA, winPctB, chartData, avgRankA, avgRankB, h2hWins, h2hLosses, h2hTies, matchups, hasMatchupData };
  }, [managerA, managerB, data]);

  if (!managerA || !managerB || !comparison) return <div>Select managers</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      
      {/* --- Controls --- */}
      <div className="bg-slate-900/80 backdrop-blur sticky top-16 z-30 p-4 -mx-4 md:mx-0 border-b border-slate-800 md:border md:rounded-2xl md:top-20 shadow-xl flex items-center justify-between gap-4">
        <div className="flex-1 max-w-xs">
          <select 
            value={managerAId} 
            onChange={(e) => setManagerAId(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 text-indigo-300 font-bold rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {data.managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <Swords className="w-6 h-6 text-slate-500 shrink-0" />
        <div className="flex-1 max-w-xs">
           <select 
            value={managerBId} 
            onChange={(e) => setManagerBId(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 text-purple-300 font-bold rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 outline-none text-right"
          >
            {data.managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      {/* --- Main Infographic Card --- */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border border-slate-700 overflow-hidden shadow-2xl relative">
         <div className="absolute top-0 inset-x-0 h-64 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-900/0 to-slate-900/0 pointer-events-none" />

         <div className="grid grid-cols-1 lg:grid-cols-12">
            
            {/* Manager A */}
            <div className="lg:col-span-3 p-8 flex flex-col items-center border-b lg:border-b-0 lg:border-r border-slate-700/50 bg-indigo-900/5">
                <div className="relative mb-6 group">
                    <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity rounded-full" />
                    <img src={managerA.avatar} alt={managerA.name} className="w-32 h-32 rounded-full border-4 border-indigo-500/50 shadow-2xl relative z-10 object-cover" />
                    <div className="absolute -bottom-3 -right-3 bg-indigo-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg border border-indigo-400 z-20">
                        {comparison.statsA.seasons} Seasons
                    </div>
                </div>
                <h2 className="text-2xl font-black text-white text-center leading-tight mb-4">{managerA.name}</h2>
                
                <div className="flex flex-col items-center gap-4 w-full mt-auto">
                   <div className="bg-slate-800/80 rounded-xl p-4 w-full text-center border border-indigo-500/20">
                       <div className="text-xs text-indigo-300 font-bold uppercase tracking-wider mb-2">Titles</div>
                       <TrophyCase count={comparison.statsA.titles} colorClass="text-indigo-400" />
                   </div>
                   <div className="bg-slate-800/80 rounded-xl p-4 w-full flex justify-between items-center border border-indigo-500/20">
                       <div className="text-left">
                           <div className="text-xs text-slate-500 font-bold uppercase">Win %</div>
                           <div className="text-xl font-bold text-white">{comparison.winPctA.toFixed(1)}%</div>
                       </div>
                       <div className="h-10 w-10 rounded-full border-4 border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400">
                           {comparison.statsA.wins}
                       </div>
                   </div>
                </div>
            </div>

            {/* Center */}
            <div className="lg:col-span-6 p-8 relative">
                <h3 className="text-center text-slate-500 text-xs font-black uppercase tracking-[0.2em] mb-8 flex items-center justify-center gap-4">
                   <span className="h-px w-12 bg-slate-700"></span>
                   Tale of the Tape
                   <span className="h-px w-12 bg-slate-700"></span>
                </h3>

                <div className="space-y-2">
                    <StatBar label="Career Points" valA={Math.round(comparison.statsA.points)} valB={Math.round(comparison.statsB.points)} />
                    <StatBar label="Wins" valA={comparison.statsA.wins} valB={comparison.statsB.wins} />
                    <StatBar label="Playoff Apps" valA={comparison.statsA.playoffApps} valB={comparison.statsB.playoffApps} />
                    <StatBar label="Avg Finish" valA={comparison.avgRankA} valB={comparison.avgRankB} unit="#" reverse={true} decimals={1} />
                    <StatBar label="Best Finish" valA={comparison.statsA.bestRank} valB={comparison.statsB.bestRank} unit="#" reverse={true} />
                </div>

                <div className="mt-10 pt-8 border-t border-slate-700/50">
                     <div className="flex items-center justify-center mb-6">
                        <div className="px-4 py-1 bg-slate-800 rounded-full border border-slate-700 text-xs font-bold text-emerald-400 flex items-center gap-2">
                            <Swords className="w-3 h-3" /> Direct Matchups
                        </div>
                     </div>

                     {!comparison.hasMatchupData ? (
                        <div className="bg-slate-800/50 border border-yellow-500/20 p-4 rounded-xl text-center">
                            <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                            <p className="text-sm text-slate-300">Head-to-Head data not found.</p>
                            <p className="text-xs text-slate-500 mt-1">Please try running the "Update" sync again. It may take a few minutes to fetch all games.</p>
                        </div>
                     ) : (
                        <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 animate-in zoom-in duration-300">
                             <div className="flex items-center justify-center gap-8 mb-6">
                                <div className="text-center">
                                    <div className="text-4xl font-black text-indigo-400">{comparison.h2hWins}</div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">WINS</div>
                                </div>
                                <div className="text-slate-600 font-light text-xl">vs</div>
                                <div className="text-center">
                                    <div className="text-4xl font-black text-purple-400">{comparison.h2hLosses}</div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">WINS</div>
                                </div>
                             </div>
                             <div className="max-h-60 overflow-y-auto custom-scrollbar pr-2 space-y-1">
                                {comparison.matchups.sort((a,b) => b.year - a.year || b.week - a.week).map((g, i) => (
                                    <div key={i} className="flex justify-between items-center text-xs p-2 rounded hover:bg-slate-700/50 transition-colors">
                                        <span className="font-mono text-slate-500 w-24 text-left">{g.year} <span className="text-slate-600">W{g.week}</span></span>
                                        <div className="flex-1 text-center font-mono">
                                            <span className={g.result === 'W' ? 'text-indigo-400 font-bold' : 'text-slate-400'}>{g.myScore.toFixed(1)}</span>
                                            <span className="text-slate-600 mx-2">-</span>
                                            <span className={g.result === 'L' ? 'text-purple-400 font-bold' : 'text-slate-400'}>{g.oppScore.toFixed(1)}</span>
                                        </div>
                                        <span className={`w-6 text-center font-bold ${g.result === 'W' ? 'text-emerald-400' : g.result === 'L' ? 'text-red-400' : 'text-slate-400'}`}>{g.result}</span>
                                    </div>
                                ))}
                             </div>
                         </div>
                     )}
                </div>
            </div>

            {/* Manager B */}
            <div className="lg:col-span-3 p-8 flex flex-col items-center border-t lg:border-t-0 lg:border-l border-slate-700/50 bg-purple-900/5">
                <div className="relative mb-6 group">
                    <div className="absolute inset-0 bg-purple-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity rounded-full" />
                    <img src={managerB.avatar} alt={managerB.name} className="w-32 h-32 rounded-full border-4 border-purple-500/50 shadow-2xl relative z-10 object-cover" />
                     <div className="absolute -bottom-3 -left-3 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg border border-purple-400 z-20">
                        {comparison.statsB.seasons} Seasons
                    </div>
                </div>
                <h2 className="text-2xl font-black text-white text-center leading-tight mb-4">{managerB.name}</h2>
                
                <div className="flex flex-col items-center gap-4 w-full mt-auto">
                   <div className="bg-slate-800/80 rounded-xl p-4 w-full text-center border border-purple-500/20">
                       <div className="text-xs text-purple-300 font-bold uppercase tracking-wider mb-2">Titles</div>
                       <TrophyCase count={comparison.statsB.titles} colorClass="text-purple-400" />
                   </div>
                   <div className="bg-slate-800/80 rounded-xl p-4 w-full flex justify-between items-center border border-purple-500/20">
                       <div className="h-10 w-10 rounded-full border-4 border-purple-500/30 flex items-center justify-center text-xs font-bold text-purple-400">
                           {comparison.statsB.wins}
                       </div>
                       <div className="text-right">
                           <div className="text-xs text-slate-500 font-bold uppercase">Win %</div>
                           <div className="text-xl font-bold text-white">{comparison.winPctB.toFixed(1)}%</div>
                       </div>
                   </div>
                </div>
            </div>
         </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-lg">
        <h3 className="text-white font-bold mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-slate-400" />
            Scoring History
        </h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={comparison.chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorB" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="year" stroke="#94a3b8" fontSize={12} tickMargin={10} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip 
                content={<CustomTooltip managerA={managerA} managerB={managerB} />}
              />
              <Legend verticalAlign="top" height={36} />
              <Area type="monotone" dataKey={managerA.name} stroke="#6366f1" fillOpacity={1} fill="url(#colorA)" strokeWidth={2} />
              <Area type="monotone" dataKey={managerB.name} stroke="#a855f7" fillOpacity={1} fill="url(#colorB)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
};
