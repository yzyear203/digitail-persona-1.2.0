import { db } from './cloudbase';

function getDocData(response) {
  return Array.isArray(response?.data) ? response.data : [];
}

function normalizeTime(value) {
  if (!value) return new Date().toLocaleTimeString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toLocaleTimeString();
  return date.toLocaleTimeString();
}

function dispatchProactiveNotice({ personaId, docs }) {
  if (typeof window === 'undefined' || !personaId || !docs?.length) return;
  const latest = docs[docs.length - 1];
  const text = String(latest.text || '').trim();
  if (!text) return;

  window.dispatchEvent(new CustomEvent('persona-runtime-status-updated', {
    detail: {
      personaId,
      status: {
        label: '来消息',
        activity: text.slice(0, 56),
        mood: '主动联系',
        base_mood: '主动联系',
        chat_mood: '主动联系',
        emotional_shift: '',
        color: 'purple',
        duration_minutes: 0,
        updated_at: new Date().toISOString(),
        expires_at: '',
        source: 'proactive_notice',
      },
    },
  }));
}

export async function fetchPendingProactiveMessages({ personaId, uid, limit = 8 } = {}) {
  if (!db || !personaId) return [];

  try {
    const res = await db.collection('persona_proactive_messages')
      .where({ personaId, consumed: false })
      .orderBy('createdAt', 'asc')
      .limit(limit)
      .get();

    const docs = getDocData(res)
      .filter(doc => !uid || !doc.uid || String(doc.uid) === String(uid))
      .filter(doc => String(doc.text || '').trim());

    if (!docs.length) return [];

    dispatchProactiveNotice({ personaId, docs });

    return docs.map(doc => ({
      ...doc,
      id: doc._id || doc.id,
      noticeText: String(doc.text || '').trim(),
      noticeTime: normalizeTime(doc.createdAt),
      message: {
        id: doc.messageId || Date.now() + Math.floor(Math.random() * 10000),
        role: 'system',
        text: '',
        time: normalizeTime(doc.createdAt),
        isProactive: true,
        proactiveReason: doc.reason || '',
      },
    }));
  } catch (error) {
    console.warn('拉取 Persona 主动消息失败:', error);
    return [];
  }
}

export async function markProactiveMessagesConsumed(messageDocs = []) {
  if (!db || !messageDocs.length) return;

  await Promise.allSettled(messageDocs
    .filter(doc => doc.id)
    .map(doc => db.collection('persona_proactive_messages').doc(doc.id).update({
      consumed: true,
      consumedAt: new Date().toISOString(),
    })));
}

export async function clearProactivePendingFlag(persona) {
  if (!db || !persona?.id) return null;

  try {
    const t3 = JSON.parse(persona.content || '{}');
    const current = t3.proactive_contact || {};
    if (!current.pendingUnreplied) return null;

    t3.proactive_contact = {
      ...current,
      pendingUnreplied: false,
      lastUserReplyAt: new Date().toISOString(),
    };

    const nextContent = JSON.stringify(t3);
    await db.collection('personas').doc(persona.id).update({ content: nextContent, updatedAt: Date.now() });
    return nextContent;
  } catch (error) {
    console.warn('清除主动消息待回复标记失败:', error);
    return null;
  }
}
