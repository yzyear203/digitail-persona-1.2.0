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
  const [verificationId, setVerificationId] = useState(''); // 【核心修复】保存官方下发的验证码唯一ID
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
          const newProfile = { uid: String(uid), email: email || 'anonymous@demo.com', nickname: isAnon ? '匿名访客' : savedNickname, shortId: generateUniqueId(), createdAt: Date.now() };
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

  // 格式化账号：手机号必须加区号
  const formatAccount = (acc, method) => {
    if (method === 'phone' && !acc.startsWith('+')) return '+86 ' + acc;
    return acc;
  };

  const handleSendCode = async () => {
    if (!account) { setAuthError(`请先填写${authMethod === 'email' ? '邮箱' : '手机号'}`); return; }
    setAuthError('');
    try {
      const formattedAccount = formatAccount(account, authMethod);
      const reqParam = authMethod === 'email' ? { email: formattedAccount } : { phone_number: formattedAccount };
      
      const res = await auth.getVerification(reqParam);
      setVerificationId(res.verification_id); // 【核心修复】缓存 verification_id
      
      setCountdown(60);
      showMsg(`✅ 验证码已发送至：${formattedAccount} (请检查垃圾箱)`);
    } catch (err) {
      setAuthError("发送失败: " + (err.message || err.code));
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthenticating(true);
    try {
      const formattedAccount = formatAccount(account, authMethod);

      if (!isLoginMode) {
        if (!nickname.trim()) throw new Error("请填写用户名");
        if (password.length < 6) throw new Error("密码至少 6 位");
        if (password !== confirmPassword) throw new Error("两次密码不一致！");
        if (!verificationCode.trim() || !verificationId) throw new Error("请先获取并输入验证码");
        
        localStorage.setItem('temp_nickname', nickname.trim());
        
        // 【核心修复】严格遵守 V2 文档：先验证验证码，再带着 token 注册
        const verifyRes = await auth.verify({
          verification_id: verificationId,
          verification_code: verificationCode
        });

        await auth.signUp({
          [authMethod === 'email' ? 'email' : 'phone_number']: formattedAccount,
          password: password,
          verification_token: verifyRes.verification_token,
          name: nickname
        });
        
        showMsg("🎉 账号创建成功！自动登入中...");
        setAppPhase('dashboard');
      } else {
        // 登录模式
        if (!account.trim() || !password.trim()) throw new Error("请输入账号和密码");
        await auth.signIn({
          [authMethod === 'email' ? 'email' : 'phone_number']: formattedAccount,
          password: password
        });
        setAppPhase('dashboard');
      }
    } catch (err) {
      const rawMsg = err.message || err.code || String(err);
      const msg = rawMsg.toLowerCase();
      let errorMsg;
      if (msg.includes('用户名') || msg.includes('两次') || msg.includes('请先获取')) errorMsg = err.message;
      else if (msg.includes('password') || msg.includes('密码')) errorMsg = '密码错误或不符合规范';
      else if (msg.includes('exist') || msg.includes('not found')) errorMsg = '账号未注册，请先注册';
      else if (msg.includes('already')) errorMsg = '该账号已被注册，请直接登录';
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
    authMethod, setAuthMethod, isLoginMode, setIsLoginMode,
    nickname, setNickname, account, setAccount,
    password, setPassword, confirmPassword, setConfirmPassword,
    verificationCode, setVerificationCode, countdown,
    authError, setAuthError, isAuthenticating,
    isAgreed, setIsAgreed, user, userProfile,
    handleSendCode, handleAuthSubmit, handleGuestAuth, handleLogout,
  };
}
