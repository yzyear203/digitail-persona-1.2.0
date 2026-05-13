const BASE_URL = import.meta.env.BASE_URL || '/';

function publicAsset(path) {
  const normalizedBase = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`;
  const normalizedPath = String(path || '').replace(/^\/+/, '');
  return `${normalizedBase}${normalizedPath}`;
}

export const OFFICIAL_STICKER_SHEET_IMAGES = {
  official_65: publicAsset('official-stickers/official_65.png'),
};
