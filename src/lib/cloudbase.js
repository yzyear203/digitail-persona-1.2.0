import cloudbase from '@cloudbase/js-sdk';

let tcb = null;
let auth = null;
let db = null;
let sdkInitError = null;

try {
  const envId = import.meta.env.VITE_TCB_ENV_ID;
  if (!envId || envId.includes("YOUR_TCB")) {
    throw new Error("致命异常：未检测到有效的 VITE_TCB_ENV_ID 环境变量！");
  }
  tcb = cloudbase.init({ env: envId });
  auth = tcb.auth({ persistence: 'local' });
  db = tcb.database();
} catch (err) {
  console.error("底层初始化失败:", err);
  sdkInitError = err.message;
}

export { auth, db, sdkInitError };