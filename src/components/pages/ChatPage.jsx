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
  
  // 🚀 新增：并发拦截唯一通行证 (Nonce)
  const generationNonce = useRef(0);
  const messagesEndRef = useRef(null);

  const chatKey = `chat_history_${activePersona ? activePersona.substring(0, 15).replace(/\s/g, '') : 'default'}`;

  useEffect(() => {
    if (messages.length === 1 && messages[0].role === 'system') {
      const savedHistory = localStorage.getItem(chatKey);
      if (savedHistory) setMessages(JSON.parse(savedHistory));
    }
  }, [chatKey]);

  useEffect(() => {
    if (messages.length > 1) {
      localStorage.setItem(chatKey, JSON.stringify(messages));
    }
  }, [messages, chatKey]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTypingIndicator]);

  const searchLocalHistory = (keyword) => {
    const results = messages
      .filter(m => m.role !== 'system' && m.text.includes(keyword))
      .slice(-5)
      .map(m => `[${m.time}] ${m.role === 'user' ? '用户' : '分身'}: ${m.text}`)
      .join('\n');
    return results || '未找到相关记忆。';
  };

  const handleSendMessage = async (e, forcedText = null) => {
    if (e) e.preventDefault();
    const userText = forcedText || input.trim();
    if (!userText) return;

    if (!forcedText) setInput('');
    
    // 🚀 核心机制：生成新的并发通行证
    const currentNonce = Date.now();
    generationNonce.current = currentNonce;

    // 🚀 核心机制：强行释放被上一轮打断遗留的全局动画锁
    if (window.__typingResolve) {
      window.__typingResolve();
      window.__typingResolve = null;
    }

    // 🚀 核心机制：强行打断！如果当前 AI 正在打字，直接将正在打字的气泡全部“删掉”（拦截渲染）
    setMessages(prev => {
      const filtered = prev.filter(m => !(m.role === 'assistant' && m.isAnimated));
      return [...filtered, { id: currentNonce, role: 'user', text: userText, time: new Date().toLocaleTimeString() }];
    });

    setIsTypingIndicator(true);

    try {
      // 🚀 滑动窗口扩大至 8 条，给予 AI 更充足的短期记忆来判断是否沉默
      const recentMessages = messages.filter(m => m.role !== 'system').slice(-8);
      
      const chatHistory = recentMessages.map(m => 
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text.replace(/<del>.*?<\/del>|<\/?recall>|\[quote:.*?\]/g, '')}`
      ).join('\n');

      const responseText = await callDeepSeekAPI(
        `对话历史:\n${chatHistory}\n\nUser: ${userText}\nAssistant:`,
        `【最高指令：深度灵魂模拟】
你现在是具备独立人格的数字生命。你的潜意识设定如下：
${activePersona}

【高级交互协议（违背将被重置）】：
1. 【回复策略（极高优先级）】：你必须优先回复用户最新发来的消息，挑好回复的回复。没必要每条消息都回！如果觉得没必要回、不想回，请直接输出 [SILENCE] 保持沉默。
2. 【引用机制】：你可以选择性地引用用户之前的某句话进行针对性回复。格式：[quote: 原文内容] 你的回复。注意：引用频率要适中。
3. 【检索机制】：如果用户提到“我之前说过吗”或询问过去信息，你必须输出 [RETRIEVE: 关键词] 来唤醒记忆搜索。
4. 【强制格式】：单气泡不允许换行。并发多消息请用 "|||" 切分。
5. 【拟人化】：撤回使用 <recall>...</recall>，犹豫使用 <del>...</del>。禁止任何动作描写。`,
        'flash'
      );

      // 🚀 拦截网：如果 API 回来时，用户已经发了新消息（Nonce 被篡改），直接丢弃该废弃响应！彻底消灭章鱼！
      if (generationNonce.current !== currentNonce) return;

      if (responseText.includes('[SILENCE]')) {
        setIsTypingIndicator(false);
        return;
      }

      if (responseText.includes('[RETRIEVE:')) {
        const keyword = responseText.match(/\[RETRIEVE:\s*(.*?)\]/)?.[1];
        const memory = searchLocalHistory(keyword);
        handleSendMessage(null, `（系统提示：已检索到相关记忆如下）\n${memory}\n请根据以上记忆重新回应我之前的询问。`);
        return;
      }

      const replyParts = responseText.split(/\|\|\||-{3,}|={3,}|\n+/).map(s => s.trim()).filter(s => s);
      setIsTypingIndicator(false);
      
      for (let i = 0; i < replyParts.length; i++) {
        // 🚀 循环内二次拦截：防止在 await 延迟动画期间用户乱入
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
      if (generationNonce.current === currentNonce) {
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
