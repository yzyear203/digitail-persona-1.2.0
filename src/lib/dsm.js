// ==========================================
// DSM 2.2 核心工具：Schema、Prompt 压缩、守门人与记忆记录规范化
// ==========================================
import { buildOfficialStickerPromptList, getOfficialStickerKeywordPresets } from './officialStickerCatalog';

export const DEFAULT_T3_PROFILE = {
  persona_name: '',
  identity: { value: '', confidence: 'low', last_updated: '', source_event_ids: [] },
  personality: { value: '', confidence: 'low', last_updated: '', source_event_ids: [] },
  runtime_card: { value: '', confidence: 'low', last_updated: '', source_event_ids: [] },
  interests: [],
  relationship: {
    archetype: '观察者',
    intimacy_level: 1,
    interaction_count: 0,
    last_chat_time: new Date().toISOString(),
    bond_momentum: 'stable',
  },
  current_context: { value: '', expires_at: '' },
  user_name: '',
  interaction_style: {
    quote_tendency: 'medium',
    quote_triggers: [],
    recall_tendency: 'low',
    recall_triggers: [],
  },
  sticker_style: {
    use_tendency: 'medium',
    trigger_rules: [
      '强烈无语、震惊、想吐槽时可以发对应官方表情包',
      '调侃、憋笑、熟人感很强时可以发笑死类官方表情包',
      '想安慰、缓和语气、卖乖时可以发抱抱、拜托、委屈类官方表情包',
    ],
  },
  forbidden_topics: [],
  pending_conflicts: [],
};

const CONFIDENCE_LABEL = { high: '', medium: '[可能]' };

function compactText(value, maxChars = 1200) {
  const source = String(value || '').replace(/\s+/g, ' ').trim();
  if (source.length <= maxChars) return source;
  const head = source.slice(0, Math.floor(maxChars * 0.72));
  const tail = source.slice(-Math.floor(maxChars * 0.22));
  return `${head} …… ${tail}`;
}

function shouldInjectField(field) {
  return Boolean(field?.value && field.confidence !== 'low');
}

function formatProfileField(label, field) {
  if (!shouldInjectField(field)) return '';
  return `${label}:${field.value}${CONFIDENCE_LABEL[field.confidence] || ''} | `;
}

function normalizeTriggerList(value, maxCount = 3) {
  if (!Array.isArray(value)) return [];
  return value.map(item => String(item || '').trim()).filter(Boolean).slice(0, maxCount);
}

function getRuntimePersonalityField(t3) {
  const runtimeCard = t3?.runtime_card || t3?.personality_runtime_card || t3?.runtime_personality;
  if (runtimeCard?.value) return { value: compactText(runtimeCard.value, 780), confidence: runtimeCard.confidence || 'high' };
  if (typeof runtimeCard === 'string' && runtimeCard.trim()) return { value: compactText(runtimeCard, 780), confidence: 'high' };

  const fullPersonality = t3?.personality?.value || '';
  if (!fullPersonality) return { value: '', confidence: 'low' };
  return { value: compactText(fullPersonality, 820), confidence: t3?.personality?.confidence || 'medium' };
}

function formatInteractionStyleBlock(t3) {
  const style = t3?.interaction_style || {};
  const quoteTriggers = normalizeTriggerList(style.quote_triggers, 3);
  const recallTriggers = normalizeTriggerList(style.recall_triggers, 3);
  if (quoteTriggers.length === 0 && recallTriggers.length === 0) return '';

  return [
    '【引用与撤回】',
    `引用倾向：${style.quote_tendency || 'medium'}${quoteTriggers.length ? `；触发：${quoteTriggers.join(' / ')}` : ''}`,
    `撤回倾向：${style.recall_tendency || 'low'}${recallTriggers.length ? `；触发：${recallTriggers.join(' / ')}` : ''}`,
    '引用必须使用编号格式 [quote_ref:U编号]，例如 [quote_ref:U3]；禁止输出 [quote:文本]，禁止自己编写或截取引用文本。可偶尔用 <recall>...</recall> 表现撤回，不要机械展示。',
  ].join('\n');
}

function formatStickerStyleBlock(t3, stickerContext = '') {
  const style = t3?.sticker_style || DEFAULT_T3_PROFILE.sticker_style;
  const rules = normalizeTriggerList(style.trigger_rules, 4);
  const tendency = style.use_tendency || 'medium';
  const officialPresets = getOfficialStickerKeywordPresets(stickerContext, 24).join('、');
  const officialList = buildOfficialStickerPromptList(stickerContext, { limit: 12 });

  return [
    '【官方表情包系统】',
    '你可以像微信聊天一样发送网站官方小黄人表情包；格式必须单独成气泡：[sticker:关键词]。',
    `表情倾向：${tendency}；本轮高频候选关键词：${officialPresets}。`,
    rules.length ? `Persona 适合使用表情包的触发：${rules.join(' / ')}` : '',
    '本轮语境候选表情：',
    officialList,
    '要求：表情包必须独立气泡，例如 文字|||[sticker:捂脸无语]|||文字；只在强情绪、调侃、安慰、无语、祝福、生活反应时使用，不要每轮都用，不要解释图片内容。',
  ].filter(Boolean).join('\n');
}

export function formatT3Compact(t3) {
  if (!t3) return '';
  const safeT3 = { ...DEFAULT_T3_PROFILE, ...t3 };
  let compactStr = '[用户档案] ';

  if (safeT3.user_name) compactStr += `称呼:${safeT3.user_name} | `;
  compactStr += formatProfileField('身份', safeT3.identity);

  if (safeT3.interests?.length > 0) {
    const topInterests = [...safeT3.interests]
      .filter(i => i?.topic && i.confidence !== 'low')
      .sort((a, b) => (b.weight || 0) - (a.weight || 0))
      .slice(0, 3)
      .map(i => `${i.topic}(★${i.weight || 1})${i.confidence === 'medium' ? '[可能]' : ''}`)
      .join('/');
    if (topInterests) compactStr += `兴趣:${topInterests} | `;
  }

  compactStr += formatProfileField('运行人格卡', getRuntimePersonalityField(safeT3));

  if (safeT3.relationship) {
    compactStr += `关系:${safeT3.relationship.archetype} 亲密度${safeT3.relationship.intimacy_level}/10 | `;
  }

  if (safeT3.current_context?.value) {
    const expiresAt = new Date(safeT3.current_context.expires_at).getTime();
    if (!safeT3.current_context.expires_at || expiresAt > Date.now()) {
      compactStr += `状态:${safeT3.current_context.value}`;
    }
  }

  return compactStr.trim();
}

export const COLD_START_INSTRUCTION = `
[冷启动破冰指令]
这是与用户的第一次对话，你对用户一无所知。请在前3轮自然获取：用户称呼、最近在忙什么、兴趣爱好。每轮最多问一件事，像朋友聊天，不要机器人式连问。
`;

export const COOLING_INSTRUCTION = `
【关系维系指令】关系处于冷却期，若话题自然，可以轻轻关怀一句，不要刻意。
`;

export const MEMORY_PREFETCH_INSTRUCTION = `
【长期记忆规则】相关长期记忆会按需出现在对话里；看见后自然结合即可。严禁输出 retrieve_long_term_memory、search_subconscious_memory、tool_name、DSML 或任何工具 JSON。
`;

export const NATURAL_REPLY_GUARD = `
【自然回复节奏】允许符合人格的口头禅、调侃、反问和情绪铺垫。超过2句话或两个独立信息点必须用 ||| 拆成聊天气泡；每个气泡只承载一个情绪/信息点。需要引用时，只能使用 [quote_ref:U编号]；禁止输出 [quote:文本]，禁止编造或截取引用文本。可偶尔用 <recall>...</recall> 表现撤回，不要连续撤回。
`;

export function getDaysSince(dateString, now = Date.now()) {
  if (!dateString) return 0;
  const parsedTime = new Date(dateString).getTime();
  if (Number.isNaN(parsedTime)) return 0;
  return Math.floor(Math.max(0, now - parsedTime) / (1000 * 60 * 60 * 24));
}

export function buildRegressionBlock(days, contextValue) {
  const contextTip = contextValue ? `并结合之前状态：“${contextValue}”` : '';
  return `【回归感知指令】用户已有 ${days} 天未与你交流。请在本次开场时自然感叹时间流逝，${contextTip}询问近况，禁止生硬地说“你好久没来了”。`;
}

const SIGNAL_PATTERNS = [
  /[\u4e00-\u9fa5]{2,4}(大学|公司|医院|景区|城市)/,
  /(今天|昨天|明天|下周|上周|最近|这几天|五一|春节)/,
  /(失恋|分手|Offer|offer|录取|失业|离职|搬家|转专业|怀孕|生病|手术)/,
  /我(打算|要|准备|决定|想).{2,15}(了|去|做)/,
  /(我叫|叫我|我的名字是|我名字叫|本人叫|我是)[\u4e00-\u9fa5A-Za-z0-9_·•]{1,16}/,
];

export function hasContentSignal(messages) {
  if (!messages?.length) return false;
  const lastUserMsg = messages.filter(m => m.role === 'user').slice(-1)[0];
  if (!lastUserMsg) return false;
  const messageContent = lastUserMsg.text || lastUserMsg.content || '';
  return SIGNAL_PATTERNS.some(p => p.test(messageContent));
}

export function getHotT1(userId) {
  try {
    const raw = localStorage.getItem(`hot_t1_${userId}`);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() > data.expires_at) {
      localStorage.removeItem(`hot_t1_${userId}`);
      return null;
    }
    return data.items || [];
  } catch (error) {
    console.warn('Hot T1 Cache Read Error:', error);
    return null;
  }
}

export function saveToHotT1Cache(userId, summary) {
  try {
    const key = `hot_t1_${userId}`;
    let data = { items: [], expires_at: Date.now() + 24 * 60 * 60 * 1000 };
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() <= parsed.expires_at) data = parsed;
    }
    data.items.push({ summary: compactText(summary, 80), timestamp: Date.now() });
    if (data.items.length > 3) data.items = data.items.slice(-3);
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Hot T1 Cache Error:', error);
  }
}

export function buildSystemPrompt(activePersona, hotT1, isCooling, daysSinceLastChat, options = {}) {
  let t3 = {};
  try {
    t3 = JSON.parse(activePersona?.content || '{}');
  } catch (error) {
    console.warn('T3 JSON 解析失败，使用空档案继续组装 Prompt:', error);
  }

  const personaName = String(activePersona?.name || t3?.persona_name || '').trim();
  const stickerContext = typeof options === 'string' ? options : (options?.stickerContext || options?.recentDialogue || '');
  let prompt = '';

  if (personaName) {
    prompt += `【你的自我身份】你的名字是“${personaName}”。这是你作为 Persona 的名字，不是用户的名字。用户问“你叫什么/你是谁/你叫啥”时，必须直接回答你叫“${personaName}”。不要把这个名字写入用户档案或当作用户称呼。\n\n`;
  }

  prompt += `${formatT3Compact(t3)}\n\n`;
  if (daysSinceLastChat > 7) prompt += `${buildRegressionBlock(daysSinceLastChat, t3.current_context?.value)}\n\n`;
  if (isCooling) prompt += `${COOLING_INSTRUCTION}\n\n`;
  prompt += `${MEMORY_PREFETCH_INSTRUCTION}\n\n`;
  prompt += `${NATURAL_REPLY_GUARD}\n\n`;

  const interactionStyleBlock = formatInteractionStyleBlock(t3);
  if (interactionStyleBlock) prompt += `${interactionStyleBlock}\n\n`;

  prompt += `${formatStickerStyleBlock(t3, stickerContext)}\n\n`;

  if (hotT1?.length > 0) {
    prompt += `[近期事件]\n${hotT1.slice(-3).map(item => `- [${new Date(item.timestamp).toISOString().split('T')[0]}] ${compactText(item.summary, 80)}`).join('\n')}\n\n`;
  } else if (!t3.identity?.value) {
    prompt += `${COLD_START_INSTRUCTION}\n\n`;
  }

  if (t3.forbidden_topics?.length > 0) {
    prompt += `【绝对禁忌】严禁在对话中提及以下内容：${t3.forbidden_topics.join('、')}。\n\n`;
  }

  return prompt.trim();
}

export function applyBudgetAllocator(messages, sysPromptTokens, maxBudget = 4000) {
  let remainingBudget = maxBudget - sysPromptTokens;
  const result = [];
  const latestUser = [...(messages || [])].reverse().find(msg => msg.role === 'user' && (msg.text || msg.content));

  for (let i = (messages || []).length - 1; i >= 0; i--) {
    const msg = messages[i];
    const msgTokens = Math.ceil((msg.text || msg.content || '').length / 1.5);
    if (remainingBudget - msgTokens > 0) {
      result.unshift(msg);
      remainingBudget -= msgTokens;
    } else if (latestUser && msg === latestUser && !result.includes(msg)) {
      result.unshift(msg);
      break;
    } else {
      break;
    }
  }

  if (result.length === 0 && latestUser) return [latestUser];
  return result;
}

function normalizeReplyText(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\\n/g, '\n').trim();
}

function isStructuredOrCodeReply(text) {
  return /```|^\s{0,3}#{1,6}\s|^\s{0,3}[-*+]\s|^\s{0,3}\d+\.\s|\|[^\n]+\|/m.test(text);
}

function hasOnlyControlMarker(text) {
  return !text.replace(/<\/?recall>|\[quote_ref:.*?\]|\[quote:.*?\]|<del>[\s\S]*?<\/del>/g, '').trim();
}

function protectControlSpans(text) {
  const spans = [];
  const protectedText = text.replace(/<del>[\s\S]*?<\/del>|<recall>[\s\S]*?<\/recall>|\[quote_ref:[\s\S]*?\]|\[quote:[\s\S]*?\]/g, span => {
    const token = `@@DSM_CTRL_${spans.length}@@`;
    spans.push(span);
    return token;
  });

  return {
    protectedText,
    restore: value => spans.reduce((result, span, index) => result.replace(`@@DSM_CTRL_${index}@@`, span), value),
  };
}

function canUseAsChatBubbles(parts) {
  return parts.length > 1 && parts.length <= 8 && parts.every(part => part.length <= 360) && parts.every(part => !hasOnlyControlMarker(part));
}

function splitLooseChatParagraphs(text) {
  if (!text || isStructuredOrCodeReply(text) || /<recall>[\s\S]*?<\/recall>/.test(text)) return [text];
  const { protectedText, restore } = protectControlSpans(text);

  const paragraphParts = protectedText.split(/(?:\n\s*){2,}/).map(part => restore(part).trim()).filter(Boolean);
  if (canUseAsChatBubbles(paragraphParts)) return paragraphParts;

  const lineParts = protectedText.split(/\n+/).map(part => restore(part).trim()).filter(Boolean);
  if (canUseAsChatBubbles(lineParts)) return lineParts;

  return [text];
}

function mergeControlOnlyParts(parts) {
  const mergedParts = [];
  for (const part of parts) {
    if (hasOnlyControlMarker(part) && mergedParts.length === 0) {
      mergedParts.push(part);
    } else if (mergedParts.length > 0 && hasOnlyControlMarker(mergedParts[mergedParts.length - 1])) {
      mergedParts[mergedParts.length - 1] = `${mergedParts[mergedParts.length - 1]}\n${part}`;
    } else {
      mergedParts.push(part);
    }
  }
  return mergedParts;
}

export function splitAssistantReply(responseText) {
  const cleanedText = normalizeReplyText(responseText);
  if (!cleanedText) return [];
  if (cleanedText.includes('|||')) {
    return mergeControlOnlyParts(cleanedText.split(/\|\|\|/).map(part => part.trim()).filter(Boolean))
      .flatMap(part => splitLooseChatParagraphs(part));
  }
  if (isStructuredOrCodeReply(cleanedText)) return [cleanedText];
  return splitLooseChatParagraphs(cleanedText);
}

export function buildT1MemoryRecord({ personaId, t1Event, sessionId = 'sess_active', deviceFp = '' }) {
  const currentTimestamp = Date.now();
  const timeFloor10s = Math.floor(currentTimestamp / 10000) * 10000;
  const idempotencyKeyRaw = `${sessionId}_${timeFloor10s}_${personaId}`;
  const eventId = `evt_${currentTimestamp}_${personaId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  const expiresAt = new Date(currentTimestamp + 7 * 24 * 3600 * 1000).toISOString();

  return {
    event_id: eventId,
    idempotency_key: btoa(encodeURIComponent(idempotencyKeyRaw)).substring(0, 64),
    user_id: personaId,
    personaId,
    memory_type: 't1_episodic',
    content: t1Event.summary,
    text: t1Event.summary,
    importance_score: t1Event.importance,
    emotion: t1Event.emotion || 'neutral',
    confidence: t1Event.confidence || 'high',
    memory_strength: 1,
    decay_rate: t1Event.importance >= 8 ? 0.03 : 0.12,
    timestamp: new Date(currentTimestamp).toISOString(),
    expires_at: expiresAt,
    session_id: sessionId,
    device_fp: deviceFp,
    device_fingerprint: deviceFp,
    createTime: new Date(),
  };
}

export function normalizeMemoryRecord(memory) {
  const content = memory?.content || memory?.text || memory?.summary || '';
  return {
    ...memory,
    user_id: memory?.user_id || memory?.personaId,
    personaId: memory?.personaId || memory?.user_id,
    content,
    text: memory?.text || content,
    memory_type: memory?.memory_type || 't1_episodic',
    timestamp: memory?.timestamp || memory?.createTime || memory?.updateTime,
  };
}

export function estimateKeywordScore(content, query) {
  if (!content || !query) return 0;
  const keywords = Array.from(new Set(String(query).split('').filter(k => k.trim())));
  if (!keywords.length) return 0;
  const hits = keywords.filter(kw => content.includes(kw)).length;
  return hits / keywords.length;
}

export async function extractT1FromMessages(messages) {
  const latestUserText = messages?.filter(m => m.role === 'user').slice(-1)[0]?.text || '';
  console.log('[DSM 守门人] 触发 T1 提取模拟调用...', latestUserText);
  return {
    event_id: `evt_${Date.now()}`,
    content: '事件提炼占位',
    importance_score: 6,
    emotion: 'neutral',
    confidence: 'medium',
    timestamp: new Date().toISOString(),
  };
}
