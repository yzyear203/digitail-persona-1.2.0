// src/lib/api.js
import { cloudbase } from './cloudbase';

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
    
    // 🚀 核心修复：如果火山引擎报错（比如 Key 填错了），立刻拦截并抛出真实原因
    if (data && data.error) {
      throw new Error(data.error.message || JSON.stringify(data.error));
    }
    
    return data.choices?.[0]?.message?.content || "";
  } catch (e) {
    // 抛出干净的错误信息给界面
    throw new Error(`${e.message}`);
  }
};
