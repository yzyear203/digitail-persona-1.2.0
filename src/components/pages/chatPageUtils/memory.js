import { db } from '../../../lib/cloudbase';
import { upsertPersonaProfile } from '../../../lib/profileStore';
import {
  hasContentSignal,
  normalizeMemoryRecord,
  estimateKeywordScore,
  buildT1MemoryRecord,
} from '../../../lib/dsm';
import { formatMessageForModel, getLatestUserMessage } from './messageFormat';

export const IMMEDIATE_MEMORY_WINDOW = 8;
export const MEMORY_BATCH_MIN_ITEMS = 3;
export const MEMORY_BATCH_MAX_WAIT_MS = 3 * 60 * 1000;

const MEMORY_PREFETCH_REGEX = /(还记得|记不记得|之前|上次|以前|我说过|你记得|记得我|我的计划|我的名字|我叫什么|医院|学校|大学|公司|offer|录取|考试|项目|家教|实习|面试|旅行|旅游|分手|失恋|离职|搬家)/i;
const BASE_HIGH_VALUE_MEMORY_REGEX = /(我叫|叫我|我的名字是|我名字叫|本人叫|录取|offer|Offer|离职|失业|分手|失恋|生病|手术|怀孕|搬家|转专业|确诊|复查|面试|签约)/i;
const GENERIC_MEMORY_STOPWORDS = new Set([
  '用户', '提到', '明确', '重要', '长期', '计划', '变化', '结果', '进展', '困难', '相关', '值得',
  '自己', '事情', '状态', '时候', '一个', '这个', '那个', '如果', '人格', '优先', '记住', '信息',
  '高价值', '事件', '偏好', '目标', '表达', '发生', '正在', '已经', '可能', '明显', '关系', '情绪',
]);

function isMemoryEligibleMessage(message) {
  return message?.role !== 'system'
    && !message?.isRecalled
    && !message?.isDeletedForUser
    && !message?.isProactive;
}

function parsePersonaContent(persona) {
  try {
    return JSON.parse(persona?.content || '{}');
  } catch (_) {
    return {};
  }
}

function parseDateMs(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.getTime === 'function') return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isExpiredMemory(memory, now = Date.now()) {
  const expiresAt = parseDateMs(memory?.expires_at || memory?.expiresAt);
  return Boolean(expiresAt && expiresAt <= now);
}

function isActiveMemory(memory) {
  return Boolean(memory?.content)
    && !isExpiredMemory(memory)
    && !memory?.archived
    && !memory?.is_archived
    && !memory?.absorbed_by_t3
    && !memory?.absorbedAt
    && memory?.memory_type !== 'debug_noise';
}

function normalizeMemoryTriggerText(value) {
  return String(value || '')
    .replace(/[\s，。,.!?！？；;：:“”"'、/\\|()[\]{}<>《》【】]+/g, ' ')
    .trim();
}

function extractTriggerKeywords(trigger) {
  const normalized = normalizeMemoryTriggerText(trigger);
  const keywordSet = new Set();
  const phraseMatches = normalized.match(/[\u4e00-\u9fa5A-Za-z0-9_·•]{2,}/g) || [];

  for (const phrase of phraseMatches) {
    if (!GENERIC_MEMORY_STOPWORDS.has(phrase)) keywordSet.add(phrase);
  }

  const compact = normalized.replace(/\s+/g, '');
  const domainMatches = compact.match(/(?:考试|家教|课程|学习|医院|复查|生病|手术|作息|压力|分手|冷战|关系|情绪|项目|offer|面试|签约|离职|实习|工作|搬家|旅行|城市|学校|大学|专业|目标|计划|名字|称呼|身份|偏好)/gi) || [];
  for (const keyword of domainMatches) keywordSet.add(keyword);

  return Array.from(keywordSet)
    .map(item => item.trim())
    .filter(item => item.length >= 2 && !GENERIC_MEMORY_STOPWORDS.has(item))
    .slice(0, 10);
}

function getPersonaMemoryStyle(persona) {
  const t3 = parsePersonaContent(persona);
  const triggers = Array.isArray(t3.memory_style?.high_value_triggers)
    ? t3.memory_style.high_value_triggers
    : [];

  return {
    highValueTriggers: triggers.map(item => String(item || '').trim()).filter(Boolean).slice(0, 5),
    batchTendency: t3.memory_style?.batch_tendency || 'balanced',
  };
}

function matchPersonaMemoryStyle(text, persona) {
  const source = String(text || '').trim();
  if (!source) return false;

  const normalizedSource = normalizeMemoryTriggerText(source).replace(/\s+/g, '');
  const { highValueTriggers } = getPersonaMemoryStyle(persona);

  for (const trigger of highValueTriggers) {
    const triggerKeywords = extractTriggerKeywords(trigger);
    if (!triggerKeywords.length) continue;
    const hitCount = triggerKeywords.filter(keyword => normalizedSource.includes(keyword)).length;
    const requiredHits = triggerKeywords.length >= 4 ? 2 : 1;
    if (hitCount >= requiredHits) {
      console.log(`[DSM 人格记忆偏好] 命中高价值记忆触发：${trigger}`);
      return true;
    }
  }

  return false;
}

function normalizeStableValue(value, max = 32) {
  return String(value || '')
    .replace(/[“”"'`]/g, '')
    .replace(/[，。,.!！?？；;：:、\s]+$/g, '')
    .trim()
    .slice(0, max);
}

function extractStableProfileSignals(t1Event) {
  const summary = String(t1Event?.summary || '').trim();
  const signals = {};
  if (!summary) return signals;

  const name = summary.match(/(?:用户(?:说|表示|透露|明确)?(?:自己)?(?:叫|名字是|名叫)|用户称呼[:：]|称呼[:：])([\u4e00-\u9fa5A-Za-z0-9_·•]{1,16})/)?.[1]
    || summary.match(/(?:我叫|叫我|我的名字是|我名字叫)([\u4e00-\u9fa5A-Za-z0-9_·•]{1,16})/)?.[1];
  if (name) signals.userName = normalizeStableValue(name, 16);

  const identity = summary.match(/用户(?:透露|表示|说|明确)?(?:自己)?是([^，。,.；;]{2,42})/)?.[1]
    || summary.match(/用户身份(?:是|为|：|:)([^，。,.；;]{2,42})/)?.[1];
  if (identity && !/这个|那个|有人|东西|情况|问题/.test(identity)) {
    signals.identity = normalizeStableValue(identity, 42);
  }

  const interest = summary.match(/用户(?:喜欢|偏好|爱好|感兴趣于)([^，。,.；;]{2,28})/)?.[1];
  if (interest) signals.interest = normalizeStableValue(interest, 28);

  return signals;
}

function mergeInterest(t3, topic, sourceEventId) {
  if (!topic) return false;
  const interests = Array.isArray(t3.interests) ? [...t3.interests] : [];
  const existing = interests.find(item => item.topic === topic);
  if (existing) {
    existing.weight = Math.min(10, Number(existing.weight || 1) + 1);
    existing.confidence = existing.confidence === 'high' ? 'high' : 'medium';
    existing.last_updated = new Date().toISOString();
    return true;
  }

  interests.push({
    topic,
    weight: 2,
    confidence: 'medium',
    last_updated: new Date().toISOString(),
    source_event_ids: sourceEventId ? [sourceEventId] : [],
  });
  t3.interests = interests.slice(-12);
  return true;
}

export function getBatchMinItemsForPersona(persona) {
  const { batchTendency } = getPersonaMemoryStyle(persona);
  if (batchTendency === 'sensitive') return 2;
  if (batchTendency === 'conservative') return 4;
  return MEMORY_BATCH_MIN_ITEMS;
}

export function shouldForceMemoryExtraction(text, persona) {
  const source = String(text || '');
  return BASE_HIGH_VALUE_MEMORY_REGEX.test(source) || matchPersonaMemoryStyle(source, persona);
}

export function shouldPrefetchLongTermMemory(messagesSnapshot) {
  const eligibleMessages = (messagesSnapshot || []).filter(isMemoryEligibleMessage);
  const latestUserText = formatMessageForModel(getLatestUserMessage(eligibleMessages));
  return MEMORY_PREFETCH_REGEX.test(latestUserText) || hasContentSignal(eligibleMessages);
}

export function buildMemoryQuery(messagesSnapshot) {
  return [...(messagesSnapshot || [])]
    .filter(isMemoryEligibleMessage)
    .slice(-4)
    .map(m => formatMessageForModel(m))
    .filter(Boolean)
    .join(' ')
    .slice(-180);
}

export async function prefetchLongTermMemory({ personaId, messagesSnapshot }) {
  if (!db || !personaId || !shouldPrefetchLongTermMemory(messagesSnapshot)) return '';

  const query = buildMemoryQuery(messagesSnapshot);
  if (!query) return '';

  try {
    let queryRes = await db.collection('persona_memories')
      .where({ user_id: personaId })
      .orderBy('timestamp', 'desc')
      .limit(30)
      .get();

    if (!queryRes.data?.length) {
      queryRes = await db.collection('persona_memories')
        .where({ personaId })
        .orderBy('timestamp', 'desc')
        .limit(30)
        .get();
    }

    const scored = (queryRes.data || [])
      .map(normalizeMemoryRecord)
      .filter(isActiveMemory)
      .map(memory => ({ ...memory, keywordScore: estimateKeywordScore(memory.content, query) }))
      .sort((a, b) => b.keywordScore - a.keywordScore);

    const matched = scored.filter(memory => memory.keywordScore > 0).slice(0, 4);
    const fallback = MEMORY_PREFETCH_REGEX.test(query) ? scored.slice(0, 2) : [];
    const finalMemories = matched.length ? matched : fallback;

    if (!finalMemories.length) return '';

    return `【可能相关的长期记忆】\n${finalMemories.map(memory => `- ${memory.content}`).join('\n')}\n请只在自然相关时使用这些记忆，不要生硬复述。`;
  } catch (error) {
    console.warn('长期记忆预取失败，跳过一跳式回源:', error);
    return '';
  }
}

export function buildMemoryExtractionItem(messagesSnapshot) {
  const eligibleMessages = (messagesSnapshot || []).filter(isMemoryEligibleMessage);
  const latestUserMsg = getLatestUserMessage(eligibleMessages);
  const history = eligibleMessages
    .slice(-IMMEDIATE_MEMORY_WINDOW)
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${formatMessageForModel(m)}`)
    .join('\n');

  return {
    id: latestUserMsg?.id || Date.now(),
    userText: formatMessageForModel(latestUserMsg),
    history,
    createdAt: Date.now(),
  };
}

export function mergeExtractionBatch(items) {
  return items
    .map((item, index) => `【片段${index + 1}】\n${item.history}`)
    .join('\n\n---\n\n');
}

export function buildMemoryExtractionPrompt(historyForExtraction) {
  return `分析以下最新对话片段，提取极具价值的增量记忆。
这些片段可能来自同一段连续聊天，请尽量合并成一条更完整的事件记忆，避免碎片化。
严禁提取无意义的日常，必须以第三人称陈述。
如果用户明确声明姓名、身份、长期偏好，请在 summary 中保留可被规则识别的表达，例如“用户叫XXX”“用户是XXX”“用户喜欢XXX”。
重要性打分规则：日常小事0-3，明确计划4-7，重大节点或重要状态变化8-10。
严格按下方JSON输出，不要包含markdown格式：
{ "importance": 9, "summary": "用户今天拿到了重要结果", "emotion": "excited", "confidence": "high" }
其中 emotion 从 [happy, sad, neutral, excited, frustrated, anxious] 中选，confidence 从 [high, medium, low] 中选。如果没有硬核信息，importance 填 0。
对话片段：\n${historyForExtraction}`;
}

export function parseT1Event(jsonText) {
  return JSON.parse(String(jsonText || '').replace(/```json|```/g, '').trim());
}

export function createMemoryRecord({ personaId, t1Event }) {
  return buildT1MemoryRecord({
    personaId,
    t1Event,
    deviceFp: navigator.userAgent.substring(0, 64),
  });
}

export async function promoteStableMemoryToT3({ personaId, persona, t1Event }) {
  if (!db || !personaId || !persona || !t1Event?.summary) return { promoted: false };
  const signals = extractStableProfileSignals(t1Event);
  if (!signals.userName && !signals.identity && !signals.interest) return { promoted: false };

  const t3 = parsePersonaContent(persona);
  const nowIso = new Date().toISOString();
  const eventId = t1Event.event_id || t1Event.eventId || '';
  const promoted = [];

  if (signals.userName && t3.user_name !== signals.userName) {
    t3.user_name = signals.userName;
    promoted.push('user_name');
  }

  if (signals.identity) {
    const currentIdentity = t3.identity?.value || '';
    if (!currentIdentity || currentIdentity.length < signals.identity.length || currentIdentity.includes('用户称呼')) {
      t3.identity = {
        ...(t3.identity || {}),
        value: signals.identity,
        confidence: 'high',
        last_updated: nowIso,
        source_event_ids: Array.from(new Set([...(t3.identity?.source_event_ids || []), eventId].filter(Boolean))).slice(-8),
      };
      promoted.push('identity');
    }
  }

  if (signals.interest && mergeInterest(t3, signals.interest, eventId)) {
    promoted.push('interest');
  }

  if (!promoted.length) return { promoted: false };

  const nextContent = JSON.stringify(t3);
  await db.collection('personas').doc(personaId).update({ content: nextContent, updatedAt: Date.now() });
  await upsertPersonaProfile({ personaId, t3Profile: t3 });

  return { promoted: true, promotedFields: promoted, t3, content: nextContent };
}

export async function writeMemoryThroughVectorize({ personaId, memoryRecord }) {
  const { cloudbase } = await import('../../../lib/cloudbase');
  if (!cloudbase) throw new Error('CloudBase SDK 未初始化，无法写入记忆');

  const functionName = 'vectorize_memory';
  const res = await cloudbase.callFunction({
    name: functionName,
    data: { personaId, records: [memoryRecord] },
    timeout: 15000,
  });

  if (res.result?.success === false) {
    throw new Error(res.result.error || `${functionName} 云函数返回失败`);
  }

  console.log(`T1 深态记忆已通过 ${functionName} 云函数写入数据库`, res.result || '');
  return true;
}

export async function writeMemoryDirectly({ memoryRecord }) {
  if (!db) throw new Error('数据库未初始化，无法写入记忆');
  await db.collection('persona_memories').add(memoryRecord);
  console.log('T1 深态记忆已通过前端兜底直接写入数据库');
}
