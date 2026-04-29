// ==========================================
// 方案 A 全量覆盖：src/lib/dsm.js
// 目标：实装 DSM 2.2 核心数据结构与紧凑 Prompt 压缩引擎
// ==========================================

import { db } from './cloudbase';

// ==========================================
// 1. DSM 2.2 核心 Schema 定义 (防空指针预设)
// ==========================================
export const DEFAULT_T3_PROFILE = {
    identity: { value: "", confidence: "low", last_updated: "", source_event_ids: [] },
    personality: { value: "", confidence: "low", last_updated: "", source_event_ids: [] },
    interests: [], // { topic: "", weight: 0, last_mentioned: "", confidence: "" }
    relationship: {
        archetype: "观察者",
        intimacy_level: 1,
        interaction_count: 0,
        last_chat_time: new Date().toISOString(),
        bond_momentum: "stable"
    },
    current_context: { value: "", expires_at: "" },
    forbidden_topics: [] // 供用户手动设置的禁忌
};

// ==========================================
// 2. 紧凑 Prompt 压缩引擎 (机制③: 节省 44% Token 并便于 Caching)
// ==========================================
export function formatT3Compact(t3) {
    if (!t3) return "";

    const safeT3 = { ...DEFAULT_T3_PROFILE, ...t3 };
    let compactStr = `[用户档案] `;

    // 身份
    if (safeT3.identity.value) {
        compactStr += `${safeT3.identity.value} | `;
    }

    // 兴趣 (取权重最高的前3个)
    if (safeT3.interests && safeT3.interests.length > 0) {
        const topInterests = [...safeT3.interests]
            .sort((a, b) => b.weight - a.weight)
            .slice(0, 3)
            .map(i => `${i.topic}(★${i.weight})`)
            .join('/');
        compactStr += `兴趣:${topInterests} | `;
    }

    // 性格
    if (safeT3.personality.value) {
        const confMark = safeT3.personality.confidence === 'high' ? '' : '[推断]';
        compactStr += `性格:${safeT3.personality.value}${confMark} | `;
    }

    // 关系
    if (safeT3.relationship) {
        compactStr += `关系:${safeT3.relationship.archetype} 亲密度${safeT3.relationship.intimacy_level}/10 | `;
    }

    // 状态
    if (safeT3.current_context && safeT3.current_context.value) {
        // 检查 TTL 是否过期
        const expiresAt = new Date(safeT3.current_context.expires_at).getTime();
        if (!safeT3.current_context.expires_at || expiresAt > Date.now()) {
            compactStr += `状态:${safeT3.current_context.value}`;
        }
    }

    return compactStr.trim();
}

// ==========================================
// 3. System Prompt 组装层 (包含冷启动与关系维护)
// ==========================================
export const COLD_START_INSTRUCTION = `
[冷启动破冰指令]
这是与用户的第一次对话，你对用户一无所知。
请在接下来的前3轮对话中，以极其自然的方式（反问、聊天中顺带问）获取以下信息，并且每轮只问一件事，禁止连续追问：
1. 用户的名字或称呼
2. 最近在忙什么 / 做什么
3. 有什么兴趣爱好
禁止说"请问你叫什么名字"这种机器人式提问。要像朋友一样自然聊天。
当你收集到足够信息后，直接用第一人称陈述出来，触发系统录入。
`;

export const COOLING_INSTRUCTION = `
【关系维系指令】与用户的关系处于冷却期，若话题自然，可以适时问一句暖心的关怀，但不要显得刻意。
`;

export const T2_TOOL_DECLARATION = `
{"tool_name":"retrieve_long_term_memory","description":"检索用户的长期语义记忆","trigger_when":"用户询问历史事件、话题涉及用户的专业/旅行/重大决策时","input":{"query":"string"}}
`;

// 计算距离上次聊天的天数
export function getDaysSince(dateString) {
    if (!dateString) return 0;
    const lastDate = new Date(dateString);
    const diffTime = Math.abs(new Date() - lastDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function buildRegressionBlock(days, contextValue) {
    const contextTip = contextValue ? `并结合之前提到过的状态：“${contextValue}”` : '';
    return `
【回归感知指令】用户已有 ${days} 天未与你交流。请在本次开场时，
以极其自然的方式感叹这段时间的流逝，${contextTip}询问近况。禁止生硬地说"你好久没来了"，要像老朋友一样。
`;
}

// ==========================================
// 4. 内容信号守门人 (机制①: 零成本前置过滤)
// ==========================================
const SIGNAL_PATTERNS = [
    /[\u4e00-\u9fa5]{2,4}(大学|公司|医院|景区|城市)/,
    /(今天|昨天|明天|下周|上周|最近|这几天|五一|春节)/,
    /(失恋|分手|Offer|录取|失业|离职|搬家|转专业|怀孕|生病|手术)/,
    /我(打算|要|准备|决定|想).{2,15}(了|去|做)/,
];

export function hasContentSignal(messages) {
    if (!messages || messages.length === 0) return false;
    const lastUserMsg = messages.filter(m => m.role === 'user').slice(-1)[0];
    if (!lastUserMsg) return false;
    return SIGNAL_PATTERNS.some(p => p.test(lastUserMsg.content));
}

// ==========================================
// 5. 记忆提取引擎接口 (供 ChatPage 调用)
// 提示：实际应调用云函数或廉价大模型API进行提取
// ==========================================
export async function extractT1FromMessages(messages) {
    // 这里应该是调用 Flash 模型进行提取的逻辑
    // 暂时模拟一个带重要度的 JSON 输出，以对接闪电通道
    console.log("[DSM 守门人] 触发 T1 提取模拟调用...");
    
    // 模拟提取结果
    return {
        event_id: `evt_${Date.now()}`,
        content: `用户在讨论重构记忆系统，提及了 offer 等关键词。`,
        importance_score: 6, // 模拟的分数
        emotion: "neutral",
        timestamp: new Date().toISOString()
    };
}
