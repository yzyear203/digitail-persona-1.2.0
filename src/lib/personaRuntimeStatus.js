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

export function getPersonaRuntimeStatusId(persona) {
  return String(persona?._id || persona?.id || '').trim();
}

export function isRuntimeStatusExpired(status, now = Date.now()) {
  if (!status?.expires_at) return true;
  const expiresAt = new Date(status.expires_at).getTime();
  return !Number.isFinite(expiresAt) || expiresAt <= now;
}

export function getRuntimeStatusRemainingMs(status, now = Date.now()) {
  if (!status?.expires_at) return 0;
  const expiresAt = new Date(status.expires_at).getTime();
  if (!Number.isFinite(expiresAt)) return 0;
  return Math.max(0, expiresAt - now);
}

export function normalizeRuntimeStatus(status = {}) {
  return {
    ...FALLBACK_STATUS,
    ...status,
    label: String(status.label || status.state || FALLBACK_STATUS.label).slice(0, 8),
    activity: String(status.activity || status.value || FALLBACK_STATUS.activity).slice(0, 56),
    source: status.source || 'persona_runtime',
  };
}

export function readRuntimeStatus() {
  return null;
}

export function shouldRefreshRuntimeStatus() {
  return false;
}

export function persistRuntimeStatus() {
  return null;
}

export function extractAndPersistRuntimeStatusMarkers(text) {
  return { text: String(text || '').replace(/\[status:\s*\{[\s\S]*?\}\]/gi, '').trim(), status: null, personaId: '' };
}

export function getRuntimeStatusFromT3() {
  return null;
}

export function getDisplayRuntimeStatus() {
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
