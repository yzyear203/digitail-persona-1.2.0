import { db } from './cloudbase';

export async function upsertPersonaProfile({ personaId, t3Profile }) {
  if (!db || !personaId) return;

  const payload = {
    user_id: personaId,
    personaId,
    updated_at: new Date(),
  };

  if (t3Profile) payload.t3_profile = t3Profile;

  const res = await db.collection('user_profile').where({ user_id: personaId }).limit(1).get();
  if (res.data?.length) {
    await db.collection('user_profile').doc(res.data[0]._id).update(payload);
    return;
  }

  await db.collection('user_profile').add({
    ...payload,
    created_at: new Date(),
  });
}
