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

function isChatPersonaPrompt(promptText) {
  const prompt = String(promptText || '');
  return prompt.includes('对话历史:') && prompt.includes('Assistant:');
}

function isPersonaDistillationPrompt(promptText) {
  const prompt = String(promptText || '');
  return /DSM\s*2\.2|人格档案|聊天记录原始切片|runtime_card|personality\.value/.test(prompt);
}

function buildAntiTemplatePersonaGuard(promptText) {
  if (isChatPersonaPrompt(promptText)) {
    return `

【人格保真：反模板守门】
请把上面的资料当作性格纹理，而不是台词脚本。不要按“遇到某情况就回答某句话”的方式执行，也不要输出固定安慰语、固定免责声明、固定犹豫句或固定转折句。
回应时优先保留这个 Persona 的语气惯性、关系位置、情绪余波和当下话题；可以短、可以含糊、可以停顿，但要像一个真实聊天对象临场反应。
引用、撤回、表情、分气泡都只是可用的表达习惯，不是任务清单；只有自然滑到那个动作时再使用。
避免反复使用“我可能不太确定”“如果你愿意的话”“作为AI”等模板式表达，除非它确实来自该人格本身的语言习惯。`;
  }

  if (isPersonaDistillationPrompt(promptText)) {
    return `

【侧写保真：反模板守门】
生成档案时，请从聊天材料中归纳“倾向、惯性、犹豫、亲疏、节奏”，不要写成固定问答脚本。避免“如果出现某情况就回答某句话”的模板化规则。
触发条件请写成柔性的心理倾向和注意力落点，而不是机械分支；runtime_card 要像压缩后的性格纹理，能诱导自然说话，而不是把 Persona 绑成流程机器人。
没有证据的地方保持留白或弱置信度，不要用通用模板补满。`;
  }

  return '';
}

function shouldInjectRuntimeStatusInstruction(promptText, systemInstructionText, personaId) {
  if (!personaId || personaId === 'default') return false;
  if (!shouldRefreshRuntimeStatus(personaId)) return false;
  if (!systemInstructionText || /只输出合法JSON|严格按下方JSON输出/.test(systemInstructionText)) return false;
  return isChatPersonaPrompt(promptText);
}

function buildRuntimeStatusInstruction(personaId) {
  return `

【Persona 状态感知】
在回复前，请轻量感知 Persona 此刻的生活位置、基础情绪，以及被本轮对话牵动后的即时情绪。这个标记只给前端状态系统读取，不参与聊天文本。

隐藏标记格式保持为：
[status:{"personaId":"${personaId}","label":"短状态","activity":"此刻正在做的具体生活化事情","color":"red|orange|yellow|green|blue|purple|pink|slate","base_mood":"基础情绪","chat_mood":"本轮对话牵动后的情绪","emotional_shift":"情绪变化原因","duration_minutes":30}]

生成时请像在给一个真实的人补充当下状态：
- 生活状态来自 TA 的人格、作息、最近聊天氛围和一点自然随机性，不要反复套用同一个场景。
- 基础情绪是 TA 当下的底色，通常比聊天情绪更稳定。
- 当前情绪是被用户这轮话题轻微牵动后的反应，可以有细微变化，但不需要戏剧化。
- 情绪变化原因用一句短语概括内在转折，不写成解释说明。
- 预计时长按生活事件自然估计，单位分钟，通常落在 10 到 180 之间。
- 标记之后继续以 Persona 本身的语气自然回复，不解释标记。`;
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
  const runtimeStatusInstruction = shouldInjectRuntimeStatusInstruction(promptText, systemInstructionText, personaId)
    ? buildRuntimeStatusInstruction(personaId)
    : '';
  const antiTemplateGuard = buildAntiTemplatePersonaGuard(promptText);
  const finalSystemInstructionText = [systemInstructionText, runtimeStatusInstruction, antiTemplateGuard]
    .filter(Boolean)
    .join('');

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
        apiMessages.push({ role: "user", content: `系统工具执行完毕。检索结果如下:\n${toolResult}\n\n请把这些记忆当成隐约想起的背景，只有在语气自然时才带入，并继续回应用户刚才的话。不要输出工具结构。` });

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
