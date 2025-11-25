import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Table2, History, Trophy, Crown, Loader2, AlertCircle, Settings, CheckCircle2, Gavel, UserPlus, Swords, Copy, Key, LogIn, ExternalLink } from 'lucide-react';
import { fetchYahooData } from './services/yahooService';
import { LeagueData, ViewState } from './types';
import { HistoryChart } from './components/HistoryChart';
import { StandingsTable } from './components/StandingsTable';
import { LeagueOracle } from './components/LeagueOracle';
import { LeagueRecords } from './components/LeagueRecords';
import { Versus } from './components/Versus';
import { DraftHistory } from './components/DraftHistory';
import { TransactionLog } from './components/TransactionLog';

// --- CONFIGURATION ---
const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.DASHBOARD);
  const [data, setData] = useState<LeagueData | null>(null);
  
  // Auth State
  const [token, setToken] = useState<string>(localStorage.getItem('yahoo_token') || '');
  
  // Configuration State
  const [clientId, setClientId] = useState<string>(() => {
    return localStorage.getItem('yahoo_client_id') || process.env.YAHOO_CLIENT_ID || '';
  });
  
  // Default Redirect URI is the current page URL without hash/query
  const [redirectUri, setRedirectUri] = useState<string>(() => {
    const saved = localStorage.getItem('yahoo_redirect_uri');
    // Default to current origin + pathname (e.g. https://myapp.com/ or https://myapp.com/app)
    // We strip trailing slash for consistency unless it's just root '/'
    let current = window.location.origin + window.location.pathname;
    if (current.endsWith('/') && current.length > 1) {
       current = current.slice(0, -1);
    }
    return saved || current;
  });

  // UI State
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('Loading...');
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Data Loading Function
  const loadData = async (accessToken: string) => {
    setLoading(true);
    setLoadingMessage('Syncing League Data...');
    setError(null);
    try {
      const yahooData = await fetchYahooData(accessToken);
      setData(yahooData);
      // Re-save valid token
      localStorage.setItem('yahoo_token', accessToken);
    } catch (err: any) {
      console.error(err);
      if (err.message === 'Unauthorized' || err.message.includes('401')) {
        setError('Session expired. Please reconnect.');
        localStorage.removeItem('yahoo_token');
        setToken('');
      } else {
        setError(err.message || 'Failed to fetch league data.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Initial Load / Auth Check
  useEffect(() => {
    // 1. Handle OAuth Redirect (Implicit Flow Return)
    // Yahoo returns the token in the URL hash: #access_token=...
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      try {
        const params = new URLSearchParams(hash.substring(1)); // remove the leading '#'
        const accessToken = params.get('access_token');
        
        if (accessToken) {
          console.log("Token detected in URL, logging in...");
          // Clean the URL so the user doesn't see the ugly token
          window.history.replaceState(null, '', window.location.pathname);
          
          setToken(accessToken);
          loadData(accessToken);
          return;
        }
      } catch (e) {
        console.error("Error parsing auth hash", e);
      }
    }

    // 2. Handle OAuth Errors (e.g. user denied access)
    // Yahoo might return errors in search query: ?error=access_denied
    const search = window.location.search;
    if (search && search.includes('error')) {
         const params = new URLSearchParams(search);
         const errorMsg = params.get('error_description') || params.get('error') || 'Authentication failed';
         setError(`Yahoo Connection Failed: ${errorMsg}`);
         // Clean URL
         window.history.replaceState(null, '', window.location.pathname);
    }

    // 3. Check for existing persisted session
    if (token && !data && !loading && !error) {
      loadData(token);
    }
  }, []);

  // Configuration Handlers
  const handleClientIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setClientId(newVal);
    localStorage.setItem('yahoo_client_id', newVal);
  };

  const handleRedirectUriChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setRedirectUri(newVal);
    localStorage.setItem('yahoo_redirect_uri', newVal);
  };

  // MAIN LOGIN ACTION
  const handleLogin = () => {
    if (!clientId) {
      setError("Client ID is required.");
      setShowSettings(true);
      return;
    }
    
    // Ensure persistence before redirect
    localStorage.setItem('yahoo_client_id', clientId);
    localStorage.setItem('yahoo_redirect_uri', redirectUri);

    // Construct OAuth URL
    // response_type=token -> Implicit Flow (Simple, client-side only)
    const scope = 'fspt-r'; 
    const authUrl = `https://api.login.yahoo.com/oauth2/request_auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${scope}`;
    
    // Redirect User
    window.location.href = authUrl;
  };

  // --- Login Screen ---
  if (!token || (!data && !loading && !error)) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center relative overflow-hidden">
        {/* Dynamic Background */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1566577739112-5180d4bf939b?q=80&w=2600&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/90 to-slate-900 pointer-events-none" />
        
        {/* Content Container */}
        <div className="relative z-10 max-w-md w-full px-6 flex flex-col items-center text-center">
          
          {/* Logo */}
          <div className="mb-8 relative group">
            <div className="absolute inset-0 bg-indigo-500 blur-[60px] opacity-40 rounded-full group-hover:opacity-60 transition-opacity duration-500" />
            <div className="relative bg-slate-800/50 backdrop-blur-xl border border-slate-700 p-6 rounded-3xl shadow-2xl">
              <Trophy className="w-16 h-16 text-indigo-400" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
            League Legacy
          </h1>
          <p className="text-slate-400 mb-8 leading-relaxed text-sm">
            Visualize your fantasy football history.
          </p>
          
          <div className="w-full bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
             
             {/* Client ID Input */}
             <div className="text-left space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase flex justify-between">
                   Yahoo Client ID
                   <button onClick={() => setShowSettings(!showSettings)} className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                      <Settings className="w-3 h-3" /> Config
                   </button>
                </label>
                <input
                  type="text"
                  value={clientId}
                  onChange={handleClientIdChange}
                  placeholder="Paste Client ID here"
                  className="block w-full bg-slate-900/50 border border-slate-600 rounded-lg py-3 px-4 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder-slate-600"
                />
             </div>

             {/* Redirect URI (Collapsible Settings) */}
             {showSettings && (
               <div className="text-left space-y-1.5 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                     Redirect URI <span className="text-emerald-500 normal-case font-normal">(Must match Yahoo App Settings)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={redirectUri}
                      onChange={handleRedirectUriChange}
                      className="block w-full bg-transparent border-none p-0 text-xs text-slate-300 font-mono focus:ring-0"
                    />
                    <button 
                      onClick={() => navigator.clipboard.writeText(redirectUri)}
                      className="text-slate-500 hover:text-white"
                      title="Copy to clipboard"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
               </div>
             )}

             {/* Connect Button */}
             <button
               onClick={handleLogin}
               className="w-full group relative flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 px-4 rounded-xl font-bold text-base transition-all transform hover:scale-[1.02] shadow-lg shadow-indigo-500/25"
             >
               <LogIn className="w-5 h-5" />
               Connect with Yahoo
             </button>

             {/* Error Message */}
             {error && (
               <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2 text-left">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400">{error}</p>
               </div>
             )}
          </div>

          {/* Helper Link */}
          <div className="mt-8 text-center">
             <a 
               href="https://developer.yahoo.com/apps/create/" 
               target="_blank" 
               rel="noopener noreferrer"
               className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-400 transition-colors"
             >
                Need a Client ID? Create App on Yahoo <ExternalLink className="w-3 h-3" />
             </a>
          </div>
        </div>
      </div>
    );
  }

  // --- Loading Screen ---
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-500 gap-4">
        <div className="relative">
           <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 rounded-full animate-pulse" />
           <Loader2 className="w-12 h-12 text-indigo-500 animate-spin relative z-10" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-medium text-white text-lg">{loadingMessage}</p>
          <p className="text-xs text-slate-600">This may take a few moments...</p>
        </div>
      </div>
    );
  }

  // --- Main App Logic (If Data Loaded) ---
  if (!data) return null;

  const currentSeason = data.seasons[data.seasons.length - 1];
  const currentChampId = currentSeason.standings.find(s => s.stats.rank === 1)?.managerId;
  const currentChampName = data.managers.find(m => m.id === currentChampId)?.name || 'Unknown';

  const NavButton = ({ v, icon: Icon, label }: { v: ViewState, icon: any, label: string }) => (
    <button 
      onClick={() => setView(v)}
      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${view === v ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden md:inline">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 selection:bg-indigo-500/30">
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-indigo-600 p-1.5 rounded-lg">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight hidden sm:block">NooKs League Legacy</span>
            </div>
            
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar px-4">
               <NavButton v={ViewState.DASHBOARD} icon={LayoutDashboard} label="Home" />
               <NavButton v={ViewState.STANDINGS} icon={Table2} label="Standings" />
               <NavButton v={ViewState.VERSUS} icon={Swords} label="Versus" />
               <NavButton v={ViewState.DRAFT} icon={Gavel} label="Drafts" />
               <NavButton v={ViewState.TRANSACTIONS} icon={UserPlus} label="Moves" />
               <NavButton v={ViewState.HISTORY} icon={History} label="Stats" />
            </div>
            
            <div className="flex items-center shrink-0">
              <button 
                onClick={() => { localStorage.removeItem('yahoo_token'); setToken(''); setData(null); }} 
                className="text-xs font-medium text-slate-500 hover:text-red-400 transition-colors px-3 py-2"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        
        {/* View Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Main Column */}
          <div className="lg:col-span-2 space-y-8">
            {view === ViewState.DASHBOARD && (
              <div className="space-y-8 animate-in fade-in duration-500">
                 
                 <div className="relative overflow-hidden bg-gradient-to-r from-indigo-900 to-slate-900 border border-indigo-500/20 rounded-2xl p-8 text-center">
                    <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10"></div>
                    <h2 className="text-3xl font-bold text-white mb-4 relative z-10">The Legacy Archives</h2>
                    <p className="text-indigo-200/80 max-w-xl mx-auto mb-8 relative z-10 leading-relaxed">
                      Tracking over a decade of fantasy dominance, heartbreak, and waiver wire wonders. 
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

                 <LeagueRecords data={data} />
                 
                 <StandingsTable data={data} />
              </div>
            )}

            {view === ViewState.STANDINGS && (
              <div className="animate-in fade-in duration-300">
                <StandingsTable data={data} />
              </div>
            )}

            {view === ViewState.VERSUS && (
              <Versus data={data} token={token} />
            )}

            {view === ViewState.DRAFT && (
              <DraftHistory data={data} token={token} />
            )}

            {view === ViewState.TRANSACTIONS && (
              <TransactionLog data={data} />
            )}

            {view === ViewState.HISTORY && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <HistoryChart data={data} />
                
                <h3 className="text-xl font-bold text-white px-1">Season History</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {data.seasons.slice().reverse().map(season => {
                     const champStand = season.standings.find(s => s.stats.rank === 1);
                     const champ = data.managers.find(m => m.id === champStand?.managerId);
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

          {/* Right Sidebar Column */}
          <div className="space-y-8">
            {/* Status Cards */}
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
                        <span className="text-lg font-bold text-white">{data.seasons.length} Seasons</span>
                        <span className="text-xs text-slate-500 block">{data.seasons[0].year} - {currentSeason.year}</span>
                    </div>
                    </div>
                </div>
            </div>

            <LeagueOracle data={data} />
            
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                System Status
              </h3>
              <div className="space-y-4">
                <div className="flex gap-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                  <div className="w-2 h-2 mt-2 bg-emerald-500 rounded-full shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <div>
                    <p className="text-slate-200 text-sm font-medium">Live Connection</p>
                    <span className="text-xs text-slate-500">Synced with Yahoo Fantasy API</span>
                  </div>
                </div>
                 <div className="flex gap-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                  <div className="w-2 h-2 mt-2 bg-indigo-500 rounded-full shrink-0" />
                  <div>
                    <p className="text-slate-200 text-sm font-medium">Archive Depth</p>
                    <span className="text-xs text-slate-500">
                       {data.seasons.length} seasons • {data.seasons.reduce((acc, s) => acc + (s.draft?.length || 0), 0)} picks • {data.seasons.reduce((acc, s) => acc + (s.transactions?.length || 0), 0)} transactions
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default App;