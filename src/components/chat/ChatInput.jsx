import React from 'react';
import { Quote, Send, X } from 'lucide-react';

export default function ChatInput({ input, setInput, handleSendMessage, chatAppearance, quotedMessage, onClearQuote }) {
  const isDark = chatAppearance?.theme === 'dark';
  const footerClass = isDark
    ? 'bg-slate-950/95 border-slate-800'
    : 'bg-white border-slate-200';
  const inputClass = isDark
    ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:ring-emerald-500'
    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:ring-emerald-500';
  const quoteClass = isDark
    ? 'bg-slate-900 border-slate-700 text-slate-300'
    : 'bg-emerald-50 border-emerald-100 text-slate-600';

  return (
    <footer className={`${footerClass} border-t p-4 md:p-5 transition-colors`}>
      <div className="max-w-4xl mx-auto space-y-3">
        {quotedMessage && (
          <div className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${quoteClass}`}>
            <div className="min-w-0 flex items-center gap-2 text-sm font-bold">
              <Quote size={16} className="shrink-0 text-emerald-500" />
              <span className="shrink-0 text-emerald-600">引用</span>
              <span className="truncate">{quotedMessage.text}</span>
            </div>
            <button type="button" onClick={onClearQuote} className="p-1 rounded-lg hover:bg-white/60 shrink-0">
              <X size={16} />
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex gap-3 md:gap-4">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="与分身深入交流..."
            className={`flex-1 border rounded-2xl px-5 md:px-6 py-4 focus:ring-2 outline-none font-bold transition-colors ${inputClass}`}
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-6 md:px-8 bg-[#07c160] hover:bg-[#06ad56] text-white rounded-2xl font-black shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send/>
          </button>
        </form>
      </div>
    </footer>
  );
}
