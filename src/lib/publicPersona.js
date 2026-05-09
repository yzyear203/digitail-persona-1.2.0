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

function buildSanitizedRuntimeProfile(t3, publicInfo) {
  return {
    persona_name: publicInfo.name || t3.persona_name || '',
    identity: t3.identity || { value: '', confidence: 'low' },
    runtime_card: t3.runtime_card || t3.personality_runtime_card || { value: publicInfo.intro || '', confidence: 'medium' },
    interests: Array.isArray(t3.interests) ? t3.interests.slice(0, 5) : [],
    relationship: {
      archetype: t3.relationship?.archetype || '访客',
      intimacy_level: Math.min(Number(t3.relationship?.intimacy_level || 3), 5),
      last_chat_time: new Date().toISOString(),
      bond_momentum: 'stable',
    },
    interaction_style: t3.interaction_style || {},
    sticker_style: t3.sticker_style || {},
    current_context: { value: '', expires_at: '' },
    forbidden_topics: Array.isArray(t3.forbidden_topics) ? t3.forbidden_topics.slice(0, 10) : [],
  };
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

async function upsertPublicPersonaCopy({ persona, snapshot, sharePersonaId }) {
  const t3 = safeJsonParse(persona?.content);
  const runtimeProfile = buildSanitizedRuntimeProfile(t3, snapshot);
  const publicCopy = {
    uid: 'public_share',
    name: snapshot.name,
    avatarUrl: snapshot.avatarUrl || '',
    content: JSON.stringify(runtimeProfile),
    isPublicShare: true,
    sourcePersonaId: snapshot.personaId,
    creatorUid: snapshot.creatorUid,
    publicIntro: snapshot.intro,
    publicTags: snapshot.tags,
    publicSampleLines: snapshot.sampleLines,
    creatorNickname: snapshot.creatorNickname,
    createdAt: persona?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  if (sharePersonaId) {
    await db.collection('personas').doc(sharePersonaId).update(publicCopy);
    return sharePersonaId;
  }

  const addRes = await db.collection('personas').add(publicCopy);
  const id = addRes.id || addRes._id;
  if (!id) throw new Error('公开人格副本创建成功，但未拿到 shareId');
  return id;
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
  const sharePersonaId = await upsertPublicPersonaCopy({
    persona,
    snapshot,
    sharePersonaId: existing?.sharePersonaId,
  });

  const publicRecord = {
    ...snapshot,
    sharePersonaId,
  };

  if (existing?._id) {
    await db.collection('public_personas').doc(existing._id).update(publicRecord);
    return { ...existing, ...publicRecord, id: sharePersonaId, publicPersonaId: existing._id };
  }

  const addRes = await db.collection('public_personas').add({
    ...publicRecord,
    createdAt: Date.now(),
  });

  return { ...publicRecord, id: sharePersonaId, publicPersonaId: addRes.id || addRes._id };
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
