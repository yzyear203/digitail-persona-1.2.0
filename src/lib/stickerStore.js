const CHINESE_BQB_SOURCE_URL = 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/chinesebqb_github.json';
const CACHE_KEY = 'chinesebqb_manifest_cache_v1';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOAD_TIMEOUT_MS = 6000;

const SEED_STICKERS = [
  { name: '滑稽问号.jpg', category: '001Funny_滑稽大佬BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/001Funny_滑稽大佬BQB/滑稽大佬00062-滑稽问号.jpg' },
  { name: '受到惊吓.jpg', category: '001Funny_滑稽大佬BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/001Funny_滑稽大佬BQB/滑稽大佬00079-受到惊吓.jpg' },
  { name: '一时语塞.jpg', category: '001Funny_滑稽大佬BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/001Funny_滑稽大佬BQB/滑稽大佬00078-一时语塞.jpg' },
  { name: '不是很懂.jpg', category: '001Funny_滑稽大佬BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/001Funny_滑稽大佬BQB/滑稽大佬00092-不是很懂.jpg' },
  { name: '我开始慌了.jpg', category: '001Funny_滑稽大佬BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/001Funny_滑稽大佬BQB/滑稽大佬00070-我开始慌了.jpg' },
  { name: '过分.jpg', category: '001Funny_滑稽大佬BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/001Funny_滑稽大佬BQB/滑稽大佬00086-过分.jpg' },
  { name: '暗中观察.jpg', category: '001Funny_滑稽大佬BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/001Funny_滑稽大佬BQB/滑稽大佬00064-暗中观察.jpg' },
  { name: '喝茶.jpg', category: '001Funny_滑稽大佬BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/001Funny_滑稽大佬BQB/滑稽大佬00089-喝茶.jpg' },
  { name: '好评.jpg', category: '001Funny_滑稽大佬BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/001Funny_滑稽大佬BQB/滑稽大佬00116-好评.jpg' },
  { name: '不过如此.jpg', category: '001Funny_滑稽大佬BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/001Funny_滑稽大佬BQB/滑稽大佬00080-不过如此.jpg' },
  { name: '给你看看爸爸的厉害.gif', category: '001Funny_滑稽大佬BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/001Funny_滑稽大佬BQB/滑稽大佬00005-菜刀-给你看看爸爸的厉害.gif' },
  { name: '摸鱼.gif', category: '001Funny_滑稽大佬BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/001Funny_滑稽大佬BQB/滑稽大佬00027-摸鱼.gif' },
  { name: '打不着-打不到.gif', category: '001Funny_滑稽大佬BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/001Funny_滑稽大佬BQB/滑稽大佬00007-打不着-打不到.gif' },
  { name: '送你一朵小滑稽.jpg', category: '001Funny_滑稽大佬BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/001Funny_滑稽大佬BQB/滑稽大佬00058-送你一朵小滑稽.jpg' },
  { name: '躲进小被几.jpg', category: '001Funny_滑稽大佬BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/001Funny_滑稽大佬BQB/滑稽大佬00095-躲进小被几.jpg' },
  { name: '问号-疑问.gif', category: '002CuteGirl_可爱的女孩纸BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/002CuteGirl_可爱的女孩纸BQB/可爱的女孩纸00093-问号-疑问.gif' },
  { name: '翻白眼.gif', category: '002CuteGirl_可爱的女孩纸BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/002CuteGirl_可爱的女孩纸BQB/可爱的女孩纸00065-翻白眼.gif' },
  { name: '委屈巴巴.gif', category: '002CuteGirl_可爱的女孩纸BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/002CuteGirl_可爱的女孩纸BQB/可爱的女孩纸00101-委屈巴巴.gif' },
  { name: '哭哭.gif', category: '002CuteGirl_可爱的女孩纸BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/002CuteGirl_可爱的女孩纸BQB/可爱的女孩纸00109-哭哭.gif' },
  { name: '忍住不笑-憋笑.gif', category: '002CuteGirl_可爱的女孩纸BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/002CuteGirl_可爱的女孩纸BQB/可爱的女孩纸00121-忍住不笑-憋笑.gif' },
  { name: '哈哈哈哈嗝.gif', category: '002CuteGirl_可爱的女孩纸BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/002CuteGirl_可爱的女孩纸BQB/可爱的女孩纸00080-哈哈哈哈嗝.gif' },
  { name: '早上好呀-早安.gif', category: '002CuteGirl_可爱的女孩纸BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/002CuteGirl_可爱的女孩纸BQB/可爱的女孩纸00122-早上好呀-早安.gif' },
  { name: '好了啦别气啦.gif', category: '002CuteGirl_可爱的女孩纸BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/002CuteGirl_可爱的女孩纸BQB/可爱的女孩纸00120-好了啦别气啦.gif' },
  { name: '送你花花.gif', category: '002CuteGirl_可爱的女孩纸BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/002CuteGirl_可爱的女孩纸BQB/可爱的女孩纸00018-送你花花.gif' },
  { name: '我好累.gif', category: '002CuteGirl_可爱的女孩纸BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/002CuteGirl_可爱的女孩纸BQB/可爱的女孩纸00020-我好累.gif' },
  { name: '不听不听王八念经.gif', category: '002CuteGirl_可爱的女孩纸BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/002CuteGirl_可爱的女孩纸BQB/可爱的女孩纸00170-不听不听王八念经.gif' },
  { name: '打扰了我自己走.gif', category: '002CuteGirl_可爱的女孩纸BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/002CuteGirl_可爱的女孩纸BQB/可爱的女孩纸00182-打扰了我自己走.gif' },
  { name: '我做错了什么.gif', category: '002CuteGirl_可爱的女孩纸BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/002CuteGirl_可爱的女孩纸BQB/可爱的女孩纸00055-我做错了什么.gif' },
  { name: '略略略.gif', category: '002CuteGirl_可爱的女孩纸BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/002CuteGirl_可爱的女孩纸BQB/可爱的女孩纸00050-略略略.gif' },
  { name: '生无可恋.gif', category: '002CuteGirl_可爱的女孩纸BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/002CuteGirl_可爱的女孩纸BQB/可爱的女孩纸00075-生无可恋.gif' },
  { name: '男人的嘴骗人的鬼.gif', category: '002CuteGirl_可爱的女孩纸BQB', url: 'https://raw.githubusercontent.com/zhaoolee/ChineseBQB/master/002CuteGirl_可爱的女孩纸BQB/可爱的女孩纸00130-男人的嘴骗人的鬼.gif' },
];

const EMOTION_ALIASES = {
  '无语': ['无语', '语塞', '沉默', '不是很懂', '翻白眼', '呵呵', '离谱'],
  '震惊': ['震惊', '惊吓', '吃惊', '问号', '疑问', '啊', '天啊', 'ohmygod'],
  '笑死': ['笑', '哈哈', '憋笑', '滑稽', '好笑', '乐', '开心'],
  '开心': ['开心', '好评', '超棒', '耶', '嗨', '得意'],
  '安慰': ['安慰', '别气', '抱抱', '花花', '委屈', '哭哭', '没事'],
  '生气': ['生气', '过分', '给我滚', '不听', '哼', '凶', '烦'],
  '害羞': ['害羞', '亲亲', '喜欢', '脸红', '么么', '比心'],
  '崩溃': ['崩溃', '累', '生无可恋', '慌', '害怕', '不想上班'],
  '疑惑': ['疑惑', '问号', '疑问', '不懂', '什么', '说的啥'],
  '嘲讽': ['嘲讽', '不过如此', '少来这套', '脑子', '过分', '骗人'],
  '摸鱼': ['摸鱼', '划水', '喝茶', '躺', '睡', '无聊'],
  '可爱': ['可爱', '萌', '小仙女', '宝宝', '花花'],
};

let stickerCache = null;
let loadingPromise = null;

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

function normalizeSticker(item, index = 0) {
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
  };
}

function normalizeList(rawItems = []) {
  return rawItems
    .filter(item => item?.url && item?.name)
    .map((item, index) => normalizeSticker(item, index));
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
  if (stickerCache && !force) return stickerCache;
  if (loadingPromise && !force) return loadingPromise;

  loadingPromise = (async () => {
    const cached = !force ? readCache() : null;
    if (cached) {
      stickerCache = cached;
      return stickerCache;
    }

    try {
      const payload = await fetchWithTimeout(CHINESE_BQB_SOURCE_URL, LOAD_TIMEOUT_MS);
      const items = normalizeList(payload?.data || []);
      if (!items.length) throw new Error('ChineseBQB 数据为空');
      stickerCache = items;
      writeCache(items);
      return stickerCache;
    } catch (error) {
      console.warn('ChineseBQB 远程清单加载失败，使用内置种子表情:', error);
      stickerCache = normalizeList(SEED_STICKERS);
      return stickerCache;
    }
  })();

  return loadingPromise;
}

export function getSeedStickers() {
  return normalizeList(SEED_STICKERS);
}

export function getStickerCacheSync() {
  return stickerCache || readCache() || getSeedStickers();
}

function scoreSticker(sticker, keyword) {
  const query = normalizeSearchText(keyword);
  if (!query) return 0;

  const aliases = EMOTION_ALIASES[keyword] || [keyword];
  const aliasList = Array.from(new Set([keyword, ...aliases].map(normalizeSearchText).filter(Boolean)));
  const text = normalizeSearchText(`${sticker.name} ${sticker.category} ${sticker.emotion} ${sticker.tags?.join(' ') || ''} ${sticker.meaning || ''}`);

  let score = 0;
  for (const alias of aliasList) {
    if (!alias) continue;
    if (normalizeSearchText(sticker.emotion) === alias) score += 80;
    if (normalizeSearchText(sticker.name).includes(alias)) score += 60;
    if (text.includes(alias)) score += 25;
    if (sticker.tags?.some(tag => normalizeSearchText(tag).includes(alias))) score += 20;
  }

  if (/gif$/i.test(sticker.rawUrl || sticker.url || '')) score += 2;
  return score;
}

function pickRandom(items) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

export async function findStickerByKeyword(keyword, options = {}) {
  const stickers = await loadChineseBqbStickers();
  const avoidIds = new Set(options.avoidIds || []);
  const scored = stickers
    .filter(item => !avoidIds.has(item.id))
    .map(item => ({ item, score: scoreSticker(item, keyword) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 80)
    .map(entry => entry.item);

  if (scored.length) return pickRandom(scored.slice(0, Math.min(16, scored.length)));

  const fallback = stickers.filter(item => !avoidIds.has(item.id));
  return pickRandom(fallback);
}

export function searchStickersSync(keyword, limit = 80) {
  const stickers = getStickerCacheSync();
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
