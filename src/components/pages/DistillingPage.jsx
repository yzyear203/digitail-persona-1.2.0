import React, { useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function DistillingPage({ distillProgress, distillLogs }) {
  const terminalEndRef = useRef(null);
  useEffect(() => { terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [distillLogs]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 font-mono">
      <div className="max-w-xl w-full">
        <div className="flex items-center gap-3 mb-6">
          <Loader2 className="animate-spin text-indigo-400" size={32}/>
          <h1 className="text-2xl font-bold text-white tracking-widest">DISTILLING...</h1>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-3xl p-8 h-[400px] flex flex-col overflow-hidden shadow-2xl">
          <div className="h-1 bg-slate-700 w-full mb-6 rounded-full">
            <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${distillProgress}%` }}></div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4">
            {distillLogs.map((l, i) => (
              <div key={i} className={`text-sm ${l.includes('成功') ? 'text-green-400 font-bold' : 'text-slate-400'}`}>
                [{new Date().toLocaleTimeString()}] {l}
              </div>
            ))}
            <div ref={terminalEndRef}/>
          </div>
        </div>
      </div>
    </div>
  );
}