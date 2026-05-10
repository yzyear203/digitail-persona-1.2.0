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

export async function fetchPendingProactiveMessages({ personaId, uid, limit = 8 }) {
  if (!db || !personaId) return [];

  try {
    let query = db.collection('persona_proactive_messages')
      .where({ personaId, consumed: false })
      .orderBy('createdAt', 'asc')
      .limit(limit);

    const res = await query.get();
    const docs = getDocData(res)
      .filter(doc => !uid || !doc.uid || String(doc.uid) === String(uid))
      .filter(doc => String(doc.text || '').trim());

    return docs.map(doc => ({
      ...doc,
      id: doc._id || doc.id,
      message: {
        id: doc.messageId || Date.now() + Math.floor(Math.random() * 10000),
        role: 'assistant',
        text: String(doc.text || '').trim(),
        time: normalizeTime(doc.createdAt),
        isAnimated: false,
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
