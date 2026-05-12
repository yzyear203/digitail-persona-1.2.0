import { db } from './cloudbase';

export async function fetchPendingProactiveMessages() {
  return [];
}

export async function markProactiveMessagesConsumed() {
  return;
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
