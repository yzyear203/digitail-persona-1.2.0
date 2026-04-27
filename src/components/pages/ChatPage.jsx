import React, { useState, useRef, useEffect } from 'react';
import { UserCircle, Sparkles, Send, Loader2, Quote } from 'lucide-react';
import TypingText from '../ui/TypingText';
import TasksModal from '../ui/TasksModal';
import { callDoubaoAPI, callDeepSeekAPI } from '../../lib/api';

export default function ChatPage({ setAppPhase, messages, setMessages, activePersona, showMsg }) {
  const [input, setInput] = useState('');
  const [isTypingIndicator, setIsTypingIndicator] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [extractedTasks, setExtractedTasks] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);
  
  const generationNonce = useRef(0);
  const abortControllerRef = useRef(null); 
  const messagesEndRef = useRef(null);
  const memoryExtractionTimerRef = useRef(null); // 🚀 旁路静默记忆提取定时器

  const activeId = activePersona ? activePersona.substring(0, 15).replace(/\s/g, '') : 'default';
  const chatKey = `chat_history_${activeId}`;
  const memoryKey = `chat_memory_${activeId}`;

  // 初始化加载历史聊天
  useEffect(() => {
    if (messages.length === 1 && messages[0].role === 'system') {
      const savedHistory = localStorage.getItem(chatKey);
      if (savedHistory) setMessages(JSON.parse(savedHistory));
    }
  }, [chatKey]);

  // 历史记录持久化
  useEffect(() => {
    if (messages.length > 1) {
      localStorage.setItem(chatKey, JSON.stringify(messages));
    }
  }, [messages, chatKey]);

  // 自动滚动到底部
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTypingIndicator]);

  // 🚀 核心重构：三级记忆引擎 - 旁路静默提炼与持久化存储
  useEffect(() => {
    if (messages.length < 3) return; // 聊天数据太少时不触发
    
    // 防抖：用户连续聊天时不提取，停顿 10 秒后触发静默整理
    if (memoryExtractionTimerRef.current) clearTimeout(memoryExtractionTimerRef.current);
    
    memoryExtractionTimerRef.current = setTimeout(async () => {
      try {
        const historyForExtraction = messages
          .filter(m => m.role !== 'system')
          .slice(-15) // 取最近 15 条供大模型提炼
          .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text.replace(/<del>.*?<\/del>|<\/?recall>|\[quote:.*?\]/g, '')}`)
          .join('\n');

        const prompt = `分析以下对话，提取 User(用户) 和 Assistant(分身/你) 双方透露的最新增量记忆。请务必在每条记忆前标明主语（例如：[用户] 或 [分身]）。严格按下方JSON格式输出（必须纯JSON，无Markdown）：
{
  "transient_states": ["双方身体/情绪/当前状态，如'[用户]今天拉肚子了', '[分身]感觉有点累'"],
  "recent_events": ["双方近期发生的事情，如'[用户]刚吃完火锅', '[分身]刚才去开会了'"],
  "core_traits": ["双方深层性格/身份/设定，如'[用户]喜欢存在主义', '[分身]是一个嘴硬心软的人'"]
}
如果没有任何新信息，对应的数组留空即可。
对话记录：\n${historyForExtraction}`;

        // 使用 Flash 模型快速处理后台任务，无需 signal，因为它不应该被用户打字阻断
        const resJSONStr = await callDeepSeekAPI(prompt, "你是一个极简的信息提取机，只输出合法JSON。", "flash", null);
        
        let newMemory = { transient_states: [], recent_events: [], core_traits: [] };
        try { newMemory = JSON.parse(resJSONStr.replace(/```json|```/g, '').trim()); } catch (e) { return; }

        // 读取现有记忆库
        let existingMemory = { transient_states: [], recent_events: [], core_traits: [] };
        const savedMem = localStorage.getItem(memoryKey);
        if (savedMem) existingMemory = JSON.parse(savedMem);

        const now = Date.now();
        // 过滤已过期的记忆 (状态 24h, 事件 3d)
        existingMemory.transient_states = existingMemory.transient_states.filter(item => item.expires > now);
        existingMemory.recent_events = existingMemory.recent_events.filter(item => item.expires > now);

        // 查重并合并新记忆 (TTL：状态86400000ms，事件259200000ms，特质永久)
        const mergeMemory = (target, newItems, ttl) => {
          if (!newItems || !Array.isArray(newItems)) return;
          newItems.forEach(text => {
            if (!target.some(item => item.text === text)) {
              target.push({ text, expires: ttl ? now + ttl : null });
            }
          });
        };

        mergeMemory(existingMemory.transient_states, newMemory.transient_states, 86400000);
        mergeMemory(existingMemory.recent_events, newMemory.recent_events, 259200000);
        mergeMemory(existingMemory.core_traits, newMemory.core_traits, null);

        // 控制容量上限，防止撑爆 Prompt
        existingMemory.transient_states = existingMemory.transient_states.slice(-5);
        existingMemory.recent_events = existingMemory.recent_events.slice(-5);
        existingMemory.core_traits = existingMemory.core_traits.slice(-10);

        localStorage.setItem(memoryKey, JSON.stringify(existingMemory));
        console.log("🧠 三级记忆库已在后台静默更新！");
      } catch (error) {
        // 静默失败不打扰用户
      }
    }, 10000); 

    return () => clearTimeout(memoryExtractionTimerRef.current);
  }, [messages, memoryKey]);

  // 🚀 读取有效记忆并格式化为潜意识 Prompt
  const getSubconsciousMemoryContext = () => {
    const savedMem = localStorage.getItem(memoryKey);
    if (!savedMem) return "";
    let mem = JSON.parse(savedMem);
    const now = Date.now();
    
    const states = mem.transient_states.filter(i => i.expires > now).map(i => i.text).join('；');
    const events = mem.recent_events.filter(i => i.expires > now).map(i => i.text).join('；');
    const traits = mem.core_traits.map(i => i.text).join('；');

    let context = "";
    if (states || events || traits) {
      context += "【你与用户的长期潜意识记忆库（包含双方状态，必须牢记且自然运用）】：\n";
      if (states) context += `- 双方当前状态(24h内)：${states}\n`;
      if (events) context += `- 双方近期事件(3天内)：${events}\n`;
      if (traits) context += `- 双方深层思想/偏好(永久)：${traits}\n`;
    }
    return context;
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const userText = input.trim();
    if (!userText) return;

    setInput('');
    
    // 🛑 物理阻断机制
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
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

    try {
      // 🚀 恢复人类工作记忆机制：主窗口仅限最近 8 条交互！
      const recentMessages = messages.filter(m => m.role !== 'system').slice(-8);
      const chatHistoryStr = recentMessages.map(m => 
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text.replace(/<del>.*?<\/del>|<\/?recall>|\[quote:.*?\]/g, '')}`
      ).join('\n');

      // 读取三级记忆库
      const memoryContextStr = getSubconsciousMemoryContext();

      const responseText = await callDeepSeekAPI(
        `对话历史:\n${chatHistoryStr}\n\nUser: ${userText}\nAssistant:`,
        `【最高指令：深度灵魂模拟】
你现在是具备独立人格的数字生命。潜意识设定如下：
${activePersona}

${memoryContextStr}
【高级交互协议（违背将被重置）】：
1. 【回复策略】：优先回复最新消息，没必要每句都回。不想回直接输出 [SILENCE]。
2. 【引用机制】：选择性回复格式 [quote: 原文内容]。
3. 【语义记忆】：综合你的【潜意识记忆库】和【对话历史】，进行强大的语义关联（如自动将用户的“不舒服”与记忆库里的“拉肚子”关联起来），自然地回答。
4. 【强制格式】：单气泡不允许换行。并发多消息请用 "|||" 切分。
5. 【拟人化】：撤回使用 <recall>...</recall>，犹豫使用 <del>...</del>。禁止任何动作描写。`,
        'flash',
        abortControllerRef.current.signal 
      );

      if (generationNonce.current !== currentNonce) return;

      if (responseText.includes('[SILENCE]')) {
        setIsTypingIndicator(false);
        return;
      }

      const replyParts = responseText.split(/\|\|\||-{3,}|={3,}|\n+/).map(s => s.trim()).filter(s => s);
      setIsTypingIndicator(false);
      
      for (let i = 0; i < replyParts.length; i++) {
        if (generationNonce.current !== currentNonce) break;

        setMessages(prev => [
          ...prev, 
          { 
            id: Date.now() + i, 
            role: 'assistant', 
            text: replyParts[i], 
            time: new Date().toLocaleTimeString(), 
            isAnimated: true 
          }
        ]);
        
        if (i < replyParts.length - 1) {
          await new Promise(resolve => { window.__typingResolve = resolve; });
          await new Promise(r => setTimeout(r, 600));
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('🛑 请求已按预期被前端物理阻断');
      } else if (generationNonce.current === currentNonce) {
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
      catch (e) { console.warn('JSON 解析失败', e); }
      
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
      <header className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-50 p-3 rounded-2xl">
            <UserCircle className="text-indigo-600" size={28}/>
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800">
              {isTypingIndicator ? '对方正在输入...' : '数字分身'}
            </h1>
            <p className="text-xs font-bold text-emerald-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> 在线
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={handleExtractTasks} 
            disabled={isExtracting} 
            className="px-5 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl font-black text-sm hover:bg-indigo-100 transition-all flex items-center gap-2"
          >
            {isExtracting ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>} 智能代办
          </button>
          <button 
            onClick={() => setAppPhase('dashboard')} 
            className="px-5 py-2.5 bg-slate-50 text-slate-600 rounded-xl font-black text-sm hover:bg-slate-100 transition-all"
          >
            返回大厅
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-8">
        {messages.map((m, index) => {
          if (m.role === 'system') return null;

          const isRecallMsg = m.text.includes('<recall>');
          const quoteMatch = m.text.match(/\[quote:\s*(.*?)\]/);
          const quoteText = quoteMatch ? quoteMatch[1] : null;
          
          const actualText = m.text.replace(/<\/?recall>|\[quote:.*?\]/g, '').trim();
          const strippedText = actualText.replace(/<del>.*?<\/del>/g, '').trim();
          
          let showTime = false;
          const prevMsg = messages.slice(0, index).reverse().find(msg => msg.role !== 'system');
          if (!prevMsg || m.id - prevMsg.id > 300000) showTime = true;
          
          if (!strippedText && !m.isAnimated && !m.isRecalled) return null;

          return (
            <React.Fragment key={m.id}>
              {showTime && (
                <div className="flex justify-center my-5">
                  <span className="text-xs text-slate-400 font-medium">{m.time}</span>
                </div>
              )}
              
              {m.isRecalled ? (
                <div className="flex justify-center my-4">
                  <span className="text-xs text-slate-500 font-medium bg-slate-200/60 px-3 py-1 rounded-md">
                    "对方" 撤回了一条消息
                  </span>
                </div>
              ) : (
                <div className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} mb-6`}>
                  <div className={`max-w-[75%] px-6 py-4 rounded-3xl shadow-sm text-[15px] font-medium leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'}`}>
                    
                    {quoteText && (
                      <div className="mb-2 p-2 bg-slate-100/50 rounded-lg border-l-4 border-indigo-400 text-xs text-slate-500 flex items-start gap-2 italic">
                        <Quote size={12} className="shrink-0 mt-0.5" />
                        <span className="truncate">{quoteText}</span>
                      </div>
                    )}
                    
                    {m.role === 'assistant' && m.isAnimated ? (
                      <TypingText 
                        content={actualText} 
                        persona={activePersona} 
                        scrollRef={messagesEndRef} 
                        onComplete={() => {
                          if (isRecallMsg) {
                            setTimeout(() => {
                              setMessages(p => p.map(msg => msg.id === m.id ? { ...msg, isAnimated: false, isRecalled: true } : msg));
                            }, 1200);
                          } else {
                            setMessages(p => p.map(msg => msg.id === m.id ? { ...msg, isAnimated: false } : msg));
                          }
                        }} 
                      />
                    ) : (
                      <span className="whitespace-pre-wrap">{strippedText}</span>
                    )}
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} className="h-4"/>
      </main>

      <footer className="bg-white border-t border-slate-200 p-6">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-4">
          <input 
            type="text" 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            placeholder="与分身深入交流..." 
            className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800" 
          />
          <button 
            type="submit" 
            disabled={!input.trim()} 
            className="px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black shadow-lg transition-all"
          >
            <Send/>
          </button>
        </form>
      </footer>
      
      {showTasksModal && <TasksModal tasks={extractedTasks} onClose={() => setShowTasksModal(false)} />}
    </div>
  );
}
