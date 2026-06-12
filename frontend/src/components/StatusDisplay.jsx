import React from 'react';

const StatusDisplay = ({ status, domain, score }) => {
  const isSafe = status === 'safe';
  const colorClass = isSafe ? 'text-emerald-400' : 'text-rose-500';
  const borderClass = isSafe ? 'border-emerald-500/20' : 'border-rose-500/20';
  const bgClass = isSafe ? 'bg-emerald-500/5' : 'bg-rose-500/5';

  return (
    <div className="flex flex-col items-center justify-center py-10">
      
      {/* Modern Ring Indicator */}
      <div className="relative">
        <div className={`w-32 h-32 rounded-full border-4 ${borderClass} flex items-center justify-center relative`}>
            {/* Pulsing glow behind */}
            <div className={`absolute inset-0 rounded-full blur-xl ${bgClass} animate-pulse`}></div>
            
            {/* Spinning active indicator */}
            <div className={`absolute inset-0 rounded-full border-4 border-t-transparent animate-[spin_3s_linear_infinite] opacity-50 ${isSafe ? 'border-emerald-400' : 'border-rose-500'}`}></div>
            
            <div className="flex flex-col items-center z-10">
                <span className={`text-3xl font-light tracking-tighter ${colorClass}`}>
                    {score || (isSafe ? '100' : '0')}
                </span>
                <span className="text-[9px] text-zinc-500 font-medium tracking-widest mt-1">TRUST</span>
            </div>
        </div>
      </div>

      <div className="mt-8 text-center space-y-2">
        <h2 className="text-xl font-medium tracking-tight text-white">
            {isSafe ? 'Connection Secured' : 'Threat Detected'}
        </h2>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800/50">
            <div className={`w-1.5 h-1.5 rounded-full ${isSafe ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`}></div>
            <span className="text-xs font-mono text-zinc-400 tracking-tight">{domain}</span>
        </div>
      </div>
    </div>
  );
};

export default StatusDisplay;
