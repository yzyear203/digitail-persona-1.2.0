import React, { useState, useRef, useEffect } from 'react';
import ChatHeader from '../chat/ChatHeader';
import ChatMessageList from '../chat/ChatMessageList';
import ChatInput from '../chat/ChatInput';
import TasksModal from '../ui/TasksModal';
import MemoryCabin from '../ui/MemoryCabin';
import ChatAppearanceModal from '../ui/ChatAppearanceModal';
import { callDoubaoAPI, callDeepSeekAPI } from '../../lib/api';
import { db } from '../../lib/cloudbase';
import { upsertPersonaProfile } from '../../lib/profileStore';
import {
  hasContentSignal,
  getHotT1,
  saveToHotT1Cache,
  buildSystemPrompt,
  applyBudgetAllocator,
  buildT1MemoryRecord,
  getDaysSince,
  splitAssistantReply
} from '../../lib/dsm';

const IMMEDIATE_MEMORY_WINDOW = 8;
const USER_SETTLE_DELAY_MS = 3000;
const DEBUG_FORCE_QUOTE_RECALL = false;
const DEBUG_RECALL_FALLBACK_TEXT = '撤回测试：如果组件正常，这条会先打出来，然后变成撤回提示。';
const CONTROL_MARKER_REGEX = /<del>[\s\S]*?<\/del>|<\/?recall>|\[quote:[\s\S]*?\]/g;
const DEFAULT_CHAT_APPEARANCE = {
  theme: 'light',
  userAvatar: '',
  backgroundImage: '',
};

function getStoredChatAppearance(activeId) {
  try {
    const raw = localStorage.getItem(`chat_appearance_${activeId}`);
    return raw ? { ...DEFAULT_CHAT_APPEARANCE, ...JSON.parse(raw) } : DEFAULT_CHAT_APPEARANCE;
  } catch (error) {
    console.warn('读取聊天外观设置失败:', error);
    return DEFAULT_CHAT_APPEARANCE;
  }
}

function extractDeclaredUserName(text) {
  const normalizedText = String(text || '').trim();
  const patterns = [
    /(?:我叫|叫我|我的名字是|我名字叫|本人叫)([\u4e00-\u9fa5A-Za-z0-9_·•]{1,16})/,
    /我是([\u4e00-\u9fa5A-Za-z0-9_·•]{1,16})(?:$|[，。,.!！?？\s])/,
  ];

  for (const pattern of patterns) {
    const matched = normalizedText.match(pattern)?.[1]?.trim();
    if (matched) return matched;
  }

  return '';
}

function stripControlMarkers(text) {
  return String(text || '').replace(CONTROL_MARKER_REGEX, '').trim();
}

function getLastUserQuote(messagesSnapshot) {
  const lastUserMsg = [...(messagesSnapshot || [])]
    .reverse()
    .find(m => m.role === 'user' && stripControlMarkers(m.text));

  const quoteText = stripControlMarkers(lastUserMsg?.text) || '最近这条消息';
  return quoteText.replace(/\s+/g, ' ').slice(0, 24);
}

function buildDebugQuoteRecallParts(replyParts, messagesSnapshot) {
  const quoteText = getLastUserQuote(messagesSnapshot);
  const baseParts = Array.isArray(replyParts) && replyParts.length > 0
    ? replyParts.map(part => stripControlMarkers(part)).filter(Boolean)
    : ['引用测试：如果组件正常，这条气泡顶部会显示引用框。'];

  const testParts = baseParts.length >= 2
    ? baseParts
    : [baseParts[0], DEBUG_RECALL_FALLBACK_TEXT];

  return testParts.map((part, index) => {
    if (index % 2 === 0) {
      return `[quote: ${quoteText}]${part}`;
    }
    return `<recall>${part || DEBUG_RECALL_FALLBACK_TEXT}</recall>`;
  });
}

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

async function writeMemoryThroughVectorize({ personaId, memoryRecord }) {
  const { cloudbase } = await import('../../lib/cloudbase');
  if (!cloudbase) throw new Error('CloudBase SDK 未初始化，无法写入记忆');

  const functionName = 'vectorize_memory';
  const res = await cloudbase.callFunction({
    name: functionName,
    data: { personaId, records: [memoryRecord] },
    timeout: 15000,
  });

  if (res.result?.success === false) {
    throw new Error(res.result.error || `${functionName} 云函数返回失败`);
  }

  console.log(`T1 深态记忆已通过 ${functionName} 云函数写入数据库`, res.result || '');
  return true;
}

async function writeMemoryDirectly({ memoryRecord }) {
  if (!db) throw new Error('数据库未初始化，无法写入记忆');
  await db.collection('persona_memories').add(memoryRecord);
  console.log('T1 深态记忆已通过前端兜底直接写入数据库');
}

export default function ChatPage({ setAppPhase, messages, setMessages, activePersona, setActivePersona, showMsg }) {
  const [input, setInput] = useState('');
  const [isTypingIndicator, setIsTypingIndicator] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [showMemoryCabin, setShowMemoryCabin] = useState(false);
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);
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

  const activeId = activePersona?.id || 'default';
  const chatKey = `chat_history_${activeId}`;
  const [chatAppearance, setChatAppearance] = useState(() => getStoredChatAppearance(activeId));
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

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    activePersonaRef.current = activePersona;
  }, [activePersona]);

  useEffect(() => {
    setChatAppearance(getStoredChatAppearance(activeId));
  }, [activeId]);

  useEffect(() => {
    try {
      localStorage.setItem(`chat_appearance_${activeId}`, JSON.stringify(chatAppearance));
    } catch (error) {
      console.warn('保存聊天外观设置失败:', error);
      showMsg('⚠️ 图片可能过大，浏览器本地存储已满');
    }
  }, [activeId, chatAppearance, showMsg]);

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
  }, [chatKey]);

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
      if (!hasContentSignal(messages)) {
        console.log('[DSM 守门人] 跳过低信息密度对话');
        return;
      }

      console.log('[DSM 闪电通道] 启动近期记忆提取');
      try {
        const historyForExtraction = messages.slice(-IMMEDIATE_MEMORY_WINDOW)
          .filter(m => m.role !== 'system' && !m.isRecalled)
          .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${stripControlMarkers(m.text)}`)
          .join('\n');

        const prompt = `分析以下最新对话，提取极具价值的增量记忆。
严禁提取无意义的日常，必须以第三人称陈述。
重要性打分规则：日常小事0-3，明确计划4-7，重大节点或重要状态变化8-10。
严格按下方JSON输出，不要包含markdown格式：
{ "importance": 9, "summary": "用户今天拿到了重要结果", "emotion": "excited", "confidence": "high" }
其中 emotion 从 [happy, sad, neutral, excited, frustrated, anxious] 中选，confidence 从 [high, medium, low] 中选。如果没有硬核信息，importance 填 0。
对话：\n${historyForExtraction}`;

        const resJSONStr = await callDeepSeekAPI(prompt, '你是一个只输出合法JSON的机器。', 'flash', null, activeId);

        let t1Event = { importance: 0, summary: '', emotion: 'neutral', confidence: 'high' };
        try {
          t1Event = JSON.parse(resJSONStr.replace(/```json|```/g, '').trim());
        } catch (parseError) {
          console.warn('T1 提取 JSON 解析失败:', parseError);
          return;
        }

        if (t1Event.importance > 0 && t1Event.summary) {
          saveToHotT1Cache(activeId, t1Event.summary);

          const { db } = await import('../../lib/cloudbase');

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
              try {
                await db.collection('personas').doc(activeId).update({ content: newT3Str });
              } catch (err) {
                console.error('T3档案更新失败:', err);
              }
            }
          }

          const memoryRecord = buildT1MemoryRecord({
            personaId: activeId,
            t1Event,
            deviceFp: navigator.userAgent.substring(0, 64),
          });

          try {
            await writeMemoryThroughVectorize({ personaId: activeId, memoryRecord });
          } catch (vectorizeError) {
            console.warn('vectorize_memory 云函数不可用，降级为前端直写:', vectorizeError.message);
            try {
              await writeMemoryDirectly({ memoryRecord });
            } catch (fallbackError) {
              console.error('T1 深态记忆写入彻底失败:', fallbackError);
            }
          }
        }
      } catch (error) {
        console.warn('Flash 提取中断:', error.message);
      }
    }, 10000);

    return () => clearTimeout(extractTimerRef.current);
  }, [messages, isTypingIndicator, activeId]);

  const runAssistantResponse = async (currentNonce) => {
    if (generationNonce.current !== currentNonce) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsTypingIndicator(true);
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
        .map(m => ({ role: m.role, text: stripControlMarkers(m.text) }));

      const sysPromptLength = Math.ceil(sysPrompt.length / 1.5);
      const prunedT0 = applyBudgetAllocator(recentT0, sysPromptLength, 3000);

      const chatHistoryStr = prunedT0.map(m =>
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`
      ).join('\n');

      const responseText = await callDeepSeekAPI(
        `对话历史:\n${chatHistoryStr}\n\nAssistant:`,
        sysPrompt,
        'pro',
        controller.signal,
        personaId
      );

      if (generationNonce.current !== currentNonce) return;
      if (responseText.includes('[SILENCE]')) {
        setIsTypingIndicator(false);
        return;
      }

      const rawReplyParts = splitAssistantReply(responseText);
      const replyParts = DEBUG_FORCE_QUOTE_RECALL
        ? buildDebugQuoteRecallParts(rawReplyParts, messagesRef.current)
        : rawReplyParts;
      setIsTypingIndicator(false);

      for (let i = 0; i < replyParts.length; i++) {
        if (generationNonce.current !== currentNonce) break;

        const messageId = Date.now() + i;
        const waitForTyping = new Promise(resolve => {
          typingResolversRef.current.set(messageId, resolve);
        });

        setMessages(prev => [
          ...prev,
          {
            id: messageId,
            role: 'assistant',
            text: replyParts[i],
            time: new Date().toLocaleTimeString(),
            isAnimated: true,
            typingPersona: personaSnapshot?.content || ''
          }
        ]);

        await waitForTyping;
        typingResolversRef.current.delete(messageId);
        if (generationNonce.current !== currentNonce) break;

        if (i < replyParts.length - 1) {
          await new Promise(r => setTimeout(r, 420));
        }
      }
    } catch (error) {
      const isAbort = error.name === 'AbortError' || /abort|aborted/i.test(error.message || '');
      if (!isAbort && generationNonce.current === currentNonce) {
        showMsg(`意识传输中断: ${error.message}`);
      }
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
        await upsertPersonaProfile({
          personaId,
          t3Profile: nextT3,
          nickname: activePersonaRef.current?.name,
        });
      } catch (error) {
        console.warn('用户称呼同步云端失败:', error);
      }
    });
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const userText = input.trim();
    if (!userText) return;

    setInput('');
    persistDeclaredUserName(extractDeclaredUserName(userText));

    const currentNonce = Date.now();
    generationNonce.current = currentNonce;

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

    setMessages(prev => {
      const filtered = prev.filter(m => !(m.role === 'assistant' && m.isAnimated));
      return [...filtered, { id: currentNonce, role: 'user', text: userText, time: new Date().toLocaleTimeString() }];
    });

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

    pendingResponseTimerRef.current = setTimeout(() => {
      pendingResponseTimerRef.current = null;
      runAssistantResponse(currentNonce);
    }, USER_SETTLE_DELAY_MS);
  };

  const handleClearChatHistory = () => {
    if (!window.confirm('确定清空当前聊天记录吗？这只会删除对话气泡，不会清空任何记忆。')) return;

    generationNonce.current = Date.now();
    if (pendingResponseTimerRef.current) {
      clearTimeout(pendingResponseTimerRef.current);
      pendingResponseTimerRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (extractTimerRef.current) clearTimeout(extractTimerRef.current);
    resolvePendingTypingAnimations();
    setIsTypingIndicator(false);

    localStorage.removeItem(chatKey);
    setMessages([
      { id: Date.now(), role: 'system', text: 'SYSTEM_BOOT', time: new Date().toLocaleTimeString(), isAnimated: false }
    ]);
    showMsg('✅ 聊天记录已清空，记忆未受影响');
  };

  const handleExtractTasks = async () => {
    setIsExtracting(true);
    try {
      const chatHistory = messages
        .filter(m => m.role !== 'system' && !m.isRecalled)
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${stripControlMarkers(m.text)}`)
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
          />
        )}
      </div>
    </div>
  );
}
