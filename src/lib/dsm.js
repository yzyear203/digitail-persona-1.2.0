// src/lib/dsm.js
/**
 * 动态结构化记忆系统 (DSM 2.2) 核心引擎库
 * 核心原则：能不调用 LLM 就不调用。极致利用本地缓存与零成本正则。
 */

// ==========================================
// 机制①：内容信号守门人 (Content Signal Gatekeeper)
// 作用：零成本前置过滤，阻挡 75% 无意义的口水话触发记忆提取
// ==========================================
const SIGNAL_PATTERNS = [
  /[\u4e00-\u9fa5]{2,4}(大学|公司|医院|景区|城市)/, // 命名实体
  /(今天|昨天|明天|下周|上周|最近|这几天|五一|春节)/, // 时间词
  /(失恋|分手|Offer|录取|失业|离职|搬家|转专业|怀孕|生病|手术|累|开心|难受|挂科)/, // 情绪触发点
  /我(打算|要|准备|决定|想).{2,15}(了|去|做|考)/, // 计划与意图
];

export function hasContentSignal(messages) {
  // 只检查最新一轮用户消息，不查历史
  const lastUserMsg = messages.filter(m => m.role === 'user').slice(-1)[0];
  if (!lastUserMsg) return false;
  
  const text = lastUserMsg.text || lastUserMsg.content || '';
  return SIGNAL_PATTERNS.some(pattern => pattern.test(text));
}


// ==========================================
// 补丁①：热态 T1 缓存管理器 (Hot Episodic Cache)
// 作用：存入 localStorage，实现“昨日之事”免检索 0 延迟注入
// ==========================================
export function getHotT1(personaId) {
  const raw = localStorage.getItem(`hot_t1_${personaId}`);
  if (!raw) return null;
  
  try {
    const data = JSON.parse(raw);
    // 强制 24 小时 TTL
    if (Date.now() > data.expires_at) {
      localStorage.removeItem(`hot_t1_${personaId}`);
      return null; 
    }
    return data.items || [];
  } catch (e) {
    return null;
  }
}

export function saveToHotT1Cache(personaId, t1Summary) {
  const key = `hot_t1_${personaId}`;
  const current = getHotT1(personaId) || [];
  
  // 热态区极度克制，只保留最近的 3 条单行摘要
  const newItems = [...current, { summary: t1Summary, timestamp: Date.now() }].slice(-3);
  
  const hotT1Data = {
    items: newItems,
    cached_at: Date.now(),
    expires_at: Date.now() + 24 * 60 * 60 * 1000 // 24小时后硬过期
  };
  localStorage.setItem(key, JSON.stringify(hotT1Data));
}


// ==========================================
// 机制③：动态 Token 预算分配器 (Budget Allocator)
// ==========================================

// 极其轻量的 Token 估算算法（1 Token ≈ 1.5 中文字符）
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 1.5);
}

/**
 * 组装符合 P0 ~ P2 优先级的 System Prompt
 */
export function buildSystemPrompt(activePersona, hotT1, isCooling = false, daysSinceLastChat = 0) {
  // 👑 核心升级：安全解析 JSON 档案
  let t3 = {};
  try {
    t3 = JSON.parse(activePersona?.content || '{}');
  } catch(e) {
    // 兼容旧版纯文本
    t3 = { identity: { value: activePersona?.content } }; 
  }

  // [BLOCK 1 - P0] T3 核心档案 (紧凑格式解析)
  let prompt = `【最高指令：深度灵魂模拟】\n你是：${activePersona?.name || '数字分身'}。\n你的核心设定与潜意识：\n`;
  
  if (t3.identity?.value || t3.personality?.value) {
    prompt += `[用户档案] ${t3.identity?.value || '未知'} | 兴趣:${(t3.interests || []).map(i => i.topic).join('/') || '未知'} | 性格:${t3.personality?.value || '未知'} | 关系:${t3.relationship?.archetype || '分身'} 亲密度${t3.relationship?.intimacy_level || 5}/10 | 状态:${t3.current_context?.value || '无'} \n`;
  }
  
  // [BLOCK 2 - P0 条件] 沉寂回归感知
  if (daysSinceLastChat > 7) {
    prompt += `\n【回归感知指令】用户已有 ${daysSinceLastChat} 天未与你交流。请在本次开场时，以极其自然的方式感叹时间流逝，像老朋友一样。\n`;
  }
  
  // [BLOCK 3 - P0 条件] 关系维系
  if (isCooling) {
    prompt += `\n【关系维系指令】与用户的关系处于冷却期，若话题自然，适时进行暖心关怀，禁止生硬刻意。\n`;
  }

  // [BLOCK 4 - P0 固定] 交互协议与 T2 工具声明
  // 配合后端的 search_subconscious_memory
  prompt += `
【高级交互协议（违背将被重置）】：
1. 【零知识开局】：你对用户的过去一无所知，绝对禁止臆想、捏造用户身份。
2. 【记忆觉醒法则】：只要对话涉及用户的身体、计划、去过的地方、名字等过去的事，**必须调用 search_subconscious_memory 工具**。如果工具查不到，必须坦白说“不记得了”或“你没说过”。
3. 【回复策略】：优先回复最新消息，不想回直接输出 [SILENCE]。
4. 【引用机制】：如果需要针对性回答，选择性使用格式 [quote: 原文内容]。
5. 【拟人化】：撤回消息使用 <recall>撤回的具体内容</recall>，打字犹豫使用 <del>本来想发的话</del>。绝对禁止任何动作描写（如“笑”、“叹气”）。
6. 【强制格式】：单气泡内绝对禁止换行。并发多消息必须用 "|||" 切分。\n`;

  // [BLOCK 5 - P1] 热态 T1 摘要 或 冷启动破冰
  if (hotT1 && hotT1.length > 0) {
    prompt += `\n【近期短时记忆】（无需检索的昨日事实）：\n`;
    hotT1.forEach(item => {
      // 转化为极简格式，如：[2026-04-28] 用户买了五一去华山的高铁票
      const dateStr = new Date(item.timestamp).toISOString().split('T')[0];
      prompt += `· [${dateStr}] ${item.summary}\n`;
    });
  } else if (!t3.identity?.value) {
    // 👑 触发蓝图冷启动流程
    prompt += `\n【冷启动破冰指令】\n这是与用户的第一次对话，你对用户一无所知。请在接下来的前3轮对话中，以极其自然的方式（反问、聊天中顺带问）获取以下信息，并且每轮只问一件事，禁止连续追问：1. 用户的名字或称呼 2. 最近在忙什么 / 做什么 3. 有什么兴趣爱好。禁止说"请问你叫什么名字"这种机器人式提问。要像朋友一样自然聊天。\n`;
  }
  
  return prompt;
}

/**
 * [BLOCK 6 - P2] 对 T0 当前对话轮次进行动态截断
 */
export function applyBudgetAllocator(t0Messages, systemPromptTokens, maxTokens = 4000) {
  let remainingBudget = maxTokens - systemPromptTokens;
  
  if (remainingBudget <= 0) return t0Messages.slice(-1); // 极限防爆：至少保留用户最后一句

  const allowedMessages = [];
  // 逆序遍历：优先保留最新消息，挤出早期无用轮次
  for (let i = t0Messages.length - 1; i >= 0; i--) {
    const msg = t0Messages[i];
    const msgTokens = estimateTokens(msg.text || msg.content);
    if (remainingBudget - msgTokens >= 0) {
      allowedMessages.unshift(msg);
      remainingBudget -= msgTokens;
    } else {
      console.warn(`[DSM Budget Allocator] 早期消息被截断，节约了 ${msgTokens} tokens`);
      break; // 预算耗尽，物理丢弃更早的历史
    }
  }
  return allowedMessages;
}
