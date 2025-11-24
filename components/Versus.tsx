import React, { useState, useMemo, useEffect } from 'react';
import { LeagueData, Manager } from '../types';
import { Trophy, X, Medal, TrendingUp, Skull, Calculator, Swords, Loader2, PlayCircle, AlertTriangle } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { fetchMatchups } from '../services/yahooService';

interface VersusProps {
  data: LeagueData;
  token: string;
}

export const Versus: React.FC<VersusProps> = ({ data, token }) => {
  const [managerAId, setManagerAId] = useState<string>(data.managers[0]?.id || '');
  const [managerBId, setManagerBId] = useState<string>(data.managers[1]?.id || '');
  
  // Head to Head State
  const [h2hLoading, setH2hLoading] = useState(false);
  const [h2hError, setH2hError] = useState<string | null>(null);
  const [h2hStats, setH2hStats] = useState<{wins: number, losses: number, ties: number, games: any[]} | null>(null);

  const managerA = data.managers.find(m => m.id === managerAId);
  const managerB = data.managers.find(m => m.id === managerBId);

  // Reset H2H when managers change
  useEffect(() => {
    setH2hStats(null);
    setH2hError(null);
  }, [managerAId, managerBId]);

  const comparison = useMemo(() => {
    if (!managerA || !managerB) return null;

    let statsA = { wins: 0, titles: 0, points: 0, playoffApps: 0, seasons: 0, bestRank: 99, ranks: [] as number[] };
    let statsB = { wins: 0, titles: 0, points: 0, playoffApps: 0, seasons: 0, bestRank: 99, ranks: [] as number[] };
    
    // Head to Head (Legacy - Standings based)
    let aFinishedAhead = 0;
    let bFinishedAhead = 0;
    
    const chartData: any[] = [];
    const commonSeasons: any[] = [];

    data.seasons.forEach(season => {
      const standA = season.standings.find(s => s.managerId === managerA.id);
      const standB = season.standings.find(s => s.managerId === managerB.id);

      if (standA && standB) {
        if (standA.stats.rank < standB.stats.rank) aFinishedAhead++;
        else bFinishedAhead++;

        chartData.push({
          year: season.year,
          [managerA.name]: standA.stats.pointsFor,
          [managerB.name]: standB.stats.pointsFor
        });

        // Track team keys for later H2H lookup
        // Ensure team keys are valid
        if (standA.teamKey && standB.teamKey) {
            commonSeasons.push({
               year: season.year,
               teamKeyA: standA.teamKey,
               teamKeyB: standB.teamKey
            });
        }
      }

      if (standA) {
        statsA.wins += standA.stats.wins;
        statsA.points += standA.stats.pointsFor;
        statsA.seasons++;
        statsA.ranks.push(standA.stats.rank);
        if (standA.stats.isChampion) statsA.titles++;
        if (standA.stats.isPlayoff) statsA.playoffApps++;
        statsA.bestRank = Math.min(statsA.bestRank, standA.stats.rank);
      }

      if (standB) {
        statsB.wins += standB.stats.wins;
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

    return { statsA, statsB, aFinishedAhead, bFinishedAhead, chartData, avgRankA, avgRankB, commonSeasons };
  }, [managerA, managerB, data]);

  const loadHeadToHead = async () => {
    if (!comparison || !managerA || !managerB) return;
    setH2hLoading(true);
    setH2hError(null);
    try {
      // 1. Gather all Team Keys for Manager A in common seasons
      const keysA = comparison.commonSeasons.map(cs => cs.teamKeyA).filter(k => !!k);
      
      if (keysA.length === 0) {
        // Technically this happens if they never played in the same season, 
        // but the UI should probably prevent this.
        setH2hStats({ wins: 0, losses: 0, ties: 0, games: [] });
        return;
      }

      // 2. Fetch Matchups
      const rawMatchups = await fetchMatchups(token, keysA);
      
      // 3. Process to find games against Manager B
      const games: any[] = [];
      let w = 0, l = 0, t = 0;

      rawMatchups.forEach(m => {
        // Find the season context to know who is who
        const myTeam = m.teams.find((t: any) => t.team_key === m.teamKey);
        const oppTeam = m.teams.find((t: any) => t.team_key !== m.teamKey);
        
        if (!oppTeam) return;

        // Does oppTeam key match Manager B's key for this season?
        const matchingSeason = comparison.commonSeasons.find(cs => cs.teamKeyA === m.teamKey);
        
        // IMPORTANT: Validate matchingSeason exists and matches the opponent key
        if (matchingSeason && matchingSeason.teamKeyB === oppTeam.team_key) {
           // FOUND A MATCHUP!
           const myScore = parseFloat(myTeam.team_points.total);
           const oppScore = parseFloat(oppTeam.team_points.total);
           
           // Determine result
           let result = 'T';
           if (myScore > oppScore) { result = 'W'; w++; }
           else if (myScore < oppScore) { result = 'L'; l++; }
           else t++;

           games.push({
             year: matchingSeason.year,
             week: m.week,
             result,
             myScore,
             oppScore,
             isPlayoffs: m.isPlayoffs
           });
        }
      });
      
      // Sort games by date (Year desc, Week desc)
      games.sort((a,b) => (b.year - a.year) || (b.week - a.week));

      setH2hStats({ wins: w, losses: l, ties: t, games });

    } catch (e: any) {
      console.error("Failed to load H2H", e);
      setH2hError("Could not retrieve detailed matchup history. This may be due to API timeouts or league privacy settings.");
    } finally {
      setH2hLoading(false);
    }
  };

  if (!managerA || !managerB || !comparison) return <div>Select managers</div>;

  const StatRow = ({ label, valA, valB, unit = '', reverse = false }: { label: string, valA: number, valB: number, unit?: string, reverse?: boolean }) => {
    const aWins = reverse ? valA < valB : valA > valB;
    const bWins = reverse ? valB < valA : valB > valA;
    
    return (
      <div className="flex items-center justify-between py-3 border-b border-slate-700/50 last:border-0">
        <div className={`w-1/3 text-right font-mono ${aWins ? 'text-green-400 font-bold' : 'text-slate-400'}`}>
          {valA.toLocaleString()}{unit}
        </div>
        <div className="w-1/3 text-center text-xs uppercase tracking-wider font-semibold text-slate-500">
          {label}
        </div>
        <div className={`w-1/3 text-left font-mono ${bWins ? 'text-green-400 font-bold' : 'text-slate-400'}`}>
          {valB.toLocaleString()}{unit}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Controls */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="w-full md:w-5/12">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Contender A</label>
          <select 
            value={managerAId} 
            onChange={(e) => setManagerAId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {data.managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        
        <div className="bg-slate-900 rounded-full p-2">
          <Swords className="w-6 h-6 text-slate-500" />
        </div>

        <div className="w-full md:w-5/12">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Contender B</label>
          <select 
            value={managerBId} 
            onChange={(e) => setManagerBId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {data.managers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      {/* Main Tale of the Tape */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Manager A Card */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-indigo-500"></div>
          <img src={managerA.avatar} alt={managerA.name} className="w-24 h-24 rounded-full border-4 border-indigo-500 shadow-lg mb-4" />
          <h2 className="text-2xl font-bold text-white">{managerA.name}</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 w-full">
            <div className="bg-slate-900/50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-white">{comparison.statsA.titles}</div>
              <div className="text-xs text-slate-500 uppercase">Titles</div>
            </div>
            <div className="bg-slate-900/50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-white">{comparison.statsA.wins}</div>
              <div className="text-xs text-slate-500 uppercase">Wins</div>
            </div>
          </div>
        </div>

        {/* Stats Comparison Column */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
          <h3 className="text-center text-indigo-400 text-sm font-bold uppercase tracking-widest mb-6">Tale of the Tape</h3>
          
          <StatRow label="Seasons Played" valA={comparison.statsA.seasons} valB={comparison.statsB.seasons} />
          <StatRow label="Total Points" valA={Math.round(comparison.statsA.points)} valB={Math.round(comparison.statsB.points)} />
          <StatRow label="Playoff Apps" valA={comparison.statsA.playoffApps} valB={comparison.statsB.playoffApps} />
          <StatRow label="Best Finish" valA={comparison.statsA.bestRank} valB={comparison.statsB.bestRank} unit="#" reverse={true} />
          <StatRow label="Avg Finish" valA={parseFloat(comparison.avgRankA.toFixed(1))} valB={parseFloat(comparison.avgRankB.toFixed(1))} unit="#" reverse={true} />
          
          <div className="mt-6 pt-6 border-t border-slate-800">
            <div className="text-center mb-2 text-xs text-slate-500">Seasons Finished Ahead</div>
            <div className="flex items-center h-8 rounded-full overflow-hidden bg-slate-800">
              <div 
                 className="h-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white" 
                 style={{ width: `${(comparison.aFinishedAhead / (comparison.aFinishedAhead + comparison.bFinishedAhead || 1)) * 100}%` }}
              >
                {comparison.aFinishedAhead}
              </div>
              <div 
                 className="h-full bg-purple-500 flex items-center justify-center text-xs font-bold text-white"
                 style={{ width: `${(comparison.bFinishedAhead / (comparison.aFinishedAhead + comparison.bFinishedAhead || 1)) * 100}%` }}
              >
                {comparison.bFinishedAhead}
              </div>
            </div>
          </div>
        </div>

        {/* Manager B Card */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-purple-500"></div>
          <img src={managerB.avatar} alt={managerB.name} className="w-24 h-24 rounded-full border-4 border-purple-500 shadow-lg mb-4" />
          <h2 className="text-2xl font-bold text-white">{managerB.name}</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 w-full">
            <div className="bg-slate-900/50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-white">{comparison.statsB.titles}</div>
              <div className="text-xs text-slate-500 uppercase">Titles</div>
            </div>
            <div className="bg-slate-900/50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-white">{comparison.statsB.wins}</div>
              <div className="text-xs text-slate-500 uppercase">Wins</div>
            </div>
          </div>
        </div>
      </div>

      {/* Head to Head Record Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex flex-col items-center justify-center min-h-[300px]">
             <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                <Swords className="w-5 h-5 text-emerald-400" />
                All-Time Matchup Record
             </h3>

             {!h2hStats && !h2hLoading && !h2hError && (
                <div className="text-center">
                   <p className="text-slate-400 text-sm mb-4 max-w-xs">
                     Analyze every single game these two have played against each other across all seasons.
                   </p>
                   <button 
                     onClick={loadHeadToHead}
                     disabled={!token}
                     className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     <PlayCircle className="w-5 h-5" />
                     Reveal History
                   </button>
                   {!token && <p className="text-xs text-red-400 mt-2">Authentication required</p>}
                </div>
             )}

             {h2hLoading && (
                <div className="flex flex-col items-center gap-3 text-slate-400">
                   <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                   <span className="text-sm">Scanning archival scoreboards...</span>
                </div>
             )}

             {h2hError && (
               <div className="text-center p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                 <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
                 <p className="text-sm text-red-400">{h2hError}</p>
                 <button onClick={loadHeadToHead} className="text-xs underline text-slate-400 mt-2 hover:text-white">Try Again</button>
               </div>
             )}

             {h2hStats && (
                <div className="animate-in zoom-in duration-300 text-center w-full">
                   <div className="flex items-center justify-center gap-8 mb-8">
                      <div className="text-center">
                         <div className="text-5xl font-black text-indigo-400">{h2hStats.wins}</div>
                         <div className="text-xs font-bold text-slate-500 uppercase mt-1">{managerA.name}</div>
                      </div>
                      <div className="text-slate-600 text-2xl font-light">-</div>
                       <div className="text-center">
                         <div className="text-5xl font-black text-purple-400">{h2hStats.losses}</div>
                         <div className="text-xs font-bold text-slate-500 uppercase mt-1">{managerB.name}</div>
                      </div>
                   </div>
                   
                   <div className="bg-slate-900/50 rounded-lg p-4 max-h-48 overflow-y-auto custom-scrollbar text-left border border-slate-700/50">
                      <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 sticky top-0 bg-slate-900 pb-2 border-b border-slate-800">Recent Games</h4>
                      <div className="space-y-2">
                        {h2hStats.games.length === 0 ? (
                           <div className="text-center text-slate-500 text-sm py-4">No direct matchups found.</div>
                        ) : (
                           h2hStats.games.map((g, idx) => (
                              <div key={idx} className="flex justify-between items-center text-sm p-2 hover:bg-slate-800 rounded transition-colors">
                                 <span className="text-slate-500 font-mono text-xs">{g.year} Wk {g.week}</span>
                                 <div className="flex gap-3 font-mono">
                                    <span className={g.result === 'W' ? 'text-indigo-400 font-bold' : 'text-slate-400'}>
                                      {g.myScore.toFixed(1)}
                                    </span>
                                    <span className="text-slate-600">-</span>
                                    <span className={g.result === 'L' ? 'text-purple-400 font-bold' : 'text-slate-400'}>
                                      {g.oppScore.toFixed(1)}
                                    </span>
                                 </div>
                                 <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    g.result === 'W' ? 'bg-emerald-500/10 text-emerald-400' : 
                                    g.result === 'L' ? 'bg-red-500/10 text-red-400' : 'bg-slate-500/10 text-slate-400'
                                 }`}>
                                    {g.result}
                                 </span>
                              </div>
                           ))
                        )}
                      </div>
                   </div>
                </div>
             )}
          </div>

          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <h3 className="text-white font-bold mb-4">Scoring History Comparison</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparison.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="year" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                    itemStyle={{ color: '#e2e8f0' }}
                  />
                  <Legend />
                  <Bar dataKey={managerA.name} fill="#6366f1" />
                  <Bar dataKey={managerB.name} fill="#a855f7" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
      </div>
    </div>
  );
};