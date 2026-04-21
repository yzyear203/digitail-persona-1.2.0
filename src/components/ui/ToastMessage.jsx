import React from 'react';
import { Info, X } from 'lucide-react';

export default function ToastMessage({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[999] bg-slate-800/95 backdrop-blur-md text-white px-6 py-4 rounded-2xl shadow-2xl flex items-start gap-4 max-w-sm w-full border border-slate-600/50">
      <Info className="w-6 h-6 text-indigo-400 shrink-0 mt-0.5" />
      <span className="font-medium text-sm whitespace-pre-wrap leading-relaxed">{message}</span>
      <button onClick={onClose} className="ml-auto opacity-50 hover:opacity-100 mt-1 shrink-0"><X className="w-4 h-4"/></button>
    </div>
  );
}