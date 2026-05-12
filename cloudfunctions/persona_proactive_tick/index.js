const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();
const _ = db.command;

const DEFAULT_PROACTIVE = {
  enabled: true,
  maxDailyCount: 2,
  minIntervalMinutes: 120,
  quietHours: { start: '23:30', end: '08:30' },
  tone: '生活化、轻轻打扰、不像客服、不像营销通知',
};

const PROACTIVE_SCENE_WEIGHTS = {
  life_update: 0.62,
  hot_share: 0.28,
  memory_ping: 0.10,
};

function parseJSON(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getTodayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function minutesSince(iso, now = Date.now()) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return Infinity;
  return Math.floor((now - t) / 60000);
}

function parseClock(value) {
  const [hour = 0, minute = 0] = String(value || '00:00').split(':').map(Number);
  return hour * 60 + minute;
}

function isInQuietHours(quietHours = DEFAULT_PROACTIVE.quietHours, date = new Date()) {
  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  const start = parseClock(quietHours.start || DEFAULT_PROACTIVE.quietHours.start);
  const end = parseClock(quietHours.end || DEFAULT_PROACTIVE.quietHours.end);
  if (start === end) return false;
  if (start < end) return nowMinutes >= start && nowMinutes < end;
  return nowMinutes >= start || nowMinutes < end;
}

function buildNextCheckAt(minutes = 30) {
  return new Date(Date.now() + minutes * 60000).toISOString();
}

function compactText(value, max = 360) {
  const source = String(value || '').replace(/\s+/g, ' ').trim();
  return source.length <= max ? source : `${source.slice(0, max)}…`;
}

function hashString(value) {
  const source = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stripStatusAndTools(text) {
  return String(text || '')
    .replace(/\[status:\s*\{[\s\S]*?\}\]/gi, '')
    .replace(/```json[\s\S]*?```/gi, '')
    .replace(/\{\s*"tool_name"[\s\S]*?\}/gi, '')
    .replace(/\|\|\|/g, '\n')
    .trim();
}

function getRuntimeStatusText(t3) {
  const runtime = t3.runtime_status || t3.persona_runtime_status || null;
  if (runtime?.activity) return runtime.activity;
  if (t3.current_context?.value) return t3.current_context.value;
  return '';
}

function getPersonaHotCategories(t3) {
  const raw = t3.hot_knowledge_style?.preferred_categories;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(item => String(item || '').trim()).filter(Boolean);
  return String(raw).split(/[,，、\s]+/).map(item => item.trim()).filter(Boolean);
}

function chooseProactiveScene({ personaId, t3, proactive, silentMinutes, hasHotTopic, hasMemory }) {
  const seed = `${personaId}|${getTodayKey()}|${proactive.dailyCount || 0}|${Math.floor(silentMinutes / 60)}|${proactive.lastProactiveAt || ''}`;
  const roll = (hashString(seed) % 1000) / 1000;
  const hotWeight = hasHotTopic ? PROACTIVE_SCENE_WEIGHTS.hot_share : 0;
  const memoryWeight = hasMemory ? PROACTIVE_SCENE_WEIGHTS.memory_ping : 0;
  const lifeWeight = Math.max(0.45, PROACTIVE_SCENE_WEIGHTS.life_update + (hasHotTopic ? 0 : 0.18) + (hasMemory ? 0 : 0.08));
  const total = lifeWeight + hotWeight + memoryWeight;
  const normalized = roll * total;
  if (normalized < hotWeight) return 'hot_share';
  if (normalized < hotWeight + memoryWeight) return 'memory_ping';
  return 'life_update';
}

function shouldConsiderPersona({ persona, t3, proactive, nowDate }) {
  if (!proactive.enabled) return { ok: false, reason: 'disabled' };
  if (isInQuietHours(proactive.quietHours, nowDate)) return { ok: false, reason: 'quiet_hours' };
  if (proactive.pendingUnreplied) return { ok: false, reason: 'pending_unreplied' };

  const todayKey = getTodayKey(nowDate);
  const dailyCount = proactive.dailyDate === todayKey ? Number(proactive.dailyCount || 0) : 0;
  if (dailyCount >= Number(proactive.maxDailyCount || DEFAULT_PROACTIVE.maxDailyCount)) {
    return { ok: false, reason: 'daily_limit' };
  }

  const minInterval = Number(proactive.minIntervalMinutes || DEFAULT_PROACTIVE.minIntervalMinutes);
  if (minutesSince(proactive.lastProactiveAt) < minInterval) {
    return { ok: false, reason: 'min_interval' };
  }

  const lastChat = t3.relationship?.last_chat_time || persona.updatedAt || persona.createdAt || '';
  const silentMinutes = minutesSince(lastChat);
  if (silentMinutes < 90) return { ok: false, reason: 'too_recent_chat' };

  const intimacy = Number(t3.relationship?.intimacy_level || 1);
  const randomGate = Math.random();
  const threshold = intimacy >= 7 ? 0.28 : intimacy >= 4 ? 0.18 : 0.1;
  if (randomGate > threshold && silentMinutes < 360) return { ok: false, reason: 'random_gate' };

  return { ok: true, reason: 'eligible', dailyCount, silentMinutes };
}

async function callDeepSeekGenerate(messages, personaId) {
  const res = await app.callFunction({
    name: 'deepseek_generate',
    data: {
      messages,
      model: 'deepseek-v4-flash',
      useThinking: false,
      personaId,
      enableMemoryTools: false,
    },
    timeout: 60000,
  });

  if (res.result?.error) throw new Error(res.result.error.message || JSON.stringify(res.result.error));
  return res.result?.choices?.[0]?.message?.content || '';
}

async function buildRecentMemoryBlock(personaId) {
  try {
    const res = await db.collection('persona_memories')
      .where(_.or([{ user_id: personaId }, { personaId }]))
      .orderBy('timestamp', 'desc')
      .limit(6)
      .get();
    const lines = (res.data || [])
      .map(item => item.content || item.text || item.summary || '')
      .filter(Boolean)
      .slice(0, 4);
    if (!lines.length) return { block: '', hasMemory: false };
    return {
      hasMemory: true,
      block: `可能可参考的近期记忆：\n${lines.map(line => `- ${compactText(line, 90)}`).join('\n')}`,
    };
  } catch (error) {
    console.warn('读取近期记忆失败:', error.message);
    return { block: '', hasMemory: false };
  }
}

async function pickHotTopicBlock(t3) {
  try {
    let res;
    try {
      res = await db.collection('hot_topics')
        .where({ expires_at: _.gt(Date.now()) })
        .orderBy('heat_score', 'desc')
        .limit(30)
        .get();
    } catch (_) {
      res = await db.collection('hot_topics').limit(30).get();
    }

    const preferred = getPersonaHotCategories(t3);
    const avoid = Array.isArray(t3.hot_knowledge_style?.avoid_categories)
      ? t3.hot_knowledge_style.avoid_categories
      : [];
    const topics = (res.data || [])
      .filter(topic => !avoid.includes(topic.category))
      .filter(topic => !topic.expires_at || Number(topic.expires_at) > Date.now())
      .sort((a, b) => {
        const scoreA = Number(a.heat_score || 0) + (preferred.includes(a.category) ? 30 : 0);
        const scoreB = Number(b.heat_score || 0) + (preferred.includes(b.category) ? 30 : 0);
        return scoreB - scoreA;
      })
      .slice(0, 1);

    if (!topics.length) return { block: '', hasHotTopic: false };
    const topic = topics[0];
    return {
      hasHotTopic: true,
      block: `可分享的开放世界素材：\n标题：${compactText(topic.title, 80)}\n摘要：${compactText(topic.summary || topic.title, 120)}\n分类：${topic.category || 'unknown'}\n可聊角度：${Array.isArray(topic.talking_points) ? topic.talking_points.slice(0, 2).join('；') : ''}`,
    };
  } catch (error) {
    console.warn('读取热点素材失败:', error.message);
    return { block: '', hasHotTopic: false };
  }
}

async function generateProactiveText({ persona, t3, proactive, silentMinutes }) {
  const personaId = persona._id || persona.id;
  const personaName = persona.name || t3.persona_name || 'Persona';
  const runtimeStatus = getRuntimeStatusText(t3);
  const relation = t3.relationship || {};
  const memory = await buildRecentMemoryBlock(personaId);
  const hotTopic = await pickHotTopicBlock(t3);
  const scene = chooseProactiveScene({
    personaId,
    t3,
    proactive,
    silentMinutes,
    hasHotTopic: hotTopic.hasHotTopic,
    hasMemory: memory.hasMemory,
  });

  const sceneInstruction = {
    life_update: '本次主动联系优先分享你正在做的事、身边发生的小事或当下情绪。可以顺带问用户一句，但不要追问施压。',
    hot_share: '本次主动联系优先分享一条开放世界热点或新鲜事，像朋友随口提起，不要像新闻播报。分享后可以用一句话问用户怎么看。',
    memory_ping: '本次主动联系优先围绕用户近期记忆轻轻关心或接续上次话题，不要像提醒事项。',
  }[scene] || '';

  const system = `你是“${personaName}”。你现在要决定一条主动发给用户的消息。\n要求：\n- 这不是回复用户，而是你主动想起用户后轻轻发一句。\n- 必须生活化、自然、像熟人，不要像客服、营销、系统通知。\n- 主动联系可以是：分享你正在做的事、分享你身边的小事、分享一条热点/新闻、接续用户近期记忆。\n- 不要解释你为什么被定时任务唤醒。\n- 不要说“系统提醒我”。\n- 不要连续追问，不要施压。\n- 只输出 1 到 2 个聊天气泡；如果两句独立，用 ||| 分隔。\n- 可以使用 [sticker:关键词]，但不要强行用。\n- 如果没有合适内容，输出 [SILENCE]。`;

  const prompt = [
    `Persona 名字：${personaName}`,
    `关系：${relation.archetype || '朋友'}，亲密度 ${relation.intimacy_level || 1}/10`,
    `用户已约 ${Math.floor(silentMinutes / 60)} 小时没有主动聊天。`,
    runtimeStatus ? `Persona 当前状态：${runtimeStatus}` : '',
    proactive.last_proactive_reason ? `上次主动原因：${proactive.last_proactive_reason}` : '',
    `本次主动场景：${scene}`,
    sceneInstruction,
    `主动语气要求：${proactive.tone || DEFAULT_PROACTIVE.tone}`,
    scene === 'hot_share' ? hotTopic.block : '',
    scene === 'memory_ping' ? memory.block : '',
    scene === 'life_update' && memory.hasMemory ? `用户记忆只作背景，不要硬提：\n${memory.block}` : '',
    '请生成本次主动消息，并给出自然理由。输出格式严格为 JSON：{"text":"消息内容","reason":"主动原因"}',
  ].filter(Boolean).join('\n');

  const raw = await callDeepSeekGenerate([
    { role: 'system', content: system },
    { role: 'user', content: prompt },
  ], personaId);

  const cleaned = stripStatusAndTools(raw);
  try {
    const parsed = JSON.parse(cleaned.replace(/```json|```/g, '').trim());
    return {
      text: stripStatusAndTools(parsed.text || ''),
      reason: compactText(parsed.reason || `${scene} 主动联系`, 80),
      scene,
    };
  } catch {
    return {
      text: cleaned,
      reason: runtimeStatus ? `在“${compactText(runtimeStatus, 32)}”时想起用户` : `${scene} 主动联系`,
      scene,
    };
  }
}

async function updatePersonaContent(personaId, t3) {
  await db.collection('personas').doc(personaId).update({
    content: JSON.stringify(t3),
    updatedAt: Date.now(),
  });
}

exports.main = async function main(event = {}) {
  const now = new Date();
  const limit = Number(event.limit || 30);
  const dryRun = Boolean(event.dryRun);
  const targetPersonaId = event.personaId || '';

  const query = targetPersonaId
    ? db.collection('personas').where({ _id: targetPersonaId }).limit(1)
    : db.collection('personas').orderBy('updatedAt', 'desc').limit(limit);

  const personasRes = await query.get();
  const results = [];

  for (const persona of personasRes.data || []) {
    const personaId = persona._id || persona.id;
    const t3 = parseJSON(persona.content, {});
    const proactive = { ...DEFAULT_PROACTIVE, ...(t3.proactive_contact || {}) };
    const decision = shouldConsiderPersona({ persona, t3, proactive, nowDate: now });

    if (!decision.ok) {
      results.push({ personaId, skipped: true, reason: decision.reason });
      continue;
    }

    try {
      const generated = await generateProactiveText({
        persona,
        t3,
        proactive,
        silentMinutes: decision.silentMinutes,
      });

      const text = compactText(generated.text, 800);
      if (!text || text.includes('[SILENCE]')) {
        proactive.nextCheckAt = buildNextCheckAt(60);
        t3.proactive_contact = proactive;
        if (!dryRun) await updatePersonaContent(personaId, t3);
        results.push({ personaId, skipped: true, reason: 'silence' });
        continue;
      }

      const todayKey = getTodayKey(now);
      const nextDailyCount = proactive.dailyDate === todayKey ? Number(proactive.dailyCount || 0) + 1 : 1;
      const messageDoc = {
        uid: persona.uid || '',
        personaId,
        text,
        reason: generated.reason || '自然想起用户',
        scene: generated.scene || 'life_update',
        consumed: false,
        createdAt: now.toISOString(),
        messageId: Date.now() + Math.floor(Math.random() * 10000),
        source: 'persona_proactive_tick',
      };

      proactive.lastProactiveAt = now.toISOString();
      proactive.nextCheckAt = buildNextCheckAt(30);
      proactive.dailyDate = todayKey;
      proactive.dailyCount = nextDailyCount;
      proactive.pendingUnreplied = true;
      proactive.last_proactive_reason = messageDoc.reason;
      proactive.last_proactive_scene = messageDoc.scene;
      t3.proactive_contact = proactive;

      if (!dryRun) {
        await db.collection('persona_proactive_messages').add(messageDoc);
        await updatePersonaContent(personaId, t3);
      }

      results.push({ personaId, sent: true, scene: messageDoc.scene, reason: messageDoc.reason, text });
    } catch (error) {
      proactive.nextCheckAt = buildNextCheckAt(60);
      t3.proactive_contact = proactive;
      if (!dryRun) await updatePersonaContent(personaId, t3).catch(() => {});
      results.push({ personaId, error: error.message });
    }
  }

  return { success: true, dryRun, checked: results.length, results };
};
