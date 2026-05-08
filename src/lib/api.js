import { cloudbase, db } from './cloudbase';
import { estimateKeywordScore, normalizeMemoryRecord } from './dsm';

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

export const callDeepSeekAPI = async (promptText, systemInstructionText = null, mode = 'pro', signal = null, personaId = 'default') => {
  const apiMessages = [];
  if (systemInstructionText) apiMessages.push({ role: 'system', content: systemInstructionText });
  apiMessages.push({ role: 'user', content: promptText });

  const isPro = mode === 'pro';
  const timeout = isPro ? 60000 : 15000;

  return new Promise(async (resolve, reject) => {
    if (signal) {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    }

    try {
      let responseText = await callDeepSeekFunction(apiMessages, isPro, personaId, timeout);
      if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));

      const fallbackQuery = getFallbackQuery(apiMessages, promptText);
      const toolCall = extractToolCall(responseText, fallbackQuery);

      if (toolCall) {
        console.log('[DSM Tool Interceptor] 已拦截长期记忆工具请求:', toolCall.toolName, toolCall.query);
        const toolResult = await retrieveLongTermMemory(personaId, toolCall.query);

        const secondHopMessages = [
          ...apiMessages,
          { role: 'assistant', content: '[系统已拦截一次长期记忆检索请求，原始工具调用不展示给用户。]' },
          {
            role: 'user',
            content: `系统工具执行完毕。检索结果如下:\n${toolResult}\n\n请结合上述信息，用自然聊天口吻回答用户刚才的问题。禁止输出任何 DSML、tool_calls、tool_name、JSON 工具调用或标签式工具调用。`,
          },
        ];

        responseText = await callDeepSeekFunction(secondHopMessages, isPro, personaId, timeout);
        if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
      }

      const safeText = sanitizeToolLeak(responseText);
      if (safeText) return resolve(safeText);

      return resolve('我刚才差点把内部工具指令发出来了，这个不该出现在聊天里。你是开发者的话，我们可以直接按模块定位这个问题。');
    } catch (e) {
      reject(new Error(`DeepSeek 引擎宕机: ${e.message}`));
    }
  });
};
