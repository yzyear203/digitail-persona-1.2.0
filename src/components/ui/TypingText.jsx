import React, { useEffect, useRef } from 'react';

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

function runAfterPaint(callback, delay) {
  const timeoutId = window.setTimeout(() => {
    window.requestAnimationFrame(callback);
  }, Math.max(16, delay));
  return timeoutId;
}

export default function TypingText({ content, persona, onComplete, scrollRef }) {
  const textRef = useRef(null);
  const cursorRef = useRef(null);
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

    if (textRef.current) textRef.current.textContent = '';
    if (cursorRef.current) cursorRef.current.style.display = 'inline-block';

    const writeTextNow = nextText => {
      currentText = nextText;
      // 不再依赖 React 每字 setState。直接写 DOM 文本节点，避免 React 批处理导致“第一个字卡住，最后整段蹦出”。
      // 注意：这个 span 不能有 React children，否则父组件重渲染会用旧 state 把命令式写入的文本清空。
      if (textRef.current) textRef.current.textContent = nextText;
      scrollRef?.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    };

    const scheduleNext = delay => {
      timerId = runAfterPaint(runAction, delay);
    };

    const finish = () => {
      if (!isMounted) return;
      if (cursorRef.current) cursorRef.current.style.display = 'none';
      // 让最终字符和光标隐藏至少经历一次浏览器绘制，再通知父组件切换为静态文本。
      window.requestAnimationFrame(() => {
        if (isMounted) onCompleteRef.current?.();
      });
    };

    const runAction = () => {
      if (!isMounted) return;

      if (index >= actions.length) {
        finish();
        return;
      }

      const action = actions[index];
      index += 1;
      let delay = baseSpeed;

      if (action.type === 'type') {
        typedCount += 1;
        writeTextNow(currentText + action.char);
        delay = getTypeDelay(action.char, baseSpeed, typedCount);
      } else if (action.type === 'delete') {
        writeTextNow(toCharacters(currentText).slice(0, -1).join(''));
        delay = deleteSpeed;
      } else if (action.type === 'pause') {
        delay = action.ms;
      }

      scheduleNext(delay);
    };

    // 旧版是立即 runAction()，不要先空等 80ms；后续每帧直接写 DOM，避免 React 状态批处理卡住字符更新。
    runAction();

    return () => {
      isMounted = false;
      if (timerId) window.clearTimeout(timerId);
    };
  }, [content, persona, scrollRef]);

  return (
    <span className="whitespace-pre-wrap">
      <span ref={textRef} />
      <span ref={cursorRef} className="inline-block w-1.5 h-4 ml-1 bg-blue-400 animate-pulse align-middle"></span>
    </span>
  );
}
