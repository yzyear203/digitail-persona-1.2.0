import { OFFICIAL_STICKER_CATALOG, OFFICIAL_STICKER_SHEETS, getOfficialStickerKeywordPresets } from './officialStickerCatalog';
import { OFFICIAL_STICKER_SHEET_IMAGES } from './officialStickerAssets';

const CACHE_KEY = 'digitail_official_sticker_market_v3';
const SHEET_META = Object.fromEntries(OFFICIAL_STICKER_SHEETS.map(sheet => [sheet.id, sheet]));
const CURRENT_PACK_IDS = OFFICIAL_STICKER_SHEETS.map(sheet => sheet.id);

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s_\-—–·・,，。.!！?？:：;；()（）\[\]【】]+/g, '');
}

function safeId(value) {
  return String(value || '')
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]+/g, '_')
    .slice(0, 80);
}

function createOfficialPlaceholderSvgDataUrl(sticker) {
  const title = sticker.name || sticker.emotion || '官方表情';
  const mood = sticker.emotion || '表情';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><defs><radialGradient id="body" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#fff7bf"/><stop offset="0.64" stop-color="#ffd83d"/><stop offset="1" stop-color="#f4a900"/></radialGradient><filter id="shadow" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#0f172a" flood-opacity="0.22"/></filter></defs><rect width="240" height="240" rx="48" fill="#fffdf7"/><g filter="url(#shadow)"><circle cx="82" cy="45" r="18" fill="#ffd43b" stroke="#f4b000" stroke-width="5"/><circle cx="158" cy="45" r="18" fill="#ffd43b" stroke="#f4b000" stroke-width="5"/><circle cx="120" cy="122" r="72" fill="url(#body)" stroke="#f2b705" stroke-width="7"/><circle cx="92" cy="106" r="8" fill="#1f2937"/><circle cx="148" cy="106" r="8" fill="#1f2937"/><path d="M92 139 Q120 158 148 139" fill="none" stroke="#1f2937" stroke-width="7" stroke-linecap="round"/></g><rect x="24" y="178" width="192" height="34" rx="17" fill="rgba(15,23,42,.78)"/><text x="120" y="201" text-anchor="middle" font-size="22" font-family="Arial, 'Microsoft YaHei', sans-serif" font-weight="900" fill="#fff">${title}</text><text x="120" y="226" text-anchor="middle" font-size="13" font-family="Arial, 'Microsoft YaHei', sans-serif" font-weight="800" fill="#92400e">${mood}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function normalizeSticker(sticker, index) {
  const sheet = SHEET_META[sticker.sheet] || {};
  const sheetUrl = OFFICIAL_STICKER_SHEET_IMAGES[sticker.sheet] || '';
  const tags = Array.from(new Set([
    sticker.name,
    sticker.emotion,
    sticker.meaning,
    ...(sticker.aliases || []),
  ].filter(Boolean)));

  return {
    id: `official_${safeId(sticker.key)}_${index}`,
    key: sticker.key,
    packId: sticker.sheet,
    sheet: sticker.sheet,
    sheetName: sheet.name || '官方表情包',
    sheetUrl,
    row: sticker.row,
    col: sticker.col,
    rows: sheet.rows,
    cols: sheet.cols,
    source: 'DigitailOfficial',
    license: 'official_user_designed',
    name: sticker.name,
    category: sheet.name || '官方表情包',
    emotion: sticker.emotion,
    tags,
    triggerWords: tags,
    meaning: sticker.meaning,
    aliases: sticker.aliases || [],
    url: sticker.url || createOfficialPlaceholderSvgDataUrl(sticker),
    rawUrl: sheetUrl,
    isSprite: Boolean(sheetUrl),
    isCurated: true,
    isAnimated: false,
    text: sticker.emotion,
    sub: sticker.meaning,
  };
}

function normalizePack(sheet) {
  const stickers = OFFICIAL_STICKER_CATALOG
    .filter(sticker => sticker.sheet === sheet.id)
    .map(normalizeSticker);

  return {
    id: sheet.id,
    name: sheet.name,
    subtitle: '网站官方小黄人表情包 · 用户原创设计',
    theme: sheet.name.replace('官方表情包 · ', ''),
    accent: '#facc15',
    character: 'official_minion',
    installed: true,
    stickers,
    cover: stickers[0]?.url || '',
    preview: stickers.slice(0, 4),
    count: stickers.length,
  };
}

const MARKET_PACKS = OFFICIAL_STICKER_SHEETS.map(normalizePack);
const ALL_STICKERS = MARKET_PACKS.flatMap(pack => pack.stickers);

function normalizeInstalledPackIds(packIds) {
  if (!Array.isArray(packIds)) return CURRENT_PACK_IDS;
  const installedCurrentIds = packIds.filter(packId => CURRENT_PACK_IDS.includes(packId));
  return installedCurrentIds.length > 0 ? installedCurrentIds : CURRENT_PACK_IDS;
}

function readInstalledPackIds() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const normalizedIds = normalizeInstalledPackIds(parsed?.installedPackIds);
    if (!parsed || JSON.stringify(parsed.installedPackIds) !== JSON.stringify(normalizedIds)) {
      writeInstalledPackIds(normalizedIds);
    }
    return normalizedIds;
  } catch {
    // ignore cache errors
  }
  return CURRENT_PACK_IDS;
}

function writeInstalledPackIds(packIds) {
  try {
    const normalizedIds = normalizeInstalledPackIds(packIds);
    localStorage.setItem(CACHE_KEY, JSON.stringify({ installedPackIds: normalizedIds, version: 3 }));
  } catch (error) {
    console.warn('官方表情包安装状态保存失败:', error);
  }
}

function getSearchAliases(keyword) {
  const normalizedKeyword = normalizeSearchText(keyword);
  const exactSticker = ALL_STICKERS.find(sticker => {
    const candidates = [sticker.name, sticker.emotion, ...(sticker.aliases || [])].map(normalizeSearchText);
    return candidates.includes(normalizedKeyword);
  });

  if (!exactSticker) return [keyword];
  return [exactSticker.name, exactSticker.emotion, exactSticker.meaning, ...(exactSticker.aliases || [])];
}

function scoreSticker(sticker, keyword) {
  const query = normalizeSearchText(keyword);
  if (!query) return sticker.isCurated ? 10 : 0;

  const aliases = Array.from(new Set([keyword, ...getSearchAliases(keyword)].map(normalizeSearchText).filter(Boolean)));
  const searchableText = normalizeSearchText([
    sticker.name,
    sticker.category,
    sticker.emotion,
    sticker.meaning,
    ...(sticker.aliases || []),
    ...(sticker.tags || []),
  ].join(' '));

  let score = 0;
  for (const alias of aliases) {
    if (!alias) continue;
    if (normalizeSearchText(sticker.name) === alias) score += 180;
    if (normalizeSearchText(sticker.emotion) === alias) score += 140;
    if (sticker.aliases?.some(tag => normalizeSearchText(tag) === alias)) score += 120;
    if (normalizeSearchText(sticker.name).includes(alias)) score += 90;
    if (searchableText.includes(alias)) score += 42;
  }

  return score;
}

function pickRandom(items) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

export function getMarketStickerPacks() {
  const installedIds = new Set(readInstalledPackIds());
  return MARKET_PACKS.map(pack => ({ ...pack, installed: installedIds.has(pack.id) }));
}

export function installStickerPack(packId) {
  const installedIds = new Set(readInstalledPackIds());
  installedIds.add(packId);
  writeInstalledPackIds([...installedIds]);
  return getMarketStickerPacks();
}

export function removeStickerPack(packId) {
  const installedIds = new Set(readInstalledPackIds());
  installedIds.delete(packId);
  writeInstalledPackIds([...installedIds]);
  return getMarketStickerPacks();
}

export function getInstalledStickers() {
  const installedIds = new Set(readInstalledPackIds());
  return ALL_STICKERS.filter(sticker => installedIds.has(sticker.packId));
}

export function searchMarketStickers(keyword = '', limit = 80) {
  const query = String(keyword || '').trim();
  const source = ALL_STICKERS;
  if (!query) return source.slice(0, limit);
  return source
    .map(sticker => ({ sticker, score: scoreSticker(sticker, query) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.sticker);
}

export function searchStickersSync(keyword = '', limit = 80) {
  const query = String(keyword || '').trim();
  const source = getInstalledStickers();
  if (!query) return source.slice(0, limit);
  return source
    .map(sticker => ({ sticker, score: scoreSticker(sticker, query) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.sticker);
}

export async function findStickerByKeyword(keyword = '') {
  const matches = searchStickersSync(keyword, 12);
  if (matches.length) return pickRandom(matches.slice(0, Math.min(4, matches.length)));

  const marketMatches = searchMarketStickers(keyword, 12);
  if (marketMatches.length) return pickRandom(marketMatches.slice(0, Math.min(4, marketMatches.length)));

  return pickRandom(getInstalledStickers());
}

export function getStickerKeywordPresets(contextText = '', limit = 24) {
  return getOfficialStickerKeywordPresets(contextText, limit);
}

export function getAllOfficialStickers() {
  return ALL_STICKERS;
}
