import React, { useEffect, useState } from 'react';
import { CheckSquare, Quote, RotateCcw, Square, UserCircle, X } from 'lucide-react';
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

function MessageActionButton({ children, onClick, danger = false, disabled = false }) {
  const colorClass = danger
    ? 'text-rose-600 hover:bg-rose-50 disabled:text-rose-300'
    : 'text-slate-600 hover:bg-slate-100 disabled:text-slate-300';

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors disabled:cursor-not-allowed ${colorClass}`}
    >
      {children}
    </button>
  );
}

export default function ChatMessageList({
  messages,
  setMessages,
  activePersona,
  messagesEndRef,
  onAssistantAnimationComplete,
  chatAppearance,
  onQuoteMessage,
  onRecallUserMessage,
  isSelectingUserMessages = false,
  selectedUserMessageIds = new Set(),
  onToggleUserMessageSelection,
  onStartUserMessageSelection,
  onCancelUserMessageSelection,
  onRecallSelectedUserMessages,
}) {
  const [contextMenu, setContextMenu] = useState(null);
  const isDark = chatAppearance?.theme === 'dark';
  const assistantAvatar = activePersona?.avatarUrl || '';
  const userAvatar = chatAppearance?.userAvatar || '';
  const selectedCount = selectedUserMessageIds?.size || 0;
  const mainClass = isDark ? 'text-slate-100' : 'text-slate-800';
  const timeClass = isDark ? 'text-slate-400 bg-slate-900/50' : 'text-slate-400';
  const recallClass = isDark
    ? 'text-slate-300 bg-slate-800/80 border border-slate-700'
    : 'text-slate-500 bg-slate-200/60';
  const actionBarClass = isDark
    ? 'bg-slate-900/95 border-slate-700 shadow-black/30'
    : 'bg-white/95 border-slate-200 shadow-slate-200/80';
  const selectionBarClass = isDark
    ? 'bg-slate-900/95 border-slate-700 text-slate-100 shadow-black/30'
    : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-200/80';

  useEffect(() => {
    if (!contextMenu) return undefined;

    const closeMenu = () => setContextMenu(null);
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') closeMenu();
    };

    window.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextMenu]);

  const openContextMenu = (event, message) => {
    const rawText = String(message?.text || '');
    const actualText = rawText.replace(/<\/?recall>|\[quote:.*?\]/g, '').trim();
    const strippedText = actualText.replace(/<del>[\s\S]*?<\/del>/g, '').trim();
    const isActionable = Boolean(strippedText) && !message?.isRecalled;

    if (!isActionable) return;

    event.preventDefault();
    event.stopPropagation();

    const menuWidth = 176;
    const menuHeight = message.role === 'user' ? 150 : 58;
    const safeX = Math.min(event.clientX, window.innerWidth - menuWidth - 12);
    const safeY = Math.min(event.clientY, window.innerHeight - menuHeight - 12);

    setContextMenu({
      message,
      x: Math.max(12, safeX),
      y: Math.max(12, safeY),
    });
  };

  const runContextAction = (action) => {
    const message = contextMenu?.message;
    setContextMenu(null);
    if (!message) return;
    action(message);
  };

  return (
    <main className={`flex-1 overflow-y-auto p-4 md:p-8 ${mainClass}`} onContextMenu={() => setContextMenu(null)}>
      {messages.map((m, index) => {
        if (m.role === 'system') return null;

        const rawText = String(m.text || '');
        const isUser = m.role === 'user';
        const isRecallMsg = rawText.includes('<recall>');
        const quoteMatch = rawText.match(/\[quote:\s*(.*?)\]/);
        const quoteText = quoteMatch ? quoteMatch[1] : null;

        const actualText = rawText.replace(/<\/?recall>|\[quote:.*?\]/g, '').trim();
        const strippedText = actualText.replace(/<del>[\s\S]*?<\/del>/g, '').trim();
        const isActionable = Boolean(strippedText) && !m.isRecalled;
        const isSelectableUserMessage = isUser && isActionable;
        const isSelected = isSelectableUserMessage && selectedUserMessageIds?.has(m.id);

        let showTime = false;
        const prevMsg = messages.slice(0, index).reverse().find(msg => msg.role !== 'system');
        if (!prevMsg || m.id - prevMsg.id > 300000) showTime = true;

        if (!strippedText && !m.isAnimated && !m.isRecalled) return null;

        const bubbleClass = isUser
          ? 'bg-[#95ec69] text-slate-900 rounded-tr-md'
          : isDark
            ? 'bg-slate-800 text-slate-50 border border-slate-700 rounded-tl-md'
            : 'bg-white text-slate-800 border border-slate-200 rounded-tl-md';
        const quoteClass = isUser
          ? 'bg-white/40 border-emerald-500 text-slate-700'
          : isDark
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
                  {isUser ? '你撤回了一条消息' : '"对方" 撤回了一条消息'}
                </span>
              </div>
            ) : (
              <div className={`flex items-start gap-3 mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <Avatar src={assistantAvatar} label={activePersona?.name || 'Persona'} isUser={false} isDark={isDark} />
                )}

                {isSelectingUserMessages && isUser && (
                  <button
                    type="button"
                    disabled={!isSelectableUserMessage}
                    onClick={() => onToggleUserMessageSelection?.(m.id)}
                    className={`mt-3 rounded-xl p-1.5 transition-colors ${isSelected ? 'text-emerald-500' : 'text-slate-400'} disabled:opacity-30 disabled:cursor-not-allowed`}
                    aria-label={isSelected ? '取消选择这条消息' : '选择这条消息'}
                  >
                    {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                  </button>
                )}

                <div
                  className={`relative max-w-[72%] ${isSelectingUserMessages && isSelectableUserMessage ? 'cursor-pointer' : 'cursor-default'}`}
                  onClick={() => {
                    if (isSelectingUserMessages && isSelectableUserMessage) onToggleUserMessageSelection?.(m.id);
                  }}
                  onContextMenu={event => openContextMenu(event, m)}
                >
                  <div className={`px-5 py-3.5 rounded-2xl shadow-sm text-[15px] font-medium leading-relaxed transition-all ${bubbleClass} ${isSelected ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-transparent' : ''}`}>
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
                </div>

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
          className={`fixed z-50 w-44 rounded-xl border p-1.5 shadow-2xl backdrop-blur ${actionBarClass}`}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={event => event.stopPropagation()}
          onContextMenu={event => event.preventDefault()}
        >
          <MessageActionButton onClick={() => runContextAction(message => onQuoteMessage?.(message))}>
            <Quote size={15} /> 引用
          </MessageActionButton>
          {contextMenu.message.role === 'user' && (
            <>
              <MessageActionButton danger onClick={() => runContextAction(message => onRecallUserMessage?.(message.id))}>
                <RotateCcw size={15} /> 撤回
              </MessageActionButton>
              <MessageActionButton onClick={() => runContextAction(message => onStartUserMessageSelection?.(message.id))}>
                <CheckSquare size={15} /> 多选
              </MessageActionButton>
            </>
          )}
        </div>
      )}

      {isSelectingUserMessages && (
        <div className="sticky bottom-4 z-30 flex justify-center pointer-events-none">
          <div className={`pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur ${selectionBarClass}`}>
            <span className="text-sm font-black">已选择 {selectedCount} 条</span>
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={onRecallSelectedUserMessages}
              className="px-3 py-2 rounded-xl bg-rose-500 text-white text-sm font-black hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              撤回所选
            </button>
            <button
              type="button"
              onClick={onCancelUserMessageSelection}
              className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-black hover:bg-slate-200 transition-colors"
            >
              <X size={14} className="inline mr-1" />取消
            </button>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} className="h-4"/>
    </main>
  );
}
