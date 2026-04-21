import cloudbase from '@cloudbase/js-sdk';

let tcb = null;
let auth = null;
let db = null;
let sdkInitError = null;

try {
  // 读取你刚刚在 Vercel 配置的官方环境变量
  const envId = import.meta.env.VITE_CLOUDBASE_ENV_ID;
  const region = import.meta.env.VITE_CLOUDBASE_REGION || 'ap-shanghai';
  const accessKey = import.meta.env.VITE_CLOUDBASE_ACCESS_KEY;

  if (!envId) {
    throw new Error("致命异常：未检测到有效的 VITE_CLOUDBASE_ENV_ID 环境变量！");
  }

  // 使用官方推荐的完整配置进行初始化
  const initConfig = {
    env: envId,
    region: region
  };
  
  // 注入公开访问令牌，突破权限限制
  if (accessKey) {
    initConfig.accessKey = accessKey;
  }

  tcb = cloudbase.init(initConfig);
  
  // 挂载核心引擎
  auth = tcb.auth({ persistence: 'local' });
  db = tcb.database();
  
} catch (err) {
  console.error("底层初始化失败:", err);
  sdkInitError = err.message;
}

export { auth, db, sdkInitError, tcb as cloudbase };
