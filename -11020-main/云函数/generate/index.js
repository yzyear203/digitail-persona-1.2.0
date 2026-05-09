'use strict';

const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();

function normalizeUsage(usage = {}) {
  const promptTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? usage.output_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? promptTokens + completionTokens;
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
  };
}

async function writeUsageLog(meta = {}) {
  try {
    const usage = normalizeUsage(meta);
    await db.collection('model_usage_logs').add({
      provider: 'doubao',
      scene: meta.scene || 'doubao_unknown',
      request_id: meta.request_id || `doubao_${Date.now()}`,
      personaId: meta.personaId || 'default',
      model: meta.model || 'doubao',
      actual_model: meta.actual_model || meta.model || 'doubao',
      model_call_count: meta.model_call_count || 1,
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
      raw_usage: meta,
      createdAt: Date.now(),
      createTime: db.serverDate(),
    });
  } catch (error) {
    console.warn('豆包模型用量日志写入失败，不影响主流程:', error.message);
  }
}

exports.main = async (event, _context) => {
  // 1. TCB 环境下，前端传来的参数直接挂载在 event 对象上
  const userMessages = event.messages;
  const usageScene = event.usageScene || 'doubao_unknown';
  const requestId = event.requestId || `doubao_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const personaId = event.personaId || 'default';

  if (!userMessages) {
    return { error: '参数缺失：未接收到 messages' };
  }

  // 2. 从 TCB 的环境变量中读取火山引擎的密钥
  const apiKey = process.env.DOUBAO_API_KEY;
  const modelId = process.env.DOUBAO_MODEL_ID;

  try {
    // 3. 呼叫火山引擎 (Node 18 原生支持 fetch)
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: userMessages
      })
    });

    const data = await response.json();
    if (!response.ok && !data.error) {
      data.error = { message: `HTTP ${response.status}` };
    }

    if (data && !data.error) {
      const usage = normalizeUsage(data.usage || {});
      data.usage = usage;
      data.x_usage = {
        provider: 'doubao',
        request_id: requestId,
        scene: usageScene,
        personaId,
        model: modelId,
        actual_model: modelId,
        model_call_count: 1,
        ...usage,
      };
      await writeUsageLog(data.x_usage);
    }

    // 4. TCB 的规矩：直接 return 数据，前端的 res.result 就能接到
    return data;

  } catch (error) {
    console.error("请求大模型失败:", error);
    // 不能用 res.status，直接返回错误对象
    return { error: '服务器内部错误', details: error.message };
  }
};
