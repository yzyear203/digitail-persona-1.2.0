import React from 'react';
import { Send } from 'lucide-react';

export default function ChatInput({ input, setInput, handleSendMessage, chatAppearance }) {
  const isDark = chatAppearance?.theme === 'dark';
  const footerClass = isDark
    ? 'bg-slate-950/95 border-slate-800'
    : 'bg-white border-slate-200';
  const inputClass = isDark
    ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:ring-emerald-500'
    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:ring-emerald-500';

  return (
    <footer className={`${footerClass} border-t p-5 transition-colors`}>
      <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-4">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="与分身深入交流..."
          className={`flex-1 border rounded-2xl px-6 py-4 focus:ring-2 outline-none font-bold transition-colors ${inputClass}`}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="px-8 bg-[#07c160] hover:bg-[#06ad56] text-white rounded-2xl font-black shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send/>
        </button>
      </form>
    </footer>
  );
}
