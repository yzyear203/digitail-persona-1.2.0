import React, { useEffect, useRef, useState } from 'react';

function toCharacters(text) {
  const source = String(text || '');
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return Array.from(new Intl.Segmenter('zh-Hans', { granularity: 'grapheme' }).segment(source), item => item.segment);
  }
  return Array.from(source);
}

function getPersonaSpeeds(persona) {
  const personaText = String(persona || '');
  if (personaText.includes('细腻') || personaText.includes('犹豫') || personaText.includes('慢')) {
    return { baseSpeed: 50, deleteSpeed: 25 };
  }

  if (personaText.includes('急躁') || personaText.includes('快') || personaText.includes('心直口快') || personaText.includes('暴躁')) {
    return { baseSpeed: 18, deleteSpeed: 12 };
  }

  return { baseSpeed: 30, deleteSpeed: 15 };
}

function buildActions(content) {
  const actions = [];

  String(content || '').split(/(<del>[\s\S]*?<\/del>)/g).forEach(part => {
    if (!part) return;

    if (part.startsWith('<del>') && part.endsWith('</del>')) {
      const deletedText = part.replace(/^<del>/, '').replace(/<\/del>$/, '');
      const deletedChars = toCharacters(deletedText);
      deletedChars.forEach(char => actions.push({ type: 'type', char }));
      actions.push({ type: 'pause', ms: 800 + Math.random() * 600 });
      deletedChars.forEach(() => actions.push({ type: 'delete' }));
      actions.push({ type: 'pause', ms: 500 + Math.random() * 500 });
      return;
    }

    toCharacters(part).forEach(char => actions.push({ type: 'type', char }));
  });

  return actions;
}

function getTypeDelay(char, baseSpeed, typedCount) {
  let delay = baseSpeed + (Math.random() * 100 - 50);

  // 参考旧版打字机的随机小停顿，但开头 8 个字不做随机长停，避免首字附近误以为卡死。
  if (typedCount > 8 && Math.random() < 0.05) delay += 300 + Math.random() * 400;
  if (/[，,、]/.test(char)) delay += 40 + Math.random() * 40;
  if (/[。！？!?；;]/.test(char)) delay += 90 + Math.random() * 70;

  // 旧版随机抖动可能产生负数延迟；这里钳制下限，避免浏览器把多个 0ms tick 合并成一段蹦出。
  return Math.max(16, delay);
}

export default function TypingText({ content, persona, onComplete, scrollRef }) {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    let isMounted = true;
    let timerId = null;
    let currentText = '';
    let index = 0;
    let typedCount = 0;
    const actions = buildActions(content);
    const { baseSpeed, deleteSpeed } = getPersonaSpeeds(persona);

    setDisplayText('');
    setIsTyping(true);

    const scheduleNext = delay => {
      timerId = window.setTimeout(runAction, Math.max(16, delay));
    };

    const runAction = () => {
      if (!isMounted) return;

      if (index >= actions.length) {
        setIsTyping(false);
        onCompleteRef.current?.();
        return;
      }

      const action = actions[index];
      index += 1;
      let delay = baseSpeed;

      if (action.type === 'type') {
        currentText += action.char;
        typedCount += 1;
        setDisplayText(currentText);
        delay = getTypeDelay(action.char, baseSpeed, typedCount);
      } else if (action.type === 'delete') {
        currentText = toCharacters(currentText).slice(0, -1).join('');
        setDisplayText(currentText);
        delay = deleteSpeed;
      } else if (action.type === 'pause') {
        delay = action.ms;
      }

      scrollRef?.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      scheduleNext(delay);
    };

    // 旧版是立即 runAction()，不要先空等 80ms，避免只看到光标像卡住。
    runAction();

    return () => {
      isMounted = false;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [content, persona, scrollRef]);

  return (
    <span className="whitespace-pre-wrap">
      {displayText}
      {isTyping && <span className="inline-block w-1.5 h-4 ml-1 bg-blue-400 animate-pulse align-middle"></span>}
    </span>
  );
}
