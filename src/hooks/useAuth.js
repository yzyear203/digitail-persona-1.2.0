const handleSendCode = async () => {
    if (!account) { setAuthError(`请先填写账号`); return; }
    try {
      const formattedAccount = (authMethod === 'phone' && !account.startsWith('+')) ? '+86 ' + account : account;
      
      // 🚀 核心修复：明确告知 TCB 云端，这次发验证码的目的是“注册”还是“登录”
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
