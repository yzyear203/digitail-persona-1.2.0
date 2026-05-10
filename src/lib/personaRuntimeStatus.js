const RUNTIME_STATUS_STORAGE_PREFIX = 'persona_runtime_status_';
const EMOTION_ACCUMULATOR_STORAGE_PREFIX = 'persona_emotion_accumulator_';

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

const DEFAULT_STATUS_TTL_MINUTES = 45;
const MIN_STATUS_TTL_MINUTES = 5;
const MAX_STATUS_TTL_MINUTES = 8 * 60;
const DISPLAY_MOOD_STREAK_THRESHOLD = 4;
const BASE_MOOD_STREAK_THRESHOLD = 8;
const STATUS_MARKER_REGEX = /\[status:\s*(\{[\s\S]*?\})\]/gi;

function compactText(value, maxChars) {
  return String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

function normalizeMood(value, fallback = '') {
  return compactText(value || fallback || '', 12) || '平稳';
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

function clampDuration(minutes) {
  const numeric = Number(minutes);
  if (!Number.isFinite(numeric)) return DEFAULT_STATUS_TTL_MINUTES;
  return Math.min(MAX_STATUS_TTL_MINUTES, Math.max(MIN_STATUS_TTL_MINUTES, Math.round(numeric)));
}

function parseChineseNumber(text) {
  const source = String(text || '').trim();
  const digitMatch = source.match(/\d+/);
  if (digitMatch) return Number(digitMatch[0]);

  const digitMap = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (source.includes('半')) return 30;
  if (source === '十') return 10;
  const tenIndex = source.indexOf('十');
  if (tenIndex >= 0) {
    const tens = tenIndex === 0 ? 1 : digitMap[source[tenIndex - 1]] || 1;
    const ones = digitMap[source[tenIndex + 1]] || 0;
    return tens * 10 + ones;
  }
  return digitMap[source[0]] || null;
}

function parseDurationMinutes(value) {
  if (Number.isFinite(Number(value))) return clampDuration(Number(value));
  const source = String(value || '').trim();
  if (!source) return DEFAULT_STATUS_TTL_MINUTES;
  const number = parseChineseNumber(source) || DEFAULT_STATUS_TTL_MINUTES;
  if (/小时|钟头|hour/i.test(source)) return clampDuration(number * 60);
  return clampDuration(number);
}

function resolveDurationMinutes(source, fallback) {
  return parseDurationMinutes(
    source.duration_minutes
    || source.durationMinutes
    || source.estimated_minutes
    || source.estimatedMinutes
    || source.duration
    || source.ttl_minutes
    || fallback.duration_minutes
    || fallback.durationMinutes
  );
}

function getRawExpiresAt(source = {}) {
  return source.expires_at || source.expiresAt || '';
}

function isRawStatusExpired(source, now = Date.now()) {
  const rawExpiresAt = getRawExpiresAt(source);
  if (!rawExpiresAt) return false;
  const expiresAt = new Date(rawExpiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= now;
}

function buildExpiresAt(source, durationMinutes, now) {
  const rawExpiresAt = getRawExpiresAt(source);
  if (rawExpiresAt) {
    const parsed = new Date(rawExpiresAt).getTime();
    if (Number.isFinite(parsed) && parsed > now) return new Date(parsed).toISOString();
  }
  return new Date(now + durationMinutes * 60 * 1000).toISOString();
}

function getEmotionAccumulatorKey(personaId) {
  return `${EMOTION_ACCUMULATOR_STORAGE_PREFIX}${personaId}`;
}

function readEmotionAccumulator(personaId) {
  if (typeof localStorage === 'undefined' || !personaId) return {};
  try {
    return JSON.parse(localStorage.getItem(getEmotionAccumulatorKey(personaId)) || '{}');
  } catch {
    return {};
  }
}

function saveEmotionAccumulator(personaId, accumulator) {
  if (typeof localStorage === 'undefined' || !personaId) return;
  try {
    localStorage.setItem(getEmotionAccumulatorKey(personaId), JSON.stringify(accumulator));
  } catch (error) {
    console.warn('保存 Persona 情绪累积器失败:', error);
  }
}

function buildNextEmotionAccumulator(previous = {}, incomingMood) {
  const mood = normalizeMood(incomingMood, previous.last_mood || '平稳');
  const sameMood = previous.last_mood === mood;
  const streak = sameMood ? Number(previous.streak || 0) + 1 : 1;
  return {
    last_mood: mood,
    streak,
    updated_at: new Date().toISOString(),
  };
}

function mergeBaseMood(previousBaseMood, incomingMood) {
  const baseMood = normalizeMood(previousBaseMood, '平稳');
  const mood = normalizeMood(incomingMood, baseMood);
  if (!baseMood || baseMood === '未定' || baseMood === '平稳') return mood;
  if (baseMood === mood || baseMood.includes(mood)) return baseMood;
  if (baseMood.length <= 2 && mood.length <= 2) return compactText(`又${baseMood}又${mood}`, 12);
  return compactText(`${baseMood}但${mood}`, 12);
}

function isEmptyOrFallbackStatus(status) {
  return !status || status.source === 'fallback' || !status.expires_at;
}

function buildDisplayedStatus({ previousStatus, incomingStatus, accumulator }) {
  const previous = previousStatus || {};
  const incoming = incomingStatus || {};
  const shouldChangeDisplay = isEmptyOrFallbackStatus(previous)
    || isRawStatusExpired(previous)
    || accumulator.streak >= DISPLAY_MOOD_STREAK_THRESHOLD;

  const baseMood = accumulator.streak >= BASE_MOOD_STREAK_THRESHOLD
    ? mergeBaseMood(previous.base_mood || incoming.base_mood, incoming.chat_mood)
    : (previous.base_mood || incoming.base_mood || incoming.chat_mood || '平稳');

  if (shouldChangeDisplay) {
    return {
      ...incoming,
      base_mood: baseMood,
      chat_mood: incoming.chat_mood,
      mood: incoming.chat_mood,
      emotional_shift: incoming.emotional_shift,
      emotion_streak: accumulator.streak,
      emotion_display_threshold: DISPLAY_MOOD_STREAK_THRESHOLD,
      emotion_base_threshold: BASE_MOOD_STREAK_THRESHOLD,
      last_observed_mood: incoming.chat_mood,
      updated_at: new Date().toISOString(),
    };
  }

  return {
    ...previous,
    base_mood: baseMood,
    last_observed_mood: incoming.chat_mood,
    emotion_streak: accumulator.streak,
    emotion_display_threshold: DISPLAY_MOOD_STREAK_THRESHOLD,
    emotion_base_threshold: BASE_MOOD_STREAK_THRESHOLD,
    pending_emotional_shift: incoming.emotional_shift,
    updated_at: previous.updated_at || new Date().toISOString(),
  };
}

export function getPersonaRuntimeStatusId(persona) {
  return String(persona?._id || persona?.id || '').trim();
}

export function isRuntimeStatusExpired(status, now = Date.now()) {
  return isRawStatusExpired(status, now);
}

export function getRuntimeStatusRemainingMs(status, now = Date.now()) {
  if (!status?.expires_at) return 0;
  const expiresAt = new Date(status.expires_at).getTime();
  if (!Number.isFinite(expiresAt)) return 0;
  return Math.max(0, expiresAt - now);
}

export function normalizeRuntimeStatus(status = {}, fallback = {}) {
  const now = Date.now();
  const source = status || {};
  const durationMinutes = resolveDurationMinutes(source, fallback);
  const label = compactText(source.label || source.state || source.activity_label || fallback.label || '在线', 8) || '在线';
  const activity = compactText(source.activity || source.value || fallback.activity || '', 56);
  const mood = normalizeMood(source.mood || source.chat_mood || source.current_mood || fallback.mood || '', fallback.chat_mood || fallback.base_mood || '平稳');
  const baseMood = normalizeMood(source.base_mood || source.baseMood || source.temperament_mood || fallback.base_mood || fallback.baseMood || mood, mood);
  const chatMood = normalizeMood(source.chat_mood || source.chatMood || source.current_mood || source.reactive_mood || fallback.chat_mood || fallback.chatMood || mood, baseMood);
  const emotionalShift = compactText(source.emotional_shift || source.emotionalShift || fallback.emotional_shift || fallback.emotionalShift || '', 24);
  const expiresAt = buildExpiresAt(source, durationMinutes, now);

  return {
    label,
    activity,
    mood: chatMood,
    base_mood: baseMood,
    chat_mood: chatMood,
    emotional_shift: emotionalShift,
    color: normalizeColor(source.color || source.tone || fallback.color),
    duration_minutes: durationMinutes,
    updated_at: source.updated_at || source.updatedAt || new Date(now).toISOString(),
    expires_at: expiresAt,
    source: source.source || 'persona_runtime',
  };
}

export function readRuntimeStatus(personaId) {
  if (typeof localStorage === 'undefined' || !personaId) return null;
  const storageKey = `${RUNTIME_STATUS_STORAGE_PREFIX}${personaId}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (isRawStatusExpired(parsed)) {
      localStorage.removeItem(storageKey);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('persona-runtime-status-expired', {
          detail: { personaId },
        }));
      }
      return null;
    }
    return normalizeRuntimeStatus(parsed);
  } catch (error) {
    console.warn('读取 Persona 运行状态失败:', error);
    localStorage.removeItem(storageKey);
    return null;
  }
}

export function shouldRefreshRuntimeStatus(personaId) {
  // 每轮对话都让模型返回“本轮观察到的当前情绪”，但前端不会每轮改展示。
  // 展示变化由 emotion accumulator 控制：同类情绪连续 4 次才改当前状态，连续 8 次才影响基础情绪。
  return Boolean(personaId);
}

export function persistRuntimeStatus(personaId, status) {
  if (typeof localStorage === 'undefined' || !personaId || !status) return null;
  const previousStatus = readRuntimeStatus(personaId) || getDisplayRuntimeStatus(null);
  const incomingStatus = normalizeRuntimeStatus(status, previousStatus || {});
  const accumulator = buildNextEmotionAccumulator(readEmotionAccumulator(personaId), incomingStatus.chat_mood);
  const displayedStatus = buildDisplayedStatus({ previousStatus, incomingStatus, accumulator });

  saveEmotionAccumulator(personaId, accumulator);

  try {
    localStorage.setItem(`${RUNTIME_STATUS_STORAGE_PREFIX}${personaId}`, JSON.stringify(displayedStatus));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('persona-runtime-status-updated', {
        detail: { personaId, status: displayedStatus, accumulator },
      }));
    }
  } catch (error) {
    console.warn('保存 Persona 运行状态失败:', error);
  }
  return displayedStatus;
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
  if (runtimeStatus && !isRawStatusExpired(runtimeStatus)) {
    return normalizeRuntimeStatus(runtimeStatus);
  }

  // current_context 是“闪电状态/上下文 TTL”，不是生活状态闹钟。
  // 它可能有 7 天有效期，不能拿来计算 30~180 分钟的 Persona 闹钟倒计时。
  return null;
}

export function getDisplayRuntimeStatus(persona) {
  const personaId = getPersonaRuntimeStatusId(persona);
  const storedStatus = readRuntimeStatus(personaId);
  if (storedStatus) return storedStatus;

  const t3Status = getRuntimeStatusFromT3(persona?.content);
  if (t3Status) return t3Status;

  return {
    label: '待唤醒',
    activity: '下一次聊天时更新 TA 的生活状态和当前情绪',
    mood: '',
    base_mood: '未定',
    chat_mood: '未定',
    emotional_shift: '',
    color: 'slate',
    duration_minutes: 0,
    updated_at: new Date().toISOString(),
    expires_at: '',
    source: 'fallback',
  };
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
