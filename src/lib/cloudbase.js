import cloudbase from '@cloudbase/js-sdk';

let tcb = null;
let auth = null;
let db = null;
let sdkInitError = null;

try {
  // 这里必须和你 Vercel 上填写的变量名完全对齐
  const envId = import.meta.env.VITE_CLOUDBASE_ENV_ID;
  const region = import.meta.env.VITE_CLOUDBASE_REGION;
  const accessKey = import.meta.env.VITE_CLOUDBASE_ACCESS_KEY;

  if (!envId) {
    throw new Error("致命异常：未检测到有效的 VITE_CLOUDBASE_ENV_ID 环境变量！");
  }

  // 初始化配置
  const config = {
    env: envId,
    region: region || 'ap-shanghai' // 既然确认了是上海，这里强制对齐
  };

  // 如果有令牌则带上令牌
  if (accessKey) {
    config.accessKey = accessKey;
  }

  tcb = cloudbase.init(config);
  auth = tcb.auth({ persistence: 'local' });
  db = tcb.database();

} catch (err) {
  console.error("底层初始化失败:", err);
  sdkInitError = err.message;
}

export { auth, db, sdkInitError, tcb as cloudbase };
