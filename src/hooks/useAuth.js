import { useState, useEffect } from 'react';
import { auth, db } from '../lib/cloudbase';

const generateUniqueId = () =>
  'UID-' + Math.random().toString(36).substring(2, 8).toUpperCase();

export function useAuth(setAppPhase, showMsg) {
  const [authMethod, setAuthMethod] = useState('email');
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [nickname, setNickname] = useState('');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isAgreed, setIsAgreed] = useState(false);
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    let timer;
    if (countdown > 0) timer = setInterval(() => setCountdown(p => p - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    if (!auth || !db) return;

    const loadUserProfile = async (uid, email, isAnon) => {
      try {
        const res = await db.collection('users').where({ uid: String(uid) }).get();
        if (res.data && res.data.length > 0) {
          setUserProfile(res.data[0]);
        } else {
          const savedNickname = localStorage.getItem('temp_nickname') || (email ? email.split('@')[0] : '云端新用户');
          const newProfile = {
            uid: String(uid),
            email: email || 'anonymous@demo.com',
            nickname: isAnon ? '匿名访客' : savedNickname,
            shortId: generateUniqueId(),
            createdAt: Date.now()
          };
          await db.collection('users').add(newProfile);
          setUserProfile(newProfile);
          localStorage.removeItem('temp_nickname');
        }
      } catch (err) {
        showMsg(`⛔ 数据库连接异常！\n${err.message || err.code}`);
      }
    };

    const handleLoginState = async (loginState) => {
      if (loginState) {
        const loginType = loginState.loginType || '';
        const isAnon = loginType === 'ANONYMOUS' || loginType === 'anonymous';
        const uid = loginState.user?.uid || loginState.uid || 'anonymous_uid';
        const userEmail = loginState.user?.email || '';
        setUser({ uid, isAnonymous: isAnon, email: userEmail });
        await loadUserProfile(uid, userEmail, isAnon);
      } else {
        setUser(null);
        setUserProfile(null);
      }
    };

    auth.getLoginState().then(handleLoginState);
    const unsubscribe = auth.onLoginStateChanged(handleLoginState);
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  const handleSendCode = async () => {
    if (!account) { setAuthError(`请先填写${authMethod === 'email' ? '邮箱' : '手机号'}`); return; }
    setAuthError('');
    try {
      if (authMethod === 'email') {
        await auth.getVerification({ email: account });
      } else {
        await auth.getVerification({ phone_number: account });
      }
      setCountdown(60);
      showMsg(`✅ 验证码已发送至：${account} (请检查垃圾箱)`);
    } catch (err) {
      setAuthError("发送失败: " + (err.message || err.code));
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthenticating(true);
    try {
      if (!isLoginMode) {
        if (!nickname.trim()) throw new Error("请填写用户名");
        if (!account.trim()) throw new Error("请填写账号");
        if (password.length < 6) throw new Error("密码至少 6 位");
        if (password !== confirmPassword) throw new Error("两次密码不一致！");
        if (!verificationCode.trim()) throw new Error("请输入验证码");
        
        localStorage.setItem('temp_nickname', nickname.trim());
        
        // 🚀 核心修复：更新为 TCB V2 标准且真实的接口
        if (authMethod === 'email') {
          await auth.signUp({ email: account, password: password, code: verificationCode });
        } else {
          await auth.signUp({ phone_number: account, password: password, code: verificationCode });
        }
        
        try { await auth.signInWithEmailAndPassword(account, password); } catch (e) {}
        
        showMsg("🎉 账号创建成功！专属 UID 已分配。");
        setAppPhase('dashboard');
      } else {
        if (!account.trim() || !password.trim()) throw new Error("请输入账号和密码");
        await auth.signInWithEmailAndPassword(account, password);
        setAppPhase('dashboard');
      }
    } catch (err) {
      const rawMsg = err.message || err.code || String(err);
      const msg = rawMsg.toLowerCase();
      let errorMsg;
      if (msg.includes('用户名') || msg.includes('两次') || msg.includes('验证码')) errorMsg = err.message;
      else if (msg.includes('password') || msg.includes('密码')) errorMsg = '密码错误或不符合规范';
      else if (msg.includes('exist') || msg.includes('not found')) errorMsg = '账号未注册，请切换注册模式';
      else if (msg.includes('already')) errorMsg = '该账号已被注册，请直接登录';
      else if (msg.includes('unverified') || msg.includes('验证')) errorMsg = '账号验证失败！提示：如果您之前用此邮箱测试并卡住了，请换个新邮箱注册。';
      else if (msg.includes('verify') || msg.includes('code') || msg.includes('无效')) errorMsg = '验证码错误或已失效';
      else errorMsg = "系统提示: " + rawMsg;
      setAuthError(errorMsg);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleGuestAuth = async () => {
    setAuthError('');
    setIsAuthenticating(true);
    try {
      await auth.anonymousAuthProvider().signIn();
      setAppPhase('dashboard');
    } catch (err) {
      setAuthError(`游客登录失败: ${err.message || err.code}`);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    if (auth) await auth.signOut();
    setAppPhase('home');
    setNickname(''); setAccount(''); setPassword('');
    setConfirmPassword(''); setVerificationCode('');
    setIsLoginMode(false); setAuthError('');
  };

  return {
    authMethod, setAuthMethod,
    isLoginMode, setIsLoginMode,
    nickname, setNickname,
    account, setAccount,
    password, setPassword,
    confirmPassword, setConfirmPassword,
    verificationCode, setVerificationCode,
    countdown,
    authError, setAuthError,
    isAuthenticating,
    isAgreed, setIsAgreed,
    user, userProfile,
    handleSendCode,
    handleAuthSubmit,
    handleGuestAuth,
    handleLogout,
  };
}
