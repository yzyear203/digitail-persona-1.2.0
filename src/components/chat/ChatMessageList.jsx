import React from 'react';
import { Quote, UserCircle } from 'lucide-react';
import TypingText from '../ui/TypingText';

function Avatar({ src, label, isUser, isDark }) {
  const fallbackClass = isUser
    ? 'bg-emerald-100 text-emerald-600'
    : 'bg-indigo-100 text-indigo-600';

  return (
    <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl overflow-hidden flex items-center justify-center shrink-0 shadow-sm ${src ? 'bg-white' : fallbackClass}`}>
      {src ? <img src={src} alt={label} className="w-full h-full object-cover" /> : <UserCircle size={26} className={isDark ? 'opacity-90' : ''} />}
    </div>
  );
}

export default function ChatMessageList({
  messages,
  setMessages,
  activePersona,
  messagesEndRef,
  onAssistantAnimationComplete,
  chatAppearance,
}) {
  const isDark = chatAppearance?.theme === 'dark';
  const assistantAvatar = activePersona?.avatarUrl || '';
  const userAvatar = chatAppearance?.userAvatar || '';
  const mainClass = isDark ? 'text-slate-100' : 'text-slate-800';
  const timeClass = isDark ? 'text-slate-400 bg-slate-900/50' : 'text-slate-400';
  const recallClass = isDark
    ? 'text-slate-300 bg-slate-800/80 border border-slate-700'
    : 'text-slate-500 bg-slate-200/60';

  return (
    <main className={`flex-1 overflow-y-auto p-4 md:p-8 ${mainClass}`}>
      {messages.map((m, index) => {
        if (m.role === 'system') return null;

        const isUser = m.role === 'user';
        const isRecallMsg = m.text.includes('<recall>');
        const quoteMatch = m.text.match(/\[quote:\s*(.*?)\]/);
        const quoteText = quoteMatch ? quoteMatch[1] : null;

        const actualText = m.text.replace(/<\/?recall>|\[quote:.*?\]/g, '').trim();
        const strippedText = actualText.replace(/<del>.*?<\/del>/g, '').trim();

        let showTime = false;
        const prevMsg = messages.slice(0, index).reverse().find(msg => msg.role !== 'system');
        if (!prevMsg || m.id - prevMsg.id > 300000) showTime = true;

        if (!strippedText && !m.isAnimated && !m.isRecalled) return null;

        const bubbleClass = isUser
          ? 'bg-[#95ec69] text-slate-900 rounded-tr-md'
          : isDark
            ? 'bg-slate-800 text-slate-50 border border-slate-700 rounded-tl-md'
            : 'bg-white text-slate-800 border border-slate-200 rounded-tl-md';
        const quoteClass = isDark
          ? 'bg-slate-900/60 border-emerald-400 text-slate-300'
          : 'bg-slate-100/70 border-indigo-400 text-slate-500';

        return (
          <React.Fragment key={m.id}>
            {showTime && (
              <div className="flex justify-center my-5">
                <span className={`text-xs font-medium px-2 py-1 rounded-md ${timeClass}`}>{m.time}</span>
              </div>
            )}

            {m.isRecalled ? (
              <div className="flex justify-center my-4">
                <span className={`text-xs font-medium px-3 py-1 rounded-md ${recallClass}`}>
                  "对方" 撤回了一条消息
                </span>
              </div>
            ) : (
              <div className={`flex items-start gap-3 mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <Avatar src={assistantAvatar} label={activePersona?.name || 'Persona'} isUser={false} isDark={isDark} />
                )}

                <div className={`max-w-[72%] px-5 py-3.5 rounded-2xl shadow-sm text-[15px] font-medium leading-relaxed ${bubbleClass}`}>
                  {quoteText && (
                    <div className={`mb-2 p-2 rounded-lg border-l-4 text-xs flex items-start gap-2 italic ${quoteClass}`}>
                      <Quote size={12} className="shrink-0 mt-0.5" />
                      <span className="truncate">{quoteText}</span>
                    </div>
                  )}

                  {m.role === 'assistant' && m.isAnimated ? (
                    <TypingText
                      content={actualText}
                      persona={m.typingPersona || activePersona?.content || ''}
                      scrollRef={messagesEndRef}
                      onComplete={() => {
                        if (isRecallMsg) {
                          setTimeout(() => {
                            setMessages(p => p.map(msg => msg.id === m.id ? { ...msg, isAnimated: false, isRecalled: true } : msg));
                          }, 1200);
                        } else {
                          setMessages(p => p.map(msg => msg.id === m.id ? { ...msg, isAnimated: false } : msg));
                        }
                        onAssistantAnimationComplete?.(m.id);
                      }}
                    />
                  ) : (
                    <span className="whitespace-pre-wrap">{strippedText}</span>
                  )}
                </div>

                {isUser && (
                  <Avatar src={userAvatar} label="我" isUser isDark={isDark} />
                )}
              </div>
            )}
          </React.Fragment>
        );
      })}
      <div ref={messagesEndRef} className="h-4"/>
    </main>
  );
}
