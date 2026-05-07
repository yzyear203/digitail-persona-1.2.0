const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();
const _ = db.command;
const axios = require('axios');

// 🚨 同样需要配置这两个环境变量
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY;

exports.main = async (event, context) => {
  console.log("🧹 启动全局记忆折叠清理任务...");

  try {
    // 1. 利用聚合查询 (Aggregate) 找出所有产生过记忆的分身 ID
    const groupRes = await db.collection('persona_memories')
      .aggregate()
      .group({ _id: '$personaId', totalMemories: $.sum(1) })
      .end();

    const personas = groupRes.list;
    console.log(`🎯 扫描到 ${personas.length} 个活跃数字分身。`);

    let report = [];

    // 2. 遍历每个分身进行清理
    for (const p of personas) {
      const pId = p._id;
      // 只有碎片记忆大于 10 条时才触发压缩，避免频繁折腾
      if (p.totalMemories < 10) continue; 

      console.log(`🔍 正在压缩分身 [${pId}] 的 ${p.totalMemories} 条记忆...`);

      // 把该分身的记忆全拉出来
      const memoriesRes = await db.collection('persona_memories')
        .where({ personaId: pId })
        .limit(500)
        .get();
      
      const rawTexts = memoriesRes.data.map(m => m.text).join('\n');

      // 3. 呼叫 DeepSeek 进行无情折叠
      const prompt = `你是一个无情的AI记忆压缩器。请阅读以下零碎的聊天记忆片段，将它们进行【去重、合并、归纳】。
      规则：
      1. 删除临时状态（如“今天有点累”、“刚吃完饭”）。
      2. 合并长效事实（例如将多条关于华山的计划，合并为“用户计划五一去华山旅游”）。
      3. 必须以严格的 JSON 字符串数组格式输出，每条不超过 30 个字。
      4. 如果毫无价值，输出 []。
      【原始碎片】：\n${rawTexts}`;

      const dsRes = await axios.post('https://api.deepseek.com/chat/completions', {
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }]
      }, { headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` } });

      let summarizedArray = [];
      try {
        const content = dsRes.data.choices[0].message.content;
        summarizedArray = JSON.parse(content.replace(/```json|```/g, '').trim());
      } catch (e) {
        console.error(`❌ 分身 [${pId}] JSON 解析失败，跳过。`);
        continue;
      }

      if (summarizedArray.length > 0) {
        // 4. 将提纯后的金子重新变成向量
        const embedRes = await axios.post('https://api.siliconflow.com/v1/embeddings', {
          model: 'Qwen/Qwen3-Embedding-8B',
          input: summarizedArray
        }, { headers: { 'Authorization': `Bearer ${EMBEDDING_API_KEY}` } });

        const vectors = embedRes.data.data;

        // 5. 危险操作：物理抹除旧的垃圾记忆
        await db.collection('persona_memories').where({ personaId: pId }).remove();

        // 6. 写入提纯后的新记忆
        const insertPromises = summarizedArray.map((text, index) => {
          return db.collection('persona_memories').add({
            personaId: pId,
            text: text,
            embedding: vectors[index].embedding,
            createTime: db.serverDate()
          });
        });

        await Promise.all(insertPromises);
        report.push(`分身 ${pId}: ${p.totalMemories} 条 📉 压缩至 ${summarizedArray.length} 条`);
      } else {
        // 如果全是垃圾，直接删光
        await db.collection('persona_memories').where({ personaId: pId }).remove();
        report.push(`分身 ${pId}: 彻底清空临时口水话`);
      }
    }

    console.log("✅ 记忆折叠任务全量完成！");
    return { success: true, report };

  } catch (error) {
    console.error("🚨 记忆折叠脚本崩溃:", error);
    return { success: false, error: error.message };
  }
};