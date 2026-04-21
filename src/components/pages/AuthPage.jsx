import React from 'react';
import { ChevronLeft, Mail, Smartphone, User, Lock, ShieldCheck, Hash, AlertTriangle, Loader2, UserCircle } from 'lucide-react';

export default function AuthPage({ setAppPhase, authProps }) {
  const {
    authMethod, setAuthMethod, isLoginMode, setIsLoginMode,
    nickname, setNickname, account, setAccount,
    password, setPassword, confirmPassword, setConfirmPassword,
    verificationCode, setVerificationCode, countdown,
    authError, setAuthError, isAuthenticating,
    handleSendCode, handleAuthSubmit, handleGuestAuth,
  } = authProps;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans py-12 relative">
      <button onClick={() => setAppPhase('home')} className="absolute top-6 left-6 flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 transition-colors">
        <ChevronLeft className="w-5 h-5" /> 返回首页
      </button>
      <div className="bg-white w-full max-w-[460px] rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col mt-8">
        <div className="flex bg-slate-100 p-1.5 m-5 rounded-2xl shadow-inner">
          <button onClick={() => { setAuthMethod('email'); setAuthError(''); }} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${authMethod === 'email' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500'}`}>
            <Mail className="inline w-4 h-4 mr-1 mb-0.5"/> 邮箱通行证
          </button>
          <button onClick={() => { setAuthMethod('phone'); setAuthError(''); }} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${authMethod === 'phone' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500'}`}>
            <Smartphone className="inline w-4 h-4 mr-1 mb-0.5"/> 手机号注册
          </button>
        </div>
        <div className="px-10 pb-10 pt-2">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-slate-900 mb-3">{isLoginMode ? '欢迎回来' : '建立专属档案'}</h1>
            <p className="text-slate-500 text-sm font-medium">{isLoginMode ? '登录编译器，唤醒数字分身' : '请按步骤完成信息填写'}</p>
          </div>
          {authError && (
            <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 flex items-start">
              <AlertTriangle className="w-5 h-5 mr-3 shrink-0" /><span>{authError}</span>
            </div>
          )}
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {!isLoginMode && (
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 font-mono">1. 设置用户名</label>
                <div className="relative">
                  <User className="absolute left-4 top-3.5 text-slate-400" size={20}/>
                  <input type="text" value={nickname} onChange={e => { setNickname(e.target.value); setAuthError(''); }} required minLength="2" maxLength="12" className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold" placeholder="给自己取个昵称" />
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5 font-mono">{isLoginMode ? '登录账号' : `2. 绑定${authMethod === 'email' ? '邮箱' : '手机'}`}</label>
              <div className="relative">
                {authMethod === 'email' ? <Mail className="absolute left-4 top-3.5 text-slate-400" size={20}/> : <Smartphone className="absolute left-4 top-3.5 text-slate-400" size={20}/>}
                <input type={authMethod === 'email' ? "email" : "text"} value={account} onChange={e => { setAccount(e.target.value); setAuthError(''); }} required className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold" placeholder={authMethod === 'email' ? "输入常用邮箱" : "输入手机号"} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5 font-mono">{isLoginMode ? '安全密码' : '3. 设置安全密码'}</label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 text-slate-400" size={20}/>
                <input type="password" value={password} onChange={e => { setPassword(e.target.value); setAuthError(''); }} required minLength="6" className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3.5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold" placeholder="至少输入 6 位" />
              </div>
            </div>
            {!isLoginMode && (
              <>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5 font-mono">4. 再次确认密码</label>
                  <div className="relative">
                    <ShieldCheck className={`absolute left-4 top-3.5 ${confirmPassword && confirmPassword === password ? 'text-emerald-500' : 'text-slate-400'}`} size={20}/>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className={`w-full bg-slate-50 border ${confirmPassword && confirmPassword !== password ? 'border-red-400' : 'border-slate-200'} rounded-xl pl-12 pr-4 py-3.5 focus:ring-2 outline-none font-bold`} placeholder="确保密码输入一致" />
                  </div>
                </div>
                <div className="pb-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1.5 font-mono">5. 身份验证码</label>
                  <div className="relative flex items-center">
                    <Hash className="absolute left-4 top-3.5 text-slate-400" size={20}/>
                    <input type="text" value={verificationCode} onChange={e => setVerificationCode(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-32 py-3.5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold tracking-widest" placeholder={`输入 6 位验证码`} />
                    <button type="button" onClick={handleSendCode} disabled={countdown > 0} className={`absolute right-2 py-2 px-3 text-xs font-bold rounded-lg ${countdown > 0 ? 'text-slate-400 cursor-not-allowed bg-slate-100' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100'}`}>
                      {countdown > 0 ? `${countdown}s 后重发` : '获取验证码'}
                    </button>
                  </div>
                </div>
              </>
            )}
            <button type="submit" disabled={isAuthenticating || (!isLoginMode && password !== confirmPassword)} className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-lg flex justify-center items-center shadow-lg transition-all transform hover:-translate-y-0.5">
              {isAuthenticating ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>{isLoginMode ? '安全登入' : '提交注册并分配 UID'}</span>}
            </button>
          </form>
          <div className="text-center mt-6">
            <button onClick={() => setIsLoginMode(!isLoginMode)} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 underline decoration-2 underline-offset-4">
              {isLoginMode ? '新用户？点此完成注册' : '已有账号？点此直接登录'}
            </button>
          </div>
          <div className="relative flex items-center py-7">
            <div className="flex-grow border-t border-slate-100"></div>
            <span className="mx-4 text-slate-300 text-[10px] font-bold uppercase tracking-widest">快速体验通道</span>
            <div className="flex-grow border-t border-slate-100"></div>
          </div>
          <button onClick={handleGuestAuth} className="w-full bg-white border-2 border-slate-200 hover:border-indigo-400 text-slate-600 py-3.5 rounded-xl font-bold flex justify-center items-center gap-2 transition-all">
            <UserCircle size={20} /> 免注册匿名体验 (数据即焚)
          </button>
        </div>
      </div>
    </div>
  );
}