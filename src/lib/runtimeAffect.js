const AFFECT_STORAGE_PREFIX = 'persona_runtime_affect_';
const MOOD_PATCH_THRESHOLD = 8;

const MOOD_RULES = [
  { mood: '开心', patterns: [/哈哈|笑死|开心|好耶|爽|太好了|喜欢|可爱|嘿嘿|不错|高兴|快乐|绷不住/] },
  { mood: '疲惫', patterns: [/累|困|熬夜|不想动|没力气|困死|好累|疲惫|撑不住/] },
  { mood: '低落', patterns: [/难过|伤心|想哭|委屈|破防|失落|心碎|不开心/] },
  { mood: '烦躁', patterns: [/烦|崩溃|红温|气死|无语|服了|烦死|离谱|受不了/] },
  { mood: '紧张', patterns: [/紧张|害怕|慌|焦虑|怎么办|怕|担心|心虚/] },
  { mood: '认真', patterns: [/分析|代码|题|证明|解释|检查|修|方案|逻辑|原因|为什么|怎么做/] },
  { mood: '期待', patterns: [/期待|想要|想喝|想吃|明天|计划|安排|试试|品鉴/] },
];

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getStorageKey(personaId, dateKey = getLocalDateKey()) {
  return `${AFFECT_STORAGE_PREFIX}${personaId}_${dateKey}`;
}

function readAffect(personaId, dateKey = getLocalDateKey()) {
  if (typeof localStorage === 'undefined' || !personaId) return null;
  try {
    const raw = localStorage.getItem(getStorageKey(personaId, dateKey));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveAffect(personaId, affect) {
  if (typeof localStorage === 'undefined' || !personaId || !affect?.date) return affect;
  try {
    localStorage.setItem(getStorageKey(personaId, affect.date), JSON.stringify(affect));
  } catch (error) {
    console.warn('保存 runtime affect 失败:', error);
  }
  return affect;
}

function normalizeMoodText(text = '') {
  return String(text || '')
    .replace(/\[quote:[\s\S]*?\]/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function inferChatMoodFromText(text = '') {
  const source = normalizeMoodText(text);
  if (!source) return '';

  for (const rule of MOOD_RULES) {
    if (rule.patterns.some(pattern => pattern.test(source))) return rule.mood;
  }

  return '';
}

export function buildBaseMoodPatch(counts = {}) {
  const happy = Number(counts['开心'] || 0);
  const tired = Number(counts['疲惫'] || 0);
  const sad = Number(counts['低落'] || 0);
  const angry = Number(counts['烦躁'] || 0);
  const nervous = Number(counts['紧张'] || 0);
  const focused = Number(counts['认真'] || 0);
  const expectant = Number(counts['期待'] || 0);

  if (happy >= MOOD_PATCH_THRESHOLD && tired >= 3) return '疲惫但开心';
  if (happy >= MOOD_PATCH_THRESHOLD) return '开心';
  if (expectant >= MOOD_PATCH_THRESHOLD) return '期待';
  if (sad >= 6) return '有点低落';
  if (angry >= 6) return '烦躁';
  if (nervous >= 6) return '紧张';
  if (tired >= 6) return '疲惫';
  if (focused >= MOOD_PATCH_THRESHOLD) return '认真';

  return '';
}

export function recordRuntimeChatMood({ personaId, text, role = 'unknown', now = new Date() }) {
  if (!personaId || !text) return null;

  const mood = inferChatMoodFromText(text);
  if (!mood) return null;

  const date = getLocalDateKey(now);
  const current = readAffect(personaId, date) || {
    date,
    chat_mood_counts: {},
    dominant_mood: '',
    base_mood_patch: '',
    samples: [],
    updated_at: '',
  };

  current.chat_mood_counts[mood] = Number(current.chat_mood_counts[mood] || 0) + 1;
  current.samples = [
    ...(Array.isArray(current.samples) ? current.samples : []),
    {
      mood,
      role,
      text: normalizeMoodText(text).slice(0, 80),
      at: now.toISOString(),
    },
  ].slice(-20);

  const sorted = Object.entries(current.chat_mood_counts)
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0));

  current.dominant_mood = sorted[0]?.[0] || '';
  current.base_mood_patch = buildBaseMoodPatch(current.chat_mood_counts);
  current.updated_at = now.toISOString();

  return saveAffect(personaId, current);
}

export function getRuntimeAffect(personaId, dateKey = getLocalDateKey()) {
  return readAffect(personaId, dateKey);
}

export function mergeRuntimeAffectIntoT3Content(content, affect) {
  if (!affect?.date) return content;
  let t3 = {};
  try {
    t3 = JSON.parse(content || '{}');
  } catch {
    t3 = {};
  }

  t3.runtime_affect = {
    ...(t3.runtime_affect || {}),
    ...affect,
  };

  return JSON.stringify(t3);
}
