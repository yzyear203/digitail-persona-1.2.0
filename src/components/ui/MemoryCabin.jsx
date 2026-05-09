// ==========================================
// 方案 A 全量覆盖：src/components/ui/MemoryCabin.jsx
// 目标：彻底拔除 React 状态覆写炸弹，实现无损的动态状态合并
// ==========================================

import React, { useState, useEffect, useRef } from 'react';
import { BrainCircuit, X, ShieldAlert, Heart, Zap, Trash2, Plus, Ban, Check, Loader2, Save, UserPen, MessageSquareX, DatabaseZap } from 'lucide-react';
import { db } from '../../lib/cloudbase';
import { upsertPersonaProfile } from '../../lib/profileStore';

const PROFILE_SUMMARY_FIELDS = [
  { label: '打字速度', patterns: [/打字速度[:：]?([^\n。；;]+)/, /打字节奏[:：]?([^\n。；;]+)/] },
  { label: '连发习惯', patterns: [/连发(?:的)?条数(?:范围)?[:：]?([^\n。；;]+)/, /一次性连发[:：]?([^\n。；;]+)/] },
  { label: '口头禅', patterns: [/口头禅(?:和惯用词)?[:：]?([^\n。；;]+)/, /惯用词[:：]?([^\n。；;]+)/] },
  { label: '收尾方式', patterns: [/句子收尾方式[:：]?([^\n。；;]+)/, /收尾(?:习惯|方式)?[:：]?([^\n。；;]+)/] },
  { label: '标点习惯', patterns: [/标点使用习惯[:：]?([^\n。；;]+)/, /标点[:：]?([^\n。；;]+)/] },
  { label: '情绪触发', patterns: [/情绪触发器[:：]?([^\n。；;]+)/, /触发器[:：]?([^\n。；;]+)/] },
  { label: '删改习惯', patterns: [/删掉的是哪类真实发言[:：]?([^\n。；;]+)/, /潜意识犹豫[^:：]*[:：]?([^\n。；;]+)/] },
  { label: '聊天体感', patterns: [/整体聊天感受[:：]?([^\n。；;]+)/, /给对方带来的整体聊天感受[:：]?([^\n。；;]+)/] },
];

function cleanProfileValue(value) {
  return String(value || '')
    .replace(/^[-•*\d.、\s]+/, '')
    .replace(/^我(?:的|会|通常|必须)?/, '')
    .replace(/^[:：\s]+/, '')
    .trim();
}

function buildPersonalitySummary(personalityText) {
  const text = String(personalityText || '');
  if (!text.trim()) return [];

  const summary = PROFILE_SUMMARY_FIELDS.map(field => {
    const matched = field.patterns
      .map(pattern => text.match(pattern)?.[1])
      .find(Boolean);

    if (!matched) return null;
    return {
      label: field.label,
      value: cleanProfileValue(matched).slice(0, 80),
    };
  }).filter(item => item?.value);

  if (summary.length > 0) return summary.slice(0, 8);

  return text
    .split(/\n|。|；|;/)
    .map(line => cleanProfileValue(line))
    .filter(Boolean)
    .slice(0, 6)
    .map((line, index) => ({ label: `摘要 ${index + 1}`, value: line.slice(0, 80) }));
}

function parseT3Content(content) {
  try {
    return JSON.parse(content || '{}');
  } catch (parseError) {
    console.warn('T3 内容解析失败，使用空对象兜底:', parseError);
    return {};
  }
}

function getPersonaDocId(persona) {
  return persona?._id || persona?.id || '';
}

function getFirstDocData(response) {
  if (Array.isArray(response?.data)) return response.data[0] || null;
  return response?.data || null;
}

function buildEmptyT3Profile(previousT3 = {}) {
  return {
    persona_name: previousT3.persona_name || '',
    identity: { value: '', confidence: 'low', last_updated: '', source_event_ids: [] },
    personality: previousT3.personality || { value: '', confidence: 'low', last_updated: '', source_event_ids: [] },
    interests: [],
    relationship: {
      archetype: previousT3.relationship?.archetype || '观察者',
      intimacy_level: 1,
      interaction_count: 0,
      last_chat_time: '',
      bond_momentum: 'stable'
    },
    current_context: { value: '', expires_at: '' },
    user_name: '',
    interaction_style: previousT3.interaction_style || {
      quote_tendency: 'medium',
      quote_triggers: [],
      recall_tendency: 'low',
      recall_triggers: [],
    },
    forbidden_topics: [],
    pending_conflicts: []
  };
}

export default function MemoryCabin({ activePersona, setActivePersona, showMsg, onClose, onClearChatHistory }) {
  const [isSaving, setIsSaving] = useState(false);
  const [newForbidden, setNewForbidden] = useState('');
  const [personaName, setPersonaName] = useState(activePersona?.name || '');

  // 初始化本地可编辑的 T3 状态
  const [t3Data, setT3Data] = useState(() => parseT3Content(activePersona?.content));

  // 👑 首席修复：使用 ref 实时追踪最新的 activePersona，规避闭包陷阱
  const latestPersonaRef = useRef(activePersona);
  useEffect(() => {
    latestPersonaRef.current = activePersona;
    setPersonaName(activePersona?.name || '');
  }, [activePersona]);

  // 👑 首席修复：仅在外部发生重大刷新且舱体未操作时，被动同步显示数据
  useEffect(() => {
    if (!activePersona?.content) return;
    const freshData = parseT3Content(activePersona.content);
    // 仅做显示层面的防御性同步，不直接覆写，核心防冲突交由 syncToCloud 的函数式更新处理
    setT3Data(prev => ({ ...freshData, ...prev }));
  }, [activePersona?.content]);

  // 👑 首席引擎重构：将前端修改一键同步至云端数据库与全局状态 (函数式更新防并发踩踏)
  const syncToCloud = async (updaterFunction) => {
    setIsSaving(true);
    try {
      let mergedStr = "";
      
      // 1. 同步前端聊天引擎的状态：使用 prev 函数式回调，获取执行瞬间的最绝对新鲜状态
      setActivePersona(prev => {
        const latestT3 = parseT3Content(prev.content);
        
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
      const personaId = getPersonaDocId(latestPersonaRef.current);
      if (db && personaId) {
        await db.collection('personas').doc(personaId).update({
          content: mergedStr
        });
        await upsertPersonaProfile({
          personaId,
          t3Profile: JSON.parse(mergedStr || '{}'),
        });
      }
      showMsg('✅ 状态舱已同步');
    } catch (error) {
      showMsg('❌ 同步云端失败: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePersonaName = async (e) => {
    e.preventDefault();
    const trimmedName = personaName.trim();
    if (!trimmedName) {
      showMsg('昵称不能为空');
      return;
    }

    const currentPersona = latestPersonaRef.current || activePersona;
    const personaId = getPersonaDocId(currentPersona);
    if (!personaId) {
      showMsg('❌ 昵称保存失败: 当前 Persona 缺少 TCB 文档 ID');
      return;
    }
    if (!db) {
      showMsg('❌ 昵称保存失败: 数据库未初始化');
      return;
    }

    setIsSaving(true);
    try {
      const latestT3 = parseT3Content(currentPersona?.content);
      const nextT3 = { ...latestT3, persona_name: trimmedName };
      const nextContent = JSON.stringify(nextT3);

      await db.collection('personas').doc(personaId).update({
        name: trimmedName,
        content: nextContent,
        updatedAt: Date.now(),
      });

      const verifyRes = await db.collection('personas').doc(personaId).get();
      const remoteDoc = getFirstDocData(verifyRes);
      const remoteT3 = parseT3Content(remoteDoc?.content);
      const remoteName = remoteDoc?.name || remoteT3?.persona_name || '';

      if (remoteName !== trimmedName) {
        throw new Error(`TCB 回读校验失败：期望 ${trimmedName}，实际 ${remoteName || '空'}`);
      }

      setT3Data(nextT3);
      setActivePersona(prev => ({
        ...prev,
        _id: prev?._id || personaId,
        id: prev?.id || personaId,
        name: trimmedName,
        content: nextContent,
        updatedAt: remoteDoc?.updatedAt || Date.now(),
      }));

      await upsertPersonaProfile({
        personaId,
        t3Profile: nextT3,
      });

      showMsg('✅ Persona 昵称已写入 TCB 并通过回读校验');
    } catch (error) {
      showMsg('❌ 昵称保存失败: ' + error.message);
      setPersonaName(latestPersonaRef.current?.name || '');
    } finally {
      setIsSaving(false);
    }
  };

  const removeMemoryDocsByField = async (field, personaId, removedIds) => {
    if (!db || !personaId) return 0;

    let removedCount = 0;
    for (let page = 0; page < 20; page += 1) {
      const res = await db.collection('persona_memories').where({ [field]: personaId }).limit(100).get();
      const records = res.data || [];
      if (records.length === 0) break;

      for (const record of records) {
        const docId = record._id || record.id;
        if (!docId || removedIds.has(docId)) continue;
        await db.collection('persona_memories').doc(docId).remove();
        removedIds.add(docId);
        removedCount += 1;
      }

      if (records.length < 100) break;
    }

    return removedCount;
  };

  const handleClearAllMemory = async () => {
    if (!window.confirm('确定清空全部记忆吗？这会清空 T3 状态档案、兴趣/禁忌/当前状态，以及长期记忆库；不会删除聊天记录。')) return;

    const personaId = getPersonaDocId(latestPersonaRef.current);
    const emptyT3 = buildEmptyT3Profile(parseT3Content(latestPersonaRef.current?.content));
    const emptyT3Str = JSON.stringify(emptyT3);

    setIsSaving(true);
    try {
      setT3Data(emptyT3);
      setActivePersona(prev => ({ ...prev, content: emptyT3Str }));
      localStorage.removeItem(`hot_t1_${personaId}`);

      if (db && personaId) {
        await db.collection('personas').doc(personaId).update({ content: emptyT3Str });
        await upsertPersonaProfile({ personaId, t3Profile: emptyT3 });
        const removedIds = new Set();
        await removeMemoryDocsByField('user_id', personaId, removedIds);
        await removeMemoryDocsByField('personaId', personaId, removedIds);
      }

      showMsg('✅ 全部记忆已清空，聊天记录已保留');
    } catch (error) {
      showMsg('❌ 清空记忆失败: ' + error.message);
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
            <BrainCircuit className="text-purple-600"/> T3 状态舱
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 bg-white rounded-full shadow-sm">
            <X size={18}/>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 pb-20">
          <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-sm space-y-4">
            <form onSubmit={handleSavePersonaName} className="space-y-2">
              <label className="text-xs font-black uppercase text-purple-500 tracking-widest flex items-center gap-1">
                <UserPen size={14}/> Persona 昵称
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={personaName}
                  onChange={(e) => setPersonaName(e.target.value)}
                  placeholder="给 TA 起一个名字"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-purple-300"
                />
                <button type="submit" disabled={isSaving || !personaName.trim()} className="bg-purple-600 text-white px-3 rounded-xl hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1 text-xs font-black">
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16}/>} 保存
                </button>
              </div>
            </form>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={onClearChatHistory} disabled={isSaving} className="bg-slate-100 text-slate-600 px-3 py-2.5 rounded-xl text-xs font-black hover:bg-slate-200 disabled:opacity-50 flex justify-center items-center gap-1">
                <MessageSquareX size={15}/> 清空聊天
              </button>
              <button onClick={handleClearAllMemory} disabled={isSaving} className="bg-red-50 text-red-600 px-3 py-2.5 rounded-xl text-xs font-black hover:bg-red-100 disabled:opacity-50 flex justify-center items-center gap-1">
                <DatabaseZap size={15}/> 清空记忆
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">清空聊天只删除当前对话气泡，不影响 T3/T1 记忆；清空记忆会重置状态档案并清理长期记忆库。</p>
          </div>
          
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
                <div className="space-y-2 mb-5">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-slate-400 font-black shrink-0">Persona：</span>
                    <span className="text-slate-700 font-bold text-right">{t3Data.persona_name || activePersona?.name || '未获取'}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-slate-400 font-black shrink-0">称呼：</span>
                    <span className="text-slate-700 font-bold text-right">{t3Data.user_name || '未获取'}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-slate-400 font-black shrink-0">身份：</span>
                    <span className="text-slate-700 font-bold text-right">{t3Data.identity?.value || '未获取'}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="text-slate-400 font-black shrink-0">关系：</span>
                    <span className="text-slate-700 font-bold text-right">{t3Data.relationship?.archetype || '未获取'} · 亲密度 {t3Data.relationship?.intimacy_level ?? 1}/10</span>
                  </div>
                </div>
                
                <h3 className="text-xs font-black uppercase text-slate-400 mb-3 tracking-widest">性格侧写摘要</h3>
                <div className="space-y-2 text-sm text-slate-600">
                  {buildPersonalitySummary(t3Data.personality?.value).map(item => (
                    <div key={item.label} className="flex justify-between gap-3 bg-slate-50 rounded-lg px-3 py-2">
                      <span className="text-slate-400 font-black shrink-0">{item.label}：</span>
                      <span className="font-medium leading-relaxed text-right">{item.value}</span>
                    </div>
                  ))}
                  {!t3Data.personality?.value && <span className="text-xs text-slate-400">未获取</span>}
                </div>
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
