// src/lib/api.js
import { cloudbase } from './cloudbase';

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
export const callDeepSeekAPI = async (promptText, systemInstructionText = null, mode = 'pro', signal = null) => {
  const apiMessages = [];
  if (systemInstructionText) apiMessages.push({ role: "system", content: systemInstructionText });
  apiMessages.push({ role: "user", content: promptText });

  const isPro = mode === 'pro';

  // 🚀 核心升级：注入 AbortController 物理阻断机制
  return new Promise(async (resolve, reject) => {
    // 注册防章鱼拦截监听器
    if (signal) {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    }

    try {
      // 注意：如果未来切换为 Fetch 直连大模型，只需在此处 fetch(url, { signal }) 即可实现真正的 GPU 毫秒级断连
      const res = await cloudbase.callFunction({
        name: 'deepseek_generate',
        data: { 
          messages: apiMessages,
          model: isPro ? 'deepseek-v4-pro' : 'deepseek-v4-flash',
          useThinking: isPro 
        },
        timeout: isPro ? 60000 : 15000 
      });
      
      // 异步回来后再次检查是否已被阻断，如果是，抛弃数据
      if (signal && signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));

      const data = res.result;
      if (data && data.error) throw new Error(data.error.message || JSON.stringify(data.error));
      resolve(data.choices?.[0]?.message?.content || "");
    } catch (e) {
      reject(new Error(`DeepSeek 引擎宕机: ${e.message}`));
    }
  });
};
