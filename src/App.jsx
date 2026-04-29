import React, { useState, useEffect } from 'react';

// 导入所有页面组件
import HomePage from './components/pages/HomePage';
import AuthPage from './components/pages/AuthPage';
import DashboardPage from './components/pages/DashboardPage';
import DistillingPage from './components/pages/DistillingPage';
import ChatPage from './components/pages/ChatPage';
import ErrorPage from './components/pages/ErrorPage';

// 导入全局组件与钩子
import ToastMessage from './components/ui/ToastMessage';
import { useAuth } from './hooks/useAuth';
import { useToast } from './hooks/useToast';

// 导入核心引擎
import { db, sdkInitError } from './lib/cloudbase';
import { callDoubaoAPI, callDeepSeekAPI } from './lib/api';

export default function App() {
  // === 全局路由与状态调度 ===
  const [appPhase, setAppPhase] = useState('home'); // 可选值: home, auth, dashboard, distilling, chat
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  
  // === 核心数据状态 ===
  const [savedPersonas, setSavedPersonas] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [activePersona, setActivePersona] = useState('');
  const [messages, setMessages] = useState([]);
  
  // === 蒸馏页面专用状态 ===
  const [distillProgress, setDistillProgress] = useState(0);
  const [distillLogs, setDistillLogs] = useState([]);

  // === 挂载自定义 Hooks ===
  const { sysMessage, showMsg, clearMsg } = useToast();
  const authProps = useAuth(setAppPhase, showMsg);

  // === 数据库操作：获取已保存的人格列表 ===
  const fetchSavedPersonas = async () => {
    if (!db || !authProps.user?.uid) return;
    try {
      const res = await db.collection('personas').where({ uid: String(authProps.user.uid) }).get();
      // 适配 TCB V2 数据库返回格式，确保获取 _id 作为唯一标识
      setSavedPersonas(res.data.map(item => ({ ...item, id: item._id || item.id })));
    } catch (err) {
      console.error('获取人格列表失败:', err);
    }
  };

 // 监听用户登录状态，登录成功后自动拉取列表
  useEffect(() => {
    if (authProps.user) {
      fetchSavedPersonas();
    }
  }, [authProps.user]);

  // 🚀 核心新增：监听 URL 裂变参数，实现一键穿透拉起
  useEffect(() => {
    const checkShareLink = async () => {
      const params = new URLSearchParams(window.location.search);
      const shareId = params.get('shareId');
      
      if (shareId && db) {
        try {
          showMsg('✨ 嗅探到灵魂链路，正在唤醒分身...');
          
          // 机制突破：如果好友未登录，强行静默触发游客登录以获取数据库访问 Token
          if (!authProps.user) {
            const { auth } = await import('./lib/cloudbase');
            await auth.anonymousAuthProvider().signIn();
          }
          
          // 根据链接 ID 拉取公有资产
          const res = await db.collection('personas').doc(shareId).get();
          if (res.data && res.data.length > 0) {
            const sharedPersona = res.data[0];
            loadPersonaAndChat(sharedPersona);
            // 唤醒成功后，静默清除 URL 上的小尾巴，保持地址栏纯净
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            showMsg('❌ 该数字资产已销毁或设置了私密');
          }
        } catch (error) {
          showMsg('❌ 唤醒失败，请检查 TCB 数据库是否已设置为“公有读”');
        }
      }
    };
    checkShareLink();
  }, [db, authProps.user]);

  // 如果云开发初始化失败，直接拦截到白屏急救页
  if (sdkInitError) {
    return <ErrorPage error={sdkInitError} />;
  }

  // === 核心业务方法 ===

  // 1. 同意协议并前往登录注册
  const handleAgreeAndProceed = () => {
    setShowAgreementModal(false);
    setAppPhase('auth');
  };

  // 2. 开始启动 AI 多模态人格蒸馏 (完全替换该方法)
  const handleStartDistillation = async () => {
    if (uploadedFiles.length === 0) return;
    setAppPhase('distilling');
    setDistillProgress(10);
    setDistillLogs(['[初始化] 启动数字资产双擎编译器...']);

    try {
      const imageParts = uploadedFiles.filter(f => f.isImage);
      const textParts = uploadedFiles.filter(f => f.isText).map(f => f.textContent).join('\n');
      let combinedChatText = textParts;

      // ================= 阶段一：Doubao 视觉感知 (OCR) =================
      if (imageParts.length > 0) {
        setDistillProgress(30);
        setDistillLogs(prev => [...prev, '[视觉感知] 唤醒 Doubao 视觉中枢，进行高精度 OCR 剥离...']);
        
        const ocrPrompt = `你现在是一个无情的 OCR 提取机器。
请提取图片中的所有聊天记录，按时间顺序整理成以下纯文本格式：
A: [说话内容]
B: [说话内容]
如果图片中有系统提示（如撤回、拍了拍），请用括号标注。
【严禁做任何分析、解释或多余的问候，只输出聊天文本！】`;

        const ocrResult = await callDoubaoAPI(
          ocrPrompt, 
          "你是一个只负责提取文本的机器部件。", 
          imageParts
        );
        
        combinedChatText += `\n\n[来自图片的聊天记录]:\n${ocrResult}`;
        setDistillLogs(prev => [...prev, '[视觉感知] 图文转译完毕，素材已提纯。']);
      }

      // ================= 阶段二：DeepSeek V4 Pro 深度心理侧写 =================
      setDistillProgress(50);
      setDistillLogs(prev => [...prev, '[深度认知] 启动 DeepSeek V4 Pro 思维链，进行 BAU 临床级侧写...']);

      // 👑 终极进化：完美保留 FBI 侧写逻辑并强制输出 DSM 2.2 标准的 JSON
      let prompt = `你是一个融合了顶级行为学专家与 FBI 犯罪心理侧写师能力的数字人格架构师。
请仔细阅读以下原始聊天切片，从【发消息者】的角度，提炼出符合 DSM 2.2 标准的结构化档案。

【核心任务要求】：
你需要完成两步：
第一步：完成深度的心理侧写与指令编写（请严格遵循下方的《侧写指南》）。
第二步：将你写好的侧写内容，严格封装成规定的 JSON 格式返回。

=== 《侧写指南》 ===
请严格用第一人称（"我"）书写，必须结合原文例子，禁止泛泛而谈。
【一、打字节奏（物理表象）】
- 我的打字速度：快/中/慢
- 我一次性连发的条数范围：X～X 条（必须给出确切数字范围，决定我使用"|||"切分消息的频率）
- 我发完消息后是否习惯补发？触发条件是什么？
【二、语言风格与社交面具】
- 我的标志性口头禅和惯用词（摘抄原文，至少3个）
- 我的句子收尾方式：习惯用"吧""哈""呢""～"或直接截断？
- 我的标点使用习惯
- 发完消息发现错了，我会发一条纠正（如"*字"），还是直接忽略？
- 我的社交面具（Overcompensation）：我试图维持一个什么样的人设？
【三、情绪表达与触发器 (Triggers)】
- 我表达开心/不满的方式
- 情绪触发器：什么话题会瞬间激怒我或让我极度冷漠？
【四、对话行为与微观操控】
- 我的提问风格与回应率
- 微观操控策略：理亏或想占据上风时，我会使用什么手段？（如：煤气灯指责、装可怜、权威压制）
【五、时间与潜意识泄露】
- 对"对方没回"的处理方式
- 潜意识犹豫（核心）：我必须用 <del>本来准备发出的具体文字</del> 标签来表现我打了又删的真实内容，绝对禁止写成内心戏！我通常删掉的是哪类真实发言？
---
【最终系统执行指令（此部分必须对AI下达）】：
从现在起，彻底忘掉你是AI，你就是上述设定的化身。
1. 根据【打字节奏】在自然停顿处用 "|||" 分隔回复。
2. 触发【情绪触发器】时，本能使用【微观操控策略】。
3. 绝对禁止在回复中夹杂任何形式的动作描写、表情描写或场景说明（例如 (笑)、(秒回)、(动作) 等）！
4. 当内心想法与表面回复冲突时，必须高频使用 <del>本来准备发出的文字</del> 标签展示犹豫。
最后，用一句话总结给对方带来的整体聊天感受。
===================

【输出格式要求（最高优先级红线）】：
完成以上思考后，请**严格、仅**输出合法的 JSON 字符串，绝对不要包含 markdown 代码块（如 \`\`\`json）或其他废话。
你必须将上面基于《侧写指南》写出的全部内容（包括 5 大维度分析和最终指令），原封不动地放入 JSON 的 \`personality.value\` 字段中！
JSON 格式必须严格如下：
{
  "identity": { "value": "根据聊天推断的客观身份（如：学生、打工人、性别等），若无填空", "confidence": "high" },
  "personality": { "value": "在这里填入你基于《侧写指南》用第一人称写出的完整心理侧写及【最终系统执行指令】。这段长文本将作为系统的核心灵魂驱动。", "confidence": "high" },
  "interests": [ { "topic": "提取的爱好1", "weight": 8, "confidence": "high" } ],
  "relationship": { "archetype": "朋友/恋人/同事", "intimacy_level": 5, "last_chat_time": "${new Date().toISOString()}", "bond_momentum": "stable" },
  "current_context": { "value": "用户目前的精神状态或正在忙的事", "expires_at": "${new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()}" }
}`;

      if (combinedChatText) prompt += `\n\n【必须进行分析的聊天记录原始切片】：\n${combinedChatText}\n`;
      if (!combinedChatText) prompt = "用户未上传素材，请随机生成一个合法的极度压抑的测试型 T3 JSON 档案。";

      // 👑 绝不改动你的原版提示词，仅在末尾强制其用 JSON 包装结果
      prompt += `\n\n【格式红线】：请将你上述分析的所有内容和系统指令，全部放在以下 JSON 的 "personality" 字段的 "value" 中。你只能输出合法的 JSON，绝对禁止输出 Markdown！
      {
        "identity": { "value": "", "confidence": "high" },
        "personality": { "value": "你的分析结果写在这里", "confidence": "high" },
        "interests": [],
        "relationship": { "archetype": "朋友", "intimacy_level": 5, "last_chat_time": "${new Date().toISOString()}", "bond_momentum": "stable" },
        "current_context": { "value": "无", "expires_at": "${new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()}" }
      }`;

      const responseText = await callDeepSeekAPI(
        prompt, 
        "你是一个只输出合法JSON的机器，严禁输出其他字符。"
      );

      // ================= 阶段三：收尾刻录 =================
      setDistillProgress(90);
      setDistillLogs(prev => [...prev, '[成功] DeepSeek V4 思维链推演完毕。']);
      setDistillLogs(prev => [...prev, '[刻录] 正在将档案同步至云端数据库...']);

      const newPersona = {
        uid: authProps.user?.uid || 'anonymous',
        name: `灵魂切片_${new Date().toLocaleDateString().replace(/\//g, '')}`,
        content: responseText,
        createdAt: Date.now()
      };

      if (db) await db.collection('personas').add(newPersona);

      setDistillProgress(100);
      setDistillLogs(prev => [...prev, '[完成] 资产刻录成功！唤醒工作台...']);

      setTimeout(() => {
        setUploadedFiles([]);
        fetchSavedPersonas();
        setAppPhase('dashboard');
      }, 2000);

    } catch (error) {
      setDistillLogs(prev => [...prev, `[异常终止] 架构崩塌: ${error.message}`]);
      showMsg(`❌ 编译链断裂: ${error.message}`);
      setTimeout(() => setAppPhase('dashboard'), 3500);
    }
  };

  // 3. 将档案载入聊天引擎
  const loadPersonaAndChat = (persona) => {
    // 🚀 核心修复：传递完整的 persona 对象（包含 name, content, id）
    setActivePersona(persona);
    // 注意：DSM 2.2 中这里存放的是 SYSTEM_BOOT 占位，真正的 Prompt 在 ChatPage 实时组装
    setMessages([
      { id: Date.now(), role: 'system', text: "SYSTEM_BOOT", time: new Date().toLocaleTimeString(), isAnimated: false }
    ]);
    setAppPhase('chat');
  };

  // 4. 销毁数字资产
  const handleDeleteSavedPersona = async (e, id) => {
    e.stopPropagation();
    try {
      await db.collection('personas').doc(id).remove();
      setSavedPersonas(prev => prev.filter(p => p.id !== id));
      showMsg("✅ 对应的数字分身档案已彻底销毁");
    } catch (error) {
      showMsg(`❌ 销毁失败: ${error.message}`);
    }
  };

  return (
    <>
      {/* 根节点动态渲染调度中心 */}
      {appPhase === 'home' && (
        <HomePage
          setAppPhase={setAppPhase}
          showMsg={showMsg}
          isAgreed={authProps.isAgreed}
          setIsAgreed={authProps.setIsAgreed}
          showAgreementModal={showAgreementModal}
          setShowAgreementModal={setShowAgreementModal}
          handleAgreeAndProceed={handleAgreeAndProceed}
        />
      )}

      {appPhase === 'auth' && (
        <AuthPage 
          setAppPhase={setAppPhase} 
          authProps={authProps} 
        />
      )}

      {appPhase === 'dashboard' && (
        <DashboardPage
          userProfile={authProps.userProfile}
          savedPersonas={savedPersonas}
          uploadedFiles={uploadedFiles}
          setUploadedFiles={setUploadedFiles}
          handleStartDistillation={handleStartDistillation}
          handleDeleteSavedPersona={handleDeleteSavedPersona}
          loadPersonaAndChat={loadPersonaAndChat}
          handleLogout={authProps.handleLogout}
        />
      )}

      {appPhase === 'distilling' && (
        <DistillingPage 
          distillProgress={distillProgress} 
          distillLogs={distillLogs} 
        />
      )}

      {appPhase === 'chat' && (
        <ChatPage
          setAppPhase={setAppPhase}
          messages={messages}
          setMessages={setMessages}
          activePersona={activePersona}
          setActivePersona={setActivePersona} // 👑 补全了此前遗漏的重要状态分发！
          showMsg={showMsg}
        />
      )}

      {/* 全局消息提示 */}
      <ToastMessage message={sysMessage} onClose={clearMsg} />
    </>
  );
}
