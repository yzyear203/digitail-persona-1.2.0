import { cloudbase } from './cloudbase'; // 注意：确保 cloudbase.js 里导出了 tcb as cloudbase

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
    // 【核心修复】：不再用 fetch，直接呼叫你刚刚建好的名为 'generate' 的云函数
    const res = await cloudbase.callFunction({
      name: 'generate',
      data: { messages: apiMessages }
    });
    
    const data = res.result;
    return data.choices?.[0]?.message?.content || "";
  } catch (e) {
    throw new Error(`AI 唤醒失败: ${e.message}`);
  }
};
