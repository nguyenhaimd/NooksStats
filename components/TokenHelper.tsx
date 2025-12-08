import React, { useState } from 'react';
import { ExternalLink, Key, Check, Loader2, ArrowLeft, ShieldCheck, Lock, AlertTriangle } from 'lucide-react';
import { exchangeAuthCode } from '../services/yahooService';

interface TokenHelperProps {
  defaultClientId?: string;
  onTokenGenerated: (token: string) => void;
  onCancel: () => void;
}

export const TokenHelper: React.FC<TokenHelperProps> = ({ onTokenGenerated, onCancel }) => {
  const envClientId = process.env.YAHOO_CLIENT_ID || '';
  const envClientSecret = process.env.YAHOO_CLIENT_SECRET || '';

  const [authCode, setAuthCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'INIT' | 'WAITING_FOR_CODE'>('INIT');

  const handleLoginClick = () => {
    if (!envClientId) {
        setError("System Error: Yahoo Client ID is not configured in the application environment.");
        return;
    }
    // Using 'oob' (Out of Band) flow which is standard for installed/client-side apps
    const authUrl = `https://api.login.yahoo.com/oauth2/request_auth?client_id=${envClientId}&redirect_uri=oob&response_type=code`;
    
    // Open in new window
    window.open(authUrl, 'YahooLogin', 'width=600,height=700,status=yes,scrollbars=yes');
    
    setStep('WAITING_FOR_CODE');
    setError(null);
  };

  const handleExchange = async () => {
      if (!authCode || authCode.length < 4) {
          setError("Invalid code. Please ensure you copied the entire 7-character code from Yahoo.");
          return;
      }
      setLoading(true);
      setError(null);
      try {
          const token = await exchangeAuthCode(envClientId, envClientSecret, authCode.trim());
          onTokenGenerated(token);
      } catch (e: any) {
          setError(e.message || "Failed to exchange token.");
          setLoading(false);
      }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 to-indigo-600 p-6 shrink-0 flex items-center justify-between shadow-lg z-10">
             <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6" />
                    Yahoo Token Generator
                </h2>
                <p className="text-indigo-100 text-sm mt-1 opacity-90">Failsafe Authentication Mode</p>
             </div>
             <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm">
                 <Lock className="w-5 h-5 text-white" />
             </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 flex flex-col items-center justify-center relative overflow-hidden">
             {/* Decorative Background */}
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

             {error && (
                <div className="w-full max-w-md bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-sm text-red-400 mb-6 flex gap-3 items-start animate-in slide-in-from-top-2 z-20">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
             )}

             {step === 'INIT' ? (
                 <div className="text-center max-w-sm z-10 animate-in fade-in zoom-in duration-300">
                     <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl border border-slate-700 transform rotate-3 hover:rotate-6 transition-transform group">
                         <Key className="w-10 h-10 text-indigo-400 group-hover:text-white transition-colors" />
                     </div>
                     <h3 className="text-2xl font-bold text-white mb-3">Authenticate</h3>
                     <p className="text-slate-400 mb-8 leading-relaxed">
                         Generate a new access token to sync your league data directly. This works even if the primary server is offline.
                     </p>
                     
                     <button 
                        onClick={handleLoginClick}
                        disabled={!envClientId}
                        className="group relative w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-xl hover:shadow-indigo-500/25 hover:-translate-y-1"
                     >
                        <span>Login with Yahoo!</span>
                        <ExternalLink className="w-5 h-5 opacity-70 group-hover:opacity-100" />
                     </button>
                     
                     {!envClientId && (
                         <div className="mt-6 p-3 bg-slate-800/50 rounded-lg text-xs text-slate-500 border border-slate-700">
                             <strong>Config Missing:</strong> YAHOO_CLIENT_ID not found in environment.
                         </div>
                     )}
                 </div>
             ) : (
                 <div className="w-full max-w-md z-10 animate-in slide-in-from-right-8 duration-300">
                     <div className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-2xl p-6 mb-6 shadow-2xl">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-lg shadow-indigo-500/20">1</div>
                            <div className="text-sm text-slate-300">
                                A window has opened. Click <strong>Agree</strong> to authorize.
                            </div>
                        </div>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-lg shadow-indigo-500/20">2</div>
                            <div className="text-sm text-slate-300">
                                Copy the <strong>7-character code</strong> displayed on the page.
                            </div>
                        </div>
                        
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Key className="h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                            </div>
                            <input 
                                type="text" 
                                autoFocus
                                value={authCode} 
                                onChange={e => setAuthCode(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-600 rounded-xl pl-10 pr-4 py-4 text-white font-mono tracking-[0.2em] text-lg focus:ring-2 focus:ring-emerald-500 outline-none placeholder-slate-700 transition-all text-center uppercase"
                                placeholder="ENTER CODE"
                            />
                        </div>
                     </div>
                     
                     <button 
                        onClick={handleExchange}
                        disabled={authCode.length < 4 || loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-500/25 active:scale-95"
                     >
                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6" />}
                        {loading ? 'Verifying...' : 'Verify & Sync'}
                     </button>
                     
                     <button 
                        onClick={() => setStep('INIT')} 
                        className="mt-6 text-slate-500 hover:text-white text-sm flex items-center justify-center gap-2 w-full transition-colors"
                     >
                        <ArrowLeft className="w-4 h-4" /> Start Over
                     </button>
                 </div>
             )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-center z-10">
             <button onClick={onCancel} className="text-slate-500 hover:text-white text-sm font-medium transition-colors">
                 Close Generator
             </button>
        </div>
    </div>
  );
};