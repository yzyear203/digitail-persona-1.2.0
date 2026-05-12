import { cloudbase, db } from './cloudbase';

const HOT_TOPIC_TRIGGER_REGEX = /(最近|这几天|今天|新闻|热点|热搜|发生了什么|有什么好玩|有什么新鲜|AI.*新|科技.*新|娱乐圈|游戏圈|你看到|你知道吗|无聊|聊点别的|讲个|八卦|离谱)/i;
const DIRECT_REPLY_REGEX = /(我叫|名字|记得|之前|上次|为什么|为啥|怎么|怎样|哪里|什么时候|多少|代码|报错|bug|修|检查|解释|证明|计算|题|选项|上传|文件|图片)/i;
const AMBIENT_HOT_TOPIC_RATE = 0.1;

function parsePersonaContent(persona) {
  try {
    return JSON.parse(persona?.content || '{}');
  } catch (_) {
    return {};
  }
}

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  return String(value).split(/[,，、\s]+/).map(item => item.trim()).filter(Boolean);
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

function getLatestUserMessage(messagesSnapshot = []) {
  return [...messagesSnapshot].reverse().find(message => message.role === 'user') || null;
}

function getMessageText(message) {
  return String(message?.text || message?.content || '')
    .replace(/\[quote:[\s\S]*?\]/g, '')
    .replace(/<\/?recall>/g, '')
    .trim();
}

function getAmbientHotTopicRoll({ messagesSnapshot = [], persona }) {
  const latestUser = getLatestUserMessage(messagesSnapshot);
  const text = getMessageText(latestUser);
  const personaId = persona?._id || persona?.id || persona?.name || 'default';
  const todayKey = new Date().toISOString().slice(0, 10);
  const stableSeed = `${personaId}|${todayKey}|${messagesSnapshot.length}|${latestUser?.id || ''}|${text}`;
  return (hashString(stableSeed) % 1000) / 1000;
}

export function getPersonaHotKnowledgeStyle(persona) {
  const t3 = parsePersonaContent(persona);
  return {
    preferredCategories: normalizeList(t3.hot_knowledge_style?.preferred_categories),
    avoidCategories: normalizeList(t3.hot_knowledge_style?.avoid_categories),
    initiative: t3.hot_knowledge_style?.initiative || 'medium',
    triggerRules: normalizeList(t3.hot_knowledge_style?.trigger_rules),
  };
}

export function getHotTopicTriggerReason({ messagesSnapshot = [], persona }) {
  const latestUser = getLatestUserMessage(messagesSnapshot);
  const text = getMessageText(latestUser);
  if (!text) return '';
  if (HOT_TOPIC_TRIGGER_REGEX.test(text)) return 'explicit';

  const style = getPersonaHotKnowledgeStyle(persona);
  if (style.initiative === 'low') return '';
  if (messagesSnapshot.length < 6) return '';
  if (text.length > 80) return '';
  if (DIRECT_REPLY_REGEX.test(text)) return '';

  const lastFew = messagesSnapshot.filter(message => message.role !== 'system').slice(-5);
  const shortTurns = lastFew.filter(message => getMessageText(message).length <= 14).length;
  const isIdleChat = shortTurns >= 2 || /哈哈|笑死|确实|可以|行吧|好吧|嗯|啊|哦|离谱|无聊/.test(text);
  if (!isIdleChat && style.initiative !== 'high') return '';

  return getAmbientHotTopicRoll({ messagesSnapshot, persona }) < AMBIENT_HOT_TOPIC_RATE ? 'ambient' : '';
}

export function shouldPrefetchHotTopics({ messagesSnapshot = [], persona }) {
  return Boolean(getHotTopicTriggerReason({ messagesSnapshot, persona }));
}

export function buildHotTopicQuery(messagesSnapshot = []) {
  return messagesSnapshot
    .filter(message => message.role !== 'system' && !message.isRecalled)
    .slice(-4)
    .map(message => getMessageText(message))
    .filter(Boolean)
    .join(' ')
    .slice(-160);
}

function buildHotTopicPromptBlock({ topics, triggerReason }) {
  const header = triggerReason === 'ambient'
    ? '【可选开放世界轻触发素材】\n以下只是可顺手一带的外部世界素材；只有和当前气氛自然贴合时才提一句，不要抢用户话题，不相关就完全忽略。'
    : '【三天内可聊热点资料】\n以下内容不是用户记忆，只是公共热点。只在自然相关时使用，不要像新闻播报，不要编造资料卡以外的细节。';

  return `${header}\n${topics.map((topic, index) => `${index + 1}. 标题：${topic.title}\n   摘要：${topic.summary || topic.title}\n   分类：${topic.category || 'unknown'}\n   可聊角度：${Array.isArray(topic.talking_points) ? topic.talking_points.slice(0, 2).join('；') : ''}\n   来源：${topic.source_name || 'unknown'}`).join('\n')}`;
}

export async function queryHotTopics({ persona, messagesSnapshot = [], limit = 3 }) {
  const triggerReason = getHotTopicTriggerReason({ messagesSnapshot, persona });
  if (!cloudbase || !triggerReason) {
    return { promptBlock: '', topics: [], triggerReason: '' };
  }

  const style = getPersonaHotKnowledgeStyle(persona);
  const query = buildHotTopicQuery(messagesSnapshot);
  const requestLimit = triggerReason === 'ambient' ? Math.min(limit, 1) : limit;

  try {
    const res = await cloudbase.callFunction({
      name: 'query_hot_topics',
      data: {
        persona,
        query,
        categories: style.preferredCategories,
        avoidCategories: style.avoidCategories,
        limit: requestLimit,
        triggerReason,
      },
      timeout: 10000,
    });

    const result = res.result || {};
    const topics = (result.topics || []).slice(0, requestLimit);
    return {
      promptBlock: result.prompt_block || (topics.length ? buildHotTopicPromptBlock({ topics, triggerReason }) : ''),
      topics,
      preferredCategories: result.preferred_categories || [],
      triggerReason,
    };
  } catch (error) {
    console.warn('热点资料预取失败，跳过 H1 层:', error);
    return { promptBlock: '', topics: [], triggerReason };
  }
}

export async function queryHotTopicsDirectly({ persona, messagesSnapshot = [], limit = 3 }) {
  const triggerReason = getHotTopicTriggerReason({ messagesSnapshot, persona });
  if (!db || !triggerReason) {
    return { promptBlock: '', topics: [], triggerReason: '' };
  }

  try {
    let res;
    try {
      res = await db.collection('hot_topics')
        .where({ expires_at: db.command.gt(Date.now()) })
        .orderBy('heat_score', 'desc')
        .limit(80)
        .get();
    } catch (_) {
      res = await db.collection('hot_topics').limit(80).get();
    }

    const style = getPersonaHotKnowledgeStyle(persona);
    const categories = style.preferredCategories;
    const requestLimit = triggerReason === 'ambient' ? Math.min(limit, 1) : limit;
    const topics = (res.data || [])
      .filter(topic => !style.avoidCategories.includes(topic.category))
      .filter(topic => !topic.expires_at || Number(topic.expires_at) > Date.now())
      .sort((a, b) => {
        const scoreA = Number(a.heat_score || 0) + (categories.includes(a.category) ? 35 : 0);
        const scoreB = Number(b.heat_score || 0) + (categories.includes(b.category) ? 35 : 0);
        return scoreB - scoreA;
      })
      .slice(0, requestLimit);

    if (!topics.length) return { promptBlock: '', topics: [], triggerReason };

    return {
      topics,
      triggerReason,
      promptBlock: buildHotTopicPromptBlock({ topics, triggerReason }),
    };
  } catch (error) {
    console.warn('前端直读热点资料失败:', error);
    return { promptBlock: '', topics: [], triggerReason };
  }
}
