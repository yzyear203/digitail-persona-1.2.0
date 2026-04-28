import React from 'react';
import { UserCircle, Sparkles, Loader2 } from 'lucide-react';

export default function ChatHeader({ 
  activePersona, 
  isTypingIndicator, 
  isExtracting, 
  handleExtractTasks, 
  setAppPhase 
}) {
  const personaName = activePersona?.name || '数字分身';

  return (
    <header className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center shadow-sm z-10">
      <div className="flex items-center gap-4">
        <div className="bg-indigo-50 p-3 rounded-2xl">
          <UserCircle className="text-indigo-600" size={28}/>
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-800 truncate max-w-[200px]">
            {isTypingIndicator ? '对方正在输入...' : personaName}
          </h1>
          <p className="text-xs font-bold text-emerald-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> 在线
          </p>
        </div>
      </div>
      <div className="flex gap-4">
        <button 
          onClick={handleExtractTasks} 
          disabled={isExtracting} 
          className="px-5 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl font-black text-sm hover:bg-indigo-100 transition-all flex items-center gap-2"
        >
          {isExtracting ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>} 智能代办
        </button>
        <button 
          onClick={() => setAppPhase('dashboard')} 
          className="px-5 py-2.5 bg-slate-50 text-slate-600 rounded-xl font-black text-sm hover:bg-slate-100 transition-all"
        >
          返回大厅
        </button>
      </div>
    </header>
  );
}