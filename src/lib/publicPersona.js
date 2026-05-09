import { cloudbase, db } from './cloudbase';

const MAX_INTRO_CHARS = 90;
const MAX_SAMPLE_LINE_CHARS = 36;

function safeJsonParse(content) {
  try {
    return JSON.parse(content || '{}');
  } catch (error) {
    console.warn('公开人格摘要解析失败:', error);
    return {};
  }
}

function compactText(value, maxChars) {
  const source = String(value || '').replace(/\s+/g, ' ').trim();
  if (source.length <= maxChars) return source;
  return `${source.slice(0, maxChars - 1)}…`;
}

function pickIntro(t3, personaName) {
  const runtimeCard = t3.runtime_card?.value || t3.personality_runtime_card?.value || '';
  const identity = t3.identity?.value || '';
  const source = runtimeCard || identity || `和 ${personaName || '这个数字人格'} 聊聊，感受 TA 的说话方式。`;
  return compactText(source, MAX_INTRO_CHARS);
}

function pickTags(t3) {
  const tags = [];
  const relationship = t3.relationship?.archetype;
  if (relationship) tags.push(relationship);

  if (Array.isArray(t3.interests)) {
    t3.interests
      .slice(0, 3)
      .map(item => item?.topic)
      .filter(Boolean)
      .forEach(topic => tags.push(topic));
  }

  const quoteTendency = t3.interaction_style?.quote_tendency;
  const recallTendency = t3.interaction_style?.recall_tendency;
  if (quoteTendency === 'high') tags.push('会引用');
  if (recallTendency === 'high') tags.push('会撤回');
  if (t3.sticker_style?.use_tendency === 'high') tags.push('爱发表情');

  return Array.from(new Set(tags.map(tag => compactText(tag, 8)).filter(Boolean))).slice(0, 5);
}

function pickSampleLines(t3) {
  const runtimeCard = String(t3.runtime_card?.value || '');
  const candidates = [
    ...(t3.interaction_style?.quote_triggers || []),
    ...(t3.interaction_style?.recall_triggers || []),
    ...runtimeCard.split(/[。！？!?；;\n]/),
  ];

  return Array.from(new Set(
    candidates
      .map(line => compactText(line, MAX_SAMPLE_LINE_CHARS))
      .filter(line => line && line.length >= 4)
  )).slice(0, 3);
}

export function buildPublicPersonaSnapshot({ persona, userProfile, user }) {
  const t3 = safeJsonParse(persona?.content);
  const personaId = String(persona?.id || persona?._id || '').trim();
  const creatorUid = String(persona?.uid || user?.uid || userProfile?.uid || '').trim();
  const name = compactText(persona?.name || t3.persona_name || '未命名数字人格', 30);

  return {
    personaId,
    creatorUid,
    name,
    intro: pickIntro(t3, name),
    tags: pickTags(t3),
    sampleLines: pickSampleLines(t3),
    avatarUrl: persona?.avatarUrl || t3.avatarUrl || '',
    creatorNickname: userProfile?.nickname || '匿名创作者',
    isPublic: true,
    updatedAt: Date.now(),
  };
}

export async function ensurePublicPersona({ persona, userProfile, user }) {
  if (!db) throw new Error('CloudBase 数据库未初始化');

  const snapshot = buildPublicPersonaSnapshot({ persona, userProfile, user });
  if (!snapshot.personaId) throw new Error('缺少 personaId，无法生成公开分享');
  if (!snapshot.creatorUid) throw new Error('缺少创建者身份，无法生成公开分享');

  const existingRes = await db.collection('public_personas')
    .where({ personaId: snapshot.personaId, creatorUid: snapshot.creatorUid })
    .limit(1)
    .get();

  const existing = existingRes.data?.[0];
  if (existing?._id) {
    await db.collection('public_personas').doc(existing._id).update(snapshot);
    return { ...existing, ...snapshot, id: existing._id };
  }

  const addRes = await db.collection('public_personas').add({
    ...snapshot,
    createdAt: Date.now(),
  });

  const id = addRes.id || addRes._id;
  if (!id) throw new Error('公开分享创建成功，但未拿到 shareId');
  return { ...snapshot, id };
}

export async function fetchSharedPersonaByShareId(shareId) {
  if (!cloudbase) throw new Error('CloudBase SDK 未初始化');

  const res = await cloudbase.callFunction({
    name: 'get_public_persona',
    data: { shareId },
    timeout: 15000,
  });

  const result = res.result || {};
  if (!result.success) {
    throw new Error(result.error || '公开人格不存在或已关闭分享');
  }

  return result;
}
