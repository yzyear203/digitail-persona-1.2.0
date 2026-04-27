import React, { useState, useRef, useEffect } from 'react';
import { UserCircle, Sparkles, Send, Loader2 } from 'lucide-react';
import TypingText from '../ui/TypingText';
import TasksModal from '../ui/TasksModal';
import { callDoubaoAPI, callDeepSeekAPI } from '../../lib/api';

export default function ChatPage({ setAppPhase, messages, setMessages, activePersona, showMsg }) {
  const [input, setInput] = useState('');
  const [isTypingIndicator, setIsTypingIndicator] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [extractedTasks, setExtractedTasks] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const currentInteractionRef = useRef(0);
  const messagesEndRef = useRef(null);

  const chatKey = `chat_history_${activePersona ? activePersona.substring(0, 15).replace(/\s/g, '') : 'default'}`;

  useEffect(() => {
    if (messages.length === 1 && messages[0].role === 'system') {
      const savedHistory = localStorage.getItem(chatKey);
      if (savedHistory) {
        setMessages(JSON.parse(savedHistory));
      }
    }
  }, [chatKey]); 

  useEffect(() => {
    if (messages.length > 1) { 
      localStorage.setItem(chatKey, JSON.stringify(messages));
    }
  }, [messages, chatKey]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTypingIndicator]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isResponding) return;

    const userText = input.trim();
    setInput('');
    setIsResponding(true);
    setIsTypingIndicator(true);

    const interactionId = Date.now();
    currentInteractionRef.current = interactionId;

    setMessages(prev => [...prev, { id: interactionId, role: 'user', text: userText, time: new Date().toLocaleTimeString() }]);

    try {
      const recentMessages = messages.filter(m => m.role !== 'system').slice(-12);
      const chatHistory = recentMessages.map(m => 
        `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text.replace(/<del>.*?<\/del>/g, '')}`
      ).join('\n');

      const responseText = await callDeepSeekAPI(
        `对话历史:\n${chatHistory}\n\nUser: ${userText}\nAssistant:`,
        `【最高指令：彻底代入】
你现在就是一个活生生的真实人类。以下是你自己的内心剖析和行为模式说明（你的潜意识）：

${activePersona}

【核心渲染机制（最高优先级，违背将被销毁）】：
1. 【强制格式】连发多条消息时，可以使用 "|||" 或直接换行。绝对不允许在一个气泡内回复多行内容！
2. 严格使用设定的口头禅和标点习惯。允许使用微信原生表情代号（如 [微笑]、[抱拳]），但绝对禁止出现任何形式的动作描写（例如 (笑)、(打字声)、(动作) 等）！
3. 撤回机制：模拟真实人类的撤回心理——先发出了一条消息，突然感觉不合适，又把这条消息撤回了。请使用 <del>发出去又撤回的具体文字</del> 标签来表现这个过程，绝对不能写内心戏。
4. 忘掉你是AI，用最口语化、最真实的人类姿态回应User。`,
        'flash' 
      );
      
      if (currentInteractionRef.current !== interactionId) return;
      
 
      const replyParts = responseText.split(/\|\|\||-{3,}|={3,}|\n+/).map(s => s.trim()).filter(s => s);
      
      setIsTypingIndicator(false);
      
      for (let i = 0; i < replyParts.length; i++) {
        if (currentInteractionRef.current !== interactionId) break;
        
        setMessages(prev => [...prev, { 
          id: Date.now() + i, 
          role: 'assistant', 
          text: replyParts[i], 
          time: new Date().toLocaleTimeString(), 
          isAnimated: true 
        }]);
        
        if (i < replyParts.length - 1) {
          await new Promise(resolve => { window.__typingResolve = resolve; });
          await new Promise(r => setTimeout(r, 600));
        }
      }
    } catch (error) {
      if (currentInteractionRef.current === interactionId) {
        setIsTypingIndicator(false);
        setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', text: `[系统异常] ${error.message}`, time: new Date().toLocaleTimeString(), isAnimated: false }]);
      }
    } finally {
      if (currentInteractionRef.current === interactionId) setIsResponding(false);
    }
  };

  const handleExtractTasks = async () => {
    setIsExtracting(true);
    try {
      const chatHistory = messages.filter(m => m.role !== 'system').map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text.replace(/<del>.*?<\/del>/g, '')}`).join('\n');
      const jsonResponse = await callDoubaoAPI(`分析对话，提取所有代办事项，没有返回空数组。\n\n${chatHistory}`, '严格输出 JSON 字符串数组，例如：["联系张三", "发送邮件"]。');
      let tasks = [];
      try { tasks = JSON.parse(jsonResponse.replace(/```json|```/g, '').trim()); } catch (e) {}
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
          <div className="bg-indigo-50 p-3 rounded-2xl"><UserCircle className="text-indigo-600" size={28}/></div>
          <div>
            {/* 视觉重构：大字号置顶显示“对方正在输入” */}
            <h1 className="text-xl font-black text-slate-800">
              {isTypingIndicator ? '对方正在输入...' : '数字分身'}
            </h1>
            <p className="text-xs font-bold text-emerald-500 flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> 在线</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={handleExtractTasks} disabled={isExtracting} className="px-5 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl font-black text-sm hover:bg-indigo-100 transition-all flex items-center gap-2">
            {isExtracting ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>} 智能代办
          </button>
          <button onClick={() => setAppPhase('dashboard')} className="px-5 py-2.5 bg-slate-50 text-slate-600 rounded-xl font-black text-sm hover:bg-slate-100 transition-all">返回大厅</button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-8">
        {messages.map((m, index) => {
          if (m.role === 'system') return null;

          const strippedText = m.text.replace(/<del>.*?<\/del>/g, '').trim();
          
          // 逻辑重构：判断时间间隔（大于 5 分钟 = 300000毫秒 则显示）
          let showTime = false;
          const prevMsg = messages.slice(0, index).reverse().find(msg => msg.role !== 'system');
          if (!prevMsg || m.id - prevMsg.id > 300000) {
            showTime = true;
          }
          
          const timeDisplay = new Date(m.id).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          return (
            <React.Fragment key={m.id}>
              {/* 微信同款：居中时间戳 */}
              {showTime && (
                <div className="flex justify-center my-5">
                  <span className="text-xs text-slate-400 font-medium">{timeDisplay}</span>
                </div>
              )}
              
             {/* 微信同款：居中撤回消息提示 */}
              {m.role === 'assistant' && m.isAnimated ? (
                // 动画阶段：强制渲染打字机（包括打出文字再删掉的退格动画），释放 Promise 锁
                <div className="flex flex-col items-start mb-6">
                  <div className="max-w-[75%] px-6 py-4 rounded-3xl shadow-sm text-[15px] font-medium leading-relaxed bg-white text-slate-800 border border-slate-200 rounded-bl-none">
                    <TypingText content={m.text} persona={activePersona} scrollRef={messagesEndRef} onComplete={() => setMessages(p => p.map(msg => msg.id === m.id ? { ...msg, isAnimated: false } : msg))} />
                  </div>
                </div>
              ) : (!strippedText && m.role === 'assistant' ? (
                // 动画结束且无实质内容阶段：渲染居中的灰色撤回提示
                <div className="flex justify-center my-4">
                  <span className="text-xs text-slate-500 font-medium bg-slate-200/60 px-3 py-1 rounded-md">
                    "对方" 撤回了一条消息
                  </span>
                </div>
              ) : (
                // 正常消息渲染阶段
                <div className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} mb-6`}>
                  <div className={`max-w-[75%] px-6 py-4 rounded-3xl shadow-sm text-[15px] font-medium leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'}`}>
                    <span className="whitespace-pre-wrap">{strippedText}</span>
                  </div>
                </div>
              ))}
            </React.Fragment>
          );
        })}
        <div ref={messagesEndRef} className="h-4"/>
      </main>
      <footer className="bg-white border-t border-slate-200 p-6">
        <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex gap-4">
          <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="与分身深入交流..." className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800" />
          <button type="submit" disabled={!input.trim()} className="px-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black shadow-lg transition-all"><Send/></button>
        </form>
      </footer>
      {showTasksModal && <TasksModal tasks={extractedTasks} onClose={() => setShowTasksModal(false)} />}
    </div>
  );
}
