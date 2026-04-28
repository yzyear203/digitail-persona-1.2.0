import React from 'react';
import { UserCircle, Sparkles, Loader2, BrainCircuit } from 'lucide-react'; // 👑 引入图标

export default function ChatHeader({ 
  activePersona, 
  isTypingIndicator, 
  isExtracting, 
  handleExtractTasks, 
  setAppPhase,
  setShowMemoryCabin // 👑 接收开关状态
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
        {/* 👑 记忆透明舱呼出按钮 */}
        <button 
          onClick={() => setShowMemoryCabin(true)} 
          className="px-5 py-2.5 bg-purple-50 text-purple-600 rounded-xl font-black text-sm hover:bg-purple-100 transition-all flex items-center gap-2"
        >
          <BrainCircuit size={16}/> T3 记忆舱
        </button>

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
