import React, { useState, useRef, useEffect } from 'react';
import ChatHeader from '../chat/ChatHeader';
import ChatMessageList from '../chat/ChatMessageList';
import ChatInput from '../chat/ChatInput';
import TasksModal from '../ui/TasksModal';
import MemoryCabin from '../ui/MemoryCabin'; // 👑 引入新舱体
import { callDoubaoAPI, callDeepSeekAPI } from '../../lib/api';
import { hasContentSignal, getHotT1, saveToHotT1Cache, buildSystemPrompt, applyBudgetAllocator } from '../../lib/dsm'; 

export default function ChatPage({ setAppPhase, messages, setMessages, activePersona, setActivePersona, showMsg }) {
  const [input, setInput] = useState('');
  const [isTypingIndicator, setIsTypingIndicator] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [showMemoryCabin, setShowMemoryCabin] = useState(false); // 👑 透明舱开关
  const [extractedTasks, setExtractedTasks] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);
  
  const generationNonce = useRef(0);
// ...
  const activeId = activePersona?.id || 'default';
  const chatKey = `chat_history_${activeId}`;

  // 👑 计算冷却期与回归天数
  let daysSinceLastChat = 0;
  let isCooling = false;
  try {
    const t3 = JSON.parse(activePersona?.content || '{}');
    if (t3.relationship?.last_chat_time) {
      daysSinceLastChat = Math.floor((Date.now() - new Date(t3.relationship.last_chat_time).getTime()) / (1000 * 3600 * 24));
    }
    if (t3.relationship?.bond_momentum === 'cooling') isCooling = true;
  } catch(e) {}

  // 1. 初始化与持久化
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

  // ==========================================
  // ⚡ DSM 引擎：机制①守门人 + 机制⑤闪电通道
  // ==========================================
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

        const prompt = `分析以下最新对话，提取极具价值的【增量记忆】（如新计划、新事实、情绪剧变）。
严禁提取无意义的日常。必须以第三人称陈述。
严格按下方JSON输出：
{ "importance": 8, "summary": "用户打算五一去华山" }
如果没有硬核信息，importance 填 0，summary 留空。
对话：\n${historyForExtraction}`;

        const resJSONStr = await callDeepSeekAPI(prompt, "你是一个只输出合法JSON的机器。", "flash", null, activeId);
        
        let t1Event = { importance: 0, summary: "" };
        try { t1Event = JSON.parse(resJSONStr.replace(/```json|```/g, '').trim()); } catch (e) { return; }

       if (t1Event.importance > 0 && t1Event.summary) {
          // A. 写入前端 localStorage 热态缓存
          saveToHotT1Cache(activeId, t1Event.summary);
          
          const { cloudbase } = await import('../../lib/cloudbase');

          // B. 【新增】蓝图机制⑤：闪电通道更新 T3 核心状态
          if (t1Event.importance >= 8) {
            showMsg(`⚡ 闪电更新：已感知到重大事件 [${t1Event.summary}]`);
            // 👑 前端静默同步 T3 状态
            setActivePersona(prev => {
              try {
                const t3 = JSON.parse(prev.content);
                t3.current_context = { value: t1Event.summary, expires_at: new Date(Date.now() + 7*24*3600*1000).toISOString() };
                return { ...prev, content: JSON.stringify(t3) };
              } catch(e) { return prev; }
            });
            await cloudbase.callFunction({
              name: 'update_t3_context',
              data: { personaId: activeId, currentContext: t1Event.summary }
            });
          }

          // C. 同步给云端向量库（T2 储备）
          await cloudbase.callFunction({
            name: 'vectorize_memory',
            data: { personaId: activeId, memories: [t1Event.summary] }
          });
        }
      } catch (error) {
        console.warn("Flash 提取中断:", error.message);
      }
    }, 10000); 

    return () => clearTimeout(extractTimerRef.current);
  }, [messages, isTypingIndicator, activeId]);

  
  // ==========================================
  // 💬 发送中枢：机制③ 动态预算与 System Prompt 直注
  // ==========================================
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

    setIsTypingIndicator(true);
    if (extractTimerRef.current) clearTimeout(extractTimerRef.current);

    try {
      const hotT1 = getHotT1(activeId);
      // 👑 传入真实计算的冷却与回归参数
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

      const replyParts = responseText.split(/\|\|\||-{3,}|={3,}|\n+/).map(s => s.trim()).filter(s => s);
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
      try { tasks = JSON.parse(jsonResponse.replace(/```json|```/g, '').trim()); } 
      catch (e) {}
      
      setExtractedTasks(tasks);
      setShowTasksModal(true);
    } catch (error) {
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
        setShowMemoryCabin={setShowMemoryCabin} // 👑 传入回调
      />
// ...
      <ChatInput 
        input={input} 
        setInput={setInput} 
        handleSendMessage={handleSendMessage} 
      />
      
      {showTasksModal && <TasksModal tasks={extractedTasks} onClose={() => setShowTasksModal(false)} />}
      {/* 👑 渲染记忆透明舱 */}
      {showMemoryCabin && <MemoryCabin activePersona={activePersona} onClose={() => setShowMemoryCabin(false)} />}
    </div>
  );
