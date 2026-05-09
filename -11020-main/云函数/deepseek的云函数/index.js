const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY;

const DEEPSEEK_PRICE_CNY_PER_1M = {
  'deepseek-v4-flash': { cacheHitInput: 0.02, cacheMissInput: 1, output: 2 },
  'deepseek-v4-pro': { cacheHitInput: 0.025, cacheMissInput: 3, output: 6 },
};

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

function isDeepSeekBusyError(error = {}) {
  const message = typeof error === 'string'
    ? error
    : (error.message || error.error?.message || JSON.stringify(error));
  return /Service is too busy|busy|temporarily switch|server is overloaded|rate limit|429|503/i.test(message);
}

async function postDeepSeek(payload) {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok && !data.error) {
    data.error = { message: `HTTP ${res.status}` };
  }
  return data;
}

function keywordScore(content, query) {
  const keywords = Array.from(new Set(String(query || '').split('').filter(Boolean)));
  if (!keywords.length || !content) return 0;
  return keywords.filter(keyword => content.includes(keyword)).length / keywords.length;
}

function normalizeUsage(usage = {}) {
  const promptTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? usage.output_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? promptTokens + completionTokens;
  const cacheHitTokens = usage.prompt_cache_hit_tokens ?? usage.cache_hit_tokens ?? 0;
  const cacheMissTokens = usage.prompt_cache_miss_tokens ?? usage.cache_miss_tokens ?? Math.max(0, promptTokens - cacheHitTokens);

  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    prompt_cache_hit_tokens: cacheHitTokens,
    prompt_cache_miss_tokens: cacheMissTokens,
  };
}

function mergeUsage(...usages) {
  return usages
    .filter(Boolean)
    .map(normalizeUsage)
    .reduce((acc, usage) => ({
      prompt_tokens: acc.prompt_tokens + usage.prompt_tokens,
      completion_tokens: acc.completion_tokens + usage.completion_tokens,
      total_tokens: acc.total_tokens + usage.total_tokens,
      prompt_cache_hit_tokens: acc.prompt_cache_hit_tokens + usage.prompt_cache_hit_tokens,
      prompt_cache_miss_tokens: acc.prompt_cache_miss_tokens + usage.prompt_cache_miss_tokens,
    }), {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      prompt_cache_hit_tokens: 0,
      prompt_cache_miss_tokens: 0,
    });
}

function estimateDeepSeekCostCNY(model, usage) {
  const price = DEEPSEEK_PRICE_CNY_PER_1M[model] || DEEPSEEK_PRICE_CNY_PER_1M['deepseek-v4-flash'];
  const cacheHitInput = usage.prompt_cache_hit_tokens || 0;
  const cacheMissInput = usage.prompt_cache_miss_tokens ?? Math.max(0, (usage.prompt_tokens || 0) - cacheHitInput);
  const outputTokens = usage.completion_tokens || 0;
  return Number((
    cacheHitInput / 1000000 * price.cacheHitInput +
    cacheMissInput / 1000000 * price.cacheMissInput +
    outputTokens / 1000000 * price.output
  ).toFixed(8));
}

async function writeUsageLog(meta = {}) {
  try {
    const usage = normalizeUsage(meta);
    const model = meta.model || meta.requested_model || 'deepseek-v4-flash';
    await db.collection('model_usage_logs').add({
      provider: 'deepseek',
      scene: meta.scene || 'unknown',
      request_id: meta.request_id || `deepseek_${Date.now()}`,
      personaId: meta.personaId || 'default',
      model,
      actual_model: meta.actual_model || model,
      requested_model: meta.requested_model || model,
      model_call_count: meta.model_call_count || 1,
      memory_tool_used: Boolean(meta.memory_tool_used),
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
      prompt_cache_hit_tokens: usage.prompt_cache_hit_tokens,
      prompt_cache_miss_tokens: usage.prompt_cache_miss_tokens,
      estimated_cost_cny: estimateDeepSeekCostCNY(model, usage),
      raw_usage: meta,
      createdAt: Date.now(),
      createTime: db.serverDate(),
    });
  } catch (error) {
    console.warn('模型用量日志写入失败，不影响主流程:', error.message);
  }
}

function attachUsageMeta(data, meta = {}) {
  if (!data || data.error) return data;
  const usage = normalizeUsage(data.usage || {});
  return {
    ...data,
    usage,
    x_usage: {
      provider: 'deepseek',
      ...meta,
      ...usage,
    },
  };
}

async function retrieveLongTermMemory(personaId, query) {
  let memoriesRes = await db.collection('persona_memories').where({ user_id: personaId }).limit(300).get();
  if (!memoriesRes.data?.length) {
    memoriesRes = await db.collection('persona_memories').where({ personaId }).limit(300).get();
  }

  const memories = (memoriesRes.data || []).map(normalizeMemory);
  if (!memories.length) return '未查到相关记忆。';

  let queryVector = null;
  if (EMBEDDING_API_KEY) {
    const embedRes = await fetch('https://api.siliconflow.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${EMBEDDING_API_KEY}` },
      body: JSON.stringify({ model: 'Qwen/Qwen3-Embedding-8B', input: [query] })
    });
    const embedData = await embedRes.json();
    queryVector = embedData.data?.[0]?.embedding || null;
  }

  const scored = memories
    .map(memory => ({
      content: memory.content,
      score: queryVector && Array.isArray(memory.embedding)
        ? cosineSimilarity(queryVector, memory.embedding)
        : keywordScore(memory.content, query),
    }))
    .sort((a, b) => b.score - a.score);

  const validMemories = scored.filter(item => item.score > 0.3).slice(0, 10);
  const finalMemories = validMemories.length ? validMemories : scored.slice(0, 5);
  return finalMemories.map((item, index) => `记忆${index + 1}: ${item.content}`).join('\n') || '未查到相关记忆。';
}

exports.main = async (event = {}, _context = {}) => {
  const {
    messages = [],
    model,
    personaId = 'default',
    enableMemoryTools = true,
    usageScene = 'unknown',
    requestId = `deepseek_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  } = event;
  const requestedModel = model === 'deepseek-v4-pro' ? 'deepseek-v4-pro' : 'deepseek-v4-flash';
  const actualModel = requestedModel === 'deepseek-v4-pro' ? 'deepseek-reasoner' : 'deepseek-chat';

  const tools = [{
    type: 'function',
    function: {
      name: 'retrieve_long_term_memory',
      description: '检索与用户相关的长期语义记忆（如身体状况、过往事件、喜好、名字、计划等）。',
      parameters: {
        type: 'object',
        properties: { query: { type: 'string', description: '检索关键词' } },
        required: ['query']
      }
    }
  }];

  try {
    const initialPayload = enableMemoryTools
      ? { model: actualModel, messages, tools, tool_choice: 'auto' }
      : { model: actualModel, messages };
    let initialData = await postDeepSeek(initialPayload);
    let firstHopModel = actualModel;

    if (initialData.error && actualModel === 'deepseek-reasoner' && isDeepSeekBusyError(initialData.error)) {
      console.warn('DeepSeek reasoner 忙碌，云函数自动降级到 deepseek-chat 重试一次:', initialData.error.message);
      initialData = await postDeepSeek({ ...initialPayload, model: 'deepseek-chat' });
      firstHopModel = 'deepseek-chat';
    }

    if (initialData.error) return initialData;

    const responseMessage = initialData.choices?.[0]?.message;
    if (responseMessage?.tool_calls && responseMessage.tool_calls.length > 0) {
      messages.push(responseMessage);

      for (const toolCall of responseMessage.tool_calls) {
        if (['retrieve_long_term_memory', 'search_subconscious_memory'].includes(toolCall.function.name)) {
          const { query } = JSON.parse(toolCall.function.arguments || '{}');
          const retrievedContext = await retrieveLongTermMemory(personaId, query || '');
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: `检索结果：\n${retrievedContext}`
          });
        } else {
          messages.push({ role: 'tool', tool_call_id: toolCall.id, name: toolCall.function.name, content: '未知工具' });
        }
      }

      let finalData = await postDeepSeek({ model: actualModel, messages });
      let secondHopModel = actualModel;
      if (finalData.error && actualModel === 'deepseek-reasoner' && isDeepSeekBusyError(finalData.error)) {
        console.warn('DeepSeek reasoner 二跳忙碌，云函数自动降级到 deepseek-chat 重试一次:', finalData.error.message);
        finalData = await postDeepSeek({ model: 'deepseek-chat', messages });
        secondHopModel = 'deepseek-chat';
      }
      if (finalData.error) return finalData;

      const mergedUsage = mergeUsage(initialData.usage, finalData.usage);
      const result = {
        ...finalData,
        usage: mergedUsage,
        x_usage: {
          provider: 'deepseek',
          request_id: requestId,
          scene: usageScene,
          personaId,
          requested_model: requestedModel,
          first_hop_model: firstHopModel,
          second_hop_model: secondHopModel,
          model: requestedModel,
          actual_model: secondHopModel,
          model_call_count: 2,
          memory_tool_used: true,
          ...mergedUsage,
          hops: [
            { model: firstHopModel, usage: normalizeUsage(initialData.usage || {}) },
            { model: secondHopModel, usage: normalizeUsage(finalData.usage || {}) },
          ],
        }
      };
      await writeUsageLog(result.x_usage);
      return result;
    }

    const result = attachUsageMeta(initialData, {
      request_id: requestId,
      scene: usageScene,
      personaId,
      requested_model: requestedModel,
      model: requestedModel,
      actual_model: firstHopModel,
      model_call_count: 1,
      memory_tool_used: false,
    });
    await writeUsageLog(result.x_usage);
    return result;
  } catch (error) {
    return { error: { message: error.message } };
  }
};
