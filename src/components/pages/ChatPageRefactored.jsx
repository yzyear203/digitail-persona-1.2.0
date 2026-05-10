import React, { useState, useRef, useEffect } from 'react';
import ChatHeader from '../chat/ChatHeader';
import ChatMessageList from '../chat/ChatMessageList';
import ChatInput from '../chat/ChatInput';
import TasksModal from '../ui/TasksModal';
import MemoryCabin from '../ui/MemoryCabinV2';
import ChatAppearanceModal from '../ui/ChatAppearanceModal';
import StickerPanel from '../stickers/StickerPanel';
import { callDoubaoAPI, callDeepSeekAPI } from '../../lib/api';
import { db } from '../../lib/cloudbase';
import { upsertPersonaProfile } from '../../lib/profileStore';
import {
  createStickerMessage,
  extractStickerKeyword,
  isStickerMarker,
  splitTextAndStickerMarkers,
} from '../../lib/stickerMessage';
import {
  hasContentSignal,
  getHotT1,
  saveToHotT1Cache,
  buildSystemPrompt,
  applyBudgetAllocator,
  getDaysSince,
  splitAssistantReply,
} from '../../lib/dsm';
import { queryHotTopics } from '../../lib/hotTopics';
import {
  getStoredChatAppearance,
  persistChatAppearance,
  fetchCloudUserAvatar,
} from './chatPageUtils/appearance';
import {
  extractDeclaredUserName,
  stripControlMarkers,
  formatMessageForModel,
  buildDebugQuoteRecallParts,
} from './chatPageUtils/messageFormat';
import {
  IMMEDIATE_MEMORY_WINDOW,
  MEMORY_BATCH_MAX_WAIT_MS,
  prefetchLongTermMemory,
  shouldForceMemoryExtraction,
  getBatchMinItemsForPersona,
  buildMemoryExtractionItem,
  mergeExtractionBatch,
  buildMemoryExtractionPrompt,
  parseT1Event,
  createMemoryRecord,
  writeMemoryThroughVectorize,
  writeMemoryDirectly,
} from './chatPageUtils/memory';

const USER_SETTLE_DELAY_MS = 3000;
const DEBUG_FORCE_QUOTE_RECALL = false;
const DEBUG_RECALL_FALLBACK_TEXT = '撤回测试：如果组件正常，这条会先打出来，然后变成撤回提示。';

function getPersonaConversationState(persona) {
  let daysSinceLastChat = 0;
  let isCooling = false;

  try {
    const t3 = JSON.parse(persona?.content || '{}');
    if (t3.relationship?.last_chat_time) {
      daysSinceLastChat = getDaysSince(t3.relationship.last_chat_time);
    }
    if (t3.relationship?.bond_momentum === 'cooling') isCooling = true;
  } catch (parseError) {
    console.warn('T3 关系状态解析失败:', parseError);
  }

  return { daysSinceLastChat, isCooling };
}

export default function ChatPage({ setAppPhase, messages, setMessages, activePersona, setActivePersona, showMsg, userProfile, user }) {
  const [input, setInput] = useState('');
  const [quotedMessage, setQuotedMessage] = useState(null);
  const [isTypingIndicator, setIsTypingIndicator] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [showMemoryCabin, setShowMemoryCabin] = useState(false);
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);
  const [showStickerPanel, setShowStickerPanel] = useState(false);
  const [extractedTasks, setExtractedTasks] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);

  const generationNonce = useRef(0);
  const abortControllerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const extractTimerRef = useRef(null);
  const typingResolversRef = useRef(new Map());
  const pendingResponseTimerRef = useRef(null);
  const messagesRef = useRef(messages);
  const activePersonaRef = useRef(activePersona);
  const memoryExtractionBufferRef = useRef([]);
  const lastMemoryExtractionAtRef = useRef(Date.now());
  const lastBufferedUserMessageIdRef = useRef(null);

  const activeId = activePersona?.id || 'default';
  const accountId = user?.uid || userProfile?.uid || '';
  const chatKey = `chat_history_${activeId}`;
  const [chatAppearance, setChatAppearance] = useState(() => getStoredChatAppearance(activeId, accountId));
  const isDarkChat = chatAppearance.theme === 'dark';
  const chatShellClass = isDarkChat ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900';
  const chatBackgroundStyle = chatAppearance.backgroundImage
    ? {
        backgroundImage: `linear-gradient(${isDarkChat ? 'rgba(2,6,23,.78), rgba(2,6,23,.78)' : 'rgba(248,250,252,.55), rgba(248,250,252,.55)'}), url(${chatAppearance.backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined;

  const resolvePendingTypingAnimations = () => {
    typingResolversRef.current.forEach(resolve => resolve());
    typingResolversRef.current.clear();
  };

  const cancelPendingAssistantWork = () => {
    generationNonce.current = Date.now();
    if (pendingResponseTimerRef.current) {
      clearTimeout(pendingResponseTimerRef.current);
      pendingResponseTimerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    resolvePendingTypingAnimations();
    setIsTypingIndicator(false);
    if (extractTimerRef.current) clearTimeout(extractTimerRef.current);
    return generationNonce.current;
  };

  const touchLastChatTime = () => {
    try {
      const t3 = JSON.parse(activePersonaRef.current?.content || '{}');
      if (t3.relationship) {
        t3.relationship.last_chat_time = new Date().toISOString();
        const updatedContent = JSON.stringify(t3);
        setActivePersona(prev => ({ ...prev, content: updatedContent }));

        import('../../lib/cloudbase').then(({ db }) => {
          if (db) db.collection('personas').doc(activeId).update({ content: updatedContent }).catch(() => {});
        });
      }
    } catch (err) {
      console.warn('更新最后聊天时间失败', err);
    }
  };

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { activePersonaRef.current = activePersona; }, [activePersona]);

  useEffect(() => {
    setChatAppearance(getStoredChatAppearance(activeId, accountId));
    memoryExtractionBufferRef.current = [];
    lastBufferedUserMessageIdRef.current = null;
    lastMemoryExtractionAtRef.current = Date.now();
  }, [activeId, accountId]);

  useEffect(() => {
    let cancelled = false;
    if (!accountId) return undefined;

    fetchCloudUserAvatar(accountId).then(cloudAvatar => {
      if (cancelled || !cloudAvatar) return;
      setChatAppearance(prev => prev.userAvatar === cloudAvatar ? prev : { ...prev, userAvatar: cloudAvatar });
    });

    return () => { cancelled = true; };
  }, [accountId]);

  useEffect(() => {
    try {
      persistChatAppearance(activeId, accountId, chatAppearance);
    } catch (error) {
      console.warn('保存聊天外观设置失败:', error);
      showMsg('⚠️ 图片可能过大，浏览器本地存储已满');
    }
  }, [activeId, accountId, chatAppearance, showMsg]);

  useEffect(() => {
    return () => {
      if (pendingResponseTimerRef.current) clearTimeout(pendingResponseTimerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
      resolvePendingTypingAnimations();
    };
  }, []);

  useEffect(() => {
    if (messages.length === 1 && messages[0].role === 'system') {
      const savedHistory = localStorage.getItem(chatKey);
      if (savedHistory) setMessages(JSON.parse(savedHistory));
    }
  }, [chatKey, messages, setMessages]);

  useEffect(() => {
    if (messages.length > 1) localStorage.setItem(chatKey, JSON.stringify(messages));
  }, [messages, chatKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTypingIndicator]);

  useEffect(() => {
    if (isTypingIndicator) return;

    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'assistant') return;

    if (extractTimerRef.current) clearTimeout(extractTimerRef.current);

    extractTimerRef.current = setTimeout(async () => {
      const latestUserMsg = [...messages].reverse().find(m => m.role === 'user' && formatMessageForModel(m));
      const latestUserText = formatMessageForModel(latestUserMsg);
      const forceExtractByPersona = shouldForceMemoryExtraction(latestUserText, activePersonaRef.current);

      if (!hasContentSignal(messages) && !forceExtractByPersona) {
        console.log('[DSM 守门人] 跳过低信息密度对话');
        return;
      }

      if (latestUserMsg?.id && lastBufferedUserMessageIdRef.current !== latestUserMsg.id) {
        memoryExtractionBufferRef.current.push(buildMemoryExtractionItem(messages));
        lastBufferedUserMessageIdRef.current = latestUserMsg.id;
      }

      const batchMinItems = getBatchMinItemsForPersona(activePersonaRef.current);
      const shouldExtractNow = forceExtractByPersona
        || memoryExtractionBufferRef.current.length >= batchMinItems
        || Date.now() - lastMemoryExtractionAtRef.current >= MEMORY_BATCH_MAX_WAIT_MS;

      if (!shouldExtractNow) {
        console.log(`[DSM 批量记忆] 暂存 ${memoryExtractionBufferRef.current.length}/${batchMinItems} 个候选片段，等待合并提取。`);
        return;
      }

      const extractionBatch = memoryExtractionBufferRef.current.splice(0);
      if (!extractionBatch.length) return;
      lastMemoryExtractionAtRef.current = Date.now();

      try {
        const historyForExtraction = mergeExtractionBatch(extractionBatch);
        const prompt = buildMemoryExtractionPrompt(historyForExtraction);
        const resJSONStr = await callDeepSeekAPI(prompt, '你是一个只输出合法JSON的机器。', 'flash', null, activeId);
        const t1Event = parseT1Event(resJSONStr);

        if (t1Event.importance > 0 && t1Event.summary) {
          saveToHotT1Cache(activeId, t1Event.summary);

          if (t1Event.importance >= 8) {
            showMsg(`闪电更新：已感知到重大事件 [${t1Event.summary}]`);
            let newT3Str = '';
            setActivePersona(prev => {
              try {
                const t3 = JSON.parse(prev.content);
                t3.current_context = { value: t1Event.summary, expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() };
                newT3Str = JSON.stringify(t3);
                return { ...prev, content: newT3Str };
              } catch (parseError) {
                console.warn('闪电通道 T3 更新失败，保留原档案:', parseError);
                return prev;
              }
            });

            if (db && newT3Str) {
              try { await db.collection('personas').doc(activeId).update({ content: newT3Str }); }
              catch (err) { console.error('T3档案更新失败:', err); }
            }
          }

          const memoryRecord = createMemoryRecord({ personaId: activeId, t1Event });
          try {
            await writeMemoryThroughVectorize({ personaId: activeId, memoryRecord });
          } catch (vectorizeError) {
            console.warn('vectorize_memory 云函数不可用，降级为前端直写:', vectorizeError.message);
            try { await writeMemoryDirectly({ memoryRecord }); }
            catch (fallbackError) { console.error('T1 深态记忆写入彻底失败:', fallbackError); }
          }
        }
      } catch (error) {
        memoryExtractionBufferRef.current = [...extractionBatch, ...memoryExtractionBufferRef.current].slice(-batchMinItems);
        console.warn('Flash 批量提取中断:', error.message);
      }
    }, 10000);

    return () => clearTimeout(extractTimerRef.current);
  }, [messages, isTypingIndicator, activeId, setActivePersona, showMsg]);

  const runAssistantResponse = async (currentNonce) => {
    if (generationNonce.current !== currentNonce) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsTypingIndicator(true);
    setShowStickerPanel(false);
    if (extractTimerRef.current) clearTimeout(extractTimerRef.current);

    try {
      const personaSnapshot = activePersonaRef.current;
      const personaId = personaSnapshot?.id || 'default';
      const { daysSinceLastChat, isCooling } = getPersonaConversationState(personaSnapshot);
      const hotT1 = getHotT1(personaId);
      const sysPrompt = buildSystemPrompt(personaSnapshot, hotT1, isCooling, daysSinceLastChat);

      const recentT0 = messagesRef.current
        .filter(m => m.role !== 'system' && !m.isRecalled)
        .slice(-IMMEDIATE_MEMORY_WINDOW)
        .map(m => ({ role: m.role, text: formatMessageForModel(m) }));

      const sysPromptLength = Math.ceil(sysPrompt.length / 1.5);
      const prunedT0 = applyBudgetAllocator(recentT0, sysPromptLength, 3000);
      const chatHistoryStr = prunedT0.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n');

      const memoryPrefetchBlock = await prefetchLongTermMemory({ personaId, messagesSnapshot: messagesRef.current });
      const hotTopics = await queryHotTopics({ persona: personaSnapshot, messagesSnapshot: messagesRef.current, limit: 3 });
      if (generationNonce.current !== currentNonce) return;

      const responseText = await callDeepSeekAPI(
        `${memoryPrefetchBlock ? `${memoryPrefetchBlock}\n\n` : ''}${hotTopics.promptBlock ? `${hotTopics.promptBlock}\n\n` : ''}对话历史:\n${chatHistoryStr}\n\nAssistant:`,
        sysPrompt,
        'flash',
        controller.signal,
        personaId
      );

      if (generationNonce.current !== currentNonce) return;
      if (responseText.includes('[SILENCE]')) {
        setIsTypingIndicator(false);
        return;
      }

      const rawReplyParts = splitAssistantReply(responseText);
      const normalizedReplyParts = DEBUG_FORCE_QUOTE_RECALL
        ? buildDebugQuoteRecallParts(rawReplyParts, messagesRef.current, DEBUG_RECALL_FALLBACK_TEXT)
        : rawReplyParts;
      const replyParts = normalizedReplyParts.flatMap(part => splitTextAndStickerMarkers(part));
      setIsTypingIndicator(false);

      for (let i = 0; i < replyParts.length; i++) {
        if (generationNonce.current !== currentNonce) break;

        const part = replyParts[i];
        const messageId = Date.now() + i;

        if (part.type === 'sticker_marker' || isStickerMarker(part.text)) {
          const keyword = part.keyword || extractStickerKeyword(part.text);
          const stickerMessage = await createStickerMessage({ role: 'assistant', keyword, id: messageId });
          if (generationNonce.current !== currentNonce) break;
          setMessages(prev => [...prev, stickerMessage]);
          if (i < replyParts.length - 1) await new Promise(r => setTimeout(r, 420));
          continue;
        }

        const waitForTyping = new Promise(resolve => {
          typingResolversRef.current.set(messageId, resolve);
        });

        setMessages(prev => [...prev, {
          id: messageId,
          role: 'assistant',
          text: part.text || String(part || ''),
          time: new Date().toLocaleTimeString(),
          isAnimated: true,
          typingPersona: personaSnapshot?.content || ''
        }]);

        await waitForTyping;
        typingResolversRef.current.delete(messageId);
        if (generationNonce.current !== currentNonce) break;
        if (i < replyParts.length - 1) await new Promise(r => setTimeout(r, 420));
      }
    } catch (error) {
      const isAbort = error.name === 'AbortError' || /abort|aborted/i.test(error.message || '');
      if (!isAbort && generationNonce.current === currentNonce) showMsg(`意识传输中断: ${error.message}`);
      if (generationNonce.current === currentNonce) setIsTypingIndicator(false);
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  };

  const persistDeclaredUserName = (userName) => {
    if (!userName) return;

    let nextT3 = null;
    setActivePersona(prev => {
      try {
        const t3 = JSON.parse(prev?.content || '{}');
        t3.user_name = userName;
        t3.identity = {
          ...(t3.identity || {}),
          value: t3.identity?.value || `用户称呼：${userName}`,
          confidence: 'high',
          last_updated: new Date().toISOString(),
        };
        nextT3 = t3;
        return { ...prev, content: JSON.stringify(t3) };
      } catch (parseError) {
        console.warn('用户称呼写入 T3 失败:', parseError);
        return prev;
      }
    });

    Promise.resolve().then(async () => {
      const personaId = activePersonaRef.current?.id || activeId;
      if (!db || !personaId || !nextT3) return;
      try {
        await db.collection('personas').doc(personaId).update({ content: JSON.stringify(nextT3) });
        await upsertPersonaProfile({ personaId, t3Profile: nextT3 });
      } catch (error) {
        console.warn('用户称呼同步云端失败:', error);
      }
    });
  };

  const handleQuoteMessage = (message) => {
    const text = stripControlMarkers(message?.text || '').replace(/\s+/g, ' ').slice(0, 80);
    if (!text) return;
    setQuotedMessage({ ...message, text });
  };

  const scheduleAssistantAfterUserInput = (currentNonce) => {
    pendingResponseTimerRef.current = setTimeout(() => {
      pendingResponseTimerRef.current = null;
      runAssistantResponse(currentNonce);
    }, USER_SETTLE_DELAY_MS);
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const userText = input.trim();
    if (!userText) return;

    const quotePrefix = quotedMessage?.text ? `[quote: ${quotedMessage.text.slice(0, 40)}]` : '';
    const messageText = `${quotePrefix}${userText}`;

    setInput('');
    setQuotedMessage(null);
    setShowStickerPanel(false);
    persistDeclaredUserName(extractDeclaredUserName(userText));

    const currentNonce = cancelPendingAssistantWork();

    setMessages(prev => {
      const filtered = prev.filter(m => !(m.role === 'assistant' && m.isAnimated));
      return [...filtered, { id: currentNonce, role: 'user', text: messageText, time: new Date().toLocaleTimeString() }];
    });

    touchLastChatTime();
    scheduleAssistantAfterUserInput(currentNonce);
  };

  const handleSendSticker = async (sticker) => {
    if (!sticker) return;
    setQuotedMessage(null);
    setShowStickerPanel(false);
    const currentNonce = cancelPendingAssistantWork();

    const stickerMessage = await createStickerMessage({
      role: 'user',
      sticker,
      keyword: sticker.emotion || sticker.name,
      id: currentNonce,
    });

    setMessages(prev => {
      const filtered = prev.filter(m => !(m.role === 'assistant' && m.isAnimated));
      return [...filtered, stickerMessage];
    });

    touchLastChatTime();
    scheduleAssistantAfterUserInput(currentNonce);
  };

  const handleClearChatHistory = () => {
    if (!window.confirm('确定清空当前聊天记录吗？这只会删除对话气泡，不会清空任何记忆。')) return;

    cancelPendingAssistantWork();
    localStorage.removeItem(chatKey);
    setQuotedMessage(null);
    setShowStickerPanel(false);
    setMessages([{ id: Date.now(), role: 'system', text: 'SYSTEM_BOOT', time: new Date().toLocaleTimeString(), isAnimated: false }]);
    showMsg('✅ 聊天记录已清空，记忆未受影响');
  };

  const handleExtractTasks = async () => {
    setIsExtracting(true);
    try {
      const chatHistory = messages
        .filter(m => m.role !== 'system' && !m.isRecalled)
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${formatMessageForModel(m)}`)
        .join('\n');
      const jsonResponse = await callDoubaoAPI(`分析对话，提取所有代办事项，没有返回空数组。\n\n${chatHistory}`, '严格输出 JSON 字符串数组，例如：["联系张三", "发送邮件"]。');

      let tasks = [];
      try {
        tasks = JSON.parse(jsonResponse.replace(/```json|```/g, '').trim());
      } catch (parseError) {
        console.warn('代办 JSON 解析失败:', parseError);
      }

      setExtractedTasks(tasks);
      setShowTasksModal(true);
    } catch (error) {
      console.error('代办提取失败:', error);
      showMsg('代办提取失败，请稍后重试。');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className={`h-screen flex flex-col font-sans overflow-hidden transition-colors ${chatShellClass}`} style={chatBackgroundStyle}>
      {!chatAppearance.backgroundImage && (
        <div className={`absolute inset-0 pointer-events-none ${isDarkChat ? 'bg-slate-950' : 'bg-slate-100'}`} />
      )}
      <div className="relative z-10 h-full flex flex-col min-h-0">
        <ChatHeader
          activePersona={activePersona}
          isTypingIndicator={isTypingIndicator}
          isExtracting={isExtracting}
          handleExtractTasks={handleExtractTasks}
          setAppPhase={setAppPhase}
          setShowMemoryCabin={setShowMemoryCabin}
          setShowAppearanceModal={setShowAppearanceModal}
          chatAppearance={chatAppearance}
        />

        <ChatMessageList
          messages={messages}
          setMessages={setMessages}
          activePersona={activePersona}
          messagesEndRef={messagesEndRef}
          chatAppearance={chatAppearance}
          onQuoteMessage={handleQuoteMessage}
          onAssistantAnimationComplete={messageId => {
            const resolve = typingResolversRef.current.get(messageId);
            if (resolve) resolve();
          }}
        />

        <ChatInput
          input={input}
          setInput={setInput}
          handleSendMessage={handleSendMessage}
          chatAppearance={chatAppearance}
          quotedMessage={quotedMessage}
          onClearQuote={() => setQuotedMessage(null)}
          onToggleStickerPanel={() => setShowStickerPanel(prev => !prev)}
          isStickerPanelOpen={showStickerPanel}
        />

        <StickerPanel
          isOpen={showStickerPanel}
          onClose={() => setShowStickerPanel(false)}
          onSelectSticker={handleSendSticker}
          chatAppearance={chatAppearance}
        />

        {showTasksModal && <TasksModal tasks={extractedTasks} onClose={() => setShowTasksModal(false)} />}
        {showMemoryCabin && (
          <MemoryCabin
            activePersona={activePersona}
            setActivePersona={setActivePersona}
            showMsg={showMsg}
            onClose={() => setShowMemoryCabin(false)}
            onClearChatHistory={handleClearChatHistory}
          />
        )}
        {showAppearanceModal && (
          <ChatAppearanceModal
            activePersona={activePersona}
            setActivePersona={setActivePersona}
            chatAppearance={chatAppearance}
            setChatAppearance={setChatAppearance}
            showMsg={showMsg}
            onClose={() => setShowAppearanceModal(false)}
            accountId={accountId}
          />
        )}
      </div>
    </div>
  );
}
