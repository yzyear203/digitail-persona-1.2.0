import { cloudbase, db } from './cloudbase';
import { estimateKeywordScore, normalizeMemoryRecord } from './dsm';
import { extractAndPersistRuntimeStatusMarkers, shouldRefreshRuntimeStatus } from './personaRuntimeStatus';

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

function isChatPrompt(promptText) {
  const prompt = String(promptText || '');
  return prompt.includes('对话历史:') && prompt.includes('Assistant:');
}

function parseChatPrompt(promptText) {
  if (!isChatPrompt(promptText)) return null;

  const prompt = String(promptText || '');
  const historyStart = prompt.indexOf('对话历史:');
  if (historyStart < 0) return null;

  const contextBlock = prompt.slice(0, historyStart).trim();
  const historyBlock = prompt
    .slice(historyStart + '对话历史:'.length)
    .replace(/\n*Assistant:\s*$/i, '')
    .trim();

  const messages = [];
  const pattern = /(?:^|\n)(User|Assistant):\s*([\s\S]*?)(?=\n(?:User|Assistant):\s*|$)/g;
  let match;
  while ((match = pattern.exec(historyBlock)) !== null) {
    const role = match[1] === 'User' ? 'user' : 'assistant';
    const content = String(match[2] || '').trim();
    if (content) messages.push({ role, content });
  }

  return { contextBlock, messages };
}

function buildApiMessagesFromPrompt(promptText, finalSystemInstructionText) {
  const parsedChat = parseChatPrompt(promptText);
  if (!parsedChat || parsedChat.messages.length === 0) {
    return [
      ...(finalSystemInstructionText ? [{ role: 'system', content: finalSystemInstructionText }] : []),
      { role: 'user', content: promptText },
    ];
  }

  const systemContent = [
    finalSystemInstructionText,
    parsedChat.contextBlock ? `【本轮辅助上下文】\n${parsedChat.contextBlock}` : '',
  ].filter(Boolean).join('\n\n');

  const apiMessages = [];
  if (systemContent) apiMessages.push({ role: 'system', content: systemContent });

  const dialogueMessages = parsedChat.messages.slice(-24);
  apiMessages.push(...dialogueMessages);

  const latestUser = [...dialogueMessages].reverse().find(message => message.role === 'user');
  const lastMessage = apiMessages[apiMessages.length - 1];
  if (latestUser && lastMessage?.role !== 'user') {
    apiMessages.push({ role: 'user', content: latestUser.content });
  }

  return apiMessages;
}

function shouldInjectRuntimeStatusInstruction(promptText, systemInstructionText, personaId) {
  if (!personaId || personaId === 'default') return false;
  if (!shouldRefreshRuntimeStatus(personaId)) return false;
  if (!systemInstructionText || /只输出合法JSON|严格按下方JSON输出/.test(systemInstructionText)) return false;
  return isChatPrompt(promptText);
}

function getLatestUserTextFromPrompt(promptText) {
  const parsedChat = parseChatPrompt(promptText);
  const latestUser = parsedChat?.messages ? [...parsedChat.messages].reverse().find(message => message.role === 'user') : null;
  if (latestUser?.content) return latestUser.content.trim();

  const prompt = String(promptText || '');
  const userLines = prompt.match(/User:\s*([^\n]+)/g) || [];
  if (!userLines.length) return '';
  return userLines[userLines.length - 1]
    .replace(/^User:\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeQuestionText(text) {
  return String(text || '')
    .replace(/[\s，。,.!！?？~～…]+/g, '')
    .trim();
}

function extractPersonaNameFromSystem(systemInstructionText) {
  const systemText = String(systemInstructionText || '');
  return systemText.match(/你的名字是“([^”]{1,32})”/)?.[1]?.trim() || '';
}

function extractKnownUserNameFromSystem(systemInstructionText) {
  const systemText = String(systemInstructionText || '');
  return systemText.match(/称呼:([^|\n]{1,32})/)?.[1]?.trim()
    || systemText.match(/用户称呼[:：]([^|\n。]{1,32})/)?.[1]?.trim()
    || '';
}

function buildDeterministicIdentityReply(promptText, systemInstructionText) {
  if (!isChatPrompt(promptText)) return '';

  const latestUserText = getLatestUserTextFromPrompt(promptText);
  const normalized = normalizeQuestionText(latestUserText);
  if (!normalized) return '';

  const asksUserName = /^(我叫什[么麼]名字?|我叫啥名字?|我名字是什[么麼]|我的名字是什[么麼]|你知道我叫什[么麼]|你知道我叫啥|还记得我叫什[么麼]|还记得我叫啥)$/.test(normalized);
  if (asksUserName) {
    const knownUserName = extractKnownUserNameFromSystem(systemInstructionText);
    return knownUserName
      ? `你叫${knownUserName}。`
      : '你还没告诉我你的名字，我现在还不知道。';
  }

  const asksPersonaName = /^(你叫什[么麼]名字?|你叫啥名字?|你名字是什[么麼]|你的名字是什[么麼]|你是谁)$/.test(normalized);
  if (asksPersonaName) {
    const personaName = extractPersonaNameFromSystem(systemInstructionText);
    return personaName
      ? `我叫${personaName}。`
      : '我还没有被设置名字。';
  }

  return '';
}

function sanitizeSystemInstructionForChat(systemInstructionText, promptText) {
  if (!isChatPrompt(promptText)) return systemInstructionText;

  return String(systemInstructionText || '')
    .replace(/\s*\|\s*状态:[^\n]+/g, '')
    .replace(/状态:[^\n]+/g, '')
    .replace(/并结合之前状态：“[^”]*”/g, '')
    .trim();
}

function buildLatestUserReplyGuard(promptText) {
  const latestUserText = getLatestUserTextFromPrompt(promptText)
    .replace(/\s+/g, ' ')
    .slice(0, 160);

  if (!latestUserText) return '';

  return `【本轮回复焦点】\n对话历史里最后一条 User 是：“${latestUserText}”。本轮正文必须先回应这条消息，再按人格自然延展。不要把隐藏状态、主动联系旧话题、长期记忆或自我活动当成正文主线；除非用户明确问“你在干嘛/你现在什么状态”，否则不要展开自己的 activity。`;
}

function buildRuntimeStatusInstruction(personaId) {
  return `

【Persona 双层状态标记】
你需要根据当前人格、最近对话和用户情绪，为 Persona 决定一个“自身生活状态 + 当前聊天情绪”。只在本轮回复最开头输出一次隐藏状态标记，格式严格为：
[status:{"personaId":"${personaId}","label":"短状态","activity":"此刻正在做的具体生活化事情","color":"red|orange|yellow|green|blue|purple|pink|slate","base_mood":"基础情绪","chat_mood":"被本轮对话影响后的情绪","emotional_shift":"为什么情绪有变化","duration_minutes":30}]
要求：
- label 最多 4 个中文字，例如：吃饭中、散步中、发呆中、回宿舍、摸鱼中、赶路中、喝水中、听歌中、补觉中、整理中。
- activity 是 Persona 自身的生活状态，不要总围绕同一件事；禁止连续机械复用“剪视频/电脑卡/暴躁”。
- base_mood 是 Persona 此刻的基础底色，例如：松弛、平稳、困倦、专注、散漫、期待、疲惫、轻快、烦躁、低落。
- chat_mood 是被用户本轮话题影响后的即时情绪，例如：被逗笑、心软、担心、认真、警觉、共情、好奇、无语、放松。
- emotional_shift 用一句短语说明从基础情绪到聊天情绪的变化原因，例如：被用户语气带轻松了、因为用户低落而收敛、被问题激起兴趣。
- duration_minutes 是这个生活状态预计持续多久，单位分钟，建议范围 10 到 180。
- 这个状态只服务前端展示，不要解释它，不要把它当聊天内容。
- 标记后正文第一句必须落在对话历史最后一条 User 上；除非用户主动问状态，否则不要延续 activity。`;
}

function stripRuntimeStatusMarkers(responseText) {
  return extractAndPersistRuntimeStatusMarkers(responseText).text;
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

const isDeepSeekBusyError = (message = '') => /Service is too busy|busy|temporarily switch|server is overloaded|rate limit|429|503/i.test(String(message));

export const callDeepSeekAPI = async (promptText, systemInstructionText = null, mode = 'pro', signal = null, personaId = 'default') => {
  const deterministicReply = buildDeterministicIdentityReply(promptText, systemInstructionText);
  if (deterministicReply) return deterministicReply;

  const sanitizedSystemInstructionText = sanitizeSystemInstructionForChat(systemInstructionText, promptText);
  const replyGuardInstruction = buildLatestUserReplyGuard(promptText);
  const runtimeStatusInstruction = shouldInjectRuntimeStatusInstruction(promptText, sanitizedSystemInstructionText, personaId)
    ? buildRuntimeStatusInstruction(personaId)
    : '';
  const finalSystemInstructionText = [
    sanitizedSystemInstructionText,
    replyGuardInstruction,
    runtimeStatusInstruction,
  ].filter(Boolean).join('\n\n');

  const apiMessages = buildApiMessagesFromPrompt(promptText, finalSystemInstructionText);
  const isPro = mode === 'pro';

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
            personaId,
            enableMemoryTools: useProModel
          },
          timeout: useProModel ? 60000 : 15000
        });
      };

      let res = await callDeepSeekFunction(mode);

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

      let responseText = data.choices?.[0]?.message?.content || '';

      const toolRegex = /```json\s*(\{[\s\S]*?"tool_name"\s*:\s*"(retrieve_long_term_memory|search_subconscious_memory)"[\s\S]*?\})\s*```|\{\s*"tool_name"\s*:\s*"(retrieve_long_term_memory|search_subconscious_memory)"[\s\S]*?\}/;
      const match = responseText.match(toolRegex);

      if (match) {
        const jsonStr = match[1] || match[0];
        let toolCall;
        try {
          toolCall = JSON.parse(jsonStr);
        } catch (parseError) {
          console.warn('Tool Call JSON 解析失败，放行输出:', jsonStr, parseError);
          return resolve(stripRuntimeStatusMarkers(responseText));
        }

        console.log(`⚡ [DSM Tool Interceptor] 侦测到深态回源请求 [${toolCall.tool_name}]:`, toolCall.input?.query);

        let toolResult = '[记忆库无相关记录]';
        if (db) {
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

             const query = toolCall.input?.query || getFallbackQuery(apiMessages, promptText);
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
             console.error('TCB 深态记忆库检索失败:', dbErr);
             toolResult = '[记忆检索系统暂时离线]';
          }
        }

        apiMessages.push({ role: 'assistant', content: responseText });
        apiMessages.push({ role: 'user', content: `系统工具执行完毕。检索结果如下:\n${toolResult}\n\n请结合上述深层记忆，继续极其自然地回答我刚才的问题。绝对禁止再次输出任何工具 JSON 结构。` });

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

        responseText = secondData.choices?.[0]?.message?.content || '';
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
