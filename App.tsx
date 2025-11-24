import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Table2, History, Trophy, Crown, ArrowUpRight, Key, Loader2, AlertCircle, Settings, Link as LinkIcon, CheckCircle2, Gavel, UserPlus, Swords, ChevronRight, Copy, ExternalLink, Save, RotateCcw } from 'lucide-react';
import { fetchYahooData } from './services/yahooService';
import { LeagueData, ViewState } from './types';
import { HistoryChart } from './components/HistoryChart';
import { StandingsTable } from './components/StandingsTable';
import { LeagueOracle } from './components/LeagueOracle';
import { LeagueRecords } from './components/LeagueRecords';
import { Versus } from './components/Versus';
import { DraftHistory } from './components/DraftHistory';
import { TransactionLog } from './components/TransactionLog';

// --- PKCE UTILITIES ---
const generateCodeVerifier = () => {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const generateCodeChallenge = async (verifier: string) => {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// --- CONFIGURATION ---
// IMPORTANT: To make the "Connect" button work, you must:
// 1. Create an App at https://developer.yahoo.com/apps/
// 2. Set 'Redirect URI' to the exact URL shown in the 'Advanced' section below.
// 3. Paste your Client ID below OR set VITE_YAHOO_CLIENT_ID in your environment variables OR enter it in the UI.

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.DASHBOARD);
  const [data, setData] = useState<LeagueData | null>(null);
  
  // Auth State
  const [token, setToken] = useState<string>(localStorage.getItem('yahoo_token') || '');
  
  // Configuration State
  const [clientId, setClientId] = useState<string>(() => {
    return localStorage.getItem('yahoo_client_id') || process.env.YAHOO_CLIENT_ID || '';
  });
  
  const [redirectUri, setRedirectUri] = useState<string>(() => {
    // Default to current location without hash, and strip trailing slash for consistency
    const defaultUri = window.location.href.split('#')[0].split('?')[0].replace(/\/$/, '');
    return localStorage.getItem('yahoo_redirect_uri') || defaultUri;
  });

  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);

  // Data Loading Function
  const loadData = async (accessToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const yahooData = await fetchYahooData(accessToken);
      setData(yahooData);
      // Re-save valid token
      localStorage.setItem('yahoo_token', accessToken);
    } catch (err: any) {
      console.error(err);
      if (err.message === 'Unauthorized') {
        setError('Token expired or invalid. Please reconnect.');
        localStorage.removeItem('yahoo_token');
        setToken('');
      } else {
        setError(err.message || 'Failed to fetch league data.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Auth Effect: Handle Redirects and Token Exchange
  useEffect(() => {
    const handleAuth = async () => {
      // 1. Check for Authorization Code (PKCE Flow)
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      
      if (code) {
        const verifier = localStorage.getItem('yahoo_code_verifier');
        if (verifier && clientId) {
          setLoading(true);
          // Clean URL immediately
          window.history.replaceState(null, '', window.location.pathname);
          
          try {
            const body = new URLSearchParams({
              client_id: clientId,
              redirect_uri: redirectUri,
              code: code,
              grant_type: 'authorization_code',
              code_verifier: verifier
            });
            
            // Exchange code for token via Proxy to avoid CORS
            const tokenUrl = 'https://api.login.yahoo.com/oauth2/get_token';
            const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(tokenUrl)}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: body.toString()
            });
            
            const json = await res.json();
            if (json.access_token) {
              setToken(json.access_token);
              localStorage.setItem('yahoo_token', json.access_token);
              localStorage.removeItem('yahoo_code_verifier'); // Cleanup
              loadData(json.access_token);
            } else {
              throw new Error(json.error_description || 'Failed to exchange token. Check Client ID and Redirect URI.');
            }
          } catch (err: any) {
             console.error(err);
             setError(err.message || "Token exchange failed");
             setLoading(false);
          }
          return; // Stop processing other checks
        }
      }

      // 2. Check for Implicit Flow (Legacy/Manual)
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.substring(1)); // remove #
        const accessToken = params.get('access_token');
        if (accessToken) {
          setToken(accessToken);
          localStorage.setItem('yahoo_token', accessToken);
          window.history.replaceState(null, '', window.location.pathname);
          loadData(accessToken);
          return;
        }
      } 
      
      // 3. Check Local Storage
      if (token && !data && !loading && !error) {
        loadData(token);
      }
    };

    handleAuth();
  }, []); // Run once on mount

  // Initiate Login with PKCE
  const handleLogin = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!clientId) return;

    // Generate PKCE Verifier & Challenge
    const verifier = generateCodeVerifier();
    localStorage.setItem('yahoo_code_verifier', verifier);
    const challenge = await generateCodeChallenge(verifier);

    const scope = 'fspt-r'; // Fantasy Sports Read
    
    // Construct Auth URL (Response Type = CODE for PKCE)
    const authUrl = `https://api.login.yahoo.com/oauth2/request_auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&code_challenge=${challenge}&code_challenge_method=S256`;
    
    window.location.href = authUrl;
  };

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

  const resetConfig = () => {
    localStorage.removeItem('yahoo_client_id');
    localStorage.removeItem('yahoo_redirect_uri');
    setClientId('');
    setRedirectUri(window.location.href.split('#')[0].split('?')[0].replace(/\/$/, ''));
    setShowManualInput(true);
  };

  const handleManualTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token) loadData(token);
  };

  // --- Login / Auth Screen ---
  if (!token || (!data && !loading && !error)) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center relative overflow-hidden">
        {/* Dynamic Background */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1566577739112-5180d4bf939b?q=80&w=2600&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/90 to-slate-900 pointer-events-none" />
        
        {/* Content Container */}
        <div className="relative z-10 max-w-4xl w-full px-6 flex flex-col items-center text-center">
          
          {/* Logo / Icon */}
          <div className="mb-8 relative group">
            <div className="absolute inset-0 bg-indigo-500 blur-[60px] opacity-40 rounded-full group-hover:opacity-60 transition-opacity duration-500" />
            <div className="relative bg-slate-800/50 backdrop-blur-xl border border-slate-700 p-6 rounded-3xl shadow-2xl">
              <Trophy className="w-16 h-16 text-indigo-400" />
            </div>
          </div>

          {/* Headlines */}
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight mb-6 drop-shadow-xl">
            NooKs Fantasy League <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Legacy</span>
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-12 leading-relaxed">
            The ultimate historical archive for your Yahoo Fantasy Football league. 
            Visualize dynasties, track rivalries, and uncover the stats that matter.
          </p>

          {/* Main Action */}
          <div className="flex flex-col items-center gap-6 w-full max-w-sm">
            {!clientId ? (
              <div className="bg-orange-500/10 border border-orange-500/50 p-4 rounded-xl text-left w-full animate-in fade-in slide-in-from-top-2">
                <div className="flex items-start gap-3">
                  <Settings className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-orange-400 text-sm">Setup Required</h4>
                    <p className="text-xs text-orange-300/80 mt-1">
                      Open <b>Advanced Configuration</b> below and enter your Yahoo Client ID to continue.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="w-full group relative flex items-center justify-center gap-3 bg-white text-slate-900 hover:bg-indigo-50 py-4 px-8 rounded-2xl font-bold text-lg transition-all transform hover:scale-[1.02] shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)] cursor-pointer decoration-0 focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
              >
                <svg className="w-6 h-6 text-[#6001d2]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm-1-7.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/> 
                </svg>
                Connect with Yahoo
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
              </button>
            )}
            
            <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold opacity-60">
               (Securely connects via Yahoo OAuth)
            </div>

            {/* Manual Override Toggle */}
            <button 
              onClick={() => setShowManualInput(!showManualInput)}
              className="text-slate-500 text-sm hover:text-indigo-400 transition-colors flex items-center gap-2 mt-2"
            >
              <Settings className="w-3 h-3" />
              {showManualInput ? 'Hide Advanced' : 'Advanced Configuration'}
            </button>

            {/* Manual Input Form */}
            {showManualInput && (
              <div className="w-full space-y-6 animate-in fade-in slide-in-from-top-2 bg-slate-800/80 p-4 rounded-xl border border-slate-700 backdrop-blur-sm text-left">
                
                <div className="flex justify-between items-center mb-2">
                   <h3 className="text-xs font-bold text-white uppercase tracking-wider">Configuration</h3>
                   <button onClick={resetConfig} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> Reset
                   </button>
                </div>

                {/* Client ID Configuration */}
                 <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Yahoo Client ID</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={clientId}
                      onChange={handleClientIdChange}
                      className="block w-full bg-black/30 border border-slate-600 rounded-lg py-2 px-3 text-xs text-white placeholder-slate-600 focus:ring-1 focus:ring-indigo-500 focus:border-transparent transition-all"
                      placeholder="Paste Client ID from Yahoo Developer Console"
                    />
                    {clientId && <CheckCircle2 className="absolute right-3 top-2 w-4 h-4 text-emerald-500" />}
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug">
                     Required. Found in your Yahoo Developer App details.
                  </p>
                </div>

                {/* Redirect URI Configuration */}
                <div className="space-y-2 pt-2 border-t border-slate-700/50">
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Redirect URI (Match Exact)</label>
                   <div className="relative">
                      <input
                        type="text"
                        value={redirectUri}
                        onChange={handleRedirectUriChange}
                        className="block w-full bg-black/30 border border-slate-600 rounded-lg py-2 px-3 text-xs text-emerald-400 font-mono placeholder-slate-600 focus:ring-1 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                      <button 
                        onClick={() => navigator.clipboard.writeText(redirectUri)}
                        className="absolute right-2 top-1.5 text-slate-500 hover:text-white bg-slate-800 p-1 rounded"
                        title="Copy to clipboard"
                      >
                         <Copy className="w-3 h-3" />
                      </button>
                   </div>
                   <p className="text-[10px] text-slate-500 leading-snug">
                     <b>Crucial:</b> Copy this exact URL and paste it into your <a href="https://developer.yahoo.com/apps/" target="_blank" className="underline hover:text-indigo-400">Yahoo App Settings</a> under "Redirect URI(s)". Mismatches cause the "Uh oh" error.
                   </p>
                </div>

                <div className="border-t border-slate-700/50 pt-4">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Manual Token Entry (Fallback)</label>
                  
                  {/* Fallback Link */}
                  <div className="mb-4 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                    <p className="text-[10px] text-indigo-300 mb-2 leading-relaxed">
                        If the direct connection is blocked, use this tool to generate a token, then paste it below:
                    </p>
                    <a 
                        href="https://lemon-dune-0cd4b231e.azurestaticapps.net/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors w-full"
                    >
                        <ExternalLink className="w-3 h-3" />
                        Open Token Generator
                    </a>
                  </div>

                  <form onSubmit={handleManualTokenSubmit} className="space-y-3">
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Key className="h-4 w-4 text-slate-500" />
                      </div>
                      <input
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        className="block w-full pl-10 bg-slate-900 border border-slate-600 rounded-lg py-2 text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500 focus:border-transparent transition-all"
                        placeholder="Paste Access Token"
                      />
                    </div>
                    <button 
                      type="submit"
                      className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
                    >
                      Load Data
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          {/* Footer Stats */}
          <div className="mt-16 grid grid-cols-3 gap-8 text-center border-t border-slate-800 pt-8">
             <div>
                <div className="text-2xl font-bold text-white">Instant</div>
                <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Sync</div>
             </div>
             <div>
                <div className="text-2xl font-bold text-white">10+</div>
                <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Years Supported</div>
             </div>
             <div>
                <div className="text-2xl font-bold text-white">AI</div>
                <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Powered Insights</div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Loading Screen ---
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-500 gap-4">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
        <p className="animate-pulse font-medium">Syncing with Yahoo Fantasy API...</p>
        <p className="text-xs text-slate-600">Downloading Standings, Drafts, and Transactions...</p>
      </div>
    );
  }

  // --- Error Screen ---
  if (error) {
    return (
       <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl border border-red-900/50 max-w-md w-full text-center shadow-2xl">
          <div className="bg-red-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
             <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Connection Interrupted</h3>
          <p className="text-slate-400 mb-8">{error}</p>
          <button 
            onClick={() => { setToken(''); setError(null); }}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-xl transition-colors font-medium"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

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

  // --- Main Dashboard ---
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
              <span className="text-lg font-bold text-white tracking-tight hidden sm:block">NooKs Fantasy League Legacy</span>
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
              <button onClick={() => { localStorage.removeItem('yahoo_token'); setToken(''); setData(null); }} className="text-xs font-medium text-slate-500 hover:text-red-400 transition-colors px-3 py-2">
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