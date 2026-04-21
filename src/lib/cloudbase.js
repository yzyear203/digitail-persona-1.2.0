// src/lib/cloudbase.js
import cloudbase from '@cloudbase/js-sdk';

let tcb = null;
let auth = null;
let db = null;
let sdkInitError = null;

try {
  const envId = import.meta.env.VITE_CLOUDBASE_ENV_ID;
  const region = import.meta.env.VITE_CLOUDBASE_REGION;
  const accessKey = import.meta.env.VITE_CLOUDBASE_ACCESS_KEY;

  if (!envId) {
    throw new Error("致命异常：未检测到有效的 VITE_CLOUDBASE_ENV_ID 环境变量！");
  }

  // 🚀 核心修复：在这里设置全局 timeout，强迫前端 SDK 等待 60 秒！
  const config = {
    env: envId,
    region: region || 'ap-shanghai',
    timeout: 60000 
  };

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
