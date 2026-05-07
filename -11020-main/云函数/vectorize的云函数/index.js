const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();
const _ = db.command;
const axios = require('axios');

const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY;
// 冲突网关需要廉价模型进行快速判断
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY; 

exports.main = async (event, context) => {
  const { personaId, memories } = event;
  if (!personaId || !memories || memories.length === 0) return { success: true };

  try {
    // 1. 向量化新记忆
    const embedRes = await axios.post('https://api.siliconflow.com/v1/embeddings', {
      model: 'Qwen/Qwen3-Embedding-8B', input: memories
    }, { headers: { 'Authorization': `Bearer ${EMBEDDING_API_KEY}` } });
    const newVectors = embedRes.data.data;

    for (let i = 0; i < memories.length; i++) {
      const newText = memories[i];
      const newVec = newVectors[i].embedding;

      // 2. 冲突检测网关：先用向量查出最相似的 Top 3 历史记忆
      const recentRes = await db.collection('persona_memories')
        .where({ personaId: personaId }).limit(100).get();
      
      let hasConflict = false;
      let targetIdToOverwrite = null;

      if (recentRes.data.length > 0) {
        const scored = recentRes.data.map(m => {
          let dot = 0, nA = 0, nB = 0;
          for (let j = 0; j < newVec.length; j++) {
            dot += newVec[j] * m.embedding[j];
            nA += newVec[j] * newVec[j];
            nB += m.embedding[j] * m.embedding[j];
          }
          return { id: m._id, text: m.text, score: dot / (Math.sqrt(nA) * Math.sqrt(nB)) };
        }).sort((a, b) => b.score - a.score);

        // 如果极其相似 (>0.85)，交给 Flash 模型判断是否构成覆盖（如：旧"想去北京" vs 新"不去北京了"）
        const topMatch = scored[0];
        if (topMatch && topMatch.score > 0.85) {
          const prompt = `判断新事实是否覆盖旧事实。\n旧：${topMatch.text}\n新：${newText}\n如果是，只输出 YES；否则输出 NO。`;
          const dsRes = await axios.post('https://api.deepseek.com/chat/completions', {
            model: "deepseek-chat", // 可替换为 flash
            messages: [{ role: "user", content: prompt }]
          }, { headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` } });

          if (dsRes.data.choices[0].message.content.includes('YES')) {
            hasConflict = true;
            targetIdToOverwrite = topMatch.id;
          }
        }
      }

      // 3. 执行写入或覆写
      if (hasConflict && targetIdToOverwrite) {
        console.log(`🔄 [DSM 冲突网关] 覆写旧记忆: ${targetIdToOverwrite}`);
        await db.collection('persona_memories').doc(targetIdToOverwrite).update({
          text: newText,
          embedding: newVec,
          updateTime: db.serverDate()
        });
      } else {
        console.log(`➕ [DSM 冲突网关] 新增独立记忆`);
        await db.collection('persona_memories').add({
          personaId: personaId,
          text: newText,
          embedding: newVec,
          createTime: db.serverDate()
        });
      }
    }

    return { success: true, count: memories.length };
  } catch (error) {
    console.error("🚨 记忆处理异常:", error);
    return { success: false, error: error.message };
  }
};