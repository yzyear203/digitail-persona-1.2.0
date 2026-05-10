# H1 热点世界资料层接入说明

## 已新增云函数

### collect_hot_topics

路径：

```text
-11020-main/云函数/collect_hot_topics
```

作用：

```text
抓取公开 RSS / GitHub Trending 等热点来源，生成三天内可聊资料卡，写入 hot_topics 集合。
```

默认来源：

```text
GitHub Trending
Hacker News RSS
Solidot RSS
少数派 RSS
```

也可以在数据库 `hot_sources` 集合里配置更多来源。存在启用的 `hot_sources` 时，云函数优先读取数据库配置；没有配置时使用默认来源。

### query_hot_topics

路径：

```text
-11020-main/云函数/query_hot_topics
```

作用：

```text
根据 persona 的 hot_knowledge_style / interests / runtime_card 推断偏好类别，从 hot_topics 中取 2~8 条可聊热点，并返回 prompt_block。
```

返回示例：

```json
{
  "success": true,
  "preferred_categories": ["ai_tech", "weird_fun"],
  "topics": [],
  "prompt_block": "【三天内可聊热点资料】..."
}
```

## 需要创建的数据库集合

```text
hot_sources       可选，配置热点来源
hot_topics        必需，保存热点资料卡
hot_digest_runs   可选，保存每次抓取日志
```

如果数据库允许云函数自动创建集合，可以先不手动创建；如果权限严格，建议手动创建。

## hot_sources 数据结构

```json
{
  "source_id": "sspai",
  "name": "少数派",
  "type": "rss",
  "url": "https://sspai.com/feed",
  "category_hint": "lifestyle",
  "enabled": true,
  "weight": 0.6
}
```

支持的 type：

```text
rss

github_trending
```

## hot_topics 数据结构

```json
{
  "topic_id": "hot_xxx",
  "title": "标题",
  "summary": "短摘要",
  "talking_points": ["可聊角度1", "可聊角度2"],
  "category": "ai_tech",
  "keywords": ["AI", "大模型"],
  "source_name": "来源名",
  "source_url": "原始链接",
  "published_at": 1710000000000,
  "collected_at": 1710000000000,
  "expires_at": 1710259200000,
  "heat_score": 80,
  "safety_level": "normal"
}
```

## 定时触发建议

在 TCB 控制台为 `collect_hot_topics` 配置定时触发。

建议频率：

```text
测试阶段：每天 2 次
正式阶段：每 4 小时 1 次
```

Cron 示例：

```text
0 0 */4 * * * *
```

具体 cron 格式以 TCB 控制台要求为准。

## 前端辅助文件

路径：

```text
src/lib/hotTopics.js
```

作用：

```text
判断用户是否在问热点 / 是否冷场
调用 query_hot_topics 云函数
返回可注入 prompt 的 promptBlock
```

后续在 ChatPage 回复前注入：

```js
const hotTopics = await queryHotTopics({
  persona: personaSnapshot,
  messagesSnapshot: messagesRef.current,
  limit: 3,
});

const responseText = await callDeepSeekAPI(
  `${memoryPrefetchBlock ? `${memoryPrefetchBlock}\n\n` : ''}${hotTopics.promptBlock ? `${hotTopics.promptBlock}\n\n` : ''}对话历史:\n${chatHistoryStr}\n\nAssistant:`,
  sysPrompt,
  'flash',
  controller.signal,
  personaId
);
```

## 注意

热点资料是公共世界资料，不是用户个人记忆。不要把热点本身写入 persona_memories；只有用户对热点表现出的长期兴趣、计划或态度，才应该进入记忆。
