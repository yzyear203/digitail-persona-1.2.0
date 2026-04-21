import React, { useState, useEffect, useRef } from 'react';

export default function TypingText({ content, persona, onComplete, scrollRef }) {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    let isMounted = true;
    const actions = [];
    let baseSpeed = 110, deleteSpeed = 40;
    if (persona.includes('细腻') || persona.includes('犹豫') || persona.includes('慢')) { baseSpeed = 200; deleteSpeed = 60; }
    else if (persona.includes('急躁') || persona.includes('快') || persona.includes('心直口快')) { baseSpeed = 60; deleteSpeed = 20; }

    content.split(/(<del>.*?<\/del>)/g).forEach(part => {
      if (part.startsWith('<del>') && part.endsWith('</del>')) {
        const del = part.replace('<del>', '').replace('</del>', '');
        for (let c of del) actions.push({ type: 'type', char: c });
        actions.push({ type: 'pause', ms: 800 + Math.random() * 600 });
        for (let i = 0; i < del.length; i++) actions.push({ type: 'delete' });
        actions.push({ type: 'pause', ms: 500 + Math.random() * 500 });
      } else {
        for (let c of part) actions.push({ type: 'type', char: c });
      }
    });

    let currentText = '', index = 0;
    const runAction = () => {
      if (!isMounted) return;
      if (index >= actions.length) {
        setIsTyping(false);
        if (onCompleteRef.current) onCompleteRef.current();
        if (window.__typingResolve) { 
          window.__typingResolve(); 
          window.__typingResolve = null; 
        }
        return;
      }
      const action = actions[index];
      let delay = baseSpeed + (Math.random() * 100 - 50);
      if (action.type === 'type') {
        currentText += action.char;
        setDisplayText(currentText);
        if (Math.random() < 0.05) delay += 300 + Math.random() * 400;
      } else if (action.type === 'delete') {
        currentText = currentText.slice(0, -1);
        setDisplayText(currentText);
        delay = deleteSpeed;
      } else if (action.type === 'pause') {
        delay = action.ms;
      }
      if (scrollRef?.current) scrollRef.current.scrollIntoView({ behavior: 'auto' });
      index++;
      setTimeout(runAction, delay);
    };
    runAction();
    
    return () => {
      isMounted = false;
      // 🚀 核心修复：绝对不能在这里调用 __typingResolve()！
      // 否则在 React 严格模式下，双重挂载会导致锁被提前解开，从而多条消息同时打字。
    };
  }, [content, persona, scrollRef]);

  return (
    <span className="whitespace-pre-wrap">
      {displayText}
      {isTyping && <span className="inline-block w-1.5 h-4 ml-1 bg-blue-400 animate-pulse align-middle"></span>}
    </span>
  );
}
