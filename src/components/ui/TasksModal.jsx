import React from 'react';
import { CheckSquare } from 'lucide-react';

export default function TasksModal({ tasks, onClose }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
        <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
          <CheckSquare className="text-indigo-600"/> 提炼代办事项
        </h2>
        <div className="space-y-3 mb-8 max-h-60 overflow-y-auto">
          {tasks.length === 0
            ? <p className="text-center text-slate-400 py-10 font-bold">未识别到明确任务</p>
            : tasks.map((t, i) => (
                <label key={i} className="flex gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <input type="checkbox" className="w-4 h-4 mt-1"/>
                  <span className="text-sm font-bold text-slate-700">{t}</span>
                </label>
              ))
          }
        </div>
        <button onClick={onClose} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl">关闭</button>
      </div>
    </div>
  );
}