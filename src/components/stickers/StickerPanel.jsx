import React, { useMemo, useState } from 'react';
import { Download, Search, Sparkles, Store, X } from 'lucide-react';
import {
  getInstalledStickers,
  getMarketStickerPacks,
  getStickerKeywordPresets,
  installStickerPack,
  removeStickerPack,
  searchMarketStickers,
  searchStickersSync,
} from '../../lib/officialStickerStore';
import OfficialStickerImage from './OfficialStickerImage';

export default function StickerPanel({ isOpen, onClose, onSelectSticker, chatAppearance }) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState('mine');
  const [packs, setPacks] = useState(() => getMarketStickerPacks());
  const isDark = chatAppearance?.theme === 'dark';
  const presets = useMemo(() => getStickerKeywordPresets(), []);

  const installedStickers = useMemo(() => getInstalledStickers(), [packs]);
  const filtered = useMemo(() => {
    if (activeTab === 'market') return searchMarketStickers(query, 160);
    if (!query.trim()) return installedStickers.slice(0, 96);
    return searchStickersSync(query, 96);
  }, [activeTab, query, installedStickers]);

  const handleTogglePack = pack => {
    const nextPacks = pack.installed ? removeStickerPack(pack.id) : installStickerPack(pack.id);
    setPacks(nextPacks);
  };

  if (!isOpen) return null;

  const shellClass = isDark
    ? 'bg-[#11181c]/98 border-slate-800 text-slate-100 shadow-black/40'
    : 'bg-white/98 border-slate-200 text-slate-900 shadow-slate-300/40';
  const inputClass = isDark
    ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500'
    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400';
  const chipClass = isDark
    ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
    : 'bg-slate-50 hover:bg-emerald-50 text-slate-600 border-slate-200';
  const packCardClass = isDark
    ? 'bg-slate-900/80 border-slate-800 hover:border-emerald-500/60'
    : 'bg-slate-50 border-slate-200 hover:border-emerald-300';

  return (
    <div className={`absolute left-0 right-0 bottom-[88px] md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[860px] max-h-[68vh] md:max-h-[70vh] border-t md:border rounded-t-3xl md:rounded-3xl shadow-2xl z-[160] overflow-hidden ${shellClass}`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-inherit">
        <div className="min-w-0">
          <div className="font-black text-base flex items-center gap-2">
            <Store size={18} className="text-emerald-500" /> Digitail 官方表情包
          </div>
          <div className="text-xs opacity-60 truncate">官方小黄人表情包 · Persona 已理解每张含义</div>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100/20 transition-colors shrink-0">
          <X size={18} />
        </button>
      </div>

      <div className="flex items-center gap-3 px-4 pt-3 overflow-x-auto border-b border-inherit">
        <button
          type="button"
          onClick={() => setActiveTab('mine')}
          className={`shrink-0 px-4 py-3 text-sm font-black border-b-2 transition-colors ${activeTab === 'mine' ? 'border-emerald-500 text-emerald-500' : 'border-transparent opacity-60'}`}
        >
          我的表情
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('market')}
          className={`shrink-0 px-4 py-3 text-sm font-black border-b-2 transition-colors ${activeTab === 'market' ? 'border-emerald-500 text-emerald-500' : 'border-transparent opacity-60'}`}
        >
          官方图库
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('packs')}
          className={`shrink-0 px-4 py-3 text-sm font-black border-b-2 transition-colors ${activeTab === 'packs' ? 'border-emerald-500 text-emerald-500' : 'border-transparent opacity-60'}`}
        >
          套装管理
        </button>
      </div>

      {activeTab !== 'packs' && (
        <div className="p-4 space-y-3">
          <div className={`flex items-center gap-2 border rounded-2xl px-3 py-2 ${inputClass}`}>
            <Search size={16} className="opacity-50" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="搜索：捂脸无语 / 咖啡续命 / 贴贴抱抱 / 笑死 / 晚安..."
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
      )}

      {activeTab === 'packs' ? (
        <div className="p-4 overflow-y-auto max-h-[48vh] md:max-h-[52vh]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {packs.map(pack => (
              <div key={pack.id} className={`rounded-3xl border p-4 transition-colors ${packCardClass}`}>
                <div className="flex gap-4">
                  <div className="w-24 h-24 rounded-3xl overflow-hidden shrink-0 bg-white/70">
                    {pack.preview?.[0] && (
                      <OfficialStickerImage sticker={pack.preview[0]} className="w-full h-full rounded-3xl" fallbackClassName="w-full h-full object-contain" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-black text-base truncate">{pack.name}</h3>
                      <span className="text-[10px] font-black px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 shrink-0">{pack.count} 张</span>
                    </div>
                    <p className="text-xs opacity-60 font-bold mt-1 line-clamp-2">{pack.subtitle}</p>
                    <div className="flex gap-1.5 mt-3">
                      {pack.preview.map(sticker => (
                        <OfficialStickerImage key={sticker.id} sticker={sticker} className="w-10 h-10 rounded-xl bg-white/60" fallbackClassName="w-10 h-10 rounded-xl object-contain bg-white/60" />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTogglePack(pack)}
                      className={`mt-3 px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 ${pack.installed ? 'bg-slate-200 text-slate-600' : 'bg-emerald-500 text-white'}`}
                    >
                      <Download size={14} /> {pack.installed ? '已添加，点击移除' : '添加到我的表情'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-4 pb-4 overflow-y-auto max-h-[42vh] md:max-h-[45vh]">
          {activeTab === 'market' && !query && (
            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {packs.slice(0, 4).map(pack => (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setQuery(pack.theme)}
                  className={`text-left rounded-3xl border p-3 transition-colors ${packCardClass}`}
                >
                  <div className="flex items-center gap-3">
                    {pack.preview?.[0] && (
                      <OfficialStickerImage sticker={pack.preview[0]} className="w-16 h-16 rounded-2xl bg-white/60 shrink-0" fallbackClassName="w-16 h-16 rounded-2xl object-contain bg-white/60 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-black truncate flex items-center gap-1.5"><Sparkles size={14} className="text-emerald-500" /> {pack.name}</div>
                      <div className="text-xs opacity-60 font-bold truncate">{pack.subtitle}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 md:gap-4">
            {filtered.map(sticker => (
              <button
                key={sticker.id}
                type="button"
                onClick={() => onSelectSticker?.(sticker)}
                title={`${sticker.name}：${sticker.meaning}`}
                className={`aspect-square rounded-3xl p-1.5 transition-transform hover:scale-105 ${isDark ? 'bg-slate-900 hover:bg-slate-800' : 'bg-slate-50 hover:bg-emerald-50'}`}
              >
                <OfficialStickerImage
                  sticker={sticker}
                  className="w-full h-full rounded-2xl"
                  fallbackClassName="w-full h-full object-contain rounded-2xl"
                />
              </button>
            ))}
          </div>

          {!filtered.length && (
            <div className="py-10 text-center text-sm opacity-60 font-bold">没有找到匹配表情，换个关键词试试</div>
          )}
        </div>
      )}
    </div>
  );
}
