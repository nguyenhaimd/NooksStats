import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Table2, History, Trophy, Crown, ArrowUpRight, Key, Loader2, AlertCircle, Settings, Link as LinkIcon, CheckCircle2, Gavel, UserPlus, Swords, ChevronRight, Copy, ExternalLink, Save, RotateCcw, ListFilter, CheckSquare, Database, RefreshCw, PlusCircle, ArrowRight, Terminal } from 'lucide-react';
import { fetchYahooData, fetchUserLeagues, LogType } from './services/yahooService';
import { initFirebase, saveLeagueToFirebase, fetchLeagueFromFirebase, fetchLeagueList, FirebaseConfig } from './services/firebaseService';
import { LeagueData, ViewState, LeagueSummary } from './types';
import { HistoryChart } from './components/HistoryChart';
import { StandingsTable } from './components/StandingsTable';
import { LeagueOracle } from './components/LeagueOracle';
import { LeagueRecords } from './components/LeagueRecords';
import { Versus } from './components/Versus';
import { DraftHistory } from './components/DraftHistory';
import { AdvancedStats } from './components/AdvancedStats';

// --- SUB COMPONENTS ---

interface LogEntry {
  type: LogType;
  message: string;
  timestamp: number;
}

interface SyncModalProps {
  loading: boolean;
  logs: LogEntry[];
  error: string | null;
  syncStep: 'TOKEN' | 'SELECT' | 'FETCHING';
  yahooToken: string;
  setYahooToken: (token: string) => void;
  discoveryLeagues: LeagueSummary[];
  leaguesToSync: string[];
  setLeaguesToSync: React.Dispatch<React.SetStateAction<string[]>>;
  handleTokenSubmit: () => void;
  executeSync: () => void;
  onClose: () => void;
}

const SyncModal: React.FC<SyncModalProps> = ({
  loading,
  logs,
  error,
  syncStep,
  yahooToken,
  setYahooToken,
  discoveryLeagues,
  leaguesToSync,
  setLeaguesToSync,
  handleTokenSubmit,
  executeSync,
  onClose
}) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
           <h2 className="text-xl font-bold text-white flex items-center gap-2">
             <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
             Sync with Yahoo
           </h2>
           <button onClick={onClose} className="text-slate-500 hover:text-white"><Swords className="w-5 h-5 rotate-45" /></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
           {error && (
             <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl mb-6 text-sm text-red-400">
               {error}
             </div>
           )}

           {syncStep === 'TOKEN' && (
             <div className="space-y-6">
               <div className="bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-xl">
                 <h3 className="text-indigo-400 font-bold mb-2 flex items-center gap-2">
                   <Key className="w-4 h-4" /> Step 1: Get Access Token
                 </h3>
                 <p className="text-slate-300 text-sm mb-3">
                   Visit the secure token generator to authenticate with Yahoo and copy your access token.
                 </p>
                 <a 
                   href="https://lemon-dune-0cd4b231e.azurestaticapps.net/" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                 >
                   Open Token Generator <ExternalLink className="w-3 h-3" />
                 </a>
               </div>

               <div>
                 <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Step 2: Paste Token</label>
                 <input 
                   type="password"
                   value={yahooToken}
                   onChange={(e) => setYahooToken(e.target.value)}
                   className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                   placeholder="Paste Access Token here..."
                 />
               </div>
             </div>
           )}

           {syncStep === 'SELECT' && (
             <div>
               <p className="text-slate-400 text-sm mb-4">Found {discoveryLeagues.length} leagues. Select the ones you want to merge into this history.</p>
               <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                 {discoveryLeagues.map(l => (
                   <div 
                     key={l.key}
                     onClick={() => setLeaguesToSync(prev => prev.includes(l.key) ? prev.filter(k => k !== l.key) : [...prev, l.key])}
                     className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${leaguesToSync.includes(l.key) ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}
                   >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded flex items-center justify-center border ${leaguesToSync.includes(l.key) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                          {leaguesToSync.includes(l.key) && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div>
                          <div className="text-white font-bold text-sm">{l.name}</div>
                          <div className="text-xs text-slate-500">{l.year} Season</div>
                        </div>
                      </div>
                   </div>
                 ))}
               </div>
             </div>
           )}

           {syncStep === 'FETCHING' && (
             <div className="space-y-4">
               <div className="flex items-center justify-between">
                 <h3 className="text-sm font-bold text-white flex items-center gap-2">
                   <Terminal className="w-4 h-4 text-slate-400" />
                   Sync Log
                 </h3>
                 <span className="text-xs text-slate-500 animate-pulse">Processing...</span>
               </div>
               
               <div 
                 ref={logContainerRef}
                 className="bg-black/50 border border-slate-700 rounded-xl p-4 h-64 overflow-y-auto font-mono text-xs space-y-1 custom-scrollbar"
               >
                 {logs.length === 0 && <span className="text-slate-600">Waiting for logs...</span>}
                 {logs.map((log, idx) => (
                   <div key={idx} className="flex gap-2">
                     <span className="text-slate-600 shrink-0">
                       {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit' })}
                     </span>
                     <span className={`
                       ${log.type === 'INFO' ? 'text-blue-300' : ''}
                       ${log.type === 'SUCCESS' ? 'text-emerald-400 font-bold' : ''}
                       ${log.type === 'WARN' ? 'text-yellow-400' : ''}
                       ${log.type === 'ERROR' ? 'text-red-400 font-bold' : ''}
                     `}>
                       {log.message}
                     </span>
                   </div>
                 ))}
               </div>
               <p className="text-xs text-slate-500 text-center pt-2">
                 Please wait while we fetch historical data. This may take a few minutes.
               </p>
             </div>
           )}
        </div>

        <div className="p-6 border-t border-slate-800 bg-slate-950 flex justify-end gap-3">
          {syncStep !== 'FETCHING' && (
             <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
          )}
          
          {syncStep === 'TOKEN' && (
             <button 
               onClick={handleTokenSubmit} 
               disabled={!yahooToken}
               className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-bold"
             >
               Next
             </button>
          )}

          {syncStep === 'SELECT' && (
             <button 
               onClick={executeSync} 
               disabled={leaguesToSync.length === 0}
               className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"
             >
               <Save className="w-4 h-4" />
               Save to Database
             </button>
          )}
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.DASHBOARD);
  
  // --- STATE ---
  // 1. Configuration
  const [firebaseConfig, setFirebaseConfig] = useState<FirebaseConfig | null>(() => {
    // Priority 1: Check Local Storage (User manual override)
    const saved = localStorage.getItem('firebase_config');
    if (saved) return JSON.parse(saved);

    // Priority 2: Check Environment Variables (Vercel/Build time)
    if (import.meta.env.VITE_FIREBASE_API_KEY) {
      return {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID
      };
    }

    return null;
  });

  // 2. Data
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(localStorage.getItem('active_league_id'));
  const [leagueData, setLeagueData] = useState<LeagueData | null>(null);
  const [savedLeagues, setSavedLeagues] = useState<any[]>([]);

  // 3. UI Flow
  const [isConfiguring, setIsConfiguring] = useState(!firebaseConfig);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncLogs, setSyncLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 4. Sync State
  const [yahooToken, setYahooToken] = useState('');
  const [discoveryLeagues, setDiscoveryLeagues] = useState<LeagueSummary[]>([]);
  const [leaguesToSync, setLeaguesToSync] = useState<string[]>([]);
  const [syncStep, setSyncStep] = useState<'TOKEN' | 'SELECT' | 'FETCHING'>('TOKEN');

  // --- INITIALIZATION ---
  useEffect(() => {
    if (firebaseConfig) {
      try {
        initFirebase(firebaseConfig);
        loadLibrary();
      } catch (e) {
        console.error("Firebase Init Error", e);
        setError("Invalid Firebase Configuration");
        setIsConfiguring(true);
      }
    }
  }, [firebaseConfig]);

  useEffect(() => {
    if (activeLeagueId && !leagueData && !isConfiguring && firebaseConfig) {
      loadLeague(activeLeagueId);
    }
  }, [activeLeagueId, firebaseConfig]);

  // --- ACTIONS ---

  const loadLibrary = async () => {
    try {
      const list = await fetchLeagueList();
      setSavedLeagues(list);
    } catch (e) {
      console.warn("Could not load library", e);
    }
  };

  const loadLeague = async (id: string) => {
    setLoading(true);
    try {
      const data = await fetchLeagueFromFirebase(id);
      if (data) {
        setLeagueData(data);
        setActiveLeagueId(id);
        localStorage.setItem('active_league_id', id);
        setView(ViewState.DASHBOARD);
      } else {
        setError(`League ${id} not found in database.`);
        setActiveLeagueId(null);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigSave = (configStr: string) => {
    try {
      const config = JSON.parse(configStr);
      // Basic validation
      if (!config.apiKey || !config.databaseURL) throw new Error("Invalid Config Object");
      
      localStorage.setItem('firebase_config', JSON.stringify(config));
      setFirebaseConfig(config);
      setIsConfiguring(false);
      setError(null);
    } catch (e) {
      setError("Invalid JSON Configuration. Please check your Firebase config object.");
    }
  };

  const startSync = () => {
    setShowSyncModal(true);
    setSyncStep('TOKEN');
    setError(null);
    setSyncLogs([]);
  };

  const addLog = (type: LogType, message: string) => {
    setSyncLogs(prev => [...prev, { type, message, timestamp: Date.now() }]);
  };

  const handleTokenSubmit = async () => {
    if (!yahooToken) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Discover Leagues
      const leagues = await fetchUserLeagues(yahooToken);
      if (leagues.length === 0) {
        setError("No leagues found for this Yahoo account.");
        setLoading(false);
        return;
      }
      setDiscoveryLeagues(leagues);
      
      // Auto-select active league if exists
      if (activeLeagueId && leagues.some(l => l.key === activeLeagueId)) {
        setLeaguesToSync([activeLeagueId]);
      } else {
        setLeaguesToSync([]);
      }
      
      setSyncStep('SELECT');
    } catch (e: any) {
      let msg = e.message;
      if (msg === 'Failed to fetch' || msg.includes('NetworkError')) {
         msg = "Network Blocked. Please disable AdBlockers (e.g., Privacy Badger) for this site or try a different browser.";
      }
      setError("Failed to validate token: " + msg);
    } finally {
      setLoading(false);
    }
  };

  const executeSync = async () => {
    if (leaguesToSync.length === 0) return;
    setSyncStep('FETCHING');
    setLoading(true);
    setSyncLogs([]);
    addLog('INFO', "Initializing sync process...");
    
    try {
      // Fetch Data with Logger
      const newData = await fetchYahooData(yahooToken, leaguesToSync, addLog);
      
      const primaryKey = leaguesToSync[0]; 
      const primaryName = discoveryLeagues.find(l => l.key === primaryKey)?.name || "Unknown League";

      addLog('INFO', "Saving data to Firebase...");
      await saveLeagueToFirebase(primaryKey, primaryName, newData);
      addLog('SUCCESS', "Sync Complete!");
      
      // Refresh UI
      await loadLibrary();
      await loadLeague(primaryKey);
      
      // Short delay to let user see success
      setTimeout(() => {
          setShowSyncModal(false);
          setYahooToken(''); 
      }, 2000);

    } catch (e: any) {
      setError("Sync Failed: " + e.message);
      addLog('ERROR', e.message);
      // setSyncStep('SELECT'); // Keep logs visible instead of going back
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER HELPERS ---

  const NavButton = ({ v, icon: Icon, label }: { v: ViewState, icon: any, label: string }) => (
    <button 
      onClick={() => setView(v)}
      className={`flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-md text-sm font-medium transition-all ${view === v ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden md:inline">{label}</span>
    </button>
  );

  // --- RENDER ---

  // 1. DATABASE CONFIG SCREEN
  if (isConfiguring) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-6 relative overflow-hidden">
         <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center opacity-10 pointer-events-none" />
         <div className="relative z-10 max-w-lg w-full bg-slate-800/90 backdrop-blur-xl border border-slate-700 p-8 rounded-3xl shadow-2xl">
           <div className="flex justify-center mb-6">
             <div className="bg-indigo-500/20 p-4 rounded-full">
               <Database className="w-12 h-12 text-indigo-400" />
             </div>
           </div>
           <h1 className="text-3xl font-bold text-white text-center mb-2">Setup Database</h1>
           <p className="text-slate-400 text-center mb-8 text-sm">
             To persist your league history, please provide your Firebase Configuration object.
           </p>

           {error && (
             <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl mb-6 flex items-start gap-3">
               <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
               <span className="text-red-400 text-sm">{error}</span>
             </div>
           )}

           <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); handleConfigSave(fd.get('config') as string); }}>
             <div className="mb-6">
               <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Firebase Config JSON</label>
               <textarea 
                 name="config"
                 className="w-full h-40 bg-slate-900 border border-slate-700 rounded-xl p-4 text-xs font-mono text-emerald-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                 placeholder={`{
  "apiKey": "...",
  "authDomain": "...",
  "databaseURL": "...",
  "projectId": "..."
}`}
                 defaultValue={localStorage.getItem('firebase_config') || ''}
               />
             </div>
             <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2">
               <Save className="w-5 h-5" />
               Connect Database
             </button>
           </form>
         </div>
      </div>
    );
  }

  // 2. LEAGUE SELECTOR (If no active league)
  if (!leagueData || !activeLeagueId) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-200">
         <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur p-4">
           <div className="max-w-5xl mx-auto flex justify-between items-center">
             <div className="flex items-center gap-2 font-bold text-white">
               <Trophy className="w-6 h-6 text-indigo-500" />
               NooKs Legacy
             </div>
             <button onClick={() => setIsConfiguring(true)} className="text-xs text-slate-500 hover:text-white flex items-center gap-1">
               <Settings className="w-3 h-3" /> Database Config
             </button>
           </div>
         </nav>
         
         <div className="max-w-4xl mx-auto p-6 mt-12">
            <div className="flex justify-between items-end mb-8">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">League Library</h1>
                <p className="text-slate-400">Select a league to view its history or import a new one.</p>
              </div>
              <button 
                onClick={startSync}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-900/20"
              >
                <PlusCircle className="w-5 h-5" />
                Import League
              </button>
            </div>

            {loading && !showSyncModal && (
              <div className="text-center py-20">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-4" />
                <p className="text-slate-500">Loading library...</p>
              </div>
            )}

            {!loading && savedLeagues.length === 0 && (
               <div className="bg-slate-800/50 border border-dashed border-slate-700 rounded-3xl p-12 text-center">
                 <div className="bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                   <Database className="w-8 h-8 text-slate-600" />
                 </div>
                 <h3 className="text-xl font-bold text-white mb-2">No Leagues Found</h3>
                 <p className="text-slate-500 max-w-sm mx-auto mb-6">Your database is connected but empty. Import your first Yahoo Fantasy League to get started.</p>
                 <button onClick={startSync} className="text-indigo-400 hover:text-indigo-300 font-bold text-sm">Start Import &rarr;</button>
               </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedLeagues.map((league) => (
                <div 
                  key={league.id}
                  onClick={() => loadLeague(league.id)}
                  className="bg-slate-800 border border-slate-700 hover:border-indigo-500 hover:bg-slate-800/80 p-6 rounded-2xl cursor-pointer transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-5 h-5 text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">{league.name}</h3>
                  <div className="flex items-center gap-4 text-sm text-slate-400">
                    <span>{league.seasonCount} Seasons</span>
                    <span className="w-1 h-1 bg-slate-600 rounded-full" />
                    <span>Updated {new Date(league.lastUpdated).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
         </div>
         {showSyncModal && (
           <SyncModal 
             loading={loading}
             logs={syncLogs}
             error={error}
             syncStep={syncStep}
             yahooToken={yahooToken}
             setYahooToken={setYahooToken}
             discoveryLeagues={discoveryLeagues}
             leaguesToSync={leaguesToSync}
             setLeaguesToSync={setLeaguesToSync}
             handleTokenSubmit={handleTokenSubmit}
             executeSync={executeSync}
             onClose={() => setShowSyncModal(false)}
           />
         )}
      </div>
    )
  }

  // 3. MAIN APP
  const currentSeason = leagueData.seasons[leagueData.seasons.length - 1];
  const currentChampId = currentSeason.standings.find(s => s.stats.rank === 1)?.managerId;
  const currentChampName = leagueData.managers.find(m => m.id === currentChampId)?.name || 'Unknown';

  const activeLeagueName = savedLeagues.find(l => l.id === activeLeagueId)?.name || (leagueData.seasons[0].key.includes(activeLeagueId) ? leagueData.seasons[0].key : "League");

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 selection:bg-indigo-500/30">
      <nav className="fixed top-0 left-0 right-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3 shrink-0 cursor-pointer" onClick={() => { setActiveLeagueId(null); setLeagueData(null); }}>
              <div className="bg-indigo-600 p-1.5 rounded-lg">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight hidden sm:block">NooKs Legacy</span>
            </div>
            
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar px-4">
               <NavButton v={ViewState.DASHBOARD} icon={LayoutDashboard} label="Home" />
               <NavButton v={ViewState.STANDINGS} icon={Table2} label="Standings" />
               <NavButton v={ViewState.VERSUS} icon={Swords} label="Versus" />
               <NavButton v={ViewState.DRAFT} icon={Gavel} label="Drafts" />
               <NavButton v={ViewState.HISTORY} icon={History} label="Stats" />
            </div>
            
            <div className="flex items-center shrink-0 gap-2">
              <button onClick={startSync} className="hidden md:flex items-center gap-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-600/50 px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                <RefreshCw className="w-3 h-3" /> Update
              </button>
              <button onClick={() => { setActiveLeagueId(null); setLeagueData(null); loadLibrary(); }} className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors" title="Switch League">
                  <ListFilter className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {view === ViewState.DASHBOARD && (
              <div className="space-y-8 animate-in fade-in duration-500">
                 <div className="relative overflow-hidden bg-gradient-to-r from-indigo-900 to-slate-900 border border-indigo-500/20 rounded-2xl p-8 text-center">
                    <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10"></div>
                    <h2 className="text-3xl font-bold text-white mb-4 relative z-10">{activeLeagueName} Archive</h2>
                    <p className="text-indigo-200/80 max-w-xl mx-auto mb-8 relative z-10 leading-relaxed">
                      Tracking {leagueData.seasons.length} seasons of fantasy dominance.
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4 relative z-10">
                      <button 
                        onClick={() => setView(ViewState.STANDINGS)}
                        className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-indigo-900/20"
                      >
                        <Table2 className="w-4 h-4" /> View Standings
                      </button>
                      <button 
                         onClick={() => setView(ViewState.VERSUS)}
                        className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-semibold transition-all border border-slate-600"
                      >
                        <Swords className="w-4 h-4" /> Compare Managers
                      </button>
                    </div>
                 </div>
                 <LeagueRecords data={leagueData} />
                 <StandingsTable data={leagueData} />
              </div>
            )}

            {view === ViewState.STANDINGS && <div className="animate-in fade-in duration-300"><StandingsTable data={leagueData} /></div>}
            {view === ViewState.VERSUS && <Versus data={leagueData} token={yahooToken} />}
            {view === ViewState.DRAFT && <DraftHistory data={leagueData} token={yahooToken} />}
            {view === ViewState.HISTORY && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <AdvancedStats data={leagueData} />
                <HistoryChart data={leagueData} />
                <h3 className="text-xl font-bold text-white px-1">Season History</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {leagueData.seasons.slice().reverse().map(season => {
                     const champStand = season.standings.find(s => s.stats.rank === 1);
                     const champ = leagueData.managers.find(m => m.id === champStand?.managerId);
                     return (
                       <div key={season.key} className="bg-slate-800 p-5 rounded-xl border border-slate-700 flex justify-between items-center group hover:border-indigo-500/30 transition-all">
                         <div>
                           <div className="text-indigo-400 text-xs font-mono mb-1">{season.year}</div>
                           <div className="text-slate-200 font-bold text-lg">Season {season.year}</div>
                         </div>
                         <div className="text-right">
                           <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Champion</div>
                           <div className="flex items-center justify-end gap-2">
                             <span className="text-white font-medium">{champ?.name || 'TBD'}</span>
                             <Crown className="w-4 h-4 text-yellow-500" />
                           </div>
                         </div>
                       </div>
                     )
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-4">
                <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 relative overflow-hidden group hover:border-yellow-500/30 transition-colors">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
                    <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Reigning Champion</h4>
                    <div className="flex items-center gap-4">
                    <div className="p-3 bg-yellow-500/10 rounded-xl">
                        <Crown className="w-6 h-6 text-yellow-500" />
                    </div>
                    <div className="overflow-hidden">
                        <span className="text-lg font-bold text-white block truncate">{currentChampName}</span>
                        <span className="text-xs text-yellow-500/80">{currentSeason.year} Season</span>
                    </div>
                    </div>
                </div>

                <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
                    <h4 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">League History</h4>
                    <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 rounded-xl">
                        <History className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <span className="text-lg font-bold text-white">{leagueData.seasons.length} Seasons</span>
                        <span className="text-xs text-slate-500 block">{leagueData.seasons[0].year} - {currentSeason.year}</span>
                    </div>
                    </div>
                </div>
            </div>

            <LeagueOracle data={leagueData} />
            
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                Data Source
              </h3>
              <div className="space-y-4">
                 <div className="flex gap-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                  <div className="w-2 h-2 mt-2 bg-indigo-500 rounded-full shrink-0" />
                  <div>
                    <p className="text-slate-200 text-sm font-medium">Firebase Database</p>
                    <span className="text-xs text-slate-500">
                       Last synced: {new Date().toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {yahooToken ? (
                   <div className="flex gap-4 p-3 bg-emerald-900/20 rounded-lg border border-emerald-500/30">
                    <div className="w-2 h-2 mt-2 bg-emerald-500 rounded-full shrink-0 animate-pulse" />
                    <div>
                      <p className="text-emerald-400 text-sm font-medium">Live Session Active</p>
                      <span className="text-xs text-emerald-500/70">
                         Draft & Matchup details available
                      </span>
                    </div>
                  </div>
                ) : (
                   <div className="p-3 rounded-lg border border-dashed border-slate-700 text-center">
                      <p className="text-xs text-slate-500 mb-2">Connect to Yahoo to view details</p>
                      <button onClick={startSync} className="text-xs font-bold text-indigo-400 hover:text-white">Refresh Token</button>
                   </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
      
      {showSyncModal && (
        <SyncModal 
          loading={loading}
          logs={syncLogs}
          error={error}
          syncStep={syncStep}
          yahooToken={yahooToken}
          setYahooToken={setYahooToken}
          discoveryLeagues={discoveryLeagues}
          leaguesToSync={leaguesToSync}
          setLeaguesToSync={setLeaguesToSync}
          handleTokenSubmit={handleTokenSubmit}
          executeSync={executeSync}
          onClose={() => setShowSyncModal(false)}
        />
      )}
    </div>
  );
};

export default App;