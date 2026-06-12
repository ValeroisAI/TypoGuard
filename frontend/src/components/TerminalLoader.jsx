import React, { useState, useEffect, useRef } from 'react';

const LOG_MESSAGES = [
  "Initializing handshake...",
  "Resolving DNS records...",
  "Checking SSL certificate validity...",
  "Analyzing heuristic patterns...",
  "Querying global whitelist database...",
  "Detecting homoglyph attacks...",
  "Running AI Deep Scan...",
  "Analyzing HTML structure...",
  "Verifying server reputation...",
  "Finalizing security report..."
];

const TerminalLoader = () => {
  const [logs, setLogs] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < LOG_MESSAGES.length) {
        // Add timestamp
        const time = new Date().toISOString().split('T')[1].split('.')[0];
        setLogs(prev => [...prev, `[${time}] ${LOG_MESSAGES[currentIndex]}`]);
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, 150); // Speed of logs

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="w-full h-64 bg-black border border-zinc-800 rounded-lg p-4 font-mono text-xs overflow-hidden relative shadow-[0_0_20px_rgba(255,255,255,0.1)]">
      <div className="absolute top-0 left-0 w-full h-6 bg-zinc-900 border-b border-zinc-800 flex items-center px-2 gap-2">
        <div className="w-2 h-2 rounded-full bg-red-500"></div>
        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
        <div className="w-2 h-2 rounded-full bg-green-500"></div>
        <span className="ml-2 text-zinc-500">system_analysis.exe</span>
      </div>
      <div className="mt-6 h-full overflow-y-auto pb-4 text-green-500/90">
        {logs.map((log, i) => (
          <div key={i} className="mb-1 border-l-2 border-green-900 pl-2">
            <span className="text-zinc-500 mr-2">{'>'}</span>
            {log}
          </div>
        ))}
        <div ref={bottomRef} />
        <div className="mt-2">
          <span className="text-white">_</span>
        </div>
      </div>
    </div>
  );
};

export default TerminalLoader;
