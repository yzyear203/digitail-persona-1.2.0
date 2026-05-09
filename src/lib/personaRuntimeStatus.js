const RUNTIME_STATUS_STORAGE_PREFIX = 'persona_runtime_status_';

const COLOR_ALIASES = {
  red: 'red',
  '红': 'red',
  '红色': 'red',
  orange: 'orange',
  '橙': 'orange',
  '橙色': 'orange',
  yellow: 'yellow',
  '黄': 'yellow',
  '黄色': 'yellow',
  green: 'green',
  emerald: 'green',
  '绿': 'green',
  '绿色': 'green',
  blue: 'blue',
  sky: 'blue',
  '蓝': 'blue',
  '蓝色': 'blue',
  purple: 'purple',
  violet: 'purple',
  '紫': 'purple',
  '紫色': 'purple',
  pink: 'pink',
  rose: 'pink',
  '粉': 'pink',
  '粉色': 'pink',
  slate: 'slate',
  gray: 'slate',
  grey: 'slate',
  '灰': 'slate',
  '灰色': 'slate',
};

const DEFAULT_STATUS_TTL_MS = 2 * 60 * 60 * 1000;
const STATUS_MARKER_REGEX = /\[status:\s*(\{[\s\S]*?\})\]/gi;

function compactText(value, maxChars) {
  return String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

function normalizeColor(value) {
  const raw = String(value || '').trim().toLowerCase();
  return COLOR_ALIASES[raw] || 'green';
}

function parseMaybeJSON(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

export function getPersonaRuntimeStatusId(persona) {
  return String(persona?._id || persona?.id || '').trim();
}

export function isRuntimeStatusExpired(status, now = Date.now()) {
  if (!status?.expires_at) return false;
  const expiresAt = new Date(status.expires_at).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

export function normalizeRuntimeStatus(status = {}, fallback = {}) {
  const now = Date.now();
  const source = status || {};
  const label = compactText(source.label || source.state || source.mood || fallback.label || '在线', 8) || '在线';
  const activity = compactText(source.activity || source.value || fallback.activity || '', 56);
  const mood = compactText(source.mood || fallback.mood || '', 12);
  const expiresAt = source.expires_at || source.expiresAt || new Date(now + DEFAULT_STATUS_TTL_MS).toISOString();

  return {
    label,
    activity,
    mood,
    color: normalizeColor(source.color || source.tone || fallback.color),
    updated_at: source.updated_at || source.updatedAt || new Date(now).toISOString(),
    expires_at: expiresAt,
    source: source.source || 'persona_runtime',
  };
}

export function readRuntimeStatus(personaId) {
  if (typeof localStorage === 'undefined' || !personaId) return null;
  try {
    const raw = localStorage.getItem(`${RUNTIME_STATUS_STORAGE_PREFIX}${personaId}`);
    if (!raw) return null;
    const status = normalizeRuntimeStatus(JSON.parse(raw));
    if (isRuntimeStatusExpired(status)) {
      localStorage.removeItem(`${RUNTIME_STATUS_STORAGE_PREFIX}${personaId}`);
      return null;
    }
    return status;
  } catch (error) {
    console.warn('读取 Persona 运行状态失败:', error);
    return null;
  }
}

export function persistRuntimeStatus(personaId, status) {
  if (typeof localStorage === 'undefined' || !personaId || !status) return null;
  const normalized = normalizeRuntimeStatus(status);
  try {
    localStorage.setItem(`${RUNTIME_STATUS_STORAGE_PREFIX}${personaId}`, JSON.stringify(normalized));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('persona-runtime-status-updated', {
        detail: { personaId, status: normalized },
      }));
    }
  } catch (error) {
    console.warn('保存 Persona 运行状态失败:', error);
  }
  return normalized;
}

export function extractAndPersistRuntimeStatusMarkers(text) {
  const sourceText = String(text || '');
  let latestStatus = null;
  let latestPersonaId = '';

  const cleanedText = sourceText.replace(STATUS_MARKER_REGEX, (fullMatch, jsonText) => {
    try {
      const parsed = JSON.parse(jsonText);
      const personaId = String(parsed.personaId || parsed.persona_id || parsed.id || '').trim();
      if (personaId) {
        latestPersonaId = personaId;
        latestStatus = persistRuntimeStatus(personaId, parsed);
      }
    } catch (error) {
      console.warn('Persona 状态标记解析失败:', error);
    }
    return '';
  });

  return { text: cleanedText, status: latestStatus, personaId: latestPersonaId };
}

export function getRuntimeStatusFromT3(t3Content) {
  const t3 = parseMaybeJSON(t3Content);
  const runtimeStatus = t3.runtime_status || t3.persona_runtime_status;
  if (runtimeStatus) {
    const normalized = normalizeRuntimeStatus(runtimeStatus);
    if (!isRuntimeStatusExpired(normalized)) return normalized;
  }

  if (t3.current_context?.value) {
    const normalized = normalizeRuntimeStatus({
      label: '进行中',
      activity: t3.current_context.value,
      color: 'purple',
      expires_at: t3.current_context.expires_at,
      source: 'current_context',
    });
    if (!isRuntimeStatusExpired(normalized)) return normalized;
  }

  return null;
}

export function getDisplayRuntimeStatus(persona) {
  const personaId = getPersonaRuntimeStatusId(persona);
  const storedStatus = readRuntimeStatus(personaId);
  if (storedStatus) return storedStatus;

  const t3Status = getRuntimeStatusFromT3(persona?.content);
  if (t3Status) return t3Status;

  return normalizeRuntimeStatus({
    label: '在线',
    activity: '等待新的聊天信号',
    color: 'green',
    source: 'fallback',
  });
}
