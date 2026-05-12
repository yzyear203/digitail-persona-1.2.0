import { cloudbase } from './cloudbase';
import { extractAndPersistRuntimeStatusMarkers } from './personaRuntimeStatus';

function getTextContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(part => typeof part === 'string' ? part : part?.text || '').join('\n');
  }
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

function normalizeQuestionText(text) {
  return String(text || '')
    .replace(/\[quote:[\s\S]*?\]/g, '')
    .replace(/<\/?recall>/g, '')
    .replace(/[\s，。,.!！?？~～…]+/g, '')
    .trim();
}

function getLatestUserTextFromPrompt(promptText) {
  const parsedChat = parseChatPrompt(promptText);
  const latestUser = parsedChat?.messages ? [...parsedChat.messages].reverse().find(message => message.role === 'user') : null;
  if (latestUser?.content) return latestUser.content.trim();

  const source = String(promptText || '');
  const userLines = source.match(/User:\s*([^\n]+)/g) || [];
  if (!userLines.length) return '';
  return userLines[userLines.length - 1].replace(/^User:\s*/, '').trim();
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

  const asksUserName = /^(我叫什[么麼]|我叫什[么麼]名字?|我叫啥|我叫啥名字?|我名字是什[么麼]|我的名字是什[么麼]|你知道我叫什[么麼]|你知道我叫啥|还记得我叫什[么麼]|还记得我叫啥)$/.test(normalized);
  if (asksUserName) {
    const knownUserName = extractKnownUserNameFromSystem(systemInstructionText);
    return knownUserName ? `你叫${knownUserName}。` : '你还没告诉我你的名字，我现在还不知道。';
  }

  const asksPersonaName = /^(你叫什[么麼]|你叫什[么麼]名字?|你叫啥|你叫啥名字?|你名字是什[么麼]|你的名字是什[么麼]|你是谁)$/.test(normalized);
  if (asksPersonaName) {
    const personaName = extractPersonaNameFromSystem(systemInstructionText);
    return personaName ? `我叫${personaName}。` : '我还没有被设置名字。';
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
  const latestUserText = getLatestUserTextFromPrompt(promptText).replace(/\s+/g, ' ').slice(0, 160);
  if (!latestUserText) return '';

  return `【本轮回复焦点】\n最后一条用户消息是：“${latestUserText}”。必须优先回应这句话。不要把旧主动消息、状态栏、长期记忆或自己的活动当成本轮正文主线。引用用户原话时，只能引用用户真实发过的话，禁止编造“系统记录”式引用。撤回只能使用 <recall>内容</recall>。`;
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
    parsedChat.contextBlock ? `【辅助上下文】\n${parsedChat.contextBlock}` : '',
  ].filter(Boolean).join('\n\n');

  const apiMessages = [];
  if (systemContent) apiMessages.push({ role: 'system', content: systemContent });

  const dialogueMessages = parsedChat.messages.slice(-18);
  apiMessages.push(...dialogueMessages);

  const latestUser = [...dialogueMessages].reverse().find(message => message.role === 'user');
  const lastMessage = apiMessages[apiMessages.length - 1];
  if (latestUser && lastMessage?.role !== 'user') {
    apiMessages.push({ role: 'user', content: latestUser.content });
  }

  return apiMessages;
}

function sanitizeAssistantResponse(responseText, latestUserText) {
  const latestUser = String(latestUserText || '').replace(/\s+/g, ' ').trim();

  return String(responseText || '')
    .replace(/\[recall[:：]\s*([^\]]{1,240})\]/g, '<recall>$1</recall>')
    .replace(/\[quote:\s*([^\]]{1,120})\]/g, (full, quoteText) => {
      const quote = String(quoteText || '').replace(/\s+/g, ' ').trim();
      if (!quote || !latestUser.includes(quote)) return '';
      return `[quote: ${quote}]`;
    })
    .trim();
}

function stripRuntimeStatusMarkers(responseText) {
  return extractAndPersistRuntimeStatusMarkers(responseText).text;
}

export const callDoubaoAPI = async (promptText, systemInstructionText = null, imageParts = []) => {
  const apiMessages = [];
  if (systemInstructionText) apiMessages.push({ role: 'system', content: systemInstructionText });

  if (imageParts.length > 0) {
    const userContent = [{ type: 'text', text: promptText }];
    imageParts.forEach(img => userContent.push({ type: 'image_url', image_url: { url: `data:${img.mimeType};base64,${img.base64Data}` } }));
    apiMessages.push({ role: 'user', content: userContent });
  } else {
    apiMessages.push({ role: 'user', content: promptText });
  }

  try {
    const res = await cloudbase.callFunction({ name: 'generate', data: { messages: apiMessages }, timeout: 60000 });
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

  const latestUserText = getLatestUserTextFromPrompt(promptText);
  const sanitizedSystemInstructionText = sanitizeSystemInstructionForChat(systemInstructionText, promptText);
  const finalSystemInstructionText = [
    sanitizedSystemInstructionText,
    buildLatestUserReplyGuard(promptText),
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
            enableMemoryTools: false,
          },
          timeout: useProModel ? 60000 : 15000,
        });
      };

      let res = await callDeepSeekFunction(mode);
      if (signal && signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));

      let data = res.result;
      if (data && data.error && isPro && isDeepSeekBusyError(data.error.message || JSON.stringify(data.error))) {
        res = await callDeepSeekFunction('flash');
        data = res.result;
      }

      if (data && data.error) throw new Error(data.error.message || JSON.stringify(data.error));

      const rawText = data.choices?.[0]?.message?.content || '';
      const cleanedText = sanitizeAssistantResponse(stripRuntimeStatusMarkers(rawText), latestUserText);
      return resolve(cleanedText || '我刚才没组织好语言，你再说一遍。');
    } catch (e) {
      reject(new Error(`DeepSeek 引擎宕机: ${e.message}`));
    }
  });
};
