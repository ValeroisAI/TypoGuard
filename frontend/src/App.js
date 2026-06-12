import React, { useState, useEffect } from 'react';
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Search, Shield, History, Zap, ChevronRight, Menu } from "lucide-react";
import StatusDisplay from './components/StatusDisplay';
import TechSpecs from './components/TechSpecs';
import ActionPanel from './components/ActionPanel';
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import axios from 'axios';

function App() {
  const [currentUrl, setCurrentUrl] = useState('https://google.com');
  const [inputUrl, setInputUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [history, setHistory] = useState([]);
  const [view, setView] = useState('scan'); 
  const [autoRedirect, setAutoRedirect] = useState(true);

  // Sync AutoRedirect with Extension if available
  useEffect(() => {
    if (window.chrome && window.chrome.storage) {
        window.chrome.storage.local.get(['autoRedirect'], (result) => {
            if (result.autoRedirect !== undefined) setAutoRedirect(result.autoRedirect);
        });
    }
  }, []);

  const toggleAutoRedirect = () => {
    const newState = !autoRedirect;
    setAutoRedirect(newState);
    if (window.chrome && window.chrome.runtime) {
        window.chrome.runtime.sendMessage({ action: "TOGGLE_AUTO_REDIRECT", value: newState });
    }
    toast.info(`Shield: ${newState ? 'Active' : 'Paused'}`);
  };

  const analyzeUrl = async (urlToScan) => {
    if (!urlToScan) return;
    setLoading(true);
    setView('scan');
    
    // Normalize URL for display/history
    const displayUrl = urlToScan.replace(/^https?:\/\//, '').replace(/\/$/, '');

    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
      
      const timer = new Promise(resolve => setTimeout(resolve, 600)); // Minimal delay for smoother UX
      const request = axios.post(`${API_URL}/api/analyze`, { url: urlToScan });
      
      const [response] = await Promise.all([request, timer]);
      const result = response.data;
      
      setAnalysis(result);
      
      setHistory(prev => {
        const newHist = prev.filter(h => h.domain !== result.domain);
        return [{ domain: result.domain, status: result.status, timestamp: new Date() }, ...newHist].slice(0, 8);
      });

      if (result.status === 'suspicious') {
          if (result.score > 98 && autoRedirect && result.suggestion) {
              toast.success(`Threat Blocked. Redirecting to ${result.suggestion}...`);
          } else {
              toast.warning("Warning: Suspicious Activity Detected");
          }
      }
    } catch (error) {
      console.error(error);
      toast.error("Network Error. Backend offline?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    analyzeUrl(currentUrl);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    analyzeUrl(inputUrl || currentUrl);
  };

  return (
    <div className="min-h-screen bg-black text-white flex justify-center items-center p-4">
      
      <div className="w-full max-w-[400px] h-[750px] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <header className="flex items-center justify-between p-5 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-sm z-10">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.3)]">
                    <Shield className="w-4 h-4 text-black fill-current" />
                </div>
                <div>
                    <h1 className="text-base font-bold tracking-tight">EagleSky</h1>
                    <p className="text-[10px] text-zinc-500 font-medium">ZERO TRUST ENGINE</p>
                </div>
            </div>
            <div className="flex gap-1">
                <button 
                    onClick={toggleAutoRedirect}
                    className={`p-2 rounded-full transition-all ${autoRedirect ? "text-blue-400 bg-blue-500/10" : "text-zinc-600 hover:bg-zinc-900"}`}
                    title="Auto-Pilot"
                >
                    <Zap className="w-4 h-4" fill={autoRedirect ? "currentColor" : "none"} />
                </button>
                <button 
                    onClick={() => setView(view === 'history' ? 'scan' : 'history')}
                    className={`p-2 rounded-full transition-all ${view === 'history' ? "text-white bg-white/10" : "text-zinc-600 hover:bg-zinc-900"}`}
                >
                    <History className="w-4 h-4" />
                </button>
            </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-hide relative">
            
            {/* Search Input */}
            <div className="px-5 pt-6">
                <form onSubmit={handleSubmit} className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <Search className="w-4 h-4 text-zinc-600" />
                    </div>
                    <input 
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        placeholder="Scan domain or IP..."
                        className="w-full bg-zinc-900/50 border border-zinc-800 text-sm text-white rounded-xl py-3 pl-10 pr-4 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 transition-all"
                    />
                </form>
            </div>

            {view === 'history' ? (
                <div className="p-5 space-y-2 animate-in slide-in-from-right duration-300">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Recent Activity</h3>
                    {history.map((item, idx) => (
                        <div key={idx} onClick={() => analyzeUrl(item.domain)} className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/30 border border-zinc-800/50 hover:bg-zinc-900 hover:border-zinc-700 cursor-pointer group transition-all">
                            <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${item.status === 'safe' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                <span className="text-sm text-zinc-300 font-medium group-hover:text-white transition-colors">{item.domain}</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                        </div>
                    ))}
                    {history.length === 0 && <div className="text-center text-zinc-700 py-10 text-sm">No recent scans.</div>}
                </div>
            ) : (
                <div className="p-5 pb-20 animate-in fade-in duration-500">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-12 h-12 border-2 border-zinc-800 border-t-white rounded-full animate-spin mb-4"></div>
                            <p className="text-xs font-medium text-zinc-500 animate-pulse">ANALYZING TARGET...</p>
                        </div>
                    ) : analysis ? (
                        <>
                            <StatusDisplay 
                                status={analysis.status} 
                                domain={analysis.domain} 
                                score={analysis.score} 
                            />
                            
                            <div className="mt-6 space-y-6">
                                <TechSpecs analysis={analysis} />

                                <ActionPanel 
                                    status={analysis.status}
                                    suggestion={analysis.suggestion}
                                    domain={analysis.domain}
                                    communityScore={analysis.community_trust_score}
                                    source={analysis.source}
                                    description={analysis.description}
                                    onWhitelist={() => toast.success("Added to Allowlist")}
                                    onIgnore={() => toast.dismiss()}
                                    onNavigateSafe={(url) => {
                                        window.open(`https://${url}`, '_blank');
                                        toast.success("Redirecting...");
                                    }}
                                />
                            </div>
                        </>
                    ) : null}
                </div>
            )}
        </div>

        {/* Footer Status Bar */}
        <div className="p-3 border-t border-zinc-900 bg-zinc-950 flex justify-between items-center text-[10px] text-zinc-600 font-mono">
            <span>V4.0.1 STABLE</span>
            <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                CONNECTED
            </span>
        </div>
      </div>
      
      <Toaster 
        theme="dark" 
        position="top-center"
        toastOptions={{
            style: { background: '#09090b', border: '1px solid #27272a', color: '#fff', borderRadius: '12px' }
        }} 
      />
    </div>
  );
}

export default App;
