import { useState, useEffect } from 'react';
import { auth, db } from '../lib/cloudbase';

const generateUniqueId = () => 'UID-' + Math.random().toString(36).substring(2, 8).toUpperCase();

export function useAuth(setAppPhase, showMsg) {
  const [authMethod, setAuthMethod] = useState('email');
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [nickname, setNickname] = useState('');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationId, setVerificationId] = useState(''); // 【核心新增】
  const [countdown, setCountdown] = useState(0);
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  // ... 倒计时逻辑保持不变 ...
  useEffect(() => {
    let timer;
    if (countdown > 0) timer = setInterval(() => setCountdown(p => p - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    if (!auth || !db) return;
    const handleLoginState = async (loginState) => {
      if (loginState) {
        const uid = loginState.user?.uid || loginState.uid;
        setUser({ uid });
        // 获取用户信息逻辑...
        const res = await db.collection('users').where({ uid: String(uid) }).get();
        if (res.data && res.data.length > 0) setUserProfile(res.data[0]);
      } else {
        setUser(null);
        setUserProfile(null);
      }
    };
    auth.getLoginState().then(handleLoginState);
    return auth.onLoginStateChanged(handleLoginState);
  }, []);

  const handleSendCode = async () => {
    if (!account) { setAuthError(`请先填写账号`); return; }
    try {
      const formattedAccount = (authMethod === 'phone' && !account.startsWith('+')) ? '+86 ' + account : account;
      const res = await auth.getVerification(authMethod === 'email' ? { email: formattedAccount } : { phone_number: formattedAccount });
      setVerificationId(res.verification_id); // 【核心修复】保存 ID
      setCountdown(60);
      showMsg("✅ 验证码已发送");
    } catch (err) { setAuthError("发送失败: " + err.message); }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthenticating(true);
    try {
      const formattedAccount = (authMethod === 'phone' && !account.startsWith('+')) ? '+86 ' + account : account;
      if (!isLoginMode) {
        // 注册模式：严格遵循 V2 流程
        const verifyRes = await auth.verify({
          verification_id: verificationId,
          verification_code: verificationCode
        });
        await auth.signUp({
          [authMethod === 'email' ? 'email' : 'phone_number']: formattedAccount,
          password,
          verification_token: verifyRes.verification_token,
          name: nickname
        });
        showMsg("🎉 注册成功！");
        setAppPhase('dashboard');
      } else {
        // 登录模式
        await auth.signIn({
          [authMethod === 'email' ? 'email' : 'phone_number']: formattedAccount,
          password
        });
        setAppPhase('dashboard');
      }
    } catch (err) { setAuthError("操作失败: " + err.message);
    } finally { setIsAuthenticating(false); }
  };

  const handleGuestAuth = async () => {
    try {
      await auth.anonymousAuthProvider().signIn();
      setAppPhase('dashboard');
    } catch (err) { setAuthError("登录失败: " + err.message); }
  };

  const handleLogout = async () => { await auth.signOut(); setAppPhase('home'); };

  return { ... }; // 保持原有返回结构
}
