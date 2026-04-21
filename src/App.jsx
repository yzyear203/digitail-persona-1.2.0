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

      let prompt = `请根据以下素材，深入提炼该人物的性格特征、语言风格、说话逻辑，最后给我一个严格的人格设定 prompt。必须要求后续你的回复中包含带有 <del>想删掉的话</del> 标签的内容以模拟人类打字犹豫感。`;
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
