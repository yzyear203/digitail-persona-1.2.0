'use strict';

const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();

const DEFAULT_CATEGORY_ALIASES = {
  ai_tech: ['AI', '科技', '数码', '大模型', '编程', 'GitHub'],
  entertainment: ['娱乐', '明星', '影视', '综艺', '音乐'],
  social: ['社会', '民生', '城市', '新闻'],
  finance: ['财经', '消费', '就业', '经济'],
  education: ['教育', '考试', '学校', '学习', '留学'],
  health: ['健康', '医学', '心理', '医院'],
  sports: ['体育', '比赛', '足球', '篮球'],
  game_anime: ['游戏', '动漫', '二次元', '电竞'],
  lifestyle: ['生活', '旅行', '美妆', '穿搭', '宠物'],
  weird_fun: ['离谱', '热梗', '吐槽', '搞笑'],
};

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  return String(value).split(/[,，、\s]+/).map(item => item.trim()).filter(Boolean);
}

function parsePersonaContent(content) {
  try {
    return JSON.parse(content || '{}');
  } catch (_) {
    return {};
  }
}

function inferPreferredCategoriesFromPersona(persona = {}) {
  const t3 = typeof persona.content === 'string' ? parsePersonaContent(persona.content) : persona;
  const explicit = normalizeList(t3.hot_knowledge_style?.preferred_categories);
  if (explicit.length) return explicit;

  const text = [
    t3.runtime_card?.value,
    t3.personality?.value,
    ...(Array.isArray(t3.interests) ? t3.interests.map(item => item.topic || '') : []),
  ].join(' ');

  const categories = [];
  for (const [category, aliases] of Object.entries(DEFAULT_CATEGORY_ALIASES)) {
    if (aliases.some(alias => text.includes(alias))) categories.push(category);
  }

  return categories.length ? categories.slice(0, 4) : ['weird_fun', 'ai_tech', 'lifestyle', 'social'];
}

function keywordScore(topic, query) {
  const text = `${topic.title || ''} ${topic.summary || ''} ${(topic.keywords || []).join(' ')}`;
  const words = normalizeList(query).concat(String(query || '').match(/[\u4e00-\u9fa5A-Za-z0-9+#._-]{2,16}/g) || []);
  const uniqueWords = Array.from(new Set(words));
  if (!uniqueWords.length) return 0;
  return uniqueWords.filter(word => text.includes(word)).length;
}

function topicScore(topic, { categories, query }) {
  let score = Number(topic.heat_score || 0);
  if (categories.includes(topic.category)) score += 35;
  score += keywordScore(topic, query) * 18;
  const ageHours = Math.max(0, (Date.now() - Number(topic.published_at || topic.collected_at || Date.now())) / 3600000);
  score += Math.max(0, 24 - ageHours) * 0.8;
  return score;
}

function formatHotTopicsBlock(topics) {
  if (!topics.length) return '';
  return `【三天内可聊热点资料】\n以下内容不是用户记忆，只是公共热点。只在自然相关时使用，不要像新闻播报，不要编造资料卡以外的细节。\n${topics.map((topic, index) => {
    const points = Array.isArray(topic.talking_points) ? topic.talking_points.slice(0, 3).join('；') : '';
    return `${index + 1}. 标题：${topic.title}\n   摘要：${topic.summary || topic.title}\n   分类：${topic.category}\n   可聊角度：${points}\n   来源：${topic.source_name || 'unknown'}`;
  }).join('\n')}`;
}

exports.main = async (event = {}, _context = {}) => {
  const limit = Math.min(Number(event.limit || 4), 8);
  const persona = event.persona || null;
  const query = String(event.query || '').slice(0, 160);
  const preferredCategories = normalizeList(event.categories).length
    ? normalizeList(event.categories)
    : inferPreferredCategoriesFromPersona(persona || {});
  const avoidCategories = normalizeList(event.avoidCategories || persona?.hot_knowledge_style?.avoid_categories);

  try {
    let res;
    try {
      res = await db.collection('hot_topics')
        .where({ expires_at: db.command.gt(Date.now()) })
        .orderBy('heat_score', 'desc')
        .limit(120)
        .get();
    } catch (_) {
      res = await db.collection('hot_topics').limit(120).get();
    }

    const topics = (res.data || [])
      .filter(topic => !avoidCategories.includes(topic.category))
      .filter(topic => !topic.expires_at || Number(topic.expires_at) > Date.now())
      .map(topic => ({ ...topic, _score: topicScore(topic, { categories: preferredCategories, query }) }))
      .sort((a, b) => b._score - a._score)
      .slice(0, limit);

    return {
      success: true,
      preferred_categories: preferredCategories,
      topics,
      prompt_block: formatHotTopicsBlock(topics),
    };
  } catch (error) {
    return { success: false, error: error.message, topics: [], prompt_block: '' };
  }
};
