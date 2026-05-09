import { cloudbase, db } from './cloudbase';
import { estimateKeywordScore, normalizeMemoryRecord } from './dsm';
import { extractAndPersistRuntimeStatusMarkers } from './personaRuntimeStatus';

const TOOL_NAME_PATTERN = /(retrieve_long_term_memory|search_subconscious_memory)/i;
const TOOL_LEAK_PATTERN = /(DSML|tool_calls|tool_name|retrieve_long_term_memory|search_subconscious_memory)/i;

function getTextContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map(part => typeof part === 'string' ? part : part?.text || '')
      .join('\n');
  }
  return '';
}

function getFallbackQuery(apiMessages, promptText) {
  const lastUser = [...apiMessages].reverse().find(message => message.role === 'user');
  const userText = getTextContent(lastUser?.content) || String(promptText || '');
  const userLines = userText.match(/User:\s*([^\n]+)/g) || [];
  if (userLines.length > 0) {
    return userLines[userLines.length - 1].replace(/^User:\s*/, '').trim().slice(0, 80);
  }
  return userText.replace(/对话历史:|Assistant:/g, '').trim().slice(-80);
}

function parseJsonToolCall(responseText) {
  const jsonMatch = responseText.match(/```json\s*(\{[\s\S]*?"tool_name"\s*:\s*"(?:retrieve_long_term_memory|search_subconscious_memory)"[\s\S]*?\})\s*```|\{\s*"tool_name"\s*:\s*"(?:retrieve_long_term_memory|search_subconscious_memory)"[\s\S]*?\}/i);
  if (!jsonMatch) return null;

  const jsonStr = jsonMatch[1] || jsonMatch[0];
  try {
    return JSON.parse(jsonStr.replace(/```json|```/g, '').trim());
  } catch (parseError) {
    console.warn('Tool Call JSON 解析失败:', jsonStr, parseError);
    return null;
  }
}

function extractDsmlQuery(responseText) {
  const parameterMatch = responseText.match(/parameter[^>]*name\s*=\s*["']query["'][^>]*>([\s\S]*?)(?:<\s*\/|$)/i);
  if (parameterMatch?.[1]) {
    return parameterMatch[1]
      .replace(/<[^>]*>/g, '')
      .replace(/\|\s*\|\s*DSML\s*\|\s*\|/gi, '')
      .trim()
      .slice(0, 80);
  }

  const inlineMatch = responseText.match(/query["']?\s*[:=]\s*["']([^"']{1,120})["']/i);
  return inlineMatch?.[1]?.trim() || '';
}

function extractToolCall(responseText, fallbackQuery) {
  const jsonToolCall = parseJsonToolCall(responseText);
  if (jsonToolCall?.tool_name) {
    return {
      toolName: jsonToolCall.tool_name,
      query: jsonToolCall.input?.query || fallbackQuery || '',
    };
  }

  if (!TOOL_NAME_PATTERN.test(responseText) && !/DSML|tool_calls/i.test(responseText)) return null;

  const toolName = responseText.match(TOOL_NAME_PATTERN)?.[1] || 'retrieve_long_term_memory';
  return {
    toolName,
    query: extractDsmlQuery(responseText) || fallbackQuery || '',
  };
}

function sanitizeToolLeak(responseText) {
  const text = String(responseText || '').trim();
  if (!TOOL_LEAK_PATTERN.test(text)) return text;

  const cleaned = text
    .replace(/```json[\s\S]*?```/gi, '')
    .replace(/\{\s*"tool_name"[\s\S]*?\}/gi, '')
    .replace(/<\s*\|\s*\|\s*DSML[\s\S]*?(?:parameter>|invoke>|tool_calls>)/gi, '')
    .replace(/^.*(?:DSML|tool_calls|retrieve_long_term_memory|search_subconscious_memory).*$/gim, '')
    .trim();

  if (cleaned && !TOOL_LEAK_PATTERN.test(cleaned)) return cleaned;
  return '';
}

function shouldInjectRuntimeStatusInstruction(promptText, systemInstructionText, personaId) {
  if (!personaId || personaId === 'default') return false;
  if (!systemInstructionText || /只输出合法JSON|严格按下方JSON输出/.test(systemInstructionText)) return false;
  const prompt = String(promptText || '');
  return prompt.includes('对话历史:') && prompt.includes('Assistant:');
}

function buildRuntimeStatusInstruction(personaId) {
  return `

【Persona 运行状态栏】
你每次正常聊天回复前，必须先输出一个隐藏状态标记，格式严格为：
[status:{"personaId":"${personaId}","label":"短状态","activity":"正在做的事","color":"red|orange|yellow|green|blue|purple|pink|slate","mood":"情绪"}]
要求：
- label 是左上角短状态，最多 4 个中文字，例如：战斗中、摸鱼中、开心、警戒、充电中。
- activity 是你自己此刻决定的“正在做的事情”，可以承接 T3 闪电状态，例如：正在和最好的朋友嘻嘻一起打怪兽。
- color 由你根据状态氛围自行选择，只能使用给定英文色名。
- 这个标记是给前端看的，不要解释它，也不要把它当聊天内容。标记后继续正常回复。`;
}

function stripRuntimeStatusMarkers(responseText) {
  return extractAndPersistRuntimeStatusMarkers(responseText).text;
}

async function retrieveLongTermMemory(personaId, query) {
  let toolResult = '[记忆库无相关记录]';
  if (!db) return toolResult;

  try {
    let queryRes = await db.collection('persona_memories')
      .where({ user_id: personaId })
      .orderBy('timestamp', 'desc')
      .limit(30)
      .get();

    if (!queryRes.data?.length) {
      queryRes = await db.collection('persona_memories')
        .where({ personaId })
        .orderBy('timestamp', 'desc')
        .limit(30)
        .get();
    }

    const scoredMemories = (queryRes.data || [])
      .map(normalizeMemoryRecord)
      .map(memory => ({
        ...memory,
        keywordScore: estimateKeywordScore(memory.content, query),
      }))
      .sort((a, b) => b.keywordScore - a.keywordScore);

    const matchedMemories = scoredMemories.filter(m => m.keywordScore > 0).slice(0, 6);
    const finalMemories = matchedMemories.length > 0 ? matchedMemories : scoredMemories.slice(0, 3);

    if (finalMemories.length > 0) {
      toolResult = '[深层记忆回源数据]:\n' + finalMemories.map(m => `- ${m.content}`).join('\n');
    }
  } catch (dbErr) {
    console.error('TCB 深态记忆库检索失败:', dbErr);
    toolResult = '[记忆检索系统暂时离线]';
  }

  return toolResult;
}

async function callDeepSeekFunction(apiMessages, isPro, personaId, timeout) {
  const res = await cloudbase.callFunction({
    name: 'deepseek_generate',
    data: {
      messages: apiMessages,
      model: isPro ? 'deepseek-v4-pro' : 'deepseek-v4-flash',
      useThinking: isPro,
      personaId,
    },
    timeout,
  });

  const data = res.result;
  if (data && data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.choices?.[0]?.message?.content || '';
}

export const callDoubaoAPI = async (promptText, systemInstructionText = null, imageParts = []) => {
  const apiMessages = [];
  if (systemInstructionText) apiMessages.push({ role: 'system', content: systemInstructionText });

  if (imageParts.length > 0) {
    const userContent = [{ type: 'text', text: promptText }];
    imageParts.forEach(img =>
      userContent.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64Data}` } })
    );
    apiMessages.push({ role: 'user', content: userContent });
  } else {
    apiMessages.push({ role: 'user', content: promptText });
  }

  try {
    const res = await cloudbase.callFunction({
      name: 'generate',
      data: { messages: apiMessages },
      timeout: 60000,
    });

    const data = res.result;
    if (data && data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return data.choices?.[0]?.message?.content || '';
  } catch (e) {
    throw new Error(`${e.message}`);
  }
};

// ================== DeepSeek 双轨制引擎 ==================
const isDeepSeekBusyError = (message = '') => /Service is too busy|busy|temporarily switch|server is overloaded|rate limit|429|503/i.test(String(message));

export const callDeepSeekAPI = async (promptText, systemInstructionText = null, mode = 'pro', signal = null, personaId = 'default') => {
  const apiMessages = [];
  const finalSystemInstructionText = shouldInjectRuntimeStatusInstruction(promptText, systemInstructionText, personaId)
    ? `${systemInstructionText}${buildRuntimeStatusInstruction(personaId)}`
    : systemInstructionText;

  if (finalSystemInstructionText) apiMessages.push({ role: 'system', content: finalSystemInstructionText });
  apiMessages.push({ role: 'user', content: promptText });

  const isPro = mode === 'pro';
  const timeout = isPro ? 60000 : 15000;

  return new Promise(async (resolve, reject) => {
    if (signal) {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    }

    try {
      const callDeepSeekFunction = (modelMode) => {
        const useProModel = modelMode === 'pro';
        return cloudbase.callFunction({
          name: 'deepseek_generate',
          data: {
            messages: apiMessages,
            model: useProModel ? 'deepseek-v4-pro' : 'deepseek-v4-flash',
            useThinking: useProModel,
            personaId: personaId,
            enableMemoryTools: useProModel
          },
          timeout: useProModel ? 60000 : 15000
        });
      };

      let res = await callDeepSeekFunction(mode);

      // 异步回来后再次检查是否已被阻断，如果是，抛弃数据
      if (signal && signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));

      let data = res.result;
      if (data && data.error) {
        const errorMessage = data.error.message || JSON.stringify(data.error);
        if (isPro && isDeepSeekBusyError(errorMessage)) {
          console.warn('DeepSeek Pro 忙碌，自动降级到 Flash 重试一次:', errorMessage);
          res = await callDeepSeekFunction('flash');
          data = res.result;
        }
      }
      if (data && data.error) throw new Error(data.error.message || JSON.stringify(data.error));

      let responseText = data.choices?.[0]?.message?.content || "";

      // 👑 首席架构师防线：无感拦截 Tool Call 文本模式 (同时兼容蓝图的 retrieve_long_term_memory 与遗留的 search_subconscious_memory)
      const toolRegex = /```json\s*(\{[\s\S]*?"tool_name"\s*:\s*"(retrieve_long_term_memory|search_subconscious_memory)"[\s\S]*?\})\s*```|\{\s*"tool_name"\s*:\s*"(retrieve_long_term_memory|search_subconscious_memory)"[\s\S]*?\}/;
      const match = responseText.match(toolRegex);

      if (match) {
        const jsonStr = match[1] || match[0];
        let toolCall;
        try {
          toolCall = JSON.parse(jsonStr);
        } catch (parseError) {
          console.warn("Tool Call JSON 解析失败，放行输出:", jsonStr, parseError);
          return resolve(stripRuntimeStatusMarkers(responseText));
        }

        console.log(`⚡ [DSM Tool Interceptor] 侦测到深态回源请求 [${toolCall.tool_name}]:`, toolCall.input?.query);

        // 1. 直连 TCB 执行 T2 向量回源 (纯前端暂用倒排模糊匹配替代原生向量检索)
        let toolResult = "[记忆库无相关记录]";
        if (db) {
          try {
             let queryRes = await db.collection('persona_memories')
               .where({ user_id: personaId })
               .orderBy('timestamp', 'desc')
               .limit(30)
               .get();

             // 兼容旧版云函数写入的 personaId/text 结构，避免迁移期深态记忆断链
             if (!queryRes.data?.length) {
               queryRes = await db.collection('persona_memories')
                 .where({ personaId })
                 .orderBy('timestamp', 'desc')
                 .limit(30)
                 .get();
             }

             const query = toolCall.input?.query || "";
             const scoredMemories = (queryRes.data || [])
               .map(normalizeMemoryRecord)
               .map(memory => ({
                 ...memory,
                 keywordScore: estimateKeywordScore(memory.content, query),
               }))
               .sort((a, b) => b.keywordScore - a.keywordScore);

             const matchedMemories = scoredMemories.filter(m => m.keywordScore > 0).slice(0, 6);
             const finalMemories = matchedMemories.length > 0 ? matchedMemories : scoredMemories.slice(0, 3);
             if (finalMemories.length > 0) {
               toolResult = `[深层记忆回源数据]:\n` + finalMemories.map(m => `- ${m.content}`).join('\n');
             }
          } catch (dbErr) {
             console.error("TCB 深态记忆库检索失败:", dbErr);
             toolResult = "[记忆检索系统暂时离线]";
          }
        }

        // 2. 擦除原始返回内容中的 JSON 暴露物，并将结果回传给大模型进行二跳 (Second Hop)
        apiMessages.push({ role: "assistant", content: responseText });
        apiMessages.push({ role: "user", content: `系统工具执行完毕。检索结果如下:\n${toolResult}\n\n请结合上述深层记忆，继续极其自然地回答我刚才的问题。绝对禁止再次输出任何工具 JSON 结构。` });

        const secondRes = await cloudbase.callFunction({
            name: 'deepseek_generate',
            data: {
              messages: apiMessages,
              model: isPro ? 'deepseek-v4-pro' : 'deepseek-v4-flash',
              useThinking: isPro,
              personaId,
              enableMemoryTools: false
            },
            timeout: isPro ? 60000 : 15000
        });

        if (signal && signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));

        const secondData = secondRes.result;
        if (secondData && secondData.error) throw new Error(secondData.error.message || JSON.stringify(secondData.error));

        // 将模型融合记忆后的最终答案返回给上层 UI
        responseText = secondData.choices?.[0]?.message?.content || "";
      }

      responseText = stripRuntimeStatusMarkers(responseText);
      const safeText = sanitizeToolLeak(responseText);
      if (safeText) return resolve(safeText);

      return resolve('我刚才差点把内部工具指令发出来了，这个不该出现在聊天里。你是开发者的话，我们可以直接按模块定位这个问题。');
    } catch (e) {
      reject(new Error(`DeepSeek 引擎宕机: ${e.message}`));
    }
  });
};
