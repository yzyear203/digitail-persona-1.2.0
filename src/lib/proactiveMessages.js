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

function getLocalChatHistory(personaId) {
  if (typeof localStorage === 'undefined' || !personaId) return [];
  try {
    const raw = localStorage.getItem(`chat_history_${personaId}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getLatestVisibleLocalMessage(personaId) {
  return [...getLocalChatHistory(personaId)]
    .reverse()
    .find(message => message?.role !== 'system' && !message?.isDeletedForUser && !message?.isRecalled);
}

function getLatestLocalUserMessage(personaId) {
  return [...getLocalChatHistory(personaId)]
    .reverse()
    .find(message => message?.role === 'user' && !message?.isDeletedForUser && !message?.isRecalled);
}

function getMessageTimestamp(message) {
  const idTime = Number(message?.id);
  if (Number.isFinite(idTime) && idTime > 1000000000000) return idTime;
  return 0;
}

function getDocCreatedTimestamp(doc) {
  const createdAt = new Date(doc?.createdAt || '').getTime();
  if (Number.isFinite(createdAt)) return createdAt;
  const messageId = Number(doc?.messageId);
  if (Number.isFinite(messageId) && messageId > 1000000000000) return messageId;
  return 0;
}

async function consumeDocsSilently(docs = []) {
  if (!db || !docs.length) return;
  await Promise.allSettled(docs
    .filter(doc => doc?._id || doc?.id)
    .map(doc => db.collection('persona_proactive_messages').doc(doc._id || doc.id).update({
      consumed: true,
      consumedAt: new Date().toISOString(),
      consumedReason: 'stale_after_user_message',
    })));
}

export async function fetchPendingProactiveMessages({ personaId, uid, limit = 8 }) {
  if (!db || !personaId) return [];

  try {
    const query = db.collection('persona_proactive_messages')
      .where({ personaId, consumed: false })
      .orderBy('createdAt', 'asc')
      .limit(limit);

    const res = await query.get();
    const docs = getDocData(res)
      .filter(doc => !uid || !doc.uid || String(doc.uid) === String(uid))
      .filter(doc => String(doc.text || '').trim());

    if (!docs.length) return [];

    const latestVisible = getLatestVisibleLocalMessage(personaId);
    const latestUser = getLatestLocalUserMessage(personaId);
    const latestUserTime = getMessageTimestamp(latestUser);

    if (latestVisible?.role === 'user') {
      const staleDocs = latestUserTime
        ? docs.filter(doc => getDocCreatedTimestamp(doc) <= latestUserTime)
        : [];
      await consumeDocsSilently(staleDocs);
      return [];
    }

    const freshDocs = latestUserTime
      ? docs.filter(doc => getDocCreatedTimestamp(doc) > latestUserTime)
      : docs;
    const staleDocs = latestUserTime
      ? docs.filter(doc => getDocCreatedTimestamp(doc) <= latestUserTime)
      : [];

    await consumeDocsSilently(staleDocs);

    return freshDocs.map(doc => ({
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
