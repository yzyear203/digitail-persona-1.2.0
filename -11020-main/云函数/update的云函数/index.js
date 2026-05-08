const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();

function buildCurrentContext(currentContext) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  return {
    value: currentContext,
    expires_at: expiresAt.toISOString()
  };
}

exports.main = async (event = {}, _context = {}) => {
  const { personaId, userId, currentContext } = event;
  const profileId = userId || personaId;
  if (!profileId || !currentContext) return { success: false, msg: '参数缺失' };

  try {
    const nextContext = buildCurrentContext(currentContext);
    const collection = db.collection('user_profile');
    const res = await collection.where({ user_id: profileId }).get();

    if (res.data.length > 0) {
      await collection.doc(res.data[0]._id).update({
        't3_profile.current_context': nextContext,
        updated_at: db.serverDate()
      });
    } else {
      await collection.add({
        user_id: profileId,
        personaId: profileId,
        t3_profile: {
          current_context: nextContext
        },
        pending_conflicts: [],
        created_at: db.serverDate(),
        updated_at: db.serverDate()
      });
    }

    // 迁移期兼容：当前前端主链路仍从 personas.content 读取 T3，这里同步更新一份。
    if (personaId) {
      const personaRes = await db.collection('personas').doc(personaId).get();
      const persona = Array.isArray(personaRes.data) ? personaRes.data[0] : personaRes.data;
      if (persona?.content) {
        const t3 = JSON.parse(persona.content || '{}');
        t3.current_context = nextContext;
        await db.collection('personas').doc(personaId).update({ content: JSON.stringify(t3) });
      }
    }

    return { success: true, action: res.data.length > 0 ? 'updated' : 'created' };
  } catch (error) {
    console.error('T3 更新失败:', error);
    return { success: false, error: error.message };
  }
};
