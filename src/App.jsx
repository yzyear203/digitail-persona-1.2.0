import React, { useState, useEffect } from 'react';
import { auth, db, sdkInitError } from './lib/cloudbase';
import { callDoubaoAPI } from './lib/api';
import { useToast } from './hooks/useToast';
import { useAuth } from './hooks/useAuth';
import ToastMessage from './components/ui/ToastMessage';
import ErrorPage from './components/pages/ErrorPage';
import HomePage from './components/pages/HomePage';
import AuthPage from './components/pages/AuthPage';
import DashboardPage from './components/pages/DashboardPage';
import DistillingPage from './components/pages/DistillingPage';
import ChatPage from './components/pages/ChatPage';

export default function App() {
  const [appPhase, setAppPhase] = useState('home');
  const { sysMessage, showMsg, clearMsg } = useToast();
  const authProps = useAuth(setAppPhase, showMsg);
  const { user, userProfile, handleLogout, isAgreed, setIsAgreed } = authProps;

  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [savedPersonas, setSavedPersonas] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [distillProgress, setDistillProgress] = useState(0);
  const [distillLogs, setDistillLogs] = useState([]);
  const [activePersona, setActivePersona] = useState("你是一个乐于助人的 AI 助手。");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!auth || !db || !user) return;
    const watcher = db.collection('personas').where({ owner: String(user.uid) }).watch({
      onChange: snapshot => {
        const loaded = snapshot.docs.map(doc => ({ id: doc._id, ...doc }));
        loaded.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setSavedPersonas(loaded);
      },
      onError: err => console.error("personas 监听失败:", err)
    });
    return () => watcher.close();
  }, [user]);

  const handleAgreeAndProceed = () => {
    setShowAgreementModal(false);
    setAppPhase(user && !user.isAnonymous ? 'dashboard' : 'auth');
  };

  const loadPersonaAndChat = (persona) => {
    setActivePersona(persona.personaPrompt);
    setMessages([
      { id: 1, role: 'system', text: `已从云端唤醒【${persona.name}】。`, time: new Date().toLocaleTimeString(), isAnimated: false },
      { id: 2, role: 'assistant', text: `你好，我是 ${persona.name} 的数字分身，继续聊吧。`, time: new Date().toLocaleTimeString(), isAnimated: true }
    ]);
    setAppPhase('chat');
  };

  const handleDeleteSavedPersona = async (e, personaId) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await db.collection('personas').doc(personaId).remove();
      showMsg("✅ 分身档案已删除");
    } catch (err) {
      showMsg(`❌ 删除失败：${err.message}`);
    }
  };

  const handleStartDistillation = async () => {
    setAppPhase('distilling');
    setDistillLogs(["[系统就绪] 开始建立后端真实算力连接..."]);
    setDistillProgress(5);
    try {
      const imageParts = uploadedFiles.filter(f => f.isImage && f.base64Data).map(f => ({ mimeType: f.mimeType, base64Data: f.base64Data }));
      const textContents = uploadedFiles.filter(f => f.isText && f.textContent).map(f => `【${f.name}】:\n${f.textContent}`).join('\n\n');
      setDistillLogs(prev => [...prev, `[解析层] 加载 ${imageParts.length} 张图片，${textContents ? '含文本数据' : '无文本'}。`]);
      setDistillProgress(25);
      setTimeout(() => { setDistillLogs(prev => [...prev, "[深度推理] 注入视觉大模型，执行 OCR 提炼..."]); setDistillProgress(50); }, 1000);

      let prompt = `用户上传了包含真实聊天记录的图片/截图。请提炼这个人的数字人格设定，用第一人称回答，必须包含：
1. 核心性格与沟通风格。
2. 常用口头禅（摘抄原话）。
3. 处理事务的逻辑。
4. 发消息的节奏风格。
5. 连发条数心理边界（明确写出数字范围）。`;
      if (textContents) prompt = `参考文本：\n\n${textContents}\n\n` + prompt;
      if (!imageParts.length && !textContents) prompt = "用户未上传有效素材，请随机生成一个标准AI助手人格设定。";

      const generatedPersona = await callDoubaoAPI(prompt, "你是一个擅长提炼人类心理学和行为特征的架构师。", imageParts);
      setDistillLogs(prev => [...prev, "[算力释放] 特征映射完成！"]);
      setDistillProgress(80);
      setActivePersona(generatedPersona);

      if (user && db) {
        try {
          await db.collection('personas').add({
            name: uploadedFiles[0]?.name?.split('.')[0] || '未命名数字人',
            personaPrompt: generatedPersona,
            createdAt: Date.now(),
            owner: String(user.uid)
          });
          setDistillLogs(prev => [...prev, "[云端同步] 档案已永久刻录至腾讯云。"]);
        } catch (err) {
          setDistillLogs(prev => [...prev, "[⚠️] 数据库存储失败，请检查配置"]);
        }
      }
      setTimeout(() => {
        setDistillLogs(prev => [...prev, "[编译成功] 正在挂载对话引擎..."]);
        setDistillProgress(100);
        setTimeout(() => {
          setMessages([
            { id: 1, role: 'system', text: '已通过认证，处于【自主人格】接管模式。', time: new Date().toLocaleTimeString(), isAnimated: false },
            { id: 2, role: 'assistant', text: '你好呀！', time: new Date().toLocaleTimeString(), isAnimated: true }
          ]);
          setAppPhase('chat');
        }, 1500);
      }, 1000);
    } catch (error) {
      setDistillLogs(prev => [...prev, `[致命错误] 管线崩溃: ${error.message}`]);
    }
  };

  if (sdkInitError) return <ErrorPage error={sdkInitError} />;

  return (
    <>
      <ToastMessage message={sysMessage} onClose={clearMsg} />
      {appPhase === 'home' && <HomePage setAppPhase={setAppPhase} showMsg={showMsg} isAgreed={isAgreed} setIsAgreed={setIsAgreed} showAgreementModal={showAgreementModal} setShowAgreementModal={setShowAgreementModal} handleAgreeAndProceed={handleAgreeAndProceed} />}
      {appPhase === 'auth' && <AuthPage setAppPhase={setAppPhase} authProps={authProps} />}
      {appPhase === 'dashboard' && <DashboardPage userProfile={userProfile} savedPersonas={savedPersonas} uploadedFiles={uploadedFiles} setUploadedFiles={setUploadedFiles} handleStartDistillation={handleStartDistillation} handleDeleteSavedPersona={handleDeleteSavedPersona} loadPersonaAndChat={loadPersonaAndChat} handleLogout={handleLogout} />}
      {appPhase === 'distilling' && <DistillingPage distillProgress={distillProgress} distillLogs={distillLogs} />}
      {appPhase === 'chat' && <ChatPage setAppPhase={setAppPhase} messages={messages} setMessages={setMessages} activePersona={activePersona} showMsg={showMsg} />}
    </>
  );
}