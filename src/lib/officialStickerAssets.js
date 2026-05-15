const REPO_RAW_BASE = 'https://raw.githubusercontent.com/yzyear203/digitail-persona-1.2.0/main/public/';

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizePath(path) {
  return String(path || '').replace(/^\/+/, '');
}

function resolveUrl(path, base) {
  try {
    return new URL(normalizePath(path), base).href;
  } catch {
    return '';
  }
}

function ensureTrailingSlash(value) {
  return value.endsWith('/') ? value : `${value}/`;
}

function publicAssetCandidates(path) {
  const normalizedPath = normalizePath(path);
  const candidates = [];

  if (typeof window !== 'undefined') {
    const originBase = ensureTrailingSlash(window.location.origin);
    const documentBase = document?.baseURI || window.location.href;
    const viteBase = import.meta.env.BASE_URL || '/';
    const viteBaseUrl = resolveUrl(viteBase, originBase);

    // 1. 当前文档基准路径：适配 TCB / GitHub Pages / 子目录部署。
    candidates.push(resolveUrl(normalizedPath, documentBase));

    // 2. Vite base 路径：适配显式设置 base 的构建产物。
    if (viteBaseUrl) candidates.push(resolveUrl(normalizedPath, viteBaseUrl));

    // 3. 当前页面所在目录：适配 hash 路由和 index.html 同目录部署。
    const currentDir = window.location.pathname.endsWith('/')
      ? window.location.pathname
      : window.location.pathname.slice(0, window.location.pathname.lastIndexOf('/') + 1);
    candidates.push(resolveUrl(normalizedPath, `${window.location.origin}${currentDir}`));

    // 4. 站点根路径：Vite public 目录的标准引用方式。
    candidates.push(resolveUrl(normalizedPath, originBase));
  }

  // 5. 相对 / 根路径兜底。
  candidates.push(`./${normalizedPath}`);
  candidates.push(`/${normalizedPath}`);

  // 6. GitHub raw 兜底：即使静态部署漏拷贝 public 资源，也能显示真实表情图。
  candidates.push(`${REPO_RAW_BASE}${normalizedPath}`);

  return uniqueValues(candidates);
}

export const OFFICIAL_STICKER_SHEET_IMAGES = {
  official_65: publicAssetCandidates('official-stickers/official_65.png'),
};
