// src/lib/cloudbase.js
import cloudbase from '@cloudbase/js-sdk';

let tcb = null;
let auth = null;
let db = null;
let sdkInitError = null;

function withPublicShareRouting(rawDb, app) {
  if (!rawDb || !app) return rawDb;

  return {
    ...rawDb,
    collection(name) {
      const collectionRef = rawDb.collection(name);
      if (name !== 'personas') return collectionRef;

      return {
        ...collectionRef,
        doc(id) {
          const docRef = collectionRef.doc(id);
          const docId = String(id || '');
          if (!docId.startsWith('public_')) return docRef;

          return {
            ...docRef,
            async get() {
              const res = await app.callFunction({
                name: 'get_public_persona',
                data: { shareId: docId },
                timeout: 15000,
              });

              if (!res.result?.success || !res.result?.persona) {
                throw new Error(res.result?.error || '公开人格不存在或已关闭分享');
              }

              return { data: [res.result.persona] };
            },
          };
        },
      };
    },
  };
}

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
  db = withPublicShareRouting(tcb.database(), tcb);

} catch (err) {
  console.error("底层初始化失败:", err);
  sdkInitError = err.message;
}

export { auth, db, sdkInitError, tcb as cloudbase };
