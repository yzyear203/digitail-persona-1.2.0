import React, { useState, useRef, useEffect } from 'react';
import ChatHeader from '../chat/ChatHeader';
import ChatMessageList from '../chat/ChatMessageList';
import ChatInput from '../chat/ChatInput';
import TasksModal from '../ui/TasksModal';
import MemoryCabin from '../ui/MemoryCabin';
import { callDoubaoAPI, callDeepSeekAPI } from '../../lib/api';
import { hasContentSignal, getHotT1, saveToHotT1Cache, buildSystemPrompt, applyBudgetAllocator, buildT1MemoryRecord, getDaysSince } from '../../lib/dsm';

export default function ChatPage({ setAppPhase, messages, setMessages, activePersona, setActivePersona, showMsg }) {
  const [input, setInput] = useState('');
  const [isTypingIndicator, setIsTypingIndicator] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [showMemoryCabin, setShowMemoryCabin] = useState(false);
  const [extractedTasks, setExtractedTasks] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);

  const generationNonce = useRef(0);
  const abortControllerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const extractTimerRef = useRef(null);

  const activeId = activePersona?.id || 'default';
  const chatKey = `chat_history_${activeId}`;

  // 计算冷却期与回归天数
  let daysSinceLastChat = 0;
  let isCooling = false;
  try {
    const t3 = JSON.parse(activePersona?.content || '{}');
    if (t3.relationship?.last_chat_time) {
      daysSinceLastChat = getDaysSince(t3.relationship.last_chat_time);
    }
    if (t3.relationship?.bond_momentum === 'cooling') isCooling = true;
  } catch (parseError) {
    console.warn('T3 关系状态解析失败:', parseError);
  }

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
        console.log("🛡️ [DSM 守门人] 过滤无意义日常，跳过 LLM 提取");
        return;
      }

      console.log("⚡ [DSM 闪电通道] 守门人放行，启动 Flash 提炼...");
      try {
        const historyForExtraction = messages.slice(-6)
          .filter(m => m.role !== 'system')
          .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text.replace(/<del>.*?<\/del>|<\/?recall>|\[quote:.*?\]/g, '')}`)
          .join('\n');

        // 👑 首席修复：补充 emotion 和 confidence 字段要求，搭建情绪隔离罩地基
        const prompt = `分析以下最新对话，提取极具价值的【增量记忆】。
严禁提取无意义的日常，必须以第三人称陈述。
【重要性打分规则】：日常小事0-3，明确计划4-7，重大人生事件（如拿到offer、失恋、生病、离职）必须打 8 到 10 分！
严格按下方JSON输出（不要包含markdown格式）：
{ "importance": 9, "summary": "用户今天拿到了字节跳动的Offer", "emotion": "excited", "confidence": "high" }
其中 emotion 从 [happy, sad, neutral, excited, frustrated, anxious] 中选，confidence 从 [high, medium, low] 中选。如果没有硬核信息，importance 填 0。
对话：\n${historyForExtraction}`;

        const resJSONStr = await callDeepSeekAPI(prompt, "你是一个只输出合法JSON的机器。", "flash", null, activeId);

        let t1Event = { importance: 0, summary: "", emotion: "neutral", confidence: "high" };
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
           showMsg(`⚡ 闪电更新：已感知到重大事件 [${t1Event.summary}]`);
           let newT3Str = "";
           setActivePersona(prev => {
             try {
               const t3 = JSON.parse(prev.content);
               t3.current_context = { value: t1Event.summary, expires_at: new Date(Date.now() + 7*24*3600*1000).toISOString() };
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
             } catch (err) { console.error('T3档案更新失败:', err); }
           }
         }

         if (db) {
           try {
             // DSM 2.2 标准 T1 记录：前端直写保证低延迟，同时保留旧字段用于云函数迁移期兼容
             const memoryRecord = buildT1MemoryRecord({
               personaId: activeId,
               t1Event,
               deviceFp: navigator.userAgent.substring(0, 64),
             });

             await db.collection('persona_memories').add(memoryRecord);

             // 尝试异步补齐 embedding；失败不影响聊天主链路和原始 T1 落库
             import('../../lib/cloudbase').then(({ cloudbase }) => {
               if (!cloudbase) return;
               cloudbase.callFunction({
                 name: 'vectorize',
                 data: { personaId: activeId, records: [memoryRecord] },
                 timeout: 15000,
               }).catch(vectorError => console.warn('T1 向量化补齐失败，保留原始结构化记忆:', vectorError));
             });

             console.log("✅ T1 深态记忆已成功写入 TCB 数据库并应用 DSM 2.2 结构化规范!");
           } catch (err) { console.error('记忆写入失败:', err); }
         }
       }
      } catch (error) {
        console.warn("Flash 提取中断:", error.message);
      }
    }, 10000);

    return () => clearTimeout(extractTimerRef.current);
  }, [messages, isTypingIndicator, activeId]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const userText = input.trim();
    if (!userText) return;

    setInput('');
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    const currentNonce = Date.now();
    generationNonce.current = currentNonce;

    if (window.__typingResolve) {
      window.__typingResolve();
      window.__typingResolve = null;
    }

    setMessages(prev => {
      const filtered = prev.filter(m => !(m.role === 'assistant' && m.isAnimated));
      return [...filtered, { id: currentNonce, role: 'user', text: userText, time: new Date().toLocaleTimeString() }];
    });

    // 👑 首席修复：重置 T3 last_chat_time，防止回归感知无限触发
    try {
      const t3 = JSON.parse(activePersona.content || '{}');
      if (t3.relationship) {
        t3.relationship.last_chat_time = new Date().toISOString();
        const updatedContent = JSON.stringify(t3);
        setActivePersona(prev => ({ ...prev, content: updatedContent }));

        import('../../lib/cloudbase').then(({ db }) => {
            if (db) db.collection('personas').doc(activeId).update({ content: updatedContent }).catch(() => {});
        });
      }
    } catch(err) { console.warn("更新最后聊天时间失败", err); }

    setIsTypingIndicator(true);
    if (extractTimerRef.current) clearTimeout(extractTimerRef.current);

    try {
      const hotT1 = getHotT1(activeId);
      const sysPrompt = buildSystemPrompt(activePersona, hotT1, isCooling, daysSinceLastChat);
      const allT0 = [...messages.filter(m => m.role !== 'system'), { role: 'user', text: userText }];
      const sysPromptLength = Math.ceil(sysPrompt.length / 1.5);
      const prunedT0 = applyBudgetAllocator(allT0, sysPromptLength, 3000);

      const chatHistoryStr = prunedT0.map(m =>
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text.replace(/<del>.*?<\/del>|<\/?recall>|\[quote:.*?\]/g, '')}`
      ).join('\n');

      const responseText = await callDeepSeekAPI(
        `对话历史:\n${chatHistoryStr}\n\nAssistant:`,
        sysPrompt,
        'pro',
        abortControllerRef.current.signal,
        activeId
      );

      if (generationNonce.current !== currentNonce) return;
      if (responseText.includes('[SILENCE]')) { setIsTypingIndicator(false); return; }

      // 👑 首席修复：彻底移除 - 和 = 切割，防止长文、代码块、Markdown 表格被行刑式打碎。强制只用 ||| 作为唯一分隔符。
      const replyParts = responseText.split(/\|\|\|/).map(s => s.trim()).filter(s => s);
      setIsTypingIndicator(false);

      for (let i = 0; i < replyParts.length; i++) {
        if (generationNonce.current !== currentNonce) break;

        setMessages(prev => [
          ...prev,
          { id: Date.now() + i, role: 'assistant', text: replyParts[i], time: new Date().toLocaleTimeString(), isAnimated: true }
        ]);

        if (i < replyParts.length - 1) {
          await new Promise(resolve => { window.__typingResolve = resolve; });
          await new Promise(r => setTimeout(r, 600));
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError' && generationNonce.current === currentNonce) {
        showMsg(`❌ 意识传输中断: ${error.message}`);
        setIsTypingIndicator(false);
      }
    }
  };

  const handleExtractTasks = async () => {
    setIsExtracting(true);
    try {
      const chatHistory = messages
        .filter(m => m.role !== 'system')
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text.replace(/<del>.*?<\/del>|<\/?recall>|\[quote:.*?\]/g, '')}`)
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
      showMsg("代办提取失败，请稍后重试。");
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="h-screen bg-slate-100 flex flex-col font-sans overflow-hidden">
      <ChatHeader
        activePersona={activePersona}
        isTypingIndicator={isTypingIndicator}
        isExtracting={isExtracting}
        handleExtractTasks={handleExtractTasks}
        setAppPhase={setAppPhase}
        setShowMemoryCabin={setShowMemoryCabin}
      />

      <ChatMessageList
        messages={messages}
        setMessages={setMessages}
        activePersona={activePersona}
        messagesEndRef={messagesEndRef}
      />

      <ChatInput
        input={input}
        setInput={setInput}
        handleSendMessage={handleSendMessage}
      />

      {showTasksModal && <TasksModal tasks={extractedTasks} onClose={() => setShowTasksModal(false)} />}
      {showMemoryCabin && (
        <MemoryCabin
          activePersona={activePersona}
          setActivePersona={setActivePersona}
          showMsg={showMsg}
          onClose={() => setShowMemoryCabin(false)}
        />
      )}
    </div>
  );
}
