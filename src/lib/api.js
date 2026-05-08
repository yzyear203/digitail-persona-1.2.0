// ==========================================
// 方案 A 全量覆盖：src/lib/api.js
// 目标：实装底层无感 Tool Call 拦截器，打通 T2 深态记忆回源闭环
// ==========================================

import { cloudbase, db } from './cloudbase';
import { estimateKeywordScore, normalizeMemoryRecord } from './dsm';

// ================== Doubao OCR 引擎 ==================
export const callDoubaoAPI = async (promptText, systemInstructionText = null, imageParts = []) => {
  const apiMessages = [];
  if (systemInstructionText) apiMessages.push({ role: "system", content: systemInstructionText });

  if (imageParts.length > 0) {
    const userContent = [{ type: "text", text: promptText }];
    imageParts.forEach(img =>
      userContent.push({ type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.base64Data}` } })
    );
    apiMessages.push({ role: "user", content: userContent });
  } else {
    apiMessages.push({ role: "user", content: promptText });
  }

  try {
    const res = await cloudbase.callFunction({
      name: 'generate',
      data: { messages: apiMessages },
      timeout: 60000
    });

    const data = res.result;
    if (data && data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    return data.choices?.[0]?.message?.content || "";
  } catch (e) {
    throw new Error(`${e.message}`);
  }
};

// ================== DeepSeek 双轨制引擎 ==================
const isDeepSeekBusyError = (message = '') => /Service is too busy|busy|temporarily switch|server is overloaded|rate limit|429|503/i.test(String(message));

export const callDeepSeekAPI = async (promptText, systemInstructionText = null, mode = 'pro', signal = null, personaId = 'default') => {
  const apiMessages = [];
  if (systemInstructionText) apiMessages.push({ role: "system", content: systemInstructionText });
  apiMessages.push({ role: "user", content: promptText });

  const isPro = mode === 'pro';

  // 🚀 核心升级：注入 AbortController 物理阻断机制与底层 Tool Call 无感拦截器
  return new Promise(async (resolve, reject) => {
    // 注册防章鱼拦截监听器
    if (signal) {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
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
          return resolve(responseText);
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

      resolve(responseText);
    } catch (e) {
      reject(new Error(`DeepSeek 引擎宕机: ${e.message}`));
    }
  });
};
