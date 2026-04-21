import React from 'react';
import { UserCircle, Trash2 } from 'lucide-react';

export default function PersonaCard({ persona, onClick, onDelete }) {
  return (
    <div onClick={onClick} className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl hover:border-indigo-400 hover:shadow-lg transition-all cursor-pointer group">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
          <UserCircle size={24}/>
        </div>
        <div className="flex flex-col truncate max-w-[120px]">
          <span className="font-bold text-slate-800 truncate">{persona.name}</span>
          <span className="text-[10px] text-slate-400">{new Date(persona.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      <button onClick={e => { e.stopPropagation(); onDelete(e, persona.id); }} className="text-slate-300 hover:text-red-500 p-2">
        <Trash2 size={18}/>
      </button>
    </div>
  );
}