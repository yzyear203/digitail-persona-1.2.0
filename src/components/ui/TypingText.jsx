import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

function toGraphemes(text) {
  const source = String(text || '');
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return Array.from(new Intl.Segmenter('zh-Hans', { granularity: 'grapheme' }).segment(source), item => item.segment);
  }
  return Array.from(source);
}

function buildTypingActions(content) {
  const actions = [];

  String(content || '').split(/(<del>[\s\S]*?<\/del>)/g).forEach(part => {
    if (!part) return;

    if (part.startsWith('<del>') && part.endsWith('</del>')) {
      const del = part.replace(/^<del>/, '').replace(/<\/del>$/, '');
      const chars = toGraphemes(del);
      chars.forEach(char => actions.push({ type: 'type', char }));
      actions.push({ type: 'pause', ms: 420 });
      chars.forEach(() => actions.push({ type: 'delete' }));
      actions.push({ type: 'pause', ms: 240 });
      return;
    }

    toGraphemes(part).forEach(char => actions.push({ type: 'type', char }));
  });

  return actions;
}

function getPersonaSpeed(persona) {
  const personaText = String(persona || '');
  if (personaText.includes('细腻') || personaText.includes('犹豫') || personaText.includes('慢')) {
    return { type: 58, delete: 34 };
  }

  if (personaText.includes('急躁') || personaText.includes('快') || personaText.includes('心直口快') || personaText.includes('暴躁')) {
    return { type: 34, delete: 24 };
  }

  return { type: 46, delete: 28 };
}

function getTypeDelay(char, baseSpeed, typedCount) {
  if (/\s/.test(char)) return Math.max(18, Math.round(baseSpeed * 0.45));

  let delay = baseSpeed + Math.random() * 18;
  if (/[，,、]/.test(char)) delay += 70 + Math.random() * 50;
  if (/[。！？!?；;]/.test(char)) delay += 130 + Math.random() * 90;
  if (/[）)】\]》]/.test(char)) delay += 35;

  // 开头几个字不能随机长停顿，避免出现“第一个字卡住”的观感。
  if (typedCount < 8) return Math.max(28, Math.min(delay, baseSpeed + 22));
  return Math.max(26, delay);
}

export default function TypingText({ content, persona, onComplete, scrollRef }) {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const onCompleteRef = useRef(onComplete);
  const actions = useMemo(() => buildTypingActions(content), [content]);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useLayoutEffect(() => {
    setDisplayText('');
    setIsTyping(true);
  }, [content]);

  useEffect(() => {
    let cancelled = false;
    let timerId = null;
    let currentText = '';
    let index = 0;
    let typedCount = 0;
    const speed = getPersonaSpeed(persona);

    const commitText = nextText => {
      if (cancelled) return;
      // 强制每个 tick 只提交一个字符，避免 React 在计时器被阻塞后把多次 setState 合并成“一大段”。
      flushSync(() => {
        setDisplayText(nextText);
      });
      scrollRef?.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    };

    const finish = () => {
      if (cancelled) return;
      flushSync(() => {
        setIsTyping(false);
      });
      onCompleteRef.current?.();
    };

    const step = () => {
      if (cancelled) return;

      if (index >= actions.length) {
        finish();
        return;
      }

      const action = actions[index];
      index += 1;
      let delay = speed.type;

      if (action.type === 'type') {
        currentText += action.char;
        typedCount += 1;
        commitText(currentText);
        delay = getTypeDelay(action.char, speed.type, typedCount);
      } else if (action.type === 'delete') {
        currentText = toGraphemes(currentText).slice(0, -1).join('');
        commitText(currentText);
        delay = speed.delete + Math.random() * 10;
      } else if (action.type === 'pause') {
        delay = action.ms;
      }

      timerId = window.setTimeout(step, delay);
    };

    timerId = window.setTimeout(step, 80);

    return () => {
      cancelled = true;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [actions, persona, scrollRef]);

  return (
    <span className="whitespace-pre-wrap">
      {displayText}
      {isTyping && <span className="inline-block w-1.5 h-4 ml-1 bg-blue-400 animate-pulse align-middle"></span>}
    </span>
  );
}
