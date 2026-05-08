const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();
const $ = db.command.aggregate;
const axios = require('axios');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY;

function normalizeMemory(memory) {
  const content = memory.content || memory.text || '';
  return {
    ...memory,
    user_id: memory.user_id || memory.personaId,
    personaId: memory.personaId || memory.user_id,
    content,
    text: memory.text || content,
  };
}

async function listActivePersonaIds() {
  const standardGroup = await db.collection('persona_memories')
    .aggregate()
    .group({ _id: '$user_id', totalMemories: $.sum(1) })
    .end();

  const legacyGroup = await db.collection('persona_memories')
    .aggregate()
    .group({ _id: '$personaId', totalMemories: $.sum(1) })
    .end();

  const merged = new Map();
  [...(standardGroup.list || []), ...(legacyGroup.list || [])].forEach(item => {
    if (!item._id) return;
    const current = merged.get(item._id) || 0;
    merged.set(item._id, Math.max(current, item.totalMemories || 0));
  });

  return Array.from(merged.entries()).map(([id, totalMemories]) => ({ id, totalMemories }));
}

async function fetchMemories(personaId) {
  let memoriesRes = await db.collection('persona_memories').where({ user_id: personaId }).limit(500).get();
  if (!memoriesRes.data?.length) {
    memoriesRes = await db.collection('persona_memories').where({ personaId }).limit(500).get();
  }
  return (memoriesRes.data || []).map(normalizeMemory);
}

exports.main = async (event = {}, _context = {}) => {
  console.log('🧹 启动 DSM 2.2 记忆折叠清理任务...', event.trigger || 'manual');

  try {
    const personas = await listActivePersonaIds();
    console.log(`🎯 扫描到 ${personas.length} 个活跃数字分身。`);

    const report = [];

    for (const persona of personas) {
      const personaId = persona.id;
      if (persona.totalMemories < 10) continue;

      console.log(`🔍 正在压缩分身 [${personaId}] 的 ${persona.totalMemories} 条记忆...`);
      const memories = await fetchMemories(personaId);
      const rawTexts = memories.map(memory => memory.content).filter(Boolean).join('\n');
      if (!rawTexts) continue;

      const prompt = `你是 DSM 2.2 的 T1→T2 语义压缩器。请阅读以下聊天记忆片段，将它们去重、合并、归纳为长期语义记忆。\n规则：\n1. 删除临时状态。\n2. 合并长效事实、偏好、计划和反复出现的情绪模式。\n3. 必须以严格 JSON 字符串数组输出，每条不超过 30 个字。\n4. 如果毫无价值，输出 []。\n【原始碎片】：\n${rawTexts}`;

      const dsRes = await axios.post('https://api.deepseek.com/chat/completions', {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }]
      }, { headers: { Authorization: `Bearer ${DEEPSEEK_API_KEY}` } });

      let summarizedArray = [];
      try {
        const content = dsRes.data.choices[0].message.content;
        summarizedArray = JSON.parse(content.replace(/```json|```/g, '').trim());
      } catch (parseError) {
        console.error(`❌ 分身 [${personaId}] JSON 解析失败，跳过。`, parseError);
        continue;
      }

      if (!summarizedArray.length) {
        report.push(`分身 ${personaId}: 未产生可沉淀 T2，保留原始 T1 等待 TTL 清理`);
        continue;
      }

      const embedRes = await axios.post('https://api.siliconflow.com/v1/embeddings', {
        model: 'Qwen/Qwen3-Embedding-8B',
        input: summarizedArray
      }, { headers: { Authorization: `Bearer ${EMBEDDING_API_KEY}` } });

      const vectors = embedRes.data.data || [];
      const now = new Date();
      const insertPromises = summarizedArray.map((content, index) => db.collection('persona_memories').add({
        event_id: `t2_${personaId}_${now.getTime()}_${index}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64),
        user_id: personaId,
        personaId,
        memory_type: 't2_semantic',
        content,
        text: content,
        embedding: vectors[index]?.embedding || null,
        importance_score: 7,
        emotion: 'neutral',
        confidence: 'medium',
        memory_strength: 1,
        decay_rate: 0,
        timestamp: now.toISOString(),
        expires_at: null,
        session_id: 'weekly_consolidation',
        device_fp: 'server_cron',
        createTime: db.serverDate(),
      }));

      await Promise.all(insertPromises);

      // 安全策略：只删除/清理过期 T1，不全量抹除，避免压缩失败导致记忆灾难。
      const expiredT1Ids = memories
        .filter(memory => memory.memory_type !== 't2_semantic')
        .filter(memory => memory.expires_at && new Date(memory.expires_at).getTime() < Date.now())
        .map(memory => memory._id);

      await Promise.all(expiredT1Ids.map(id => db.collection('persona_memories').doc(id).remove()));
      report.push(`分身 ${personaId}: 生成 ${summarizedArray.length} 条 T2，清理过期 T1 ${expiredT1Ids.length} 条`);
    }

    console.log('✅ 记忆折叠任务完成！');
    return { success: true, report };
  } catch (error) {
    console.error('🚨 记忆折叠脚本崩溃:', error);
    return { success: false, error: error.message };
  }
};
