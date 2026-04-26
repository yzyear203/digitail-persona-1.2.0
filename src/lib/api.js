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
    
    if (data && data.error) {
      throw new Error(data.error.message || JSON.stringify(data.error));
    }
    
    return data.choices?.[0]?.message?.content || "";
  } catch (e) {
    throw new Error(`${e.message}`);
  }
};

// ================== DeepSeek 双轨制引擎 ==================
export const callDeepSeekAPI = async (promptText, systemInstructionText = null, mode = 'pro') => {
  const apiMessages = [];
  if (systemInstructionText) apiMessages.push({ role: "system", content: systemInstructionText });
  apiMessages.push({ role: "user", content: promptText });

  const isPro = mode === 'pro';

  try {
    const res = await cloudbase.callFunction({
      name: 'generate_deepseek',
      data: { 
        messages: apiMessages,
        model: isPro ? 'deepseek-v4-pro' : 'deepseek-v4-flash',
        useThinking: isPro 
      },
      timeout: isPro ? 60000 : 15000 
    });
    
    const data = res.result;
    if (data && data.error) throw new Error(data.error.message || JSON.stringify(data.error));
    
    return data.choices?.[0]?.message?.content || "";
  } catch (e) {
    throw new Error(`DeepSeek 引擎宕机: ${e.message}`);
  }
};
