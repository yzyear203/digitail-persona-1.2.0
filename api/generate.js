// 文件路径: api/generate.js
export default async function handler(req, res) {
  // 安全拦截：只允许前端用 POST 方式提交数据
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只允许 POST 请求' });
  }

  // 从 Vercel 服务器后台安全读取密钥，这段代码永远不会发送给浏览器！
  const apiKey = process.env.DOUBAO_API_KEY;
  const modelId = process.env.DOUBAO_MODEL_ID;

  // 接收前端传过来的用户聊天内容和图片数据
  const userMessages = req.body.messages;

  try {
    // 由你的 Vercel 服务器代为向火山引擎发起请求
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}` // 钥匙在这里被安全地加上了！
      },
      body: JSON.stringify({
        model: modelId,
        messages: userMessages
      })
    });

    const data = await response.json();
    
    // 把火山引擎返回的结果，原封不动地传回给前端浏览器
    res.status(200).json(data);
  } catch (error) {
    console.error("请求火山引擎失败:", error);
    res.status(500).json({ error: '服务器内部处理错误' });
  }
}