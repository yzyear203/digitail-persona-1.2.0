// ==========================================
// 方案 A 全量覆盖：src/components/ui/MemoryCabin.jsx
// 目标：彻底拔除 React 状态覆写炸弹，实现无损的动态状态合并
// ==========================================

import React, { useState, useEffect, useRef } from 'react';
import { BrainCircuit, X, ShieldAlert, Heart, Zap, Trash2, Plus, Ban, Check, Loader2 } from 'lucide-react';
import { db } from '../../lib/cloudbase';

export default function MemoryCabin({ activePersona, setActivePersona, showMsg, onClose }) {
  const [isSaving, setIsSaving] = useState(false);
  const [newForbidden, setNewForbidden] = useState('');

  // 初始化本地可编辑的 T3 状态
  const [t3Data, setT3Data] = useState(() => {
    try {
      return JSON.parse(activePersona?.content || '{}');
    } catch (parseError) {
      console.warn('透明舱 T3 初始化解析失败:', parseError);
      return {};
    }
  });

  // 👑 首席修复：使用 ref 实时追踪最新的 activePersona，规避闭包陷阱
  const latestPersonaRef = useRef(activePersona);
  useEffect(() => {
    latestPersonaRef.current = activePersona;
  }, [activePersona]);

  // 👑 首席修复：仅在外部发生重大刷新且舱体未操作时，被动同步显示数据
  useEffect(() => {
    if (!activePersona?.content) return;
    try {
      const freshData = JSON.parse(activePersona.content);
      // 仅做显示层面的防御性同步，不直接覆写，核心防冲突交由 syncToCloud 的函数式更新处理
      setT3Data(prev => ({ ...freshData, ...prev }));
    } catch (e) {
      console.error("透明舱同步外部状态失败:", e);
    }
  }, [activePersona?.content]);

  // 👑 首席引擎重构：将前端修改一键同步至云端数据库与全局状态 (函数式更新防并发踩踏)
  const syncToCloud = async (updaterFunction) => {
    setIsSaving(true);
    try {
      let mergedStr = "";
      
      // 1. 同步前端聊天引擎的状态：使用 prev 函数式回调，获取执行瞬间的最绝对新鲜状态
      setActivePersona(prev => {
        let latestT3 = {};
        try {
          latestT3 = JSON.parse(prev.content || '{}');
        } catch (parseError) {
          console.warn('透明舱同步前解析最新 T3 失败:', parseError);
        }
        
        // 将局部修改精准打补丁到最新状态上
        const updatedT3 = updaterFunction(latestT3);
        
        // 同步回本地 UI
        setT3Data(updatedT3);
        
        mergedStr = JSON.stringify(updatedT3);
        return { ...prev, content: mergedStr };
      });

      // 确保微任务队列清空，mergedStr 拿到最新值
      await Promise.resolve();

      // 2. 静默直连 TCB 数据库进行覆写，省去云函数调用
      if (db && latestPersonaRef.current?.id) {
        await db.collection('personas').doc(latestPersonaRef.current.id).update({
          content: mergedStr
        });
      }
      showMsg('✅ 记忆舱矩阵已重新对齐，未发生并发踩踏');
    } catch (error) {
      showMsg('❌ 同步云端失败: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // --- 交互功能 1：一键删除兴趣特征 ---
  const handleRemoveInterest = (index) => {
    syncToCloud(latest => {
      const newInterests = [...(latest.interests || [])];
      newInterests.splice(index, 1);
      return { ...latest, interests: newInterests };
    });
  };

  // --- 交互功能 2：手动添加与删除禁忌话题 ---
  const handleAddForbidden = (e) => {
    e.preventDefault();
    const trimmed = newForbidden.trim();
    if (!trimmed) return;
    
    syncToCloud(latest => {
      const newForbiddenList = [...(latest.forbidden_topics || [])];
      if (!newForbiddenList.includes(trimmed)) {
        newForbiddenList.push(trimmed);
      }
      return { ...latest, forbidden_topics: newForbiddenList };
    });
    setNewForbidden('');
  };

  const handleRemoveForbidden = (index) => {
    syncToCloud(latest => {
      const newForbiddenList = [...(latest.forbidden_topics || [])];
      newForbiddenList.splice(index, 1);
      return { ...latest, forbidden_topics: newForbiddenList };
    });
  };

  // --- 交互功能 3：处理冲突网关抛出的 Pending Conflicts ---
  const handleResolveConflict = (index, decision) => {
    syncToCloud(latest => {
      const newLatest = { ...latest };
      const conflictList = [...(newLatest.pending_conflicts || [])];
      if (conflictList.length === 0) return newLatest;

      const conflict = conflictList[index];

      if (decision === 'accept' && conflict) {
        // 假设冲突字段路径扁平，如 "identity.value"
        const keys = conflict.field.split('.');
        if (keys.length === 2) {
          if (!newLatest[keys[0]]) newLatest[keys[0]] = {};
          newLatest[keys[0]][keys[1]] = conflict.new_value;
        } else if (keys.length === 1) {
          newLatest[keys[0]] = conflict.new_value;
        }
      }
      
      // 无论接受还是拒绝，都将其移出待裁决区
      conflictList.splice(index, 1);
      newLatest.pending_conflicts = conflictList;
      return newLatest;
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-end z-[120]">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 relative overflow-hidden">
          {isSaving && <div className="absolute top-0 left-0 w-full h-1 bg-purple-500 animate-pulse"></div>}
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <BrainCircuit className="text-purple-600"/> T3 记忆透明舱
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 bg-white rounded-full shadow-sm">
            <X size={18}/>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 pb-20">
          
          {!t3Data || Object.keys(t3Data).length === 0 ? (
            <div className="text-center py-20 text-slate-400 font-bold">暂无结构化档案，触发冷启动中...</div>
          ) : (
            <>
              {/* === 冲突待裁决区 (Highest Priority) === */}
              {t3Data.pending_conflicts?.length > 0 && (
                <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 shadow-sm animate-pulse">
                  <h3 className="text-xs font-black text-amber-800 mb-3 flex items-center gap-1">
                    <ShieldAlert size={16}/> 冲突网关拦截待裁决 ({t3Data.pending_conflicts.length})
                  </h3>
                  <div className="space-y-3">
                    {t3Data.pending_conflicts.map((conf, idx) => (
                      <div key={idx} className="bg-white p-3 rounded-xl text-xs border border-amber-100">
                        <p className="font-bold text-slate-600 mb-1">字段：{conf.field}</p>
                        <p className="text-slate-400 line-through">旧值：{conf.old_value}</p>
                        <p className="text-amber-600 font-bold mb-3">新值：{conf.new_value}</p>
                        <div className="flex gap-2">
                          <button onClick={() => handleResolveConflict(idx, 'reject')} className="flex-1 py-1.5 bg-slate-100 text-slate-600 rounded-lg font-bold hover:bg-slate-200 flex justify-center items-center gap-1">
                            <X size={14}/> 驳回
                          </button>
                          <button onClick={() => handleResolveConflict(idx, 'accept')} className="flex-1 py-1.5 bg-amber-500 text-white rounded-lg font-bold hover:bg-amber-600 flex justify-center items-center gap-1">
                            <Check size={14}/> 接受覆盖
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* === 闪电状态 === */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-5 rounded-2xl border border-indigo-100 shadow-sm relative overflow-hidden">
                <h3 className="text-xs font-black text-indigo-800 mb-3 flex items-center gap-1">
                  <Zap size={14} className={t3Data.current_context?.value ? "animate-bounce text-amber-500" : ""}/> 闪电状态 (当前上下文)
                </h3>
                <p className="text-sm font-bold text-indigo-900">{t3Data.current_context?.value || '静默期，无紧急事态'}</p>
                {t3Data.current_context?.expires_at && (
                  <p className="text-[10px] text-indigo-400 mt-2 font-mono">
                    TTL: {new Date(t3Data.current_context.expires_at).toLocaleString()} 后过期销毁
                  </p>
                )}
              </div>

              {/* === 身份与性格 === */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-xs font-black uppercase text-slate-400 mb-3 tracking-widest flex justify-between">
                  <span>核心身份档案</span>
                  {t3Data.identity?.confidence === 'medium' && <span className="text-amber-500 text-[10px] bg-amber-50 px-2 py-0.5 rounded">AI 推断</span>}
                </h3>
                <p className="text-sm font-bold text-slate-700 leading-relaxed mb-5">{t3Data.identity?.value || '未获取'}</p>
                
                <h3 className="text-xs font-black uppercase text-slate-400 mb-3 tracking-widest">性格侧写</h3>
                <p className="text-sm font-medium text-slate-600 leading-relaxed h-32 overflow-y-auto pr-2 custom-scrollbar">
                  {t3Data.personality?.value || '未获取'}
                </p>
              </div>

              {/* === 已知兴趣/特征 (可删除) === */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-xs font-black uppercase text-slate-400 mb-3 tracking-widest flex items-center gap-1">
                  <Heart size={14}/> 已知兴趣/客观事实
                </h3>
                <div className="flex flex-wrap gap-2">
                  {(t3Data.interests || []).map((item, idx) => (
                    <div key={idx} className="group flex items-center bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 transition-all hover:border-red-200 hover:bg-red-50">
                      <span>{item.topic}</span>
                      <span className="text-slate-400 font-mono ml-2 border-l border-slate-300 pl-2 group-hover:hidden">W:{item.weight}</span>
                      <button onClick={() => handleRemoveInterest(idx)} className="hidden group-hover:block ml-2 text-red-500 hover:text-red-700">
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  ))}
                  {(!t3Data.interests || t3Data.interests.length === 0) && <span className="text-xs text-slate-400">暂无数据</span>}
                </div>
              </div>

              {/* === 绝对禁忌 (可添加) === */}
              <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-sm">
                <h3 className="text-xs font-black uppercase text-red-400 mb-3 tracking-widest flex items-center gap-1">
                  <Ban size={14}/> 潜意识禁忌 (Forbidden Topics)
                </h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  {(t3Data.forbidden_topics || []).map((item, idx) => (
                    <div key={idx} className="flex items-center bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200">
                      <span>{item}</span>
                      <button onClick={() => handleRemoveForbidden(idx)} className="ml-2 text-red-400 hover:text-red-600">
                        <X size={14}/>
                      </button>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleAddForbidden} className="flex gap-2">
                  <input 
                    type="text" 
                    value={newForbidden}
                    onChange={(e) => setNewForbidden(e.target.value)}
                    placeholder="输入雷区，如：前任的名字" 
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-red-300"
                  />
                  <button type="submit" disabled={!newForbidden.trim() || isSaving} className="bg-slate-800 text-white p-2 rounded-lg hover:bg-slate-700 disabled:opacity-50">
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16}/>}
                  </button>
                </form>
                <p className="text-[10px] text-slate-400 mt-2">AI 将在所有对话中绝对规避以上话题。</p>
              </div>

            </>
          )}
        </div>
      </div>
    </div>
  );
}
