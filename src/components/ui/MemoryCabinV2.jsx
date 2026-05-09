import React, { useEffect, useRef, useState } from 'react';
import { BrainCircuit, DatabaseZap, Loader2, MessageSquareX, Save, UserPen, X } from 'lucide-react';
import { db } from '../../lib/cloudbase';
import { upsertPersonaProfile } from '../../lib/profileStore';
import { getDisplayRuntimeStatus, getPersonaRuntimeStatusId } from '../../lib/personaRuntimeStatus';

function parseT3Content(content) {
  try {
    return JSON.parse(content || '{}');
  } catch {
    return {};
  }
}

function getPersonaDocId(persona) {
  return persona?._id || persona?.id || '';
}

function getFirstDocData(response) {
  return Array.isArray(response?.data) ? response.data[0] || null : response?.data || null;
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
      bond_momentum: 'stable',
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
    pending_conflicts: [],
  };
}

export default function MemoryCabinV2({ activePersona, setActivePersona, showMsg, onClose, onClearChatHistory }) {
  const [isSaving, setIsSaving] = useState(false);
  const [personaName, setPersonaName] = useState(activePersona?.name || '');
  const [t3Data, setT3Data] = useState(() => parseT3Content(activePersona?.content));
  const [runtimeStatus, setRuntimeStatus] = useState(() => getDisplayRuntimeStatus(activePersona));
  const latestPersonaRef = useRef(activePersona);
  const personaIdForStatus = getPersonaRuntimeStatusId(activePersona);

  useEffect(() => {
    latestPersonaRef.current = activePersona;
    setT3Data(parseT3Content(activePersona?.content));
    setRuntimeStatus(getDisplayRuntimeStatus(activePersona));
    setPersonaName(activePersona?.name || '');
  }, [activePersona, personaIdForStatus]);

  useEffect(() => {
    const handleRuntimeStatusUpdate = (event) => {
      if (!event.detail?.status) return;
      if (event.detail?.personaId && event.detail.personaId !== personaIdForStatus) return;
      setRuntimeStatus(event.detail.status);
    };
    window.addEventListener('persona-runtime-status-updated', handleRuntimeStatusUpdate);
    return () => window.removeEventListener('persona-runtime-status-updated', handleRuntimeStatusUpdate);
  }, [personaIdForStatus]);

  const refreshLocalPersona = (patch) => {
    setActivePersona(prev => {
      const next = { ...prev, ...patch };
      latestPersonaRef.current = next;
      return next;
    });
  };

  const savePersonaName = async (event) => {
    event.preventDefault();
    const nextName = personaName.trim();
    if (!nextName) {
      showMsg('昵称不能为空');
      return;
    }

    const persona = latestPersonaRef.current || activePersona;
    const personaId = getPersonaDocId(persona);
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
      const nextT3 = { ...parseT3Content(persona.content), persona_name: nextName };
      const nextContent = JSON.stringify(nextT3);
      const updatedAt = Date.now();

      await db.collection('personas').doc(personaId).update({
        name: nextName,
        content: nextContent,
        updatedAt,
      });

      const verifyRes = await db.collection('personas').doc(personaId).get();
      const remoteDoc = getFirstDocData(verifyRes);
      const remoteT3 = parseT3Content(remoteDoc?.content);
      const remoteName = remoteDoc?.name || remoteT3?.persona_name || '';

      if (remoteName !== nextName) {
        throw new Error(`TCB 回读校验失败：期望 ${nextName}，实际 ${remoteName || '空'}`);
      }

      setT3Data(nextT3);
      refreshLocalPersona({
        _id: persona._id || personaId,
        id: persona.id || personaId,
        name: nextName,
        content: nextContent,
        updatedAt: remoteDoc?.updatedAt || updatedAt,
      });
      await upsertPersonaProfile({ personaId, t3Profile: nextT3 });
      showMsg('✅ Persona 昵称已写入 TCB 并通过回读校验');
    } catch (error) {
      showMsg('❌ 昵称保存失败: ' + error.message);
      setPersonaName((latestPersonaRef.current || activePersona)?.name || '');
    } finally {
      setIsSaving(false);
    }
  };

  const clearAllMemory = async () => {
    if (!window.confirm('确定清空全部记忆吗？这会清空 T3 状态档案、兴趣/禁忌/当前状态，以及长期记忆库；不会删除聊天记录。')) return;

    const persona = latestPersonaRef.current || activePersona;
    const personaId = getPersonaDocId(persona);
    const emptyT3 = buildEmptyT3Profile(parseT3Content(persona?.content));
    const nextContent = JSON.stringify(emptyT3);

    setIsSaving(true);
    try {
      if (db && personaId) {
        await db.collection('personas').doc(personaId).update({ content: nextContent, updatedAt: Date.now() });
        await upsertPersonaProfile({ personaId, t3Profile: emptyT3 });
      }
      localStorage.removeItem(`hot_t1_${personaId}`);
      localStorage.removeItem(`persona_runtime_status_${personaId}`);
      setT3Data(emptyT3);
      setRuntimeStatus(getDisplayRuntimeStatus({ ...persona, content: nextContent }));
      refreshLocalPersona({ content: nextContent });
      showMsg('✅ 全部记忆已清空，聊天记录已保留');
    } catch (error) {
      showMsg('❌ 清空记忆失败: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const personaDisplayName = t3Data.persona_name || activePersona?.name || '未获取';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-end z-[120]">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 relative overflow-hidden">
          {isSaving && <div className="absolute top-0 left-0 w-full h-1 bg-purple-500 animate-pulse" />}
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <BrainCircuit className="text-purple-600" /> T3 状态舱
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 bg-white rounded-full shadow-sm">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 pb-20">
          <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-sm space-y-4">
            <form onSubmit={savePersonaName} className="space-y-2">
              <label className="text-xs font-black uppercase text-purple-500 tracking-widest flex items-center gap-1">
                <UserPen size={14} /> Persona 昵称
              </label>
              <div className="flex gap-2">
                <input
                  value={personaName}
                  onChange={event => setPersonaName(event.target.value)}
                  placeholder="给 TA 起一个名字"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:border-purple-300"
                />
                <button type="submit" disabled={isSaving || !personaName.trim()} className="bg-purple-600 text-white px-3 rounded-xl hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1 text-xs font-black">
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 保存
                </button>
              </div>
            </form>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={onClearChatHistory} disabled={isSaving} className="bg-slate-100 text-slate-600 px-3 py-2.5 rounded-xl text-xs font-black hover:bg-slate-200 disabled:opacity-50 flex justify-center items-center gap-1">
                <MessageSquareX size={15} /> 清空聊天
              </button>
              <button onClick={clearAllMemory} disabled={isSaving} className="bg-red-50 text-red-600 px-3 py-2.5 rounded-xl text-xs font-black hover:bg-red-100 disabled:opacity-50 flex justify-center items-center gap-1">
                <DatabaseZap size={15} /> 清空记忆
              </button>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">保存昵称会写入 personas.name 和 personas.content.persona_name，并立即从 TCB 回读校验。</p>
          </div>

          <div className="bg-gradient-to-br from-rose-50 to-orange-50 p-5 rounded-2xl border border-rose-100 shadow-sm space-y-2">
            <h3 className="text-xs font-black text-rose-800 flex items-center gap-1">🎭 Persona 自选状态栏</h3>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-white border border-rose-100 text-xs font-black text-rose-600">{runtimeStatus?.label || '在线'}</span>
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">{runtimeStatus?.color || 'green'}</span>
            </div>
            <p className="text-sm font-bold text-rose-900">{runtimeStatus?.activity || '等待新的聊天信号'}</p>
            {runtimeStatus?.mood && <p className="text-[11px] text-rose-500 font-bold">情绪：{runtimeStatus.mood}</p>}
          </div>

          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-5 rounded-2xl border border-indigo-100 shadow-sm">
            <h3 className="text-xs font-black text-indigo-800 mb-3 flex items-center gap-1">⚡ 闪电状态 (当前上下文)</h3>
            <p className="text-sm font-bold text-indigo-900">{t3Data.current_context?.value || '静默期，无紧急事态'}</p>
            {t3Data.current_context?.expires_at && <p className="text-[10px] text-indigo-400 mt-2 font-mono">TTL: {new Date(t3Data.current_context.expires_at).toLocaleString()} 后过期销毁</p>}
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black uppercase text-slate-400 mb-3 tracking-widest">核心身份档案</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3"><span className="text-slate-400 font-black shrink-0">Persona：</span><span className="text-slate-700 font-bold text-right">{personaDisplayName}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-400 font-black shrink-0">称呼：</span><span className="text-slate-700 font-bold text-right">{t3Data.user_name || '未获取'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-400 font-black shrink-0">身份：</span><span className="text-slate-700 font-bold text-right">{t3Data.identity?.value || '未获取'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-400 font-black shrink-0">关系：</span><span className="text-slate-700 font-bold text-right">{t3Data.relationship?.archetype || '未获取'} · 亲密度 {t3Data.relationship?.intimacy_level ?? 1}/10</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
