const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();
const axios = require('axios');

const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

function normalizeIncomingMemory(personaId, item) {
  const isString = typeof item === 'string';
  const itemData = isString ? {} : item;
  const content = isString ? item : (itemData.content || itemData.text || itemData.summary || '');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

  return {
    ...itemData,
    user_id: itemData.user_id || itemData.personaId || personaId,
    personaId: itemData.personaId || itemData.user_id || personaId,
    memory_type: itemData.memory_type || 't1_episodic',
    content,
    text: itemData.text || content,
    importance_score: itemData.importance_score || itemData.importance || 5,
    emotion: itemData.emotion || 'neutral',
    confidence: itemData.confidence || 'medium',
    memory_strength: itemData.memory_strength ?? 1,
    decay_rate: itemData.decay_rate ?? 0.12,
    timestamp: itemData.timestamp || now.toISOString(),
    expires_at: itemData.expires_at || expiresAt.toISOString(),
    session_id: itemData.session_id || 'sess_vectorize',
    device_fp: itemData.device_fp || itemData.device_fingerprint || '',
    device_fingerprint: itemData.device_fingerprint || itemData.device_fp || '',
    createTime: itemData.createTime || db.serverDate(),
  };
}

function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length !== vecB.length) return 0;
  let dot = 0;
  let nA = 0;
  let nB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    nA += vecA[i] * vecA[i];
    nB += vecB[i] * vecB[i];
  }
  const denominator = Math.sqrt(nA) * Math.sqrt(nB);
  return denominator ? dot / denominator : 0;
}

async function shouldOverwrite(oldText, newText) {
  if (!DEEPSEEK_API_KEY) return false;
  const prompt = `判断新事实是否覆盖旧事实。\n旧：${oldText}\n新：${newText}\n如果是，只输出 YES；否则输出 NO。`;
  const dsRes = await axios.post('https://api.deepseek.com/chat/completions', {
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }]
  }, { headers: { Authorization: `Bearer ${DEEPSEEK_API_KEY}` } });

  return dsRes.data.choices?.[0]?.message?.content?.includes('YES');
}

exports.main = async (event = {}, _context = {}) => {
  const { personaId } = event;
  const incoming = event.records || event.memories || [];
  if (!personaId || !incoming.length) return { success: true, count: 0 };

  try {
    const records = incoming.map(item => normalizeIncomingMemory(personaId, item)).filter(item => item.content);
    if (!records.length) return { success: true, count: 0 };

    const embedRes = await axios.post('https://api.siliconflow.com/v1/embeddings', {
      model: 'Qwen/Qwen3-Embedding-8B',
      input: records.map(item => item.content)
    }, { headers: { Authorization: `Bearer ${EMBEDDING_API_KEY}` } });

    const vectors = embedRes.data.data || [];
    let upserted = 0;

    for (let i = 0; i < records.length; i++) {
      const record = { ...records[i], embedding: vectors[i]?.embedding };
      if (!record.embedding) continue;

      // 如果前端已经按 event_id 直写过标准 T1，这里只补 embedding，不重复新增。
      if (record.event_id) {
        const existing = await db.collection('persona_memories').where({ event_id: record.event_id }).limit(1).get();
        if (existing.data?.length) {
          await db.collection('persona_memories').doc(existing.data[0]._id).update({
            embedding: record.embedding,
            updateTime: db.serverDate(),
          });
          upserted++;
          continue;
        }
      }

      const recentRes = await db.collection('persona_memories').where({ user_id: record.user_id }).limit(100).get();
      const legacyRes = recentRes.data?.length
        ? recentRes
        : await db.collection('persona_memories').where({ personaId: record.personaId }).limit(100).get();

      const scored = (legacyRes.data || [])
        .filter(memory => Array.isArray(memory.embedding))
        .map(memory => ({
          id: memory._id,
          content: memory.content || memory.text || '',
          score: cosineSimilarity(record.embedding, memory.embedding),
        }))
        .sort((a, b) => b.score - a.score);

      const topMatch = scored[0];
      if (topMatch && topMatch.score > 0.85 && await shouldOverwrite(topMatch.content, record.content)) {
        await db.collection('persona_memories').doc(topMatch.id).update({
          ...record,
          updateTime: db.serverDate(),
        });
      } else {
        await db.collection('persona_memories').add(record);
      }
      upserted++;
    }

    return { success: true, count: upserted };
  } catch (error) {
    console.error('🚨 记忆处理异常:', error);
    return { success: false, error: error.message };
  }
};
