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
    if (!lines.length) return '';
    return `可能可参考的近期记忆：\n${lines.map(line => `- ${line}`).join('\n')}`;
  } catch (error) {
    console.warn('读取近期记忆失败:', error.message);
    return '';
  }
}

async function generateProactiveText({ persona, t3, proactive, silentMinutes }) {
  const personaName = persona.name || t3.persona_name || 'Persona';
  const runtimeStatus = getRuntimeStatusText(t3);
  const relation = t3.relationship || {};
  const memoryBlock = await buildRecentMemoryBlock(persona._id || persona.id);

  const system = `你是“${personaName}”。你现在要决定一条主动发给用户的消息。\n要求：\n- 这不是回复用户，而是你主动想起用户后轻轻发一句。\n- 必须生活化、自然、像熟人，不要像客服、营销、系统通知。\n- 不要解释你为什么被定时任务唤醒。\n- 不要说“系统提醒我”。\n- 不要连续追问，不要施压。\n- 只输出 1 到 2 个聊天气泡；如果两句独立，用 ||| 分隔。\n- 可以使用 [sticker:关键词]，但不要强行用。\n- 如果当前状态适合，可以自然参考；不需要等状态结束。\n- 如果没有合适内容，输出 [SILENCE]。`;

  const prompt = [
    `Persona 名字：${personaName}`,
    `关系：${relation.archetype || '朋友'}，亲密度 ${relation.intimacy_level || 1}/10`,
    `用户已约 ${Math.floor(silentMinutes / 60)} 小时没有主动聊天。`,
    runtimeStatus ? `Persona 当前状态：${runtimeStatus}` : '',
    proactive.last_proactive_reason ? `上次主动原因：${proactive.last_proactive_reason}` : '',
    `主动语气要求：${proactive.tone || DEFAULT_PROACTIVE.tone}`,
    memoryBlock,
    '请生成本次主动消息，并给出自然理由。输出格式严格为 JSON：{"text":"消息内容","reason":"主动原因"}',
  ].filter(Boolean).join('\n');

  const raw = await callDeepSeekGenerate([
    { role: 'system', content: system },
    { role: 'user', content: prompt },
  ], persona._id || persona.id);

  const cleaned = stripStatusAndTools(raw);
  try {
    const parsed = JSON.parse(cleaned.replace(/```json|```/g, '').trim());
    return {
      text: stripStatusAndTools(parsed.text || ''),
      reason: compactText(parsed.reason || '自然想起用户', 80),
    };
  } catch {
    return {
      text: cleaned,
      reason: runtimeStatus ? `在“${compactText(runtimeStatus, 32)}”时想起用户` : '自然想起用户',
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
      t3.proactive_contact = proactive;

      if (!dryRun) {
        await db.collection('persona_proactive_messages').add(messageDoc);
        await updatePersonaContent(personaId, t3);
      }

      results.push({ personaId, sent: true, reason: messageDoc.reason, text });
    } catch (error) {
      proactive.nextCheckAt = buildNextCheckAt(60);
      t3.proactive_contact = proactive;
      if (!dryRun) await updatePersonaContent(personaId, t3).catch(() => {});
      results.push({ personaId, error: error.message });
    }
  }

  return { success: true, dryRun, checked: results.length, results };
};
