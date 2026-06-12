import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ShieldCheck, ShieldAlert, ShieldQuestion, Activity } from "lucide-react";

const StatusCard = ({ status, domain, suggestion, score }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'safe':
        return {
          borderColor: 'border-white', // Stark contrast
          textColor: 'text-white',
          iconColor: 'text-white',
          glow: 'shadow-[0_0_30px_rgba(255,255,255,0.2)]',
          icon: <ShieldCheck className="w-20 h-20" />,
          title: 'SECURE TARGET',
          description: 'Domain verified against Trusted Database.'
        };
      case 'suspicious':
        return {
          borderColor: 'border-red-600',
          textColor: 'text-red-500',
          iconColor: 'text-red-600',
          glow: 'shadow-[0_0_30px_rgba(220,38,38,0.4)]',
          icon: <ShieldAlert className="w-20 h-20 animate-pulse" />,
          title: 'THREAT DETECTED',
          description: 'High probability of phishing or scam activity.'
        };
      default:
        return {
          borderColor: 'border-zinc-700',
          textColor: 'text-zinc-400',
          iconColor: 'text-zinc-500',
          glow: '',
          icon: <ShieldQuestion className="w-20 h-20" />,
          title: 'UNKNOWN HOST',
          description: 'Insufficient data for conclusive analysis.'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Card className={`w-full bg-black border-2 ${config.borderColor} ${config.glow} transition-all duration-500 relative overflow-hidden`}>
      {/* Decorative Grid Background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
      </div>

      <CardHeader className="flex flex-col items-center justify-center pt-8 pb-4 relative z-10">
        <div className={`mb-4 ${config.iconColor}`}>
          {config.icon}
        </div>
        <CardTitle className={`text-3xl font-black tracking-widest ${config.textColor}`}>
          {config.title}
        </CardTitle>
        <div className="mt-3 px-4 py-1 border border-zinc-700 bg-zinc-900/50 rounded text-xs font-mono text-zinc-300">
          HOST: {domain}
        </div>
      </CardHeader>

      <CardContent className="text-center pb-8 relative z-10">
        <p className={`mb-6 text-sm font-mono ${config.textColor} opacity-80 uppercase tracking-wide`}>
          {config.description}
        </p>
        
        {status === 'suspicious' && suggestion && (
          <div className="mt-4 p-4 bg-red-950/30 border border-red-900 rounded-none relative overflow-hidden group">
             <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>
            <p className="text-[10px] text-red-400 uppercase tracking-widest mb-1">Recommended Redirect</p>
            <div className="font-bold text-xl text-white group-hover:tracking-widest transition-all duration-300">
              {suggestion}
            </div>
            {score && (
              <div className="mt-3 flex items-center justify-center gap-2 text-xs font-mono text-red-500">
                <Activity className="w-3 h-3" />
                <span>RISK LEVEL: {score}%</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StatusCard;
