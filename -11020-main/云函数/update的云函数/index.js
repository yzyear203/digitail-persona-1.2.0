const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();

exports.main = async (event, context) => {
  // 复用你现有的 personaId 体系
  const { personaId, currentContext } = event;
  if (!personaId || !currentContext) return { success: false, msg: "参数缺失" };

  try {
    const collection = db.collection('user_profile');
    const res = await collection.where({ personaId: personaId }).get();

    // 蓝图规范：状态自带 TTL 过期时间（这里默认 7 天后状态失效）
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    if (res.data.length > 0) {
      // 更新现有档案的 current_context
      await collection.doc(res.data[0]._id).update({
        't3_profile.current_context': {
          value: currentContext,
          expires_at: expiresAt
        },
        updated_at: db.serverDate()
      });
      return { success: true, action: "updated" };
    } else {
      // 冷启动：初始化 T3 档案
      await collection.add({
        personaId: personaId,
        t3_profile: {
          current_context: { value: currentContext, expires_at: expiresAt }
        },
        created_at: db.serverDate(),
        updated_at: db.serverDate()
      });
      return { success: true, action: "created" };
    }
  } catch (error) {
    console.error("T3 更新失败:", error);
    return { success: false, error: error.message };
  }
};