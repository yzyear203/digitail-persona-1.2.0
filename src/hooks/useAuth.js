import { useState, useEffect } from 'react';
import { auth, db } from '../lib/cloudbase';

export function useAuth(setAppPhase, showMsg) {
  const [authMethod, setAuthMethod] = useState('email');
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [nickname, setNickname] = useState('');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationId, setVerificationId] = useState('');
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
    const handleLoginState = async (loginState) => {
      if (loginState) {
        const uid = loginState.user?.uid || loginState.uid;
        setUser({ uid });
        try {
          const res = await db.collection('users').where({ uid: String(uid) }).get();
          if (res.data && res.data.length > 0) setUserProfile(res.data[0]);
        } catch (error) {
          console.error("获取用户信息失败", error);
        }
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
      const actionType = isLoginMode ? 'login' : 'register'; 
      const reqParam = authMethod === 'email' 
        ? { email: formattedAccount, action: actionType } 
        : { phone_number: formattedAccount, action: actionType };

      const res = await auth.getVerification(reqParam);
      setVerificationId(res.verification_id);
      setCountdown(60);
      showMsg("✅ 验证码已发送");
    } catch (err) { 
      console.error("【发验证码失败】:", err);
      const errorDetail = err.message || err.msg || err.code || String(err);
      setAuthError("发送失败: " + errorDetail); 
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthenticating(true);
    try {
      const formattedAccount = (authMethod === 'phone' && !account.startsWith('+')) ? '+86 ' + account : account;
      
      if (!isLoginMode) {
        if (!verificationId) throw new Error("请先获取验证码");
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
        // 🚀 核心修复：TCB V2 的标准账号密码登录语法，不能用泛型 signIn
        if (authMethod === 'email') {
          await auth.signInWithEmailAndPassword(formattedAccount, password);
        } else {
          // 如果以后开放手机号登录，对应语法如下
          await auth.signInWithPhoneAndPassword(formattedAccount, password);
        }
        setAppPhase('dashboard');
      }
    } catch (err) { 
      console.error("【TCB 完整报错日志】:", err);
      const errorDetail = err.message || err.msg || err.code || (typeof err === 'string' ? err : JSON.stringify(err));
      setAuthError("操作失败: " + errorDetail);
    } finally { 
      setIsAuthenticating(false); 
    }
  };

  const handleGuestAuth = async () => {
    try {
      await auth.anonymousAuthProvider().signIn();
      setAppPhase('dashboard');
    } catch (err) { 
      setAuthError("匿名登录失败: " + err.message); 
    }
  };

  const handleLogout = async () => { 
    await auth.signOut(); 
    setAppPhase('home'); 
  };

  return {
    authMethod, setAuthMethod,
    isLoginMode, setIsLoginMode,
    nickname, setNickname,
    account, setAccount,
    password, setPassword,
    confirmPassword, setConfirmPassword,
    verificationCode, setVerificationCode,
    verificationId, setVerificationId,
    countdown, setCountdown,
    authError, setAuthError,
    isAuthenticating, setIsAuthenticating,
    isAgreed, setIsAgreed,
    user, setUser,
    userProfile, setUserProfile,
    handleSendCode, handleAuthSubmit, handleGuestAuth, handleLogout
  };
}
