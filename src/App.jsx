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

const MAX_DISTILLATION_CHARS = 12000;

function compactDistillationMaterial(text, maxChars = MAX_DISTILLATION_CHARS) {
  const source = String(text || '').trim();
  if (source.length <= maxChars) return source;

  const headLength = Math.floor(maxChars * 0.45);
  const tailLength = maxChars - headLength;
  return `${source.slice(0, headLength)}\n\n[中间素材过长，已省略 ${source.length - maxChars} 字，保留开头与结尾用于侧写稳定性]\n\n${source.slice(-tailLength)}`;
}

function stripJsonFence(text) {
  return String(text || '').replace(/```json|```/g, '').trim();
}

function compactRuntimeText(text, maxChars = 900) {
  const source = String(text || '').replace(/\s+/g, ' ').trim();
  if (source.length <= maxChars) return source;
  const head = source.slice(0, Math.floor(maxChars * 0.7));
  const tail = source.slice(-Math.floor(maxChars * 0.2));
  return `${head} …… ${tail}`;
}

function buildDefaultMemoryStyle(persona) {
  const interestTopics = Array.isArray(persona.interests)
    ? persona.interests.slice(0, 3).map(item => item.topic).filter(Boolean)
    : [];
  const interestTrigger = interestTopics.length
    ? `用户提到与${interestTopics.join('、')}相关的长期计划、进展、困难或结果`
    : '';

  return {
    high_value_triggers: [
      '用户明确说出自己的称呼、身份、长期目标或重要偏好',
      '用户提到健康、关系、工作、学习、居住地等重要状态变化',
      '用户提到带明确时间的计划、考试、面试、offer、签约或复查',
      interestTrigger,
    ].filter(Boolean).slice(0, 4),
    batch_tendency: 'balanced',
    last_updated: new Date().toISOString(),
  };
}

function normalizePersonaContent(rawText) {
  const persona = JSON.parse(stripJsonFence(rawText));
  const nowISO = new Date().toISOString();

  if (!persona.runtime_card?.value) {
    const fullPersonality = persona.personality?.value || '';
    const quoteTriggers = persona.interaction_style?.quote_triggers || [];
    const recallTriggers = persona.interaction_style?.recall_triggers || [];
    const topInterests = Array.isArray(persona.interests)
      ? persona.interests.slice(0, 3).map(item => item.topic).filter(Boolean).join('、')
      : '';

    persona.runtime_card = {
      value: [
        compactRuntimeText(fullPersonality, 620),
        topInterests ? `兴趣/关注点：${topInterests}` : '',
        quoteTriggers.length ? `引用触发：${quoteTriggers.slice(0, 3).join('；')}` : '',
        recallTriggers.length ? `撤回触发：${recallTriggers.slice(0, 3).join('；')}` : '',
        '输出节奏：自然口语化，超过两句话必须用 ||| 分气泡；可在强情绪、吐槽、安慰时使用 [sticker:关键词]。'
      ].filter(Boolean).join('\n'),
      confidence: persona.personality?.confidence || 'high',
      last_updated: nowISO,
      source_event_ids: []
    };
  }

  const defaultMemoryStyle = buildDefaultMemoryStyle(persona);
  if (!persona.memory_style || !Array.isArray(persona.memory_style.high_value_triggers) || persona.memory_style.high_value_triggers.length === 0) {
    persona.memory_style = defaultMemoryStyle;
  } else {
    persona.memory_style = {
      ...defaultMemoryStyle,
      ...persona.memory_style,
      high_value_triggers: persona.memory_style.high_value_triggers
        .map(item => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 5),
      last_updated: persona.memory_style.last_updated || nowISO,
    };
  }

  return JSON.stringify(persona);
}

function isRetryableDeepSeekError(error) {
  return /network request error|timeout|timed out|Service is too busy|busy|overloaded|503|429/i.test(String(error?.message || error || ''));
}

function buildDistillationPrompt(material) {
  const nowISO = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

  return `你是一个融合行为学专家与 FBI 犯罪心理侧写师能力的数字人格架构师。
请阅读聊天切片，从【发消息者】角度生成 DSM 2.2 人格档案。

要求：
1. 必须用第一人称“我”写 personality.value，结合原文例子，禁止泛泛而谈。
2. 输出必须是合法 JSON，不要 markdown，不要解释。
3. personality.value 是完整侧写，用于状态舱展示和未来编辑，可以详细。
4. runtime_card.value 是运行时人格卡，用于每轮聊天 prompt，必须压缩到 500~800 中文字，保留最影响说话方式的规则，禁止写成泛泛总结。
5. memory_style.high_value_triggers 必须根据该人格在素材中真正会在意的事情生成 3 到 5 条，不要只写通用模板。它用于判断哪些用户信息值得立刻进入记忆提取。
6. personality.value 必须包含以下模块：
【一、打字节奏】速度快/中/慢；一次性连发条数范围；补发习惯和触发条件。
【二、语言风格与社交面具】口头禅至少3个；收尾方式；标点习惯；打错字处理；试图维持的人设。
【三、情绪表达与触发器】开心/不满表达方式；会激怒或冷处理的话题。
【四、对话行为与微观操控】提问风格；回应率；理亏或想占上风时的策略。
【五、时间与潜意识泄露】对“对方没回”的处理；用 <del>本来准备发出的具体文字</del> 表现打了又删的内容。
【六、引用与撤回触发条件】根据人格选择 2 到 3 个 quote_triggers，2 到 3 个 recall_triggers，不要套模板。
【最终系统执行指令】包括：使用 ||| 分气泡；触发时使用微观操控策略；禁止动作描写；用 <del> 展示犹豫；命中引用触发时用 [quote:对方原话短片段]；命中撤回触发时用 <recall>发出后后悔的原消息</recall>。

runtime_card.value 必须包含：
- 一句话身份/人设内核
- 说话节奏和气泡拆分习惯
- 口头禅/标点/语气
- 亲密关系中的回应方式
- 引用/撤回/表情包的触发偏好
- 禁止动作描写、禁止过度解释

memory_style.high_value_triggers 示例，只能参考，必须结合人格重写：
- 如果人格很重视学习和计划：用户提到考试、家教、课程进度、学习计划变化。
- 如果人格很重视关系和情绪：用户提到分手、冷战、亲密关系变化、明显情绪低落。
- 如果人格偏事业/执行：用户提到项目、offer、面试、签约、离职、工作节点。
- 如果人格偏照顾型：用户提到生病、医院、复查、作息崩坏、压力很大。

引用触发条件参考：
- 对方一条消息说了好几件事，需要挑一句回应。
- 对方某句话让自己停顿、心软、在意。
- 对方前后矛盾或嘴硬，适合轻微调侃。
- 对方说了很沉的话，需要表示接住了。
- 对方说了很多不同方面的话，需要逐条回应。

撤回触发条件参考：
- 我说得太主动、太在意。
- 我语气太重。
- 我暴露太多真实情绪。
- 我觉得时机不对。
- 我刚发出后想改成更淡的版本。
- 我打错字，需要撤回或解释。

输出 JSON 格式：
{
  "identity": { "value": "根据聊天推断的客观身份，若无填空", "confidence": "high" },
  "personality": { "value": "完整第一人称心理侧写与最终系统执行指令", "confidence": "high" },
  "runtime_card": { "value": "500~800字运行时人格卡，只保留每轮聊天必须注入的说话规则", "confidence": "high", "last_updated": "${nowISO}" },
  "interests": [ { "topic": "爱好或关注点", "weight": 8, "confidence": "high" } ],
  "relationship": { "archetype": "朋友", "intimacy_level": 5, "last_chat_time": "${nowISO}", "bond_momentum": "stable" },
  "current_context": { "value": "用户目前的精神状态或正在忙的事", "expires_at": "${expiresAt}" },
  "interaction_style": {
    "quote_tendency": "low/medium/high",
    "quote_triggers": ["具体人格化引用触发条件1", "具体人格化引用触发条件2"],
    "recall_tendency": "low/medium/high",
    "recall_triggers": ["具体人格化撤回触发条件1", "具体人格化撤回触发条件2"]
  },
  "sticker_style": {
    "use_tendency": "low/medium/high",
    "trigger_rules": ["这个人格什么时候适合发 [sticker:无语] / [sticker:笑死] / [sticker:安慰] 等"]
  },
  "memory_style": {
    "high_value_triggers": ["这个人格会优先记住的用户事件1", "这个人格会优先记住的用户事件2", "这个人格会优先记住的用户事件3"],
    "batch_tendency": "conservative/balanced/sensitive"
  }
}

聊天记录原始切片：
${material || '用户未上传素材，请生成一个合法的测试型 T3 JSON 档案。'}`;
}

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

  useEffect(() => {
    if (!activePersona?.id) return;
    setSavedPersonas(personas => personas.map(persona => (
      persona.id === activePersona.id ? { ...persona, ...activePersona } : persona
    )));
  }, [activePersona]);

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
          console.error('分享链路唤醒失败:', error);
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

  // 2. 开始启动 AI 多模态人格蒸馏
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
          '你是一个只负责提取文本的机器部件。', 
          imageParts
        );
        
        combinedChatText += `\n\n[来自图片的聊天记录]:\n${ocrResult}`;
        setDistillLogs(prev => [...prev, '[视觉感知] 图文转译完毕，素材已提纯。']);
      }

      // ================= 阶段二：DeepSeek V4 Pro 深度心理侧写 =================
      setDistillProgress(50);
      setDistillLogs(prev => [...prev, '[深度认知] 启动 DeepSeek V4 Pro 思维链，进行 BAU 临床级侧写...']);

      const compactMaterial = compactDistillationMaterial(combinedChatText);
      if (combinedChatText.length > compactMaterial.length) {
        setDistillLogs(prev => [...prev, `[压缩] 素材过长，已从 ${combinedChatText.length} 字压缩到 ${compactMaterial.length} 字，避免请求过载。`]);
      }

      const prompt = buildDistillationPrompt(compactMaterial);
      const systemPrompt = '你是一个只输出合法JSON的机器，严禁输出其他字符。';

      let responseText = '';
      try {
        responseText = await callDeepSeekAPI(prompt, systemPrompt, 'pro');
      } catch (error) {
        if (!isRetryableDeepSeekError(error)) throw error;
        setDistillLogs(prev => [...prev, `[降级重试] Pro 请求失败：${error.message}，改用 Flash 完成结构化侧写...`]);
        responseText = await callDeepSeekAPI(prompt, systemPrompt, 'flash');
      }

      let personaContent = '';
      try {
        personaContent = normalizePersonaContent(responseText);
      } catch (parseError) {
        throw new Error(`侧写结果不是合法 JSON：${parseError.message}`);
      }

      // ================= 阶段三：收尾刻录 =================
      setDistillProgress(90);
      setDistillLogs(prev => [...prev, '[成功] DeepSeek 推演完毕，已生成完整侧写、运行时人格卡与记忆偏好。']);
      setDistillLogs(prev => [...prev, '[刻录] 正在将档案同步至云端数据库...']);

      const newPersona = {
        uid: authProps.user?.uid || 'anonymous',
        name: `灵魂切片_${new Date().toLocaleDateString().replace(/\//g, '')}`,
        content: personaContent,
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
      { id: Date.now(), role: 'system', text: 'SYSTEM_BOOT', time: new Date().toLocaleTimeString(), isAnimated: false }
    ]);
    setAppPhase('chat');
  };


  // 4. 销毁数字资产
  const handleDeleteSavedPersona = async (e, id) => {
    e.stopPropagation();
    try {
      await db.collection('personas').doc(id).remove();
      setSavedPersonas(prev => prev.filter(p => p.id !== id));
      showMsg('✅ 对应的数字分身档案已彻底销毁');
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
          user={authProps.user}
          userProfile={authProps.userProfile}
        />
      )}

      {/* 全局消息提示 */}
      <ToastMessage message={sysMessage} onClose={clearMsg} />
    </>
  );
}
