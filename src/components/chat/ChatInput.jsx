import React from 'react';
import { Send } from 'lucide-react';

export default function ChatInput({ input, setInput, handleSendMessage }) {
  return (
    <footer className="bg-white border-t border-slate-200 p-6">
      <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-4">
        <input 
          type="text" 
          value={input} 
          onChange={e => setInput(e.target.value)} 
          placeholder="与分身深入交流..." 
          className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800" 
        />
        <button 
          type="submit" 
          disabled={!input.trim()} 
          className="px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black shadow-lg transition-all"
        >
          <Send/>
        </button>
      </form>
    </footer>
  );
}