const CHINESE_BQB_SOURCE_URL = 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/chinesebqb_github.json';
const CACHE_KEY = 'chinesebqb_manifest_cache_v2';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOAD_TIMEOUT_MS = 6000;

const CLEAN_REACTIONS = [
  { key: 'speechless', name: '无语', emotion: '无语', emoji: '😶', text: '无语', sub: '让我缓缓', bg: ['#0f172a', '#334155'], tags: ['无语', '沉默', '离谱', '语塞'] },
  { key: 'question', name: '疑惑', emotion: '疑惑', emoji: '？', text: '啊？', sub: '你认真的吗', bg: ['#111827', '#4b5563'], tags: ['疑惑', '问号', '不懂', '啊'] },
  { key: 'shocked', name: '震惊', emotion: '震惊', emoji: '😧', text: '震惊', sub: '还有这种事', bg: ['#1e1b4b', '#6366f1'], tags: ['震惊', '惊讶', '真的假的'] },
  { key: 'laugh', name: '笑死', emotion: '笑死', emoji: '🤣', text: '笑死', sub: '绷不住了', bg: ['#422006', '#f59e0b'], tags: ['笑死', '哈哈', '好笑', '绷不住'] },
  { key: 'ok', name: '可以', emotion: '开心', emoji: '👌', text: '可以', sub: '这波还行', bg: ['#064e3b', '#10b981'], tags: ['开心', '可以', '好评', '不错'] },
  { key: 'comfort', name: '拍拍', emotion: '安慰', emoji: '🫳', text: '拍拍', sub: '没事的', bg: ['#164e63', '#06b6d4'], tags: ['安慰', '抱抱', '没事', '委屈'] },
  { key: 'angry', name: '别搞', emotion: '生气', emoji: '😾', text: '别搞', sub: '我真的会谢', bg: ['#7f1d1d', '#ef4444'], tags: ['生气', '烦', '别搞', '过分'] },
  { key: 'collapse', name: '崩溃', emotion: '崩溃', emoji: '🫠', text: '崩溃', sub: '我先碎一下', bg: ['#312e81', '#8b5cf6'], tags: ['崩溃', '累', '裂开', '救命'] },
  { key: 'mock', name: '就这', emotion: '嘲讽', emoji: '🙂', text: '就这', sub: '有点意思', bg: ['#3f3f46', '#a1a1aa'], tags: ['嘲讽', '阴阳', '就这', '不过如此'] },
  { key: 'fish', name: '摸鱼', emotion: '摸鱼', emoji: '🐟', text: '摸鱼', sub: '暂停营业', bg: ['#0c4a6e', '#38bdf8'], tags: ['摸鱼', '躺', '休息', '摆烂'] },
  { key: 'cute', name: '收到', emotion: '可爱', emoji: '🫡', text: '收到', sub: '马上执行', bg: ['#831843', '#f472b6'], tags: ['可爱', '收到', '乖', '宝宝'] },
  { key: 'shy', name: '别说了', emotion: '害羞', emoji: '🫣', text: '别说了', sub: '有点顶不住', bg: ['#7c2d12', '#fb7185'], tags: ['害羞', '脸红', '别说了'] },
];

const BQB_FILTER_OUT = [
  '爸爸', '男人的嘴', '王八', '给我滚', '菜刀', '小仙女', '女孩纸', '大佬', '滑稽大佬',
  '开车', '鸡你太美', '斗图', '表白', '污', '色', '骚', '黄', '绿帽', '亲亲', '老婆', '老公',
];

const EMOTION_ALIASES = {
  '无语': ['无语', '语塞', '沉默', '不是很懂', '翻白眼', '呵呵', '离谱'],
  '震惊': ['震惊', '惊吓', '吃惊', '问号', '疑问', '啊', '天啊', 'ohmygod'],
  '笑死': ['笑', '哈哈', '憋笑', '好笑', '乐', '绷不住'],
  '开心': ['开心', '好评', '超棒', '耶', '嗨', '得意', '可以'],
  '安慰': ['安慰', '别气', '抱抱', '拍拍', '委屈', '哭哭', '没事'],
  '生气': ['生气', '过分', '不听', '哼', '凶', '烦', '别搞'],
  '害羞': ['害羞', '喜欢', '脸红', '别说了'],
  '崩溃': ['崩溃', '累', '生无可恋', '慌', '害怕', '裂开', '救命'],
  '疑惑': ['疑惑', '问号', '疑问', '不懂', '什么', '说的啥', '啊'],
  '嘲讽': ['嘲讽', '不过如此', '少来这套', '阴阳', '就这'],
  '摸鱼': ['摸鱼', '划水', '喝茶', '躺', '睡', '无聊', '摆烂'],
  '可爱': ['可爱', '萌', '宝宝', '收到', '乖'],
};

let bqbCache = null;
let loadingPromise = null;

function createSvgDataUrl({ emoji, text, sub, bg }) {
  const [from, to] = bg;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect width="240" height="240" rx="46" fill="url(#g)"/>
  <circle cx="120" cy="96" r="58" fill="rgba(255,255,255,.14)"/>
  <text x="120" y="117" text-anchor="middle" font-size="70" dominant-baseline="middle">${emoji}</text>
  <g filter="url(#shadow)">
    <rect x="38" y="146" width="164" height="48" rx="18" fill="rgba(255,255,255,.18)"/>
    <text x="120" y="176" text-anchor="middle" font-size="26" font-family="Arial, 'Microsoft YaHei', sans-serif" font-weight="800" fill="#fff">${text}</text>
  </g>
  <text x="120" y="214" text-anchor="middle" font-size="14" font-family="Arial, 'Microsoft YaHei', sans-serif" font-weight="700" fill="rgba(255,255,255,.78)">${sub}</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function safeId(value) {
  return String(value || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]+/g, '_')
    .slice(0, 80);
}

function stripExtension(name) {
  return String(name || '').replace(/\.[a-z0-9]+$/i, '');
}

function normalizeSearchText(value) {
  return String(value || '').toLowerCase().replace(/[\s_\-—–]+/g, '');
}

function isBlockedBqbItem(item) {
  const text = `${item.name || ''} ${item.category || ''}`.toLowerCase();
  return BQB_FILTER_OUT.some(word => text.includes(word.toLowerCase()));
}

function inferEmotion(item) {
  const text = `${item.name || ''} ${item.category || ''}`;
  for (const [emotion, aliases] of Object.entries(EMOTION_ALIASES)) {
    if (aliases.some(alias => text.includes(alias))) return emotion;
  }
  if (/Funny|滑稽|斗图/i.test(text)) return '笑死';
  if (/Cute|可爱/i.test(text)) return '可爱';
  return '其他';
}

function inferTags(item, emotion) {
  const name = stripExtension(item.name);
  const category = String(item.category || '').replace(/^\d+/, '');
  const words = name
    .split(/[\s_\-—–,，.。/\\]+/)
    .map(word => word.trim())
    .filter(word => word && !/^\d+$/.test(word));

  return Array.from(new Set([emotion, category, ...words].filter(Boolean))).slice(0, 12);
}

function normalizeBqbSticker(item, index = 0) {
  const emotion = inferEmotion(item);
  const tags = inferTags(item, emotion);
  const name = stripExtension(item.name) || `表情${index + 1}`;
  const category = item.category || 'ChineseBQB';

  return {
    id: `bqb_${safeId(category)}_${safeId(name)}_${index}`,
    packId: 'chinesebqb',
    source: 'ChineseBQB',
    name,
    category,
    emotion,
    tags,
    triggerWords: tags.slice(0, 8),
    meaning: `${emotion} / ${tags.slice(1, 4).join(' / ') || name}`,
    url: encodeURI(item.url || ''),
    rawUrl: item.url || '',
    isCurated: false,
  };
}

function normalizeCleanSticker(item, index = 0) {
  return {
    id: `clean_${item.key}_${index}`,
    packId: 'clean_reactions',
    source: 'CleanReaction',
    name: item.name,
    category: '清爽反应包',
    emotion: item.emotion,
    tags: item.tags,
    triggerWords: item.tags,
    meaning: `${item.emotion} / ${item.tags.slice(1, 4).join(' / ')}`,
    url: createSvgDataUrl(item),
    rawUrl: '',
    isCurated: true,
  };
}

function normalizeBqbList(rawItems = []) {
  return rawItems
    .filter(item => item?.url && item?.name && !isBlockedBqbItem(item))
    .map((item, index) => normalizeBqbSticker(item, index));
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    return parsed.items;
  } catch {
    return null;
  }
}

function writeCache(items) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), items }));
  } catch (error) {
    console.warn('ChineseBQB 缓存写入失败，继续使用内存缓存:', error);
  }
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function loadChineseBqbStickers({ force = false } = {}) {
  if (bqbCache && !force) return bqbCache;
  if (loadingPromise && !force) return loadingPromise;

  loadingPromise = (async () => {
    const cached = !force ? readCache() : null;
    if (cached) {
      bqbCache = cached;
      return bqbCache;
    }

    try {
      const payload = await fetchWithTimeout(CHINESE_BQB_SOURCE_URL, LOAD_TIMEOUT_MS);
      const items = normalizeBqbList(payload?.data || []);
      if (!items.length) throw new Error('ChineseBQB 数据为空');
      bqbCache = items;
      writeCache(items);
      return bqbCache;
    } catch (error) {
      console.warn('ChineseBQB 远程清单加载失败，仅使用清爽反应包:', error);
      bqbCache = [];
      return bqbCache;
    }
  })();

  return loadingPromise;
}

export function getSeedStickers() {
  return CLEAN_REACTIONS.map(normalizeCleanSticker);
}

export function getStickerCacheSync({ includeBqb = false } = {}) {
  const clean = getSeedStickers();
  if (!includeBqb) return clean;
  return [...clean, ...(bqbCache || readCache() || [])];
}

function scoreSticker(sticker, keyword) {
  const query = normalizeSearchText(keyword);
  if (!query) return sticker.isCurated ? 10 : 0;

  const aliases = EMOTION_ALIASES[keyword] || [keyword];
  const aliasList = Array.from(new Set([keyword, ...aliases].map(normalizeSearchText).filter(Boolean)));
  const text = normalizeSearchText(`${sticker.name} ${sticker.category} ${sticker.emotion} ${sticker.tags?.join(' ') || ''} ${sticker.meaning || ''}`);

  let score = sticker.isCurated ? 8 : 0;
  for (const alias of aliasList) {
    if (!alias) continue;
    if (normalizeSearchText(sticker.emotion) === alias) score += sticker.isCurated ? 120 : 70;
    if (normalizeSearchText(sticker.name).includes(alias)) score += sticker.isCurated ? 80 : 50;
    if (text.includes(alias)) score += sticker.isCurated ? 40 : 18;
    if (sticker.tags?.some(tag => normalizeSearchText(tag).includes(alias))) score += sticker.isCurated ? 30 : 14;
  }

  if (/gif$/i.test(sticker.rawUrl || sticker.url || '')) score += 1;
  return score;
}

function pickRandom(items) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

export async function findStickerByKeyword(keyword, options = {}) {
  const avoidIds = new Set(options.avoidIds || []);
  const includeBqb = Boolean(options.includeBqb);
  const stickers = includeBqb
    ? [...getSeedStickers(), ...await loadChineseBqbStickers()]
    : getSeedStickers();

  const scored = stickers
    .filter(item => !avoidIds.has(item.id))
    .map(item => ({ item, score: scoreSticker(item, keyword) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 40)
    .map(entry => entry.item);

  if (scored.length) return pickRandom(scored.slice(0, Math.min(8, scored.length)));
  return pickRandom(stickers.filter(item => !avoidIds.has(item.id)));
}

export function searchStickersSync(keyword, limit = 80, options = {}) {
  const stickers = getStickerCacheSync({ includeBqb: options.includeBqb });
  const query = String(keyword || '').trim();
  if (!query) return stickers.slice(0, limit);

  return stickers
    .map(item => ({ item, score: scoreSticker(item, query) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(entry => entry.item);
}

export function getStickerKeywordPresets() {
  return Object.keys(EMOTION_ALIASES);
}

export const CHINESE_BQB_META = {
  packId: 'chinesebqb',
  name: 'ChineseBQB 测试表情库',
  sourceUrl: CHINESE_BQB_SOURCE_URL,
};
