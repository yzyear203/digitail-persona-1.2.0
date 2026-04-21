import React, { useState, useRef, useEffect } from 'react';
import { UserCircle, Sparkles, Send, Loader2 } from 'lucide-react';
import TypingText from '../ui/TypingText';
import TasksModal from '../ui/TasksModal';
import { callDoubaoAPI } from '../../lib/api';

export default function ChatPage({ setAppPhase, messages, setMessages, activePersona, showMsg }) {
  const [input, setInput] = useState('');
  const [isTypingIndicator, setIsTypingIndicator] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [extractedTasks, setExtractedTasks] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const currentInteractionRef = useRef(0);
  const messagesEndRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTypingIndicator]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userText = input;
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: userText, time: new Date().toLocaleTimeString() }]);
    setInput('');
    const interactionId = Date.now();
    currentInteractionRef.current = interactionId;
    setIsTypingIndicator(true);
    setIsResponding(true);
    try {
      const chatHistory = messages.filter(m => m.role !== 'system').map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text.replace(/<del>.*?<\/del>/g, '')}`).join('\n');
      const responseText = await callDoubaoAPI(
        `对话历史:\n${chatHistory}\n\nUser: ${userText}\nAssistant:`,
        `你是一个数字备份人格。请严格遵循设定：\n${activePersona}\n输出中必须包含 <del>想删掉的话</del>！多条消息请用 "|||" 隔开。`
      );
      if (currentInteractionRef.current !== interactionId) return;
      
      // 🚀 核心修复：废除会导致穿帮的合并逻辑。每一段文字都是独立的气泡。
      const replyParts = responseText.split('|||').map(s => s.trim()).filter(s => s);
      
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
            <h1 className="text-xl font-black text-slate-800">数字分身</h1>
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
      <main className="flex-1 overflow-y-auto p-8 space-y-6">
        {messages.map(m => {
          // 🚀 核心修复：遇到系统设定的 prompt，直接不渲染它，防止出现空泡泡
          if (m.role === 'system') return null;

          const strippedText = m.text.replace(/<del>.*?<\/del>/g, '').trim();
          return (
            <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[75%] px-6 py-4 rounded-3xl shadow-sm text-[15px] font-medium leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'}`}>
                {m.role === 'assistant' && m.isAnimated
                  ? <TypingText content={m.text} persona={activePersona} scrollRef={messagesEndRef} onComplete={() => setMessages(p => p.map(msg => msg.id === m.id ? { ...msg, isAnimated: false } : msg))} />
                  : (strippedText ? strippedText : <span className="italic text-slate-400 text-sm">（撤回了一条消息）</span>)}
                <span className={`block text-[10px] mt-2 font-black opacity-50 ${m.role === 'user' ? 'text-indigo-100' : 'text-slate-400'}`}>{m.time}</span>
              </div>
            </div>
          );
        })}
        {isTypingIndicator && (
          <div className="flex gap-2 p-4 bg-white rounded-2xl w-fit">
            <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
          </div>
        )}
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
