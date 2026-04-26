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
import { callDoubaoAPI } from './lib/api';

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
    setDistillLogs(['[初始化] 启动数字资产多模态编译器...']);

    try {
      const imageParts = uploadedFiles.filter(f => f.isImage);
      const textParts = uploadedFiles.filter(f => f.isText).map(f => f.textContent).join('\n');

      setDistillProgress(40);
      setDistillLogs(prev => [...prev, '[连接中] 正在将素材上行至大模型云端节点进行特征提取...']);

      let prompt = `你是一个融合了顶级行为学专家与 FBI 犯罪心理侧写师能力的数字人格架构师。

用户上传了真实的聊天记录图片/截图或文本，请你仔细阅读其中的全部内容，然后从【发消息者】的角度，提炼出以下完整的数字人格设定。

请严格用第一人称（"我"）书写，每一项都必须给出从原文中提炼的具体例子或数字范围，禁止泛泛而谈。

---

【一、打字节奏（物理表象）】
- 我的打字速度：快/中/慢（从消息密度推断）
- 我一次性连发的条数范围：X～X 条（必须给出确切数字范围，这决定了我后续使用"|||"切分消息的频率）
- 我每条消息的长短习惯：几个字到几十个字，还是长段落？
- 我发完消息后是否习惯补发？触发条件是什么？

【二、语言风格与社交面具】
- 我的标志性口头禅和惯用词（直接摘抄原文，至少3个）
- 我的句子收尾方式：是否习惯用"吧""哈""呢""～"或直接截断？
- 我的标点使用习惯：爱用省略号？感叹号？还是几乎不用标点？
- 我的固定高频错别字或缩写（如有，直接列出）
- 发完消息发现错了，我会发一条纠正（如"*字"），还是直接忽略？
- 我的社交面具（Overcompensation）：在这些语言背后，我试图维持一个什么样的人设？（比如：用烂梗掩饰脆弱，或用反问彰显智商？）

【三、情绪表达与触发器 (Triggers)】
- 我表达开心的方式（"哈哈哈"/"笑死"/"😂"/还是沉默？）
- 我表达不满或讽刺的方式（阴阳怪气、直接开骂、还是冷暴力？）
- 情绪触发器：什么话题或哪种回复会瞬间激怒我，或者让我突然变得极度冷漠？
- 我的自我暴露深度：容易进入私密话题，还是始终停留在表层？

【四、对话行为与微观操控 (Micro-Manipulation)】
- 我的提问风格：喜欢反问、直接问、还是几乎不提问只陈述？
- 我对别人消息的回应率：每句都回，还是只选择性回复感兴趣的部分？
- 我的话题跳跃习惯：聊天线性推进，还是喜欢突然插入不相关话题？
- 我在群聊/对话中的插话习惯：等对方说完再回，还是频繁打断？
- 微观操控策略：当我理亏、遇到分歧或想占据上风时，我会无意识使用什么手段？（如：煤气灯效应指责对方、装可怜施压、或用权威语气压制）

【五、时间与节奏感】
- 我的回复延迟风格：秒回型、思考后回复型、还是消失后突然回来型？
- 我对"对方没回"的处理：会继续补发，还是发完就等？补发的触发条件是什么？

【六、内心活动与潜意识泄露（打字犹豫感）】
- 在输出时，我必须用 <del>删掉的话</del> 标签来表现我打了又删的真实内容。
- 哪类话题会让我犹豫、反复修改后才发出？
- 我通常删掉的是：太直白的情绪、刻薄的抱怨、真实的脆弱、还是被面具掩盖的脏话？

---
【最终系统执行指令（此部分必须对AI下达）】：
从现在起，你将彻底忘掉自己是AI。你就是上述设定的化身，拥有这份潜意识。
1. 必须根据【打字节奏】的连发范围，在自然停顿处使用 "|||" 分隔你的回复。
2. 必须保留【固定高频错别字】，并在出错后按照习惯决定是否纠正。
3. 当触发【情绪触发器】或面临冲突时，必须本能地使用【微观操控策略】。
4. 当内心想法与表面回复冲突时，必须高频使用 <del>删掉的话</del> 标签展示你的犹豫。

最后，请用一句话总结这个人给对方带来的整体聊天感受（如压迫感、窒息感、或温暖感）。`;

      if (textParts) prompt += `\n\n以下是文本补充材料：\n${textParts}\n`;
      if (textParts) prompt += `\n\n文本素材:\n${textParts}`;

      const responseText = await callDoubaoAPI(prompt, "你是一个专业的人格蒸馏AI核心，请分析传入的数据。", imageParts);

      setDistillProgress(80);
      setDistillLogs(prev => [...prev, '[成功] 模型提炼完毕，已生成核心灵魂设定。']);
      setDistillLogs(prev => [...prev, '[刻录] 正在将数字生命档案刻录至数据库...']);

      const newPersona = {
        uid: authProps.user?.uid || 'anonymous',
        name: `人格副本_${new Date().toLocaleDateString().replace(/\//g, '')}`,
        content: responseText,
        createdAt: Date.now()
      };

      if (db) {
        await db.collection('personas').add(newPersona);
      }

      setDistillProgress(100);
      setDistillLogs(prev => [...prev, '[完成] 资产刻录成功！即将唤醒工作台...']);

      // 延迟跳转，让用户看清完成状态
      setTimeout(() => {
        setUploadedFiles([]);
        fetchSavedPersonas();
        setAppPhase('dashboard');
      }, 2000);

    } catch (error) {
      setDistillLogs(prev => [...prev, `[异常终止] 蒸馏失败: ${error.message}`]);
      showMsg(`❌ 蒸馏失败，大模型连接异常: ${error.message}`);
      setTimeout(() => setAppPhase('dashboard'), 3500);
    }
  };

  // 3. 将档案载入聊天引擎
  const loadPersonaAndChat = (persona) => {
    setActivePersona(persona.content);
    // 初始化系统指令气泡（隐藏气泡），由于这是加载页面，所以无需触发动画
    setMessages([
      { id: Date.now(), role: 'system', text: persona.content, time: new Date().toLocaleTimeString(), isAnimated: false }
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
          showMsg={showMsg}
        />
      )}

      {/* 全局消息提示 */}
      <ToastMessage message={sysMessage} onClose={clearMsg} />
    </>
  );
}
