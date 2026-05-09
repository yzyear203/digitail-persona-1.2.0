import React, { useEffect, useState } from 'react';
import { Quote, RotateCcw, UserCircle, X } from 'lucide-react';
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

function StickerBubble({ sticker, isUser, isDark }) {
  const label = sticker?.name || '表情包';
  return (
    <div className={`max-w-[46%] rounded-2xl p-2 shadow-sm ${isDark ? 'bg-slate-900/40' : 'bg-white/65'}`} title={label}>
      <img
        src={sticker?.url}
        alt={label}
        loading="lazy"
        className="max-w-[138px] md:max-w-[168px] max-h-[138px] md:max-h-[168px] object-contain rounded-xl"
        onError={event => {
          event.currentTarget.style.display = 'none';
        }}
      />
      <div className={`mt-1 text-[10px] font-bold truncate text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {isUser ? '我方表情' : 'Persona 表情'} · {sticker?.emotion || sticker?.name || 'BQB'}
      </div>
    </div>
  );
}

function cleanMessageText(message) {
  if (message?.type === 'sticker') {
    const sticker = message.sticker || {};
    return `[表情包:${sticker.meaning || sticker.emotion || sticker.name || '表情'}]`;
  }

  return String(message?.text || message || '')
    .replace(/<\/?recall>|\[quote:.*?\]/g, '')
    .replace(/<del>.*?<\/del>/g, '')
    .trim();
}

export default function ChatMessageList({
  messages,
  setMessages,
  activePersona,
  messagesEndRef,
  onAssistantAnimationComplete,
  chatAppearance,
  onQuoteMessage,
}) {
  const [contextMenu, setContextMenu] = useState(null);
  const isDark = chatAppearance?.theme === 'dark';
  const assistantAvatar = activePersona?.avatarUrl || '';
  const userAvatar = chatAppearance?.userAvatar || '';
  const mainClass = isDark ? 'text-slate-100' : 'text-slate-800';
  const timeClass = isDark ? 'text-slate-400 bg-slate-900/50' : 'text-slate-400';
  const recallClass = isDark
    ? 'text-slate-300 bg-slate-800/80 border border-slate-700'
    : 'text-slate-500 bg-slate-200/60';
  const menuClass = isDark
    ? 'bg-slate-900 border-slate-700 text-slate-100 shadow-black/30'
    : 'bg-white border-slate-200 text-slate-700 shadow-slate-300/50';

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, []);

  const openContextMenu = (event, message) => {
    event.preventDefault();
    event.stopPropagation();

    if (message.isAnimated || message.isRecalled) return;
    const text = cleanMessageText(message);
    if (!text) return;

    const menuWidth = 168;
    const menuHeight = 104;
    const x = Math.min(event.clientX, window.innerWidth - menuWidth - 12);
    const y = Math.min(event.clientY, window.innerHeight - menuHeight - 12);

    setContextMenu({
      x: Math.max(12, x),
      y: Math.max(12, y),
      message: { ...message, cleanText: text },
    });
  };

  const handleQuote = () => {
    if (!contextMenu?.message) return;
    onQuoteMessage?.({
      id: contextMenu.message.id,
      role: contextMenu.message.role,
      text: contextMenu.message.cleanText,
    });
    setContextMenu(null);
  };

  const handleRecall = () => {
    if (!contextMenu?.message) return;
    const targetId = contextMenu.message.id;
    setMessages(prev => prev.map(msg => msg.id === targetId ? { ...msg, isAnimated: false, isRecalled: true } : msg));
    setContextMenu(null);
  };

  return (
    <main className={`flex-1 overflow-y-auto p-4 md:p-8 ${mainClass}`}>
      {messages.map((m, index) => {
        if (m.role === 'system') return null;

        const isUser = m.role === 'user';
        const isSticker = m.type === 'sticker';
        const rawText = String(m.text || '');
        const isRecallMsg = rawText.includes('<recall>');
        const quoteMatch = rawText.match(/\[quote:\s*(.*?)\]/);
        const quoteText = quoteMatch ? quoteMatch[1] : null;

        const actualText = rawText.replace(/<\/?recall>|\[quote:.*?\]/g, '').trim();
        const strippedText = actualText.replace(/<del>.*?<\/del>/g, '').trim();

        let showTime = false;
        const prevMsg = messages.slice(0, index).reverse().find(msg => msg.role !== 'system');
        if (!prevMsg || m.id - prevMsg.id > 300000) showTime = true;

        if (!isSticker && !strippedText && !m.isAnimated && !m.isRecalled) return null;

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
                  {isUser ? '你' : '"对方"'} 撤回了一条消息
                </span>
              </div>
            ) : (
              <div className={`flex items-start gap-3 mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <Avatar src={assistantAvatar} label={activePersona?.name || 'Persona'} isUser={false} isDark={isDark} />
                )}

                {isSticker ? (
                  <div onContextMenu={event => openContextMenu(event, m)} className="cursor-default select-none">
                    <StickerBubble sticker={m.sticker} isUser={isUser} isDark={isDark} />
                  </div>
                ) : (
                  <div
                    onContextMenu={event => openContextMenu(event, m)}
                    className={`max-w-[72%] px-5 py-3.5 rounded-2xl shadow-sm text-[15px] font-medium leading-relaxed cursor-default select-text ${bubbleClass}`}
                  >
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
                )}

                {isUser && (
                  <Avatar src={userAvatar} label="我" isUser isDark={isDark} />
                )}
              </div>
            )}
          </React.Fragment>
        );
      })}

      {contextMenu && (
        <div
          className={`fixed z-[140] w-40 rounded-2xl border p-2 shadow-2xl ${menuClass}`}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={event => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleQuote}
            className="w-full px-3 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
          >
            <Quote size={15} /> 引用消息
          </button>
          <button
            type="button"
            onClick={handleRecall}
            className="w-full px-3 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <RotateCcw size={15} /> 撤回消息
          </button>
          <button
            type="button"
            onClick={() => setContextMenu(null)}
            className="w-full px-3 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 hover:bg-slate-100 transition-colors"
          >
            <X size={15} /> 取消
          </button>
        </div>
      )}

      <div ref={messagesEndRef} className="h-4"/>
    </main>
  );
}
