import React, { useEffect, useRef, useState } from 'react';
import { Check, CopyCheck, Quote, RotateCcw, Trash2, UserCircle, X } from 'lucide-react';
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
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const longPressTimerRef = useRef(null);
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
  const toolbarClass = isDark
    ? 'bg-slate-950/95 border-slate-800 text-slate-100'
    : 'bg-white/95 border-slate-200 text-slate-800';

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  const selectableMessages = messages.filter(message => message.role !== 'system' && !message.isRecalled && !message.isAnimated && !message.isDeletedForUser);
  const selectedCount = selectedIds.length;
  const selectedUserCount = messages.filter(message => selectedIds.includes(message.id) && message.role === 'user').length;

  const clearSelection = () => {
    setSelectedIds([]);
    setIsMultiSelect(false);
  };

  const toggleSelect = messageId => {
    setSelectedIds(prev => prev.includes(messageId) ? prev.filter(id => id !== messageId) : [...prev, messageId]);
  };

  const enterMultiSelect = message => {
    if (!message || message.isAnimated || message.isRecalled || message.isDeletedForUser) return;
    setContextMenu(null);
    setIsMultiSelect(true);
    setSelectedIds(prev => prev.includes(message.id) ? prev : [...prev, message.id]);
  };

  const openContextMenuAt = (xPoint, yPoint, message) => {
    if (message.isAnimated || message.isRecalled || message.isDeletedForUser) return;
    const text = cleanMessageText(message);
    if (!text) return;

    const menuWidth = 168;
    const menuHeight = message.role === 'user' ? 150 : 120;
    const x = Math.min(xPoint, window.innerWidth - menuWidth - 12);
    const y = Math.min(yPoint, window.innerHeight - menuHeight - 12);

    setContextMenu({
      x: Math.max(12, x),
      y: Math.max(12, y),
      message: { ...message, cleanText: text },
    });
  };

  const openContextMenu = (event, message) => {
    event.preventDefault();
    event.stopPropagation();
    openContextMenuAt(event.clientX, event.clientY, message);
  };

  const startLongPress = (event, message) => {
    if (isMultiSelect || message.isAnimated || message.isRecalled || message.isDeletedForUser) return;
    const touch = event.touches?.[0];
    const x = touch?.clientX || event.clientX || window.innerWidth / 2;
    const y = touch?.clientY || event.clientY || window.innerHeight / 2;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      openContextMenuAt(x, y, message);
    }, 520);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
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

  const recallMessageIds = ids => {
    const idSet = new Set(ids);
    setMessages(prev => prev.map(msg => (
      idSet.has(msg.id) && msg.role === 'user'
        ? { ...msg, isAnimated: false, isRecalled: true }
        : msg
    )));
  };

  const deleteMessageIdsForUser = ids => {
    const idSet = new Set(ids);
    setMessages(prev => prev.map(msg => idSet.has(msg.id) ? { ...msg, isDeletedForUser: true } : msg));
  };

  const handleRecall = () => {
    if (!contextMenu?.message || contextMenu.message.role !== 'user') return;
    recallMessageIds([contextMenu.message.id]);
    setContextMenu(null);
  };

  const handleDelete = () => {
    if (!contextMenu?.message) return;
    deleteMessageIdsForUser([contextMenu.message.id]);
    setContextMenu(null);
  };

  const handleMultiRecall = () => {
    if (!selectedUserCount) return;
    recallMessageIds(selectedIds);
    clearSelection();
  };

  const handleMultiDelete = () => {
    if (!selectedIds.length) return;
    deleteMessageIdsForUser(selectedIds);
    clearSelection();
  };

  const selectAll = () => {
    setSelectedIds(selectableMessages.map(message => message.id));
  };

  return (
    <main className={`flex-1 overflow-y-auto p-4 md:p-8 ${mainClass}`}>
      {isMultiSelect && (
        <div className={`sticky top-0 z-[120] mb-4 rounded-2xl border px-3 py-3 shadow-xl backdrop-blur ${toolbarClass}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-black">已选择 {selectedCount} 条</div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={selectAll} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-black flex items-center gap-1">
                <CopyCheck size={14} /> 全选
              </button>
              <button type="button" onClick={handleMultiDelete} disabled={!selectedCount} className="px-3 py-2 rounded-xl bg-amber-50 text-amber-600 text-xs font-black flex items-center gap-1 disabled:opacity-40">
                <Trash2 size={14} /> 删除
              </button>
              <button type="button" onClick={handleMultiRecall} disabled={!selectedUserCount} className="px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-black flex items-center gap-1 disabled:opacity-40">
                <RotateCcw size={14} /> 撤回我方{selectedUserCount ? ` ${selectedUserCount}` : ''}
              </button>
              <button type="button" onClick={clearSelection} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-black flex items-center gap-1">
                <X size={14} /> 取消
              </button>
            </div>
          </div>
        </div>
      )}

      {messages.map((m, index) => {
        if (m.role === 'system' || m.isDeletedForUser) return null;

        const isUser = m.role === 'user';
        const isSticker = m.type === 'sticker';
        const rawText = String(m.text || '');
        const isRecallMsg = rawText.includes('<recall>');
        const quoteMatch = rawText.match(/\[quote:\s*(.*?)\]/);
        const quoteText = quoteMatch ? quoteMatch[1] : null;

        const actualText = rawText.replace(/<\/?recall>|\[quote:.*?\]/g, '').trim();
        const strippedText = actualText.replace(/<del>.*?<\/del>/g, '').trim();

        let showTime = false;
        const prevMsg = messages.slice(0, index).reverse().find(msg => msg.role !== 'system' && !msg.isDeletedForUser);
        if (!prevMsg || m.id - prevMsg.id > 300000) showTime = true;

        if (!isSticker && !strippedText && !m.isAnimated && !m.isRecalled) return null;

        const isSelected = selectedIds.includes(m.id);
        const bubbleClass = isUser
          ? 'bg-[#95ec69] text-slate-900 rounded-tr-md'
          : isDark
            ? 'bg-slate-800 text-slate-50 border border-slate-700 rounded-tl-md'
            : 'bg-white text-slate-800 border border-slate-200 rounded-tl-md';
        const quoteClass = isDark
          ? 'bg-slate-900/60 border-emerald-400 text-slate-300'
          : 'bg-slate-100/70 border-indigo-400 text-slate-500';
        const selectableClass = isMultiSelect ? 'cursor-pointer rounded-3xl px-1 py-1 -mx-1' : '';
        const selectedClass = isSelected ? 'bg-emerald-400/20 ring-2 ring-emerald-400/50' : '';

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
                  你撤回了一条消息
                </span>
              </div>
            ) : (
              <div
                onClick={() => isMultiSelect && toggleSelect(m.id)}
                className={`flex items-start gap-3 mb-6 ${isUser ? 'justify-end' : 'justify-start'} ${selectableClass} ${selectedClass}`}
              >
                {isMultiSelect && !isUser && (
                  <div className={`mt-2 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : isDark ? 'border-slate-600' : 'border-slate-300 bg-white'}`}>
                    {isSelected && <Check size={14} />}
                  </div>
                )}

                {!isUser && (
                  <Avatar src={assistantAvatar} label={activePersona?.name || 'Persona'} isUser={false} isDark={isDark} />
                )}

                {isSticker ? (
                  <div
                    onContextMenu={event => openContextMenu(event, m)}
                    onTouchStart={event => startLongPress(event, m)}
                    onTouchMove={cancelLongPress}
                    onTouchEnd={cancelLongPress}
                    onTouchCancel={cancelLongPress}
                    className="cursor-default select-none"
                  >
                    <StickerBubble sticker={m.sticker} isUser={isUser} isDark={isDark} />
                  </div>
                ) : (
                  <div
                    onContextMenu={event => openContextMenu(event, m)}
                    onTouchStart={event => startLongPress(event, m)}
                    onTouchMove={cancelLongPress}
                    onTouchEnd={cancelLongPress}
                    onTouchCancel={cancelLongPress}
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

                {isMultiSelect && isUser && (
                  <div className={`mt-2 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : isDark ? 'border-slate-600' : 'border-slate-300 bg-white'}`}>
                    {isSelected && <Check size={14} />}
                  </div>
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
            onClick={() => enterMultiSelect(contextMenu.message)}
            className="w-full px-3 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
          >
            <Check size={15} /> 多选
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="w-full px-3 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 hover:bg-amber-50 hover:text-amber-600 transition-colors"
          >
            <Trash2 size={15} /> 删除
          </button>
          {contextMenu.message.role === 'user' && (
            <button
              type="button"
              onClick={handleRecall}
              className="w-full px-3 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <RotateCcw size={15} /> 撤回
            </button>
          )}
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
