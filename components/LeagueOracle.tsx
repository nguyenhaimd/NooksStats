import React, { useState } from 'react';
import { Send, Bot, Sparkles } from 'lucide-react';
import { LeagueData } from '../types';
import { askLeagueOracle } from '../services/gemini';

interface LeagueOracleProps {
  data: LeagueData;
}

export const LeagueOracle: React.FC<LeagueOracleProps> = ({ data }) => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResponse(null);
    
    const answer = await askLeagueOracle(query, data);
    
    setResponse(answer);
    setLoading(false);
  };

  return (
    <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-6 relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">League Oracle</h3>
            <p className="text-sm text-indigo-300">Powered by Gemini 2.5</p>
          </div>
        </div>

        <div className="mb-6 space-y-4">
          {!response && !loading && (
             <div className="text-slate-400 text-sm italic">
               Ask me anything about the league history. Who is the GOAT? Who chokes in playoffs?
             </div>
          )}
          
          {loading && (
            <div className="flex items-center gap-2 text-indigo-400 animate-pulse">
              <Sparkles className="w-4 h-4" />
              <span>Consulting the archives...</span>
            </div>
          )}

          {response && (
            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 text-slate-200 leading-relaxed">
              {response}
            </div>
          )}
        </div>

        <form onSubmit={handleAsk} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="E.g. Who has the most championships?"
            className="flex-1 bg-slate-800 border-slate-700 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};