const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();

const DEFAULT_LIMIT = 200;
const DEFAULT_PERSONA_SCAN_LIMIT = 50;
const HIGH_VALUE_IMPORTANCE = 8;
const IDENTITY_MIN_SUPPORT = 2;
const INTEREST_MIN_SUPPORT = 2;
const ARCHIVE_AFTER_PROMOTION = true;

function parseT3(content) {
  try {
    return JSON.parse(content || '{}');
  } catch (_) {
    return {};
  }
}

function normalizeText(value, max = 80) {
  return String(value || '')
    .replace(/[“”"'`]/g, '')
    .replace(/\s+/g, '')
    .replace(/[，。,.!！?？；;：:、]+$/g, '')
    .trim()
    .slice(0, max);
}

function parseDateMs(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value?.getTime === 'function') return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeMemory(memory) {
  const content = memory.content || memory.text || memory.summary || '';
  return {
    ...memory,
    content,
    personaId: memory.personaId || memory.user_id,
    user_id: memory.user_id || memory.personaId,
    importance_score: Number(memory.importance_score || memory.importance || 0),
    confidence: memory.confidence || 'medium',
    timestamp: memory.timestamp || memory.createTime || memory.updateTime,
  };
}

function getMemoryId(memory) {
  return memory._id || memory.id || memory.event_id || '';
}

function extractSignals(memory) {
  const content = String(memory.content || '').trim();
  const signals = [];
  if (!content) return signals;

  const name = content.match(/(?:用户(?:说|表示|透露|明确)?(?:自己)?(?:叫|名字是|名叫)|用户称呼[:：]|称呼[:：])([\u4e00-\u9fa5A-Za-z0-9_·•]{1,16})/)?.[1]
    || content.match(/(?:我叫|叫我|我的名字是|我名字叫|本人叫)([\u4e00-\u9fa5A-Za-z0-9_·•]{1,16})/)?.[1];
  if (name) signals.push({ field: 'user_name', value: normalizeText(name, 16), memory });

  const identity = content.match(/用户(?:透露|表示|说|明确)?(?:自己)?是([^，。,.；;!?！？]{2,42})/)?.[1]
    || content.match(/用户身份(?:是|为|：|:)([^，。,.；;!?！？]{2,42})/)?.[1];
  if (identity && !/(这个|那个|问题|情况|东西|什么|谁|吗|呢|觉得)/.test(identity)) {
    signals.push({ field: 'identity', value: normalizeText(identity, 42), memory });
  }

  const interest = content.match(/用户(?:喜欢|偏好|爱好|感兴趣于|经常)([^，。,.；;!?！？]{2,28})/)?.[1];
  if (interest && !/(问题|情况|这个|那个)/.test(interest)) {
    signals.push({ field: 'interests', value: normalizeText(interest, 28), memory });
  }

  if (memory.importance_score >= HIGH_VALUE_IMPORTANCE) {
    signals.push({ field: 'current_context', value: content.slice(0, 120), memory });
  }

  return signals.filter(item => item.value);
}

function groupByValue(signals, field) {
  const grouped = new Map();
  signals.filter(item => item.field === field).forEach(signal => {
    const key = signal.value;
    const list = grouped.get(key) || [];
    list.push(signal);
    grouped.set(key, list);
  });
  return grouped;
}

function pushConflict(t3, field, incoming, existing, sourceIds) {
  const item = {
    field,
    incoming,
    existing,
    source_event_ids: sourceIds.filter(Boolean).slice(-8),
    created_at: new Date().toISOString(),
    status: 'pending',
  };
  const conflicts = Array.isArray(t3.pending_conflicts) ? t3.pending_conflicts : [];
  if (!conflicts.some(conflict => conflict.field === field && conflict.incoming === incoming && conflict.existing === existing)) {
    conflicts.push(item);
  }
  t3.pending_conflicts = conflicts.slice(-20);
}

function mergeInterest(t3, topic, supportSignals) {
  const nowIso = new Date().toISOString();
  const sourceIds = supportSignals.map(s => s.memory.event_id || getMemoryId(s.memory)).filter(Boolean);
  const interests = Array.isArray(t3.interests) ? [...t3.interests] : [];
  const existing = interests.find(item => item.topic === topic);

  if (existing) {
    existing.weight = Math.min(10, Number(existing.weight || 1) + supportSignals.length);
    existing.confidence = existing.weight >= 4 ? 'high' : (existing.confidence || 'medium');
    existing.last_updated = nowIso;
    existing.source_event_ids = Array.from(new Set([...(existing.source_event_ids || []), ...sourceIds])).slice(-12);
  } else {
    interests.push({
      topic,
      weight: Math.min(10, 1 + supportSignals.length),
      confidence: supportSignals.length >= INTEREST_MIN_SUPPORT ? 'high' : 'medium',
      last_updated: nowIso,
      source_event_ids: sourceIds.slice(-12),
    });
  }

  t3.interests = interests
    .filter(item => item?.topic)
    .sort((a, b) => Number(b.weight || 0) - Number(a.weight || 0))
    .slice(0, 16);
}

function buildT3Patch(t3, memories) {
  const nowIso = new Date().toISOString();
  const signals = memories.flatMap(extractSignals);
  const promotedMemoryIds = new Map();
  const promotedFields = new Set();
  let conflicts = 0;

  const names = groupByValue(signals, 'user_name');
  for (const [name, support] of names.entries()) {
    const sourceIds = support.map(s => s.memory.event_id || getMemoryId(s.memory));
    if (!t3.user_name || t3.user_name === name) {
      t3.user_name = name;
      promotedFields.add('user_name');
      support.forEach(s => promotedMemoryIds.set(getMemoryId(s.memory), ['user_name']));
    } else {
      pushConflict(t3, 'user_name', name, t3.user_name, sourceIds);
      conflicts += 1;
    }
  }

  const identities = groupByValue(signals, 'identity');
  for (const [identity, support] of identities.entries()) {
    const sourceIds = support.map(s => s.memory.event_id || getMemoryId(s.memory));
    const strongSupport = support.length >= IDENTITY_MIN_SUPPORT || support.some(s => s.memory.importance_score >= HIGH_VALUE_IMPORTANCE && s.memory.confidence !== 'low');
    if (!strongSupport) continue;

    const current = t3.identity?.value || '';
    if (!current || current === identity || current.includes('用户称呼')) {
      t3.identity = {
        ...(t3.identity || {}),
        value: identity,
        confidence: support.length >= IDENTITY_MIN_SUPPORT ? 'high' : 'medium',
        last_updated: nowIso,
        source_event_ids: Array.from(new Set([...(t3.identity?.source_event_ids || []), ...sourceIds.filter(Boolean)])).slice(-12),
      };
      promotedFields.add('identity');
      support.forEach(s => promotedMemoryIds.set(getMemoryId(s.memory), ['identity']));
    } else if (current !== identity) {
      pushConflict(t3, 'identity', identity, current, sourceIds);
      conflicts += 1;
    }
  }

  const interests = groupByValue(signals, 'interests');
  for (const [topic, support] of interests.entries()) {
    const strongSupport = support.length >= INTEREST_MIN_SUPPORT || support.some(s => s.memory.importance_score >= HIGH_VALUE_IMPORTANCE);
    if (!strongSupport) continue;
    mergeInterest(t3, topic, support);
    promotedFields.add('interests');
    support.forEach(s => promotedMemoryIds.set(getMemoryId(s.memory), ['interests']));
  }

  const contextSignals = signals.filter(s => s.field === 'current_context');
  if (contextSignals.length) {
    const latest = contextSignals.sort((a, b) => parseDateMs(b.memory.timestamp) - parseDateMs(a.memory.timestamp))[0];
    if (latest?.value) {
      t3.current_context = {
        value: latest.value,
        expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      };
      promotedFields.add('current_context');
      promotedMemoryIds.set(getMemoryId(latest.memory), ['current_context']);
    }
  }

  t3.relationship = {
    archetype: t3.relationship?.archetype || '观察者',
    intimacy_level: Math.min(10, Math.max(1, Number(t3.relationship?.intimacy_level || 1))),
    interaction_count: Number(t3.relationship?.interaction_count || 0) + Math.min(memories.length, 3),
    last_chat_time: t3.relationship?.last_chat_time || nowIso,
    bond_momentum: t3.relationship?.bond_momentum || 'stable',
  };

  return { t3, promotedMemoryIds, promotedFields: Array.from(promotedFields), conflicts };
}

async function upsertPersonaProfile(personaId, t3) {
  const payload = {
    user_id: personaId,
    personaId,
    t3_profile: t3,
    updated_at: db.serverDate(),
  };
  const existing = await db.collection('user_profile').where({ user_id: personaId }).limit(1).get();
  if (existing.data?.length) {
    await db.collection('user_profile').doc(existing.data[0]._id).update(payload);
    return;
  }
  await db.collection('user_profile').add({ ...payload, created_at: db.serverDate() });
}

async function fetchMemories(personaId, limit) {
  const res = await db.collection('persona_memories')
    .where({ user_id: personaId })
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();
  return (res.data || []).map(normalizeMemory);
}

async function fetchPersona(personaId) {
  const res = await db.collection('personas').doc(personaId).get();
  const data = Array.isArray(res.data) ? res.data[0] : res.data;
  return data || null;
}

async function fetchPersonaIdsForScheduledScan(limit) {
  const res = await db.collection('personas')
    .orderBy('updatedAt', 'desc')
    .limit(limit)
    .get();
  return (res.data || [])
    .map(item => item._id || item.id)
    .filter(Boolean);
}

function shouldArchive(memory, now) {
  if (memory.archived || memory.is_archived) return false;
  if (memory.promoted_to_t3) return ARCHIVE_AFTER_PROMOTION;
  const expiresAt = parseDateMs(memory.expires_at || memory.expiresAt);
  if (expiresAt && expiresAt <= now && memory.importance_score < HIGH_VALUE_IMPORTANCE) return true;
  if (!String(memory.content || '').trim()) return true;
  return false;
}

async function updateMemoryDoc(memory, patch) {
  const docId = memory._id;
  if (!docId) return false;
  await db.collection('persona_memories').doc(docId).update({ ...patch, updateTime: db.serverDate() });
  return true;
}

exports.main = async (event = {}) => {
  const limit = Math.min(Number(event.limit || DEFAULT_LIMIT), 500);
  const personaScanLimit = Math.min(Number(event.personaScanLimit || DEFAULT_PERSONA_SCAN_LIMIT), 100);
  let personaIds = Array.isArray(event.personaIds)
    ? event.personaIds.filter(Boolean)
    : (event.personaId ? [event.personaId] : []);

  const stats = {
    scanned: 0,
    promoted: 0,
    archived: 0,
    deleted: 0,
    conflicts: 0,
    scheduledScan: false,
    updatedPersonaIds: [],
  };

  if (!personaIds.length) {
    personaIds = await fetchPersonaIdsForScheduledScan(personaScanLimit);
    stats.scheduledScan = true;
  }

  if (!personaIds.length) {
    return { success: true, message: '没有找到需要维护的 Persona。', ...stats };
  }

  for (const personaId of personaIds) {
    const persona = await fetchPersona(personaId);
    if (!persona) continue;

    const memories = await fetchMemories(personaId, limit);
    stats.scanned += memories.length;
    if (!memories.length) continue;

    const activeMemories = memories.filter(memory => !memory.archived && !memory.is_archived && !memory.promoted_to_t3);
    const t3 = parseT3(persona.content);
    const result = buildT3Patch(t3, activeMemories);
    stats.conflicts += result.conflicts;

    if (result.promotedFields.length) {
      const nextContent = JSON.stringify(result.t3);
      await db.collection('personas').doc(personaId).update({ content: nextContent, updatedAt: Date.now() });
      await upsertPersonaProfile(personaId, result.t3);
      stats.updatedPersonaIds.push(personaId);

      for (const memory of activeMemories) {
        const memoryId = getMemoryId(memory);
        if (!result.promotedMemoryIds.has(memoryId) || !memory._id) continue;
        await updateMemoryDoc(memory, {
          promoted_to_t3: true,
          promoted_at: db.serverDate(),
          t3_fields: result.promotedMemoryIds.get(memoryId),
          archived: ARCHIVE_AFTER_PROMOTION,
          archive_reason: ARCHIVE_AFTER_PROMOTION ? 'promoted_to_t3' : undefined,
        });
        stats.promoted += 1;
        if (ARCHIVE_AFTER_PROMOTION) stats.archived += 1;
      }
    }

    const now = Date.now();
    for (const memory of memories) {
      if (!memory._id) continue;
      if (shouldArchive(memory, now)) {
        await updateMemoryDoc(memory, {
          archived: true,
          archived_at: db.serverDate(),
          archive_reason: memory.promoted_to_t3 ? 'promoted_to_t3' : 'expired_low_value',
        });
        stats.archived += 1;
      }
    }
  }

  stats.updatedPersonaIds = Array.from(new Set(stats.updatedPersonaIds));
  return { success: true, ...stats };
};
