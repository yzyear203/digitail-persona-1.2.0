const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();
const axios = require('axios');

const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY;
const EMBEDDING_TIMEOUT_MS = 1800;

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
    embedding: itemData.embedding || null,
    createTime: itemData.createTime || db.serverDate(),
  };
}

async function upsertMemoryRecord(record) {
  if (record.event_id) {
    const existing = await db.collection('persona_memories').where({ event_id: record.event_id }).limit(1).get();
    if (existing.data?.length) {
      const docId = existing.data[0]._id;
      await db.collection('persona_memories').doc(docId).update({
        ...record,
        embedding: record.embedding || existing.data[0].embedding || null,
        updateTime: db.serverDate(),
      });
      return docId;
    }
  }

  const addRes = await db.collection('persona_memories').add(record);
  return addRes.id || addRes._id;
}

async function updateRecordEmbedding(docId, embedding) {
  if (!docId || !Array.isArray(embedding)) return false;
  await db.collection('persona_memories').doc(docId).update({
    embedding,
    updateTime: db.serverDate(),
  });
  return true;
}

async function requestEmbeddings(records) {
  if (!EMBEDDING_API_KEY) throw new Error('缺少 EMBEDDING_API_KEY');

  const embedRes = await axios.post('https://api.siliconflow.com/v1/embeddings', {
    model: 'Qwen/Qwen3-Embedding-8B',
    input: records.map(item => item.content)
  }, {
    headers: { Authorization: `Bearer ${EMBEDDING_API_KEY}` },
    timeout: EMBEDDING_TIMEOUT_MS,
  });

  return embedRes.data.data || [];
}

exports.main = async (event = {}, _context = {}) => {
  const { personaId } = event;
  const incoming = event.records || event.memories || [];
  if (!personaId || !incoming.length) return { success: true, count: 0, embedded: 0 };

  try {
    const records = incoming.map(item => normalizeIncomingMemory(personaId, item)).filter(item => item.content);
    if (!records.length) return { success: true, count: 0, embedded: 0 };

    // 先写入原始记忆，再尝试补 embedding。这样即使云函数 3 秒超时或向量接口慢，也不会丢失 T1。
    const docIds = [];
    for (const record of records) {
      const docId = await upsertMemoryRecord(record);
      docIds.push(docId);
    }

    let embedded = 0;
    try {
      const vectors = await requestEmbeddings(records);
      for (let i = 0; i < records.length; i++) {
        if (await updateRecordEmbedding(docIds[i], vectors[i]?.embedding)) embedded += 1;
      }
    } catch (embeddingError) {
      console.warn('⚠️ 向量化失败或超时，已保留无 embedding 的原始记忆:', embeddingError.message);
    }

    return {
      success: true,
      count: records.length,
      embedded,
      fallback: embedded === 0,
    };
  } catch (error) {
    console.error('🚨 记忆处理异常:', error);
    return { success: false, error: error.message };
  }
};
