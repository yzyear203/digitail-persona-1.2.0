import { getRuntimeAffect } from './runtimeAffect';

const RUNTIME_STATUS_STORAGE_PREFIX = 'persona_runtime_status_';
const RUNTIME_SCHEDULE_STORAGE_PREFIX = 'persona_runtime_schedule_';
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

const DAILY_SEGMENT_TEMPLATES = [
  { start: 0, end: 420, label: '睡觉中', color: 'slate', base_mood: '困倦', activities: ['窝在被子里睡觉', '半梦半醒地补觉', '手机丢在一边睡着了'] },
  { start: 420, end: 540, label: '醒神中', color: 'blue', base_mood: '迷糊', activities: ['刚醒，边喝水边缓慢开机', '洗漱完在窗边醒神', '一边找东西一边整理今天的状态'] },
  { start: 540, end: 690, label: '赶路中', color: 'orange', base_mood: '清醒', activities: ['带着耳机赶路，顺手看两眼消息', '在路上晃着，脑子慢慢转起来', '边走边想今天要处理的事'] },
  { start: 690, end: 780, label: '专注中', color: 'green', base_mood: '专注', activities: ['坐下来处理正事，桌面有点乱', '盯着屏幕把手头的事往前推', '进入工作状态，偶尔看一眼消息'] },
  { start: 780, end: 870, label: '吃饭中', color: 'yellow', base_mood: '松弛', activities: ['吃饭时刷着手机，整个人松下来一点', '在吃东西补能量，脑子短暂放空', '边吃边看外面的动静'] },
  { start: 870, end: 1080, label: '忙碌中', color: 'purple', base_mood: '认真', activities: ['下午继续处理事情，状态还算在线', '在一堆小任务里来回切换', '一边整理思路一边推进今天的安排'] },
  { start: 1080, end: 1230, label: '放空中', color: 'pink', base_mood: '散漫', activities: ['傍晚有点放空，靠着椅背回神', '把事情暂时放下，在慢慢回血', '刷到一点新鲜事，心情轻了一点'] },
  { start: 1230, end: 1380, label: '摸鱼中', color: 'green', base_mood: '松弛', activities: ['晚上窝着刷手机，顺手回消息', '靠在一边摸鱼，整个人没那么紧绷', '慢悠悠处理零碎事情，心情比较软'] },
  { start: 1380, end: 1440, label: '准备睡', color: 'slate', base_mood: '困倦', activities: ['准备睡了，但还在看最后几眼手机', '灯光暗下来，脑子开始降速', '把今天收尾，慢慢进入睡前状态'] },
];

function compactText(value, maxChars) {
  return String(value || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

function parseMaybeJSON(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
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
  if (Number.isFinite(minutes) && minutes > 0) return new Date(Date.now() + minutes * 60 * 1000).toISOString();
  return '';
}

function getStorageKey(personaId) {
  return `${RUNTIME_STATUS_STORAGE_PREFIX}${personaId}`;
}

function getScheduleStorageKey(personaId, dateKey) {
  return `${RUNTIME_SCHEDULE_STORAGE_PREFIX}${personaId}_${dateKey}`;
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMinuteOfDay(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

function parseClockToMinute(value) {
  if (typeof value === 'number') return value;
  const [hour = 0, minute = 0] = String(value || '00:00').split(':').map(Number);
  return Math.min(1440, Math.max(0, hour * 60 + minute));
}

function formatClockFromMinute(minute) {
  const safeMinute = Math.min(1440, Math.max(0, Number(minute || 0)));
  const hour = Math.floor(safeMinute / 60);
  const min = safeMinute % 60;
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function localDateAtMinute(dateKey, minuteOfDay) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  date.setMinutes(minuteOfDay);
  return date;
}

function localDateTimeToISO(dateKey, clock) {
  return localDateAtMinute(dateKey, parseClockToMinute(clock)).toISOString();
}

function hashString(value) {
  const source = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickSeeded(items, seed) {
  if (!items?.length) return '';
  return items[seed % items.length];
}

function buildScheduleStatus({ personaId, dateKey, template, index }) {
  const seed = hashString(`${personaId}_${dateKey}_${index}_${template.label}`);
  const activity = pickSeeded(template.activities, seed);
  const startAt = localDateAtMinute(dateKey, template.start);
  const endAt = localDateAtMinute(dateKey, template.end);
  return normalizeRuntimeStatus({
    personaId,
    label: template.label,
    activity,
    color: template.color,
    base_mood: template.base_mood,
    chat_mood: template.base_mood,
    emotional_shift: '按当日生活轨迹自然推进',
    duration_minutes: Math.max(1, template.end - template.start),
    updated_at: startAt.toISOString(),
    expires_at: endAt.toISOString(),
    source: 'daily_schedule',
    schedule_date: dateKey,
    schedule_index: index,
    start: formatClockFromMinute(template.start),
    end: formatClockFromMinute(template.end),
  });
}

function generateDailyRuntimeSchedule(persona, now = new Date()) {
  const personaId = getPersonaRuntimeStatusId(persona);
  const dateKey = getLocalDateKey(now);
  return {
    personaId,
    dateKey,
    date: dateKey,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'local',
    created_at: new Date().toISOString(),
    source: 'local_daily_schedule',
    items: DAILY_SEGMENT_TEMPLATES.map((template, index) => buildScheduleStatus({ personaId, dateKey, template, index })),
  };
}

function readDailyRuntimeSchedule(personaId, dateKey) {
  if (typeof localStorage === 'undefined' || !personaId || !dateKey) return null;
  try {
    const raw = localStorage.getItem(getScheduleStorageKey(personaId, dateKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if ((parsed?.dateKey || parsed?.date) !== dateKey || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch (error) {
    console.warn('读取 Persona 当日状态日程失败:', error);
    return null;
  }
}

function persistDailyRuntimeSchedule(schedule) {
  if (typeof localStorage === 'undefined' || !schedule?.personaId || !(schedule?.dateKey || schedule?.date)) return null;
  try {
    localStorage.setItem(getScheduleStorageKey(schedule.personaId, schedule.dateKey || schedule.date), JSON.stringify(schedule));
  } catch (error) {
    console.warn('保存 Persona 当日状态日程失败:', error);
  }
  return schedule;
}

function ensureDailyRuntimeSchedule(persona, now = new Date()) {
  const personaId = getPersonaRuntimeStatusId(persona);
  const dateKey = getLocalDateKey(now);
  if (!personaId) return null;
  const existing = readDailyRuntimeSchedule(personaId, dateKey);
  if (existing) return existing;
  return persistDailyRuntimeSchedule(generateDailyRuntimeSchedule(persona, now));
}

function normalizeScheduleItem(item, schedule, now = new Date()) {
  if (!item) return null;
  const dateKey = schedule?.date || schedule?.dateKey || getLocalDateKey(now);
  const startMinute = Number.isFinite(item.start) ? item.start : parseClockToMinute(item.start);
  const endMinute = Number.isFinite(item.end) ? item.end : parseClockToMinute(item.end || item.expires_at);
  const safeEnd = endMinute > startMinute ? endMinute : Math.min(1440, startMinute + Number(item.duration_minutes || 60));
  return normalizeRuntimeStatus({
    ...item,
    start: formatClockFromMinute(startMinute),
    end: formatClockFromMinute(safeEnd),
    updated_at: item.updated_at || localDateAtMinute(dateKey, startMinute).toISOString(),
    expires_at: item.expires_at || localDateAtMinute(dateKey, safeEnd).toISOString(),
    duration_minutes: item.duration_minutes || Math.max(1, safeEnd - startMinute),
    source: schedule?.source || item.source || 't3_runtime_schedule',
    schedule_date: dateKey,
  });
}

function getCurrentStatusFromAnySchedule(schedule, now = new Date()) {
  if (!schedule?.items?.length) return null;
  const minute = getMinuteOfDay(now);
  const current = schedule.items.find(item => {
    const start = Number.isFinite(item.start) ? item.start : parseClockToMinute(item.start);
    const end = Number.isFinite(item.end) ? item.end : parseClockToMinute(item.end || item.expires_at);
    const safeEnd = end > start ? end : Math.min(1440, start + Number(item.duration_minutes || 60));
    return minute >= start && minute < safeEnd;
  }) || schedule.items[schedule.items.length - 1];
  return normalizeScheduleItem(current, schedule, now);
}

function getRuntimeScheduleFromT3(t3Content, now = new Date()) {
  const t3 = parseMaybeJSON(t3Content);
  const schedule = t3.runtime_schedule || t3.persona_runtime_schedule;
  if (!schedule || !Array.isArray(schedule.items)) return null;
  const today = getLocalDateKey(now);
  const scheduleDate = schedule.date || schedule.dateKey;
  if (scheduleDate !== today) return null;
  return getCurrentStatusFromAnySchedule(schedule, now);
}

function isManualRuntimeStatus(status) {
  return status && status.source && !['daily_schedule', 'local_daily_schedule', 't3_runtime_schedule', 'dsm_memory_maintenance', 'fallback'].includes(status.source);
}

function applyRuntimeAffect(status, personaId) {
  if (!status || !personaId) return status;
  const affect = getRuntimeAffect(personaId, status.schedule_date || getLocalDateKey());
  if (!affect?.base_mood_patch) return status;
  return normalizeRuntimeStatus({
    ...status,
    base_mood: affect.base_mood_patch,
    chat_mood: affect.dominant_mood || affect.base_mood_patch,
    emotional_shift: `今天聊天中“${affect.dominant_mood || affect.base_mood_patch}”多次出现`,
    affect_date: affect.date,
    affect_counts: affect.chat_mood_counts,
  });
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
    emotional_shift: compactText(source.emotional_shift || source.emotionalShift || base.emotional_shift || '', 36),
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
      window.dispatchEvent(new CustomEvent('persona-runtime-status-updated', { detail: { personaId, status: normalized } }));
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
  if (runtimeStatus && !isRuntimeStatusExpired(runtimeStatus)) return normalizeRuntimeStatus(runtimeStatus);
  return null;
}

export function getDailyRuntimeSchedule(persona, now = new Date()) {
  return ensureDailyRuntimeSchedule(persona, now);
}

export function getDisplayRuntimeStatus(persona) {
  const personaId = getPersonaRuntimeStatusId(persona);
  const t3ScheduleStatus = getRuntimeScheduleFromT3(persona?.content);
  if (t3ScheduleStatus) return applyRuntimeAffect(t3ScheduleStatus, personaId);

  const storedStatus = readRuntimeStatus(personaId);
  if (isManualRuntimeStatus(storedStatus)) return storedStatus;

  const t3Status = getRuntimeStatusFromT3(persona?.content);
  if (isManualRuntimeStatus(t3Status)) return t3Status;

  const schedule = ensureDailyRuntimeSchedule(persona);
  const scheduleStatus = getCurrentStatusFromAnySchedule(schedule);
  if (scheduleStatus) return applyRuntimeAffect(scheduleStatus, personaId);

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
