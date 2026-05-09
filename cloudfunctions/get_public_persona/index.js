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

function buildSharedPersona({ shareId, publicInfo }) {
  const runtimeProfile = sanitizeRuntimeProfile(publicInfo.content, publicInfo);

  return {
    id: `share_${shareId}`,
    sourcePersonaId: publicInfo.personaId || '',
    shareId,
    name: publicInfo.name || '公开数字人格',
    avatarUrl: publicInfo.avatarUrl || '',
    isSharedPersona: true,
    content: JSON.stringify(runtimeProfile),
    publicInfo: {
      intro: publicInfo.intro || '',
      tags: publicInfo.tags || [],
      sampleLines: publicInfo.sampleLines || [],
      creatorNickname: publicInfo.creatorNickname || '匿名创作者',
    },
    createdAt: publicInfo.createdAt || Date.now(),
  };
}

exports.main = async (event = {}) => {
  const shareId = String(event.shareId || '').trim();
  if (!shareId) {
    return { success: false, error: '缺少 shareId' };
  }

  try {
    const publicRes = await db.collection('public_personas').doc(shareId).get();
    const publicInfo = normalizeDoc(publicRes.data);

    if (!publicInfo || publicInfo.isPublic === false) {
      return { success: false, error: '公开人格不存在或已关闭分享' };
    }

    return { success: true, persona: buildSharedPersona({ shareId, publicInfo }) };
  } catch (error) {
    console.error('get_public_persona failed:', error);
    return { success: false, error: error.message || '公开人格读取失败' };
  }
};
