import React, { useState } from 'react';
import { Button } from "./ui/button";
import { ExternalLink, ShieldCheck, Ban, ThumbsUp, ThumbsDown, ScanEye, Terminal } from "lucide-react";
import axios from 'axios';
import { toast } from "sonner";

const ActionPanel = ({ status, suggestion, domain, onWhitelist, onIgnore, onNavigateSafe, communityScore, source, description }) => {
  const [voted, setVoted] = useState(false);

  const handleVote = async (voteType) => {
    try {
      const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
      await axios.post(`${API_URL}/api/feedback`, { domain, vote: voteType });
      setVoted(true);
      toast.success("Feedback Logged.");
    } catch (e) { toast.error("Log failed."); }
  };

  return (
    <div className="flex flex-col gap-4 mt-6 w-full font-mono">
      
      {/* Tech Specs Row */}
      <div className="flex items-center justify-between px-2 py-2 border-y border-zinc-800 text-[10px] text-zinc-500">
        <div className="flex items-center gap-2">
            <Terminal className="w-3 h-3" />
            <span>SOURCE: {source?.toUpperCase()}</span>
        </div>
        <div>
            TRUST_INDEX: {communityScore || 0}
        </div>
      </div>

      {description && (
          <div className="p-3 border-l-2 border-white bg-zinc-900/50 text-xs text-zinc-300 italic">
            "{description}"
          </div>
      )}

      {status === 'suspicious' ? (
        <div className="space-y-3">
            {suggestion && (
                <Button 
                onClick={() => onNavigateSafe(suggestion)}
                className="w-full bg-white text-black hover:bg-zinc-200 font-bold tracking-wider py-6 border-2 border-white"
                >
                <ExternalLink className="mr-2 h-4 w-4" />
                REDIRECT TO: {suggestion}
                </Button>
            )}

            <div className="grid grid-cols-2 gap-3">
                <Button 
                variant="outline" 
                onClick={onIgnore}
                className="bg-black text-zinc-400 border-zinc-700 hover:bg-zinc-900 hover:text-white hover:border-white transition-colors"
                >
                <Ban className="mr-2 h-3 w-3" />
                IGNORE RISK
                </Button>
                <Button 
                variant="outline" 
                onClick={onWhitelist}
                className="bg-black text-green-500 border-zinc-700 hover:bg-zinc-900 hover:border-green-500 transition-colors"
                >
                <ShieldCheck className="mr-2 h-3 w-3" />
                WHITELIST
                </Button>
            </div>
        </div>
      ) : (
        <div className="text-center p-4 border border-zinc-800 rounded bg-zinc-900/20 text-xs text-zinc-500">
            CONNECTION SECURED. NO THREATS DETECTED.
        </div>
      )}

      {/* Voting UI - Minimalist */}
      {!voted && (
        <div className="flex gap-0 border border-zinc-800 rounded overflow-hidden">
             <Button 
                size="sm" variant="ghost" 
                className="flex-1 rounded-none hover:bg-zinc-900 text-zinc-400 hover:text-green-400"
                onClick={() => handleVote('safe')}
              >
                <ThumbsUp className="w-3 h-3 mr-2" /> SAFE
             </Button>
             <div className="w-[1px] bg-zinc-800"></div>
             <Button 
                size="sm" variant="ghost" 
                className="flex-1 rounded-none hover:bg-zinc-900 text-zinc-400 hover:text-red-400"
                onClick={() => handleVote('scam')}
              >
                SCAM <ThumbsDown className="w-3 h-3 ml-2" />
             </Button>
        </div>
      )}
    </div>
  );
};

export default ActionPanel;
