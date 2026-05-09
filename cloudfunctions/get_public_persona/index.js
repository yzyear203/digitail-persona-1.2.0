const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();

function normalizeDoc(data) {
  return Array.isArray(data) ? data[0] : data;
}

function sanitizeRuntimeProfile(rawContent, publicInfo = {}) {
  let t3 = {};
  try {
    t3 = JSON.parse(rawContent || '{}');
  } catch (error) {
    t3 = {};
  }

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

function buildSharedPersona({ shareId, persona, publicInfo = {} }) {
  const runtimeProfile = persona.isPublicShare
    ? sanitizeRuntimeProfile(persona.content, {
        name: persona.name,
        intro: persona.publicIntro,
      })
    : sanitizeRuntimeProfile(persona.content, publicInfo);

  return {
    id: `share_${shareId}`,
    sourcePersonaId: persona.sourcePersonaId || publicInfo.personaId || persona._id || shareId,
    shareId,
    name: publicInfo.name || persona.name || '公开数字人格',
    avatarUrl: publicInfo.avatarUrl || persona.avatarUrl || '',
    isSharedPersona: true,
    content: JSON.stringify(runtimeProfile),
    publicInfo: {
      intro: publicInfo.intro || persona.publicIntro || '',
      tags: publicInfo.tags || persona.publicTags || [],
      sampleLines: publicInfo.sampleLines || persona.publicSampleLines || [],
      creatorNickname: publicInfo.creatorNickname || persona.creatorNickname || '匿名创作者',
    },
    createdAt: publicInfo.createdAt || persona.createdAt || Date.now(),
  };
}

async function getByPublicRecord(shareId) {
  const publicRes = await db.collection('public_personas').doc(shareId).get();
  const publicInfo = normalizeDoc(publicRes.data);

  if (!publicInfo || publicInfo.isPublic === false) return null;

  const personaId = String(publicInfo.sharePersonaId || publicInfo.personaId || '').trim();
  if (!personaId) throw new Error('公开人格缺少 personaId');

  const personaRes = await db.collection('personas').doc(personaId).get();
  const persona = normalizeDoc(personaRes.data);
  if (!persona) throw new Error('原始人格已删除或不可用');

  return buildSharedPersona({ shareId, persona, publicInfo });
}

async function getBySanitizedPersonaCopy(shareId) {
  const personaRes = await db.collection('personas').doc(shareId).get();
  const persona = normalizeDoc(personaRes.data);
  if (!persona || persona.isPublicShare !== true) return null;
  return buildSharedPersona({ shareId, persona });
}

exports.main = async (event = {}) => {
  const shareId = String(event.shareId || '').trim();
  if (!shareId) {
    return { success: false, error: '缺少 shareId' };
  }

  try {
    const sharedPersona = await getBySanitizedPersonaCopy(shareId) || await getByPublicRecord(shareId);
    if (!sharedPersona) {
      return { success: false, error: '公开人格不存在或已关闭分享' };
    }
    return { success: true, persona: sharedPersona };
  } catch (error) {
    console.error('get_public_persona failed:', error);
    return { success: false, error: error.message || '公开人格读取失败' };
  }
};
