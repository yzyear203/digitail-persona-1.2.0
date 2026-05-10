'use strict';

const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();

const CATEGORY_MAP = {
  github: 'ai_tech',
  hackernews: 'ai_tech',
  hn: 'ai_tech',
  news: 'social',
  google_news: 'social',
  weibo: 'social',
  zhihu: 'social',
  bilibili: 'game_anime',
  xiaohongshu: 'lifestyle',
  reddit: 'weird_fun',
  wikipedia: 'social',
};

const DEFAULT_SOURCES = [
  {
    source_id: 'github_trending',
    name: 'GitHub Trending',
    type: 'github_trending',
    url: 'https://github.com/trending?since=daily',
    category_hint: 'ai_tech',
    enabled: true,
    weight: 0.8,
  },
  {
    source_id: 'hackernews_top',
    name: 'Hacker News Top',
    type: 'rss',
    url: 'https://hnrss.org/frontpage',
    category_hint: 'ai_tech',
    enabled: true,
    weight: 0.75,
  },
  {
    source_id: 'solidot',
    name: 'Solidot',
    type: 'rss',
    url: 'https://www.solidot.org/index.rss',
    category_hint: 'ai_tech',
    enabled: true,
    weight: 0.65,
  },
  {
    source_id: 'sspai',
    name: '少数派',
    type: 'rss',
    url: 'https://sspai.com/feed',
    category_hint: 'lifestyle',
    enabled: true,
    weight: 0.6,
  },
];

const CATEGORY_KEYWORDS = [
  ['ai_tech', /(AI|人工智能|大模型|模型|OpenAI|DeepSeek|Claude|Gemini|芯片|机器人|科技|软件|GitHub|开发|编程|iPhone|苹果|安卓|数码|Sora|Agent)/i],
  ['education', /(高考|考研|大学|学校|教育|考试|留学|课程|老师|学生|家教|论文|学习)/i],
  ['health', /(医院|医生|健康|医学|心理|睡眠|焦虑|抑郁|药|疾病|复查|手术)/i],
  ['finance', /(股市|股票|基金|消费|财经|经济|就业|工资|裁员|房价|利率|美元|人民币|比特币|加密)/i],
  ['entertainment', /(电影|电视剧|综艺|明星|演员|娱乐|票房|音乐|演唱会|塌房)/i],
  ['game_anime', /(游戏|电竞|动漫|二次元|Switch|Steam|原神|鸣潮|崩坏|番剧)/i],
  ['lifestyle', /(旅行|美妆|穿搭|生活|咖啡|奶茶|宠物|健身|做饭|买房|租房|城市)/i],
  ['sports', /(足球|篮球|NBA|英超|世界杯|奥运|比赛|冠军|运动员|体育)/i],
  ['weird_fun', /(离谱|奇葩|热梗|网友|搞笑|吐槽|抽象|整活|翻车)/i],
];

function stripHtml(value = '') {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function hashString(input) {
  const text = String(input || '');
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash) + text.charCodeAt(i);
  return Math.abs(hash).toString(36);
}

function inferCategory(text, fallback = 'social') {
  for (const [category, pattern] of CATEGORY_KEYWORDS) {
    if (pattern.test(text)) return category;
  }
  return fallback;
}

function extractKeywords(text) {
  const source = String(text || '');
  const matches = source.match(/[\u4e00-\u9fa5A-Za-z0-9+#._-]{2,24}/g) || [];
  const stopwords = new Set(['https', 'http', 'www', 'com', 'github', '一个', '这个', '那个', '最新', '如何', '什么', 'the', 'and', 'for', 'with']);
  return Array.from(new Set(matches.map(item => item.trim()).filter(item => !stopwords.has(item.toLowerCase())))).slice(0, 8);
}

function buildTalkingPoints(title, category) {
  const map = {
    ai_tech: ['可以聊它对普通用户有什么用', '可以吐槽它是不是又在制造焦虑', '可以延展到未来工作和学习会不会被改变'],
    education: ['可以聊它对学生或家长有什么影响', '可以问用户最近学习压力是不是也类似', '可以延展到考试、成长和规划'],
    health: ['可以作为轻量提醒，不要提供医疗建议', '可以聊作息、压力和日常照顾', '适合用温和语气接住用户情绪'],
    finance: ['只适合聊现象，不给投资建议', '可以聊普通人消费和就业感受', '可以问用户怎么看这个变化'],
    entertainment: ['适合轻松八卦和吐槽', '可以问用户有没有看过相关作品', '可以用来缓和沉重话题'],
    game_anime: ['适合聊游戏体验或作品热度', '可以吐槽玩家社区反应', '可以问用户玩不玩相关内容'],
    lifestyle: ['适合日常闲聊和转移注意力', '可以聊消费、旅行、穿搭或城市生活', '适合冷场时自然抛出'],
    sports: ['适合聊比赛结果和运动员表现', '可以问用户支持谁', '可以作为轻松话题'],
    weird_fun: ['适合吐槽和制造轻松感', '可以用来打破冷场', '注意不要扩大未经证实的细节'],
    social: ['可以聊普通人的感受', '可以问用户怎么看', '敏感事件要保持克制，不编细节'],
  };
  return map[category] || map.social;
}

function normalizeTopic(raw, source) {
  const title = stripHtml(raw.title || raw.name || raw.text || '');
  if (!title || title.length < 3) return null;
  const link = raw.link || raw.url || source.url;
  const summary = stripHtml(raw.summary || raw.description || raw.content || title).slice(0, 120);
  const textForClassify = `${title} ${summary}`;
  const category = inferCategory(textForClassify, source.category_hint || CATEGORY_MAP[source.type] || 'social');
  const now = Date.now();
  const publishedAt = raw.published_at || raw.pubDate || raw.isoDate ? Date.parse(raw.published_at || raw.pubDate || raw.isoDate) || now : now;
  const heatScore = Math.min(100, Math.round((source.weight || 0.5) * 60 + Math.max(0, 30 - Math.floor((now - publishedAt) / 3600000))));

  return {
    topic_id: `hot_${hashString(`${source.source_id}_${title}_${link}`)}`,
    title,
    summary,
    talking_points: buildTalkingPoints(title, category),
    category,
    subcategories: [],
    keywords: extractKeywords(textForClassify),
    source_id: source.source_id,
    source_name: source.name,
    source_url: link,
    source_type: source.type,
    published_at: publishedAt,
    collected_at: now,
    expires_at: now + 3 * 24 * 3600 * 1000,
    heat_score: heatScore,
    confidence: 'medium',
    safety_level: ['health', 'finance', 'social'].includes(category) ? 'sensitive' : 'normal',
  };
}

function parseRssItems(xml) {
  const items = [];
  const itemRegex = /<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi;
  const blocks = String(xml || '').match(itemRegex) || [];
  for (const block of blocks.slice(0, 30)) {
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
    const link = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1]
      || block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]
      || '';
    const description = block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1]
      || block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1]
      || '';
    const pubDate = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]
      || block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1]
      || block.match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1]
      || '';
    items.push({ title, link: stripHtml(link), description, pubDate: stripHtml(pubDate) });
  }
  return items;
}

function parseGithubTrending(html) {
  const items = [];
  const articleRegex = /<article[\s\S]*?<\/article>/gi;
  const blocks = String(html || '').match(articleRegex) || [];
  for (const block of blocks.slice(0, 25)) {
    const repoHref = block.match(/<h2[\s\S]*?<a[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1];
    const titleRaw = block.match(/<h2[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] || '';
    const desc = block.match(/<p[^>]*class=["'][^"']*col-9[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] || '';
    const title = stripHtml(titleRaw).replace(/\s+/g, '').replace('/', ' / ');
    if (!title) continue;
    items.push({ title, link: repoHref ? `https://github.com${repoHref}` : 'https://github.com/trending', description: desc });
  }
  return items;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'digitail-persona-hot-topics/1.0' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function loadSources(eventSources = []) {
  if (Array.isArray(eventSources) && eventSources.length > 0) {
    return eventSources.filter(source => source.enabled !== false);
  }

  try {
    const res = await db.collection('hot_sources').where({ enabled: true }).limit(100).get();
    if (res.data?.length) return res.data;
  } catch (error) {
    console.warn('读取 hot_sources 失败，使用默认来源:', error.message);
  }

  return DEFAULT_SOURCES;
}

async function collectFromSource(source) {
  const text = await fetchText(source.url);
  const rawItems = source.type === 'github_trending' ? parseGithubTrending(text) : parseRssItems(text);
  return rawItems.map(item => normalizeTopic(item, source)).filter(Boolean);
}

async function saveTopic(topic) {
  try {
    await db.collection('hot_topics').doc(topic.topic_id).set(topic);
    return true;
  } catch (error) {
    try {
      await db.collection('hot_topics').add(topic);
      return true;
    } catch (fallbackError) {
      console.warn('热点写入失败:', topic.title, fallbackError.message);
      return false;
    }
  }
}

async function cleanupExpiredTopics() {
  try {
    const now = Date.now();
    const res = await db.collection('hot_topics').where({ expires_at: db.command.lt(now) }).limit(100).get();
    await Promise.all((res.data || []).map(item => db.collection('hot_topics').doc(item._id).remove().catch(() => null)));
    return res.data?.length || 0;
  } catch (error) {
    console.warn('清理过期热点失败:', error.message);
    return 0;
  }
}

exports.main = async (event = {}, _context = {}) => {
  const runId = `hot_run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = Date.now();
  const sources = await loadSources(event.sources || []);
  const allTopics = [];
  const errors = [];

  for (const source of sources) {
    try {
      const topics = await collectFromSource(source);
      allTopics.push(...topics);
      try {
        await db.collection('hot_sources').doc(source.source_id).update({ last_crawled_at: Date.now() });
      } catch (_) {}
    } catch (error) {
      errors.push({ source_id: source.source_id, message: error.message });
      console.warn('热点来源抓取失败:', source.source_id, error.message);
    }
  }

  const seen = new Set();
  const uniqueTopics = allTopics.filter(topic => {
    const key = `${topic.title}_${topic.source_url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => b.heat_score - a.heat_score).slice(0, event.limit || 80);

  let savedCount = 0;
  for (const topic of uniqueTopics) {
    if (await saveTopic(topic)) savedCount += 1;
  }

  const expiredCount = await cleanupExpiredTopics();
  const finishedAt = Date.now();
  const runLog = {
    run_id: runId,
    started_at: startedAt,
    finished_at: finishedAt,
    duration_ms: finishedAt - startedAt,
    source_count: sources.length,
    raw_item_count: allTopics.length,
    saved_topic_count: savedCount,
    expired_topic_count: expiredCount,
    error_count: errors.length,
    errors,
    createdAt: finishedAt,
    createTime: db.serverDate(),
  };

  try {
    await db.collection('hot_digest_runs').add(runLog);
  } catch (error) {
    console.warn('热点抓取日志写入失败:', error.message);
  }

  return { success: true, ...runLog, sample: uniqueTopics.slice(0, 5) };
};
