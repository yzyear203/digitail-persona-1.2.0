import React, { useState } from 'react';
import { UserCircle, Sparkles, Loader2, BrainCircuit, Palette, Menu, X, ChevronLeft } from 'lucide-react';

export default function ChatHeader({
  activePersona,
  isTypingIndicator,
  isExtracting,
  handleExtractTasks,
  setAppPhase,
  setShowMemoryCabin,
  setShowAppearanceModal,
  chatAppearance,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const personaName = activePersona?.name || '数字分身';
  const isDark = chatAppearance?.theme === 'dark';
  const headerClass = isDark
    ? 'bg-slate-950/95 border-slate-800 text-white'
    : 'bg-white border-slate-200 text-slate-800';
  const subTextClass = isDark ? 'text-slate-300' : 'text-slate-800';
  const softButtonClass = isDark
    ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
    : 'bg-slate-50 text-slate-600 hover:bg-slate-100';
  const mobileMenuClass = isDark
    ? 'bg-slate-950/98 border-slate-800 shadow-2xl shadow-black/30'
    : 'bg-white/98 border-slate-200 shadow-2xl shadow-slate-300/40';

  const closeMenu = () => setIsMenuOpen(false);

  const runMobileAction = action => {
    closeMenu();
    action();
  };

  return (
    <header className={`${headerClass} border-b px-4 md:px-8 py-3 md:py-5 flex justify-between items-center shadow-sm z-30 transition-colors relative`}>
      <div className="flex items-center gap-3 md:gap-4 min-w-0">
        <div className="w-11 h-11 md:w-14 md:h-14 rounded-2xl overflow-hidden bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
          {activePersona?.avatarUrl ? (
            <img src={activePersona.avatarUrl} alt={personaName} className="w-full h-full object-cover" />
          ) : (
            <UserCircle size={28}/>
          )}
        </div>
        <div className="min-w-0">
          <h1 className={`text-base md:text-xl font-black truncate max-w-[160px] md:max-w-[220px] ${subTextClass}`}>
            {isTypingIndicator ? '对方正在输入...' : personaName}
          </h1>
          <p className="text-[11px] md:text-xs font-bold text-emerald-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> 在线
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsMenuOpen(prev => !prev)}
        className={`md:hidden p-2.5 rounded-xl transition-all ${softButtonClass}`}
        aria-label={isMenuOpen ? '关闭菜单' : '打开菜单'}
      >
        {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      <div className="hidden md:flex gap-3 flex-wrap justify-end">
        <button
          onClick={() => setShowAppearanceModal(true)}
          className="px-5 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl font-black text-sm hover:bg-emerald-100 transition-all flex items-center gap-2"
        >
          <Palette size={16}/> 外观
        </button>

        <button
          onClick={() => setShowMemoryCabin(true)}
          className="px-5 py-2.5 bg-purple-50 text-purple-600 rounded-xl font-black text-sm hover:bg-purple-100 transition-all flex items-center gap-2"
        >
          <BrainCircuit size={16}/> T3 状态舱
        </button>

        <button
          onClick={handleExtractTasks}
          disabled={isExtracting}
          className="px-5 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl font-black text-sm hover:bg-indigo-100 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {isExtracting ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>} 智能代办
        </button>
        <button
          onClick={() => setAppPhase('dashboard')}
          className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all ${softButtonClass}`}
        >
          返回大厅
        </button>
      </div>

      {isMenuOpen && (
        <div className={`md:hidden absolute top-full left-3 right-3 mt-2 rounded-2xl border p-3 space-y-2 ${mobileMenuClass}`}>
          <button
            onClick={() => runMobileAction(() => setShowAppearanceModal(true))}
            className="w-full px-4 py-3 bg-emerald-50 text-emerald-600 rounded-xl font-black text-sm flex items-center gap-2"
          >
            <Palette size={16}/> 外观设置
          </button>
          <button
            onClick={() => runMobileAction(() => setShowMemoryCabin(true))}
            className="w-full px-4 py-3 bg-purple-50 text-purple-600 rounded-xl font-black text-sm flex items-center gap-2"
          >
            <BrainCircuit size={16}/> T3 状态舱
          </button>
          <button
            onClick={() => runMobileAction(handleExtractTasks)}
            disabled={isExtracting}
            className="w-full px-4 py-3 bg-indigo-50 text-indigo-600 rounded-xl font-black text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {isExtracting ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>} 智能代办
          </button>
          <button
            onClick={() => runMobileAction(() => setAppPhase('dashboard'))}
            className={`w-full px-4 py-3 rounded-xl font-black text-sm flex items-center gap-2 ${softButtonClass}`}
          >
            <ChevronLeft size={16}/> 返回大厅
          </button>
        </div>
      )}
    </header>
  );
}
