import React, { memo, useEffect, useRef } from 'react';

function toCharacters(text) {
  const source = String(text || '');
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return Array.from(new Intl.Segmenter('zh-Hans', { granularity: 'grapheme' }).segment(source), item => item.segment);
  }
  return Array.from(source);
}

const SPEED_PRESETS = {
  slow: { baseSpeed: 50, deleteSpeed: 25 },
  normal: { baseSpeed: 30, deleteSpeed: 15 },
  fast: { baseSpeed: 18, deleteSpeed: 12 },
};

function getPersonaSpeeds(persona, speed, deleteSpeed) {
  if (Number.isFinite(speed)) {
    return {
      baseSpeed: Math.max(12, speed),
      deleteSpeed: Math.max(8, Number.isFinite(deleteSpeed) ? deleteSpeed : Math.round(speed * 0.5)),
    };
  }

  const personaText = String(persona || '');
  if (personaText.includes('细腻') || personaText.includes('犹豫') || personaText.includes('慢')) {
    return SPEED_PRESETS.slow;
  }

  if (personaText.includes('急躁') || personaText.includes('快') || personaText.includes('心直口快') || personaText.includes('暴躁')) {
    return SPEED_PRESETS.fast;
  }

  return SPEED_PRESETS.normal;
}

function buildActions(content) {
  const actions = [];
  const parts = String(content || '').split(/(<del>[\s\S]*?<\/del>)/g).filter(Boolean);

  parts.forEach(part => {
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

function TypingText({ content, persona, onComplete, scrollRef, speed, deleteSpeed }) {
  const textRef = useRef(null);
  const cursorRef = useRef(null);
  const textNodeRef = useRef(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    let isMounted = true;
    let timerId = null;
    let frameId = null;
    let scrollFrameId = null;
    const currentChars = [];
    let index = 0;
    let typedCount = 0;
    const actions = buildActions(content);
    const speeds = getPersonaSpeeds(persona, speed, deleteSpeed);

    const requestFrame = callback => {
      if (typeof window.requestAnimationFrame === 'function') {
        frameId = window.requestAnimationFrame(callback);
      } else {
        timerId = window.setTimeout(callback, 16);
      }
    };

    const requestScrollAfterPaint = () => {
      if (!scrollRef?.current) return;
      if (scrollFrameId && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(scrollFrameId);
      }
      if (typeof window.requestAnimationFrame === 'function') {
        scrollFrameId = window.requestAnimationFrame(() => {
          scrollFrameId = null;
          scrollRef?.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
        });
      } else {
        scrollRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
      }
    };

    if (textRef.current) {
      textRef.current.textContent = '';
      textNodeRef.current = document.createTextNode('');
      textRef.current.appendChild(textNodeRef.current);
    }
    if (cursorRef.current) {
      cursorRef.current.style.opacity = '0.75';
      cursorRef.current.classList.add('animate-pulse');
    }

    const ensureTextNode = () => {
      if (textNodeRef.current?.parentNode === textRef.current) return textNodeRef.current;
      if (!textRef.current) return null;
      textRef.current.textContent = '';
      textNodeRef.current = document.createTextNode('');
      textRef.current.appendChild(textNodeRef.current);
      return textNodeRef.current;
    };

    const appendCharNow = char => {
      currentChars.push(char);
      // 不再依赖 React 每字 setState。直接写 DOM 文本节点，避免 React 批处理导致“第一个字卡住，最后整段蹦出”。
      // 注意：这个 span 不能有 React children，否则父组件重渲染会用旧 state 把命令式写入的文本清空。
      ensureTextNode()?.appendData(char);
      requestScrollAfterPaint();
    };

    const deleteCharNow = () => {
      const removedChar = currentChars.pop();
      const textNode = ensureTextNode();
      if (removedChar && textNode) {
        textNode.deleteData(Math.max(0, textNode.length - removedChar.length), removedChar.length);
      }
      requestScrollAfterPaint();
    };

    const scheduleNext = delay => {
      timerId = window.setTimeout(() => {
        timerId = null;
        requestFrame(runAction);
      }, Math.max(16, delay));
    };

    const finish = () => {
      if (!isMounted) return;
      if (cursorRef.current) {
        cursorRef.current.classList.remove('animate-pulse');
        cursorRef.current.style.opacity = '0';
      }
      // 让最终字符和光标淡出至少经历一次浏览器绘制，再通知父组件切换为静态文本。
      requestFrame(() => {
        if (isMounted) onCompleteRef.current?.();
      });
    };

    function runAction() {
      frameId = null;
      if (!isMounted) return;

      if (index >= actions.length) {
        finish();
        return;
      }

      const action = actions[index];
      index += 1;
      let delay = speeds.baseSpeed;

      if (action.type === 'type') {
        typedCount += 1;
        appendCharNow(action.char);
        delay = getTypeDelay(action.char, speeds.baseSpeed, typedCount);
      } else if (action.type === 'delete') {
        deleteCharNow();
        delay = speeds.deleteSpeed;
      } else if (action.type === 'pause') {
        delay = action.ms;
      }

      scheduleNext(delay);
    }

    // 旧版是立即 runAction()，不要先空等 80ms；后续每帧直接写 DOM，避免 React 状态批处理卡住字符更新。
    runAction();

    return () => {
      isMounted = false;
      if (timerId) window.clearTimeout(timerId);
      if (frameId && typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(frameId);
      if (scrollFrameId && typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(scrollFrameId);
      textNodeRef.current = null;
    };
  }, [content, persona, scrollRef, speed, deleteSpeed]);

  return (
    <span className="whitespace-pre-wrap">
      <span ref={textRef} />
      <span
        ref={cursorRef}
        className="inline-block w-0.5 h-[1em] ml-0.5 bg-current align-middle opacity-75 animate-pulse transition-opacity duration-500"
      ></span>
    </span>
  );
}

function areTypingPropsEqual(prev, next) {
  return prev.content === next.content
    && prev.persona === next.persona
    && prev.scrollRef === next.scrollRef
    && prev.speed === next.speed
    && prev.deleteSpeed === next.deleteSpeed;
}

export default memo(TypingText, areTypingPropsEqual);
