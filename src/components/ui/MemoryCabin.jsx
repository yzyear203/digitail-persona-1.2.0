import React from 'react';
import { BrainCircuit, X, ShieldAlert, Heart, Zap } from 'lucide-react';

export default function MemoryCabin({ activePersona, onClose }) {
  let t3Data = null;
  try {
    t3Data = JSON.parse(activePersona?.content || '{}');
  } catch (e) {}

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-end z-[120]">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <BrainCircuit className="text-purple-600"/> 记忆透明舱
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 bg-white rounded-full shadow-sm">
            <X size={18}/>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          
          {!t3Data || Object.keys(t3Data).length === 0 ? (
            <div className="text-center py-20 text-slate-400 font-bold">暂无结构化档案，触发冷启动中...</div>
          ) : (
            <>
              {/* Identity Block */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-xs font-black uppercase text-slate-400 mb-3 tracking-widest flex justify-between">
                  <span>核心身份档案</span>
                  {t3Data.identity?.confidence === 'medium' && <span className="text-amber-500 text-[10px] bg-amber-50 px-2 py-0.5 rounded">AI 推断</span>}
                </h3>
                <p className="text-sm font-bold text-slate-700 leading-relaxed">{t3Data.identity?.value || '未获取'}</p>
              </div>

              {/* Personality Block */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-xs font-black uppercase text-slate-400 mb-3 tracking-widest flex justify-between">
                  <span>性格侧写</span>
                </h3>
                <p className="text-sm font-medium text-slate-600 leading-relaxed">{t3Data.personality?.value || '未获取'}</p>
              </div>

              {/* Current Context Block */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-5 rounded-2xl border border-indigo-100 shadow-sm">
                <h3 className="text-xs font-black text-indigo-800 mb-3 flex items-center gap-1">
                  <Zap size={14}/> 闪电状态 (当前上下文)
                </h3>
                <p className="text-sm font-bold text-indigo-900">{t3Data.current_context?.value || '静默期'}</p>
                {t3Data.current_context?.expires_at && (
                  <p className="text-[10px] text-indigo-400 mt-2 font-mono">
                    TTL: {new Date(t3Data.current_context.expires_at).toLocaleString()} 后过期
                  </p>
                )}
              </div>

              {/* Interests Block */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-xs font-black uppercase text-slate-400 mb-3 tracking-widest flex items-center gap-1">
                  <Heart size={14}/> 已知兴趣/特征
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(t3Data.interests || []).map((item, idx) => (
                    <span key={idx} className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200">
                      {item.topic} <span className="text-slate-400 font-mono ml-1">W:{item.weight}</span>
                    </span>
                  ))}
                  {(!t3Data.interests || t3Data.interests.length === 0) && <span className="text-xs text-slate-400">暂无数据</span>}
                </div>
              </div>

              {/* Pending Conflicts Placeholder */}
              <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 border-dashed">
                <h3 className="text-xs font-black text-amber-800 mb-2 flex items-center gap-1">
                  <ShieldAlert size={14}/> 待裁决区 (冲突检测)
                </h3>
                <p className="text-xs text-amber-600/80 font-medium">当前无阻断冲突。后端的 CONFLICT 数据将流转至此由您裁决。</p>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
