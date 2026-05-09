import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCcw, Search, X } from 'lucide-react';
import {
  getSeedStickers,
  getStickerKeywordPresets,
  loadChineseBqbStickers,
  searchStickersSync,
} from '../../lib/stickerStore';

export default function StickerPanel({ isOpen, onClose, onSelectSticker, chatAppearance }) {
  const [query, setQuery] = useState('');
  const [stickers, setStickers] = useState(() => getSeedStickers());
  const [isLoading, setIsLoading] = useState(false);
  const [sourceState, setSourceState] = useState('内置种子');
  const isDark = chatAppearance?.theme === 'dark';
  const presets = useMemo(() => getStickerKeywordPresets(), []);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setIsLoading(true);
    loadChineseBqbStickers()
      .then(items => {
        if (cancelled) return;
        setStickers(items);
        setSourceState(items.length > 100 ? `ChineseBQB ${items.length} 张` : '内置种子');
      })
      .catch(error => {
        console.warn('表情包加载失败:', error);
        if (!cancelled) {
          const seeds = getSeedStickers();
          setStickers(seeds);
          setSourceState('内置种子');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!query.trim()) return stickers.slice(0, 120);
    return searchStickersSync(query, 120);
  }, [query, stickers]);

  const reloadRemote = async () => {
    setIsLoading(true);
    try {
      const items = await loadChineseBqbStickers({ force: true });
      setStickers(items);
      setSourceState(items.length > 100 ? `ChineseBQB ${items.length} 张` : '内置种子');
    } catch (error) {
      console.warn('表情包刷新失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const shellClass = isDark
    ? 'bg-slate-950/98 border-slate-800 text-slate-100 shadow-black/40'
    : 'bg-white/98 border-slate-200 text-slate-900 shadow-slate-300/40';
  const inputClass = isDark
    ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500'
    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400';
  const chipClass = isDark
    ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
    : 'bg-slate-50 hover:bg-emerald-50 text-slate-600 border-slate-200';

  return (
    <div className={`absolute left-4 right-4 bottom-[92px] md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[760px] max-h-[58vh] rounded-3xl border shadow-2xl z-[160] overflow-hidden ${shellClass}`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-inherit">
        <div className="min-w-0">
          <div className="font-black text-base">ChineseBQB 表情库</div>
          <div className="text-xs opacity-60 truncate">测试阶段远程读取开源索引 · {sourceState}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={reloadRemote}
            className="p-2 rounded-xl hover:bg-slate-100/20 transition-colors"
            title="刷新远程表情库"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCcw size={18} />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100/20 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className={`flex items-center gap-2 border rounded-2xl px-3 py-2 ${inputClass}`}>
          <Search size={16} className="opacity-50" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="搜索：无语 / 笑死 / 问号 / 委屈 / 摸鱼..."
            className="flex-1 bg-transparent outline-none text-sm font-bold"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {presets.map(preset => (
            <button
              key={preset}
              type="button"
              onClick={() => setQuery(preset)}
              className={`shrink-0 border rounded-full px-3 py-1.5 text-xs font-black transition-colors ${chipClass}`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4 overflow-y-auto max-h-[36vh]">
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
          {filtered.map(sticker => (
            <button
              key={sticker.id}
              type="button"
              onClick={() => onSelectSticker?.(sticker)}
              title={sticker.name}
              className={`aspect-square rounded-2xl p-1.5 transition-transform hover:scale-105 ${isDark ? 'bg-slate-900 hover:bg-slate-800' : 'bg-slate-50 hover:bg-emerald-50'}`}
            >
              <img
                src={sticker.url}
                alt={sticker.name}
                loading="lazy"
                className="w-full h-full object-contain rounded-xl"
                onError={event => {
                  event.currentTarget.style.opacity = '0.25';
                }}
              />
            </button>
          ))}
        </div>

        {!filtered.length && (
          <div className="py-10 text-center text-sm opacity-60 font-bold">没有找到匹配表情，换个关键词试试</div>
        )}
      </div>
    </div>
  );
}
