import { findStickerByKeyword } from './officialStickerStore';

const STICKER_MARKER_REGEX = /^\s*\[(?:sticker|表情包)\s*[:：]\s*([^\]]+?)\s*\]\s*$/i;
const INLINE_STICKER_REGEX = /\[(?:sticker|表情包)\s*[:：]\s*([^\]]+?)\s*\]/gi;

export function isStickerMarker(text) {
  return STICKER_MARKER_REGEX.test(String(text || ''));
}

export function extractStickerKeyword(text) {
  return String(text || '').match(STICKER_MARKER_REGEX)?.[1]?.trim() || '';
}

export function getMessagePlainText(message) {
  if (!message) return '';
  if (message.type === 'sticker') {
    const sticker = message.sticker || {};
    return `[表情包:${sticker.meaning || sticker.emotion || sticker.name || '表情'}]`;
  }
  return String(message.text || '');
}

export function splitTextAndStickerMarkers(text) {
  const source = String(text || '').trim();
  if (!source) return [];

  const result = [];
  let lastIndex = 0;
  let match;
  INLINE_STICKER_REGEX.lastIndex = 0;

  while ((match = INLINE_STICKER_REGEX.exec(source)) !== null) {
    const before = source.slice(lastIndex, match.index).trim();
    if (before) result.push({ type: 'text', text: before });
    result.push({ type: 'sticker_marker', keyword: match[1].trim() });
    lastIndex = INLINE_STICKER_REGEX.lastIndex;
  }

  const after = source.slice(lastIndex).trim();
  if (after) result.push({ type: 'text', text: after });

  return result.length ? result : [{ type: 'text', text: source }];
}

export async function createStickerMessage({ role = 'assistant', keyword, sticker, id, time }) {
  const selectedSticker = sticker || await findStickerByKeyword(keyword);
  if (!selectedSticker) {
    return {
      id: id || Date.now(),
      role,
      type: 'text',
      text: `[sticker:${keyword || '表情'}]`,
      time: time || new Date().toLocaleTimeString(),
      isAnimated: false,
    };
  }

  return {
    id: id || Date.now(),
    role,
    type: 'sticker',
    text: '',
    sticker: selectedSticker,
    time: time || new Date().toLocaleTimeString(),
    isAnimated: false,
  };
}
