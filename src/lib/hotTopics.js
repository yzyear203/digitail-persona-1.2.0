import { cloudbase, db } from './cloudbase';

const HOT_TOPIC_TRIGGER_REGEX = /(最近|这几天|今天|新闻|热点|热搜|发生了什么|有什么好玩|有什么新鲜|AI.*新|科技.*新|娱乐圈|游戏圈|你看到|你知道吗|无聊|聊点别的|讲个|八卦|离谱)/i;

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

export function getPersonaHotKnowledgeStyle(persona) {
  const t3 = parsePersonaContent(persona);
  return {
    preferredCategories: normalizeList(t3.hot_knowledge_style?.preferred_categories),
    avoidCategories: normalizeList(t3.hot_knowledge_style?.avoid_categories),
    initiative: t3.hot_knowledge_style?.initiative || 'medium',
    triggerRules: normalizeList(t3.hot_knowledge_style?.trigger_rules),
  };
}

export function shouldPrefetchHotTopics({ messagesSnapshot = [], persona }) {
  const latestUser = [...messagesSnapshot].reverse().find(message => message.role === 'user');
  const text = String(latestUser?.text || latestUser?.content || '').trim();
  if (HOT_TOPIC_TRIGGER_REGEX.test(text)) return true;

  const style = getPersonaHotKnowledgeStyle(persona);
  if (style.initiative === 'high' && messagesSnapshot.length >= 5) {
    const lastFew = messagesSnapshot.filter(message => message.role !== 'system').slice(-4);
    const shortTurns = lastFew.filter(message => String(message.text || '').length <= 8).length;
    return shortTurns >= 3;
  }

  return false;
}

export function buildHotTopicQuery(messagesSnapshot = []) {
  return messagesSnapshot
    .filter(message => message.role !== 'system' && !message.isRecalled)
    .slice(-4)
    .map(message => String(message.text || message.content || '').replace(/\[quote:[\s\S]*?\]/g, '').trim())
    .filter(Boolean)
    .join(' ')
    .slice(-160);
}

export async function queryHotTopics({ persona, messagesSnapshot = [], limit = 3 }) {
  if (!cloudbase || !shouldPrefetchHotTopics({ persona, messagesSnapshot })) {
    return { promptBlock: '', topics: [] };
  }

  const style = getPersonaHotKnowledgeStyle(persona);
  const query = buildHotTopicQuery(messagesSnapshot);

  try {
    const res = await cloudbase.callFunction({
      name: 'query_hot_topics',
      data: {
        persona,
        query,
        categories: style.preferredCategories,
        avoidCategories: style.avoidCategories,
        limit,
      },
      timeout: 10000,
    });

    const result = res.result || {};
    return {
      promptBlock: result.prompt_block || '',
      topics: result.topics || [],
      preferredCategories: result.preferred_categories || [],
    };
  } catch (error) {
    console.warn('热点资料预取失败，跳过 H1 层:', error);
    return { promptBlock: '', topics: [] };
  }
}

export async function queryHotTopicsDirectly({ persona, messagesSnapshot = [], limit = 3 }) {
  if (!db || !shouldPrefetchHotTopics({ persona, messagesSnapshot })) {
    return { promptBlock: '', topics: [] };
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
    const topics = (res.data || [])
      .filter(topic => !style.avoidCategories.includes(topic.category))
      .filter(topic => !topic.expires_at || Number(topic.expires_at) > Date.now())
      .sort((a, b) => {
        const scoreA = Number(a.heat_score || 0) + (categories.includes(a.category) ? 35 : 0);
        const scoreB = Number(b.heat_score || 0) + (categories.includes(b.category) ? 35 : 0);
        return scoreB - scoreA;
      })
      .slice(0, limit);

    if (!topics.length) return { promptBlock: '', topics: [] };

    return {
      topics,
      promptBlock: `【三天内可聊热点资料】\n以下内容不是用户记忆，只是公共热点。只在自然相关时使用，不要像新闻播报，不要编造资料卡以外的细节。\n${topics.map((topic, index) => `${index + 1}. 标题：${topic.title}\n   摘要：${topic.summary || topic.title}\n   分类：${topic.category}\n   可聊角度：${Array.isArray(topic.talking_points) ? topic.talking_points.slice(0, 3).join('；') : ''}\n   来源：${topic.source_name || 'unknown'}`).join('\n')}`,
    };
  } catch (error) {
    console.warn('前端直读热点资料失败:', error);
    return { promptBlock: '', topics: [] };
  }
}
