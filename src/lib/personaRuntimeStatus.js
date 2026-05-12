const RUNTIME_STATUS_STORAGE_PREFIX = 'persona_runtime_status_';
const STATUS_MARKER_REGEX = /\[status:\s*(\{[\s\S]*?\})\]/gi;

const FALLBACK_STATUS = {
  label: '待唤醒',
  activity: '等待下一次自然更新',
  mood: '',
  base_mood: '未定',
  chat_mood: '未定',
  emotional_shift: '',
  color: 'slate',
  duration_minutes: 0,
  updated_at: '',
  expires_at: '',
  source: 'fallback',
};

const COLOR_SET = new Set(['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'slate']);

function compactText(value, maxChars) {
  return String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
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

function normalizeColor(value) {
  const color = String(value || '').trim().toLowerCase();
  return COLOR_SET.has(color) ? color : 'slate';
}

function getRawExpiresAt(source = {}) {
  return source.expires_at || source.expiresAt || '';
}

function buildExpiresAt(source = {}) {
  const rawExpiresAt = getRawExpiresAt(source);
  if (rawExpiresAt) return rawExpiresAt;

  const minutes = Number(source.duration_minutes || source.durationMinutes || 0);
  if (Number.isFinite(minutes) && minutes > 0) {
    return new Date(Date.now() + minutes * 60 * 1000).toISOString();
  }

  return '';
}

function getStorageKey(personaId) {
  return `${RUNTIME_STATUS_STORAGE_PREFIX}${personaId}`;
}

export function getPersonaRuntimeStatusId(persona) {
  return String(persona?._id || persona?.id || '').trim();
}

export function isRuntimeStatusExpired(status, now = Date.now()) {
  const rawExpiresAt = getRawExpiresAt(status);
  if (!rawExpiresAt) return false;
  const expiresAt = new Date(rawExpiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

export function getRuntimeStatusRemainingMs(status, now = Date.now()) {
  const rawExpiresAt = getRawExpiresAt(status);
  if (!rawExpiresAt) return 0;
  const expiresAt = new Date(rawExpiresAt).getTime();
  if (!Number.isFinite(expiresAt)) return 0;
  return Math.max(0, expiresAt - now);
}

export function normalizeRuntimeStatus(status = {}, fallback = {}) {
  const source = status || {};
  const base = fallback || {};
  const label = compactText(source.label || source.state || source.activity_label || base.label || FALLBACK_STATUS.label, 8);
  const activity = compactText(source.activity || source.value || base.activity || FALLBACK_STATUS.activity, 56);
  const mood = compactText(source.mood || source.chat_mood || source.current_mood || base.mood || '', 12);

  return {
    ...FALLBACK_STATUS,
    ...base,
    ...source,
    label,
    activity,
    mood,
    base_mood: compactText(source.base_mood || source.baseMood || base.base_mood || mood || '未定', 12),
    chat_mood: compactText(source.chat_mood || source.chatMood || base.chat_mood || mood || '未定', 12),
    emotional_shift: compactText(source.emotional_shift || source.emotionalShift || base.emotional_shift || '', 24),
    color: normalizeColor(source.color || source.tone || base.color),
    updated_at: source.updated_at || source.updatedAt || new Date().toISOString(),
    expires_at: buildExpiresAt(source) || buildExpiresAt(base),
    source: source.source || base.source || 'persona_runtime',
  };
}

export function readRuntimeStatus(personaId) {
  if (typeof localStorage === 'undefined' || !personaId) return null;
  try {
    const raw = localStorage.getItem(getStorageKey(personaId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (isRuntimeStatusExpired(parsed)) {
      localStorage.removeItem(getStorageKey(personaId));
      return null;
    }
    return normalizeRuntimeStatus(parsed);
  } catch (error) {
    console.warn('读取 Persona 运行状态失败:', error);
    return null;
  }
}

export function shouldRefreshRuntimeStatus() {
  return false;
}

export function persistRuntimeStatus(personaId, status) {
  if (typeof localStorage === 'undefined' || !personaId || !status) return null;
  const normalized = normalizeRuntimeStatus(status, readRuntimeStatus(personaId) || {});

  try {
    localStorage.setItem(getStorageKey(personaId), JSON.stringify(normalized));
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

  return { text: cleanedText.trim(), status: latestStatus, personaId: latestPersonaId };
}

export function getRuntimeStatusFromT3(t3Content) {
  const t3 = parseMaybeJSON(t3Content);
  const runtimeStatus = t3.runtime_status || t3.persona_runtime_status;
  if (runtimeStatus && !isRuntimeStatusExpired(runtimeStatus)) {
    return normalizeRuntimeStatus(runtimeStatus);
  }
  return null;
}

export function getDisplayRuntimeStatus(persona) {
  const personaId = getPersonaRuntimeStatusId(persona);
  const storedStatus = readRuntimeStatus(personaId);
  if (storedStatus) return storedStatus;

  const t3Status = getRuntimeStatusFromT3(persona?.content);
  if (t3Status) return t3Status;

  return { ...FALLBACK_STATUS, updated_at: new Date().toISOString() };
}

export function formatRuntimeStatusRemaining(status, now = Date.now()) {
  const remainingMs = getRuntimeStatusRemainingMs(status, now);
  if (remainingMs <= 0) return '等待唤醒';
  const remainingMinutes = Math.ceil(remainingMs / 60000);
  if (remainingMinutes < 60) return `约 ${remainingMinutes} 分钟后`;
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  return minutes ? `约 ${hours} 小时 ${minutes} 分钟后` : `约 ${hours} 小时后`;
}
