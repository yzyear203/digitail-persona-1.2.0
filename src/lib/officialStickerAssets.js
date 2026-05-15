function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizePath(path) {
  return String(path || '').replace(/^\/+/, '');
}

function withBase(base, path) {
  try {
    return new URL(normalizePath(path), base).href;
  } catch {
    return '';
  }
}

function publicAssetCandidates(path) {
  const normalizedPath = normalizePath(path);
  const candidates = [];
  const viteBase = import.meta.env.BASE_URL || './';

  if (typeof window !== 'undefined') {
    candidates.push(withBase(viteBase, window.location.href));
    candidates.push(withBase(normalizedPath, window.location.href));
    candidates.push(`${window.location.origin}/${normalizedPath}`);

    const currentDir = window.location.pathname.endsWith('/')
      ? window.location.pathname
      : window.location.pathname.slice(0, window.location.pathname.lastIndexOf('/') + 1);
    candidates.push(`${window.location.origin}${currentDir}${normalizedPath}`);
  }

  candidates.push(`/${normalizedPath}`);
  candidates.push(`./${normalizedPath}`);
  return uniqueValues(candidates);
}

export const OFFICIAL_STICKER_SHEET_IMAGES = {
  official_65: publicAssetCandidates('official-stickers/official_65.png'),
};
