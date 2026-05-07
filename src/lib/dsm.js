// ==========================================
// DSM 2.2 核心工具：Schema、Prompt 压缩、守门人与记忆记录规范化
// ==========================================

// ==========================================
// 1. DSM 2.2 核心 Schema 定义 (防空指针预设)
// ==========================================
export const DEFAULT_T3_PROFILE = {
    identity: { value: "", confidence: "low", last_updated: "", source_event_ids: [] },
    personality: { value: "", confidence: "low", last_updated: "", source_event_ids: [] },
    interests: [], 
    relationship: {
        archetype: "观察者",
        intimacy_level: 1,
        interaction_count: 0,
        last_chat_time: new Date().toISOString(),
        bond_momentum: "stable"
    },
    current_context: { value: "", expires_at: "" },
    forbidden_topics: [],
    pending_conflicts: []
};

const CONFIDENCE_LABEL = {
    high: '',
    medium: '[可能]',
};

function shouldInjectField(field) {
    return Boolean(field?.value && field.confidence !== 'low');
}

function formatProfileField(label, field) {
    if (!shouldInjectField(field)) return '';
    return `${label}:${field.value}${CONFIDENCE_LABEL[field.confidence] || ''} | `;
}

// ==========================================
// 2. 紧凑 Prompt 压缩引擎 (机制③)
// ==========================================
export function formatT3Compact(t3) {
    if (!t3) return "";

    const safeT3 = { ...DEFAULT_T3_PROFILE, ...t3 };
    let compactStr = `[用户档案] `;

    compactStr += formatProfileField('身份', safeT3.identity);

    if (safeT3.interests && safeT3.interests.length > 0) {
        const topInterests = [...safeT3.interests]
            .filter(i => i?.topic && i.confidence !== 'low')
            .sort((a, b) => (b.weight || 0) - (a.weight || 0))
            .slice(0, 3)
            .map(i => `${i.topic}(★${i.weight || 1})${i.confidence === 'medium' ? '[可能]' : ''}`)
            .join('/');
        if (topInterests) compactStr += `兴趣:${topInterests} | `;
    }

    compactStr += formatProfileField('性格', safeT3.personality);

    if (safeT3.relationship) {
        compactStr += `关系:${safeT3.relationship.archetype} 亲密度${safeT3.relationship.intimacy_level}/10 | `;
    }

    if (safeT3.current_context && safeT3.current_context.value) {
        const expiresAt = new Date(safeT3.current_context.expires_at).getTime();
        if (!safeT3.current_context.expires_at || expiresAt > Date.now()) {
            compactStr += `状态:${safeT3.current_context.value}`;
        }
    }

    return compactStr.trim();
}

// ==========================================
// 3. 核心指令预设
// ==========================================
export const COLD_START_INSTRUCTION = `
[冷启动破冰指令]
这是与用户的第一次对话，你对用户一无所知。
请在前3轮对话中，自然地获取以下信息（每轮只问一件事，禁止连续追问）：
1. 用户的名字或称呼
2. 最近在忙什么 / 做什么
3. 有什么兴趣爱好
禁止机器人式提问，像朋友一样聊天。
`;

export const COOLING_INSTRUCTION = `
【关系维系指令】与用户的关系处于冷却期，若话题自然，可以适时问一句暖心的关怀，不要刻意。
`;

export const T2_TOOL_DECLARATION = `
{"tool_name":"retrieve_long_term_memory","description":"检索用户的长期语义记忆","trigger_when":"用户询问历史事件、话题涉及专业/旅行/重大决策时","input":{"query":"string"}}
`;

export function getDaysSince(dateString, now = Date.now()) {
    if (!dateString) return 0;
    const parsedTime = new Date(dateString).getTime();
    if (Number.isNaN(parsedTime)) return 0;
    const diffTime = Math.max(0, now - parsedTime);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

export function buildRegressionBlock(days, contextValue) {
    const contextTip = contextValue ? `并结合之前状态：“${contextValue}”` : '';
    return `
【回归感知指令】用户已有 ${days} 天未与你交流。请在本次开场时，极其自然地感叹时间流逝，${contextTip}询问近况。禁止生硬地说"你好久没来了"。
`;
}

// ==========================================
// 4. 内容信号守门人 (机制①)
// ==========================================
const SIGNAL_PATTERNS = [
    /[\u4e00-\u9fa5]{2,4}(大学|公司|医院|景区|城市)/,
    /(今天|昨天|明天|下周|上周|最近|这几天|五一|春节)/,
    /(失恋|分手|Offer|offer|录取|失业|离职|搬家|转专业|怀孕|生病|手术)/,
    /我(打算|要|准备|决定|想).{2,15}(了|去|做)/,
];

export function hasContentSignal(messages) {
    if (!messages || messages.length === 0) return false;
    const lastUserMsg = messages.filter(m => m.role === 'user').slice(-1)[0];
    if (!lastUserMsg) return false;
    const messageContent = lastUserMsg.text || lastUserMsg.content || "";
    return SIGNAL_PATTERNS.some(p => p.test(messageContent));
}

// ==========================================
// 5. 热态 T1 缓存管理 (机制④：LocalStorage 24h 生命周期)
// ==========================================
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
        data.items.push({ summary, timestamp: Date.now() });
        // 防止上下文爆满，最多保留 5 条近期 T1
        if (data.items.length > 5) data.items = data.items.slice(-5);
        localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
        console.error("Hot T1 Cache Error:", error);
    }
}

// ==========================================
// 6. System Prompt 终极组装器 (机制⑦)
// ==========================================
export function buildSystemPrompt(activePersona, hotT1, isCooling, daysSinceLastChat) {
    let t3 = {};
    try {
        t3 = JSON.parse(activePersona?.content || '{}');
    } catch (error) {
        console.warn('T3 JSON 解析失败，使用空档案继续组装 Prompt:', error);
    }
    
    let prompt = formatT3Compact(t3) + "\n\n";

    if (daysSinceLastChat > 7) {
        prompt += buildRegressionBlock(daysSinceLastChat, t3.current_context?.value) + "\n\n";
    }

    if (isCooling) prompt += COOLING_INSTRUCTION + "\n\n";

    prompt += T2_TOOL_DECLARATION + "\n\n";

    if (hotT1 && hotT1.length > 0) {
        prompt += "[近期事件]\n" + hotT1.map(item => `- [${new Date(item.timestamp).toISOString().split('T')[0]}] ${item.summary}`).join('\n') + "\n\n";
    } else if (!t3.identity?.value) {
        prompt += COLD_START_INSTRUCTION + "\n\n";
    }

    // 禁忌话题装载
    if (t3.forbidden_topics && t3.forbidden_topics.length > 0) {
        prompt += `【绝对禁忌】严禁在对话中提及以下内容：${t3.forbidden_topics.join('、')}。\n\n`;
    }
    
    return prompt.trim();
}

// ==========================================
// 7. 动态 Token 预算分配器 (机制②)
// ==========================================
export function applyBudgetAllocator(messages, sysPromptTokens, maxBudget = 4000) {
    let remainingBudget = maxBudget - sysPromptTokens;
    const result = [];
    
    // 逆序遍历：优先保留最新消息，砍掉过早的对话历史
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        // 粗略估算：1 个中文字符约为 1.5 ~ 2 tokens
        const msgTokens = Math.ceil((msg.text || msg.content || "").length / 1.5); 
        if (remainingBudget - msgTokens > 0) {
            result.unshift(msg);
            remainingBudget -= msgTokens;
        } else {
            break;
        }
    }
    return result;
}

// ==========================================
// 8. DSM 2.2 标准记忆记录构造/兼容层
// ==========================================
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
        personaId, // 兼容旧云函数/存量数据，后续迁移完成后可删除
        memory_type: 't1_episodic',
        content: t1Event.summary,
        text: t1Event.summary, // 兼容旧云函数/存量数据，后续迁移完成后可删除
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

// ==========================================
// 9. 记忆提取引擎接口 (预留位)
// ==========================================
export async function extractT1FromMessages(messages) {
    const latestUserText = messages?.filter(m => m.role === 'user').slice(-1)[0]?.text || '';
    console.log("[DSM 守门人] 触发 T1 提取模拟调用...", latestUserText);
    return {
        event_id: `evt_${Date.now()}`,
        content: `事件提炼占位`,
        importance_score: 6,
        emotion: "neutral",
        confidence: "medium",
        timestamp: new Date().toISOString()
    };
}
