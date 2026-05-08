import React from 'react';
import { Quote } from 'lucide-react';
import TypingText from '../ui/TypingText';

export default function ChatMessageList({
  messages,
  setMessages,
  activePersona,
  messagesEndRef,
  onAssistantAnimationComplete
}) {
  return (
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
                      persona={activePersona?.content || ''}
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
              </div>
            )}
          </React.Fragment>
        );
      })}
      <div ref={messagesEndRef} className="h-4"/>
    </main>
  );
}
