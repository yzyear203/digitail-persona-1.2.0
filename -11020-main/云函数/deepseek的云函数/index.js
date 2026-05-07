const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY; 
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY; 

exports.main = async (event, context) => {
  const { messages, model, personaId = "default" } = event;

  const actualModel = model === 'deepseek-v4-pro' ? 'deepseek-reasoner' : 'deepseek-chat';

  // 🛠️ 工具定义
  const tools = [{
    type: "function",
    function: {
      name: "search_subconscious_memory",
      description: "检索与用户相关的潜意识记忆（如身体状况、过往事件、喜好、名字、计划等）。",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "检索关键词" } },
        required: ["query"]
      }
    }
  }];

  try {
    // 🧠 1. 询问 DeepSeek 是否需要查记忆
    const initialRes = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
      body: JSON.stringify({ model: actualModel, messages: messages, tools: tools, tool_choice: "auto" })
    });
    const initialData = await initialRes.json();
    
    // 如果 API 异常，直接返回
    if (initialData.error) return initialData;

    const responseMessage = initialData.choices[0].message;

    // 🕵️ 2. 如果需要查记忆
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      
      // 🚀 必须把原话塞回去
      messages.push(responseMessage);

      // 🚀 核心修复：循环处理每一个工具调用，解决崩溃！
      for (const toolCall of responseMessage.tool_calls) {
        if (toolCall.function.name === 'search_subconscious_memory') {
          const { query } = JSON.parse(toolCall.function.arguments);

          // A. 将查询词转向量
          const embedRes = await fetch('https://api.siliconflow.com/v1/embeddings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${EMBEDDING_API_KEY}` },
            body: JSON.stringify({ model: 'Qwen/Qwen3-Embedding-8B', input: [query] })
          });
          const embedData = await embedRes.json();
          
          // 如果向量化接口挂了，塞回空结果
          if (!embedData.data || embedData.data.length === 0) {
            messages.push({ role: "tool", tool_call_id: toolCall.id, name: "search_subconscious_memory", content: "检索失败" });
            continue;
          }

          const queryVector = embedData.data[0].embedding;

          // B. 从 persona_memories 集合拉取数据进行数学比对
          const memoriesRes = await db.collection('persona_memories')
            .where({ personaId: personaId })
            .limit(300) 
            .get();
            
          let retrievedContext = "未查到相关记忆。";
          if (memoriesRes.data && memoriesRes.data.length > 0) {
            // 余弦相似度数学引擎
            const scored = memoriesRes.data.map(m => {
              let dot = 0, nA = 0, nB = 0;
              for (let i = 0; i < queryVector.length; i++) {
                dot += queryVector[i] * m.embedding[i];
                nA += queryVector[i] * queryVector[i];
                nB += m.embedding[i] * m.embedding[i];
              }
              return { text: m.text, score: dot / (Math.sqrt(nA) * Math.sqrt(nB)) };
            }).sort((a, b) => b.score - a.score);

            // 🚀 核心修复：过滤垃圾记忆 (>0.3) 并且扩大召回数量 (10个)
            const validMemories = scored.filter(s => s.score > 0.3).slice(0, 10);
            if (validMemories.length > 0) {
              retrievedContext = validMemories.map((s, idx) => `记忆${idx+1}: ${s.text}`).join('\n');
            }
          }

          // C. 带着查到的记忆进行第二次回答
          messages.push({ role: "tool", tool_call_id: toolCall.id, name: "search_subconscious_memory", content: `检索结果：\n${retrievedContext}` });
        } else {
          // 不认识的工具也要塞回去
          messages.push({ role: "tool", tool_call_id: toolCall.id, name: toolCall.function.name, content: "未知工具" });
        }
      }

      // 再次请求
      const finalRes = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
        body: JSON.stringify({ model: actualModel, messages: messages })
      });
      return await finalRes.json();
    }

    return initialData;
  } catch (error) {
    return { error: { message: error.message } };
  }
};