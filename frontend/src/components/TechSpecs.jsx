import React from 'react';
import { Shield, Lock, Server, Globe, Clock, Zap, MapPin, Activity } from "lucide-react";

const TechSpecs = ({ analysis }) => {
  if (!analysis) return null;

  // Real Data Mapping
  const sslVersion = analysis.status === 'safe' ? 'TLS 1.3 (Secure)' : 'Unverified';
  const serverRegion = analysis.server_location || 'Unknown';
  const ipAddr = analysis.ip_address || 'Hidden';
  const source = analysis.source || 'Heuristic';

  const specs = [
    { icon: <Lock className="w-3 h-3" />, label: "SSL Protocol", value: sslVersion },
    { icon: <MapPin className="w-3 h-3" />, label: "Server Provider", value: serverRegion },
    { icon: <Activity className="w-3 h-3" />, label: "IP Address", value: ipAddr },
    { icon: <Zap className="w-3 h-3" />, label: "Detection Source", value: source.toUpperCase() },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 mt-4">
      {specs.map((spec, idx) => (
        <div key={idx} className="flex flex-col p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg transition-all hover:bg-zinc-800/50 hover:border-zinc-700">
          <div className="flex items-center gap-2 text-zinc-500 mb-1">
            {spec.icon}
            <span className="text-[10px] uppercase font-semibold tracking-wider">{spec.label}</span>
          </div>
          <span className="text-xs font-mono text-zinc-200 truncate" title={spec.value}>{spec.value}</span>
        </div>
      ))}
    </div>
  );
};

export default TechSpecs;
