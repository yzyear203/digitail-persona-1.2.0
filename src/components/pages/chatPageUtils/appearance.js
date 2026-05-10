import { db } from '../../../lib/cloudbase';

export const DEFAULT_CHAT_APPEARANCE = {
  theme: 'light',
  userAvatar: '',
  backgroundImage: '',
};

export function getStoredChatAppearance(activeId, accountId = '') {
  try {
    const keys = [
      accountId ? `chat_appearance_account_${accountId}_${activeId}` : '',
      `chat_appearance_${activeId}`,
      accountId ? `chat_appearance_account_${accountId}` : '',
      'chat_appearance_global',
    ].filter(Boolean);

    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (raw) return { ...DEFAULT_CHAT_APPEARANCE, ...JSON.parse(raw) };
    }
    return DEFAULT_CHAT_APPEARANCE;
  } catch (error) {
    console.warn('读取聊天外观设置失败:', error);
    return DEFAULT_CHAT_APPEARANCE;
  }
}

export function persistChatAppearance(activeId, accountId, appearance) {
  if (accountId) {
    localStorage.setItem(`chat_appearance_account_${accountId}`, JSON.stringify(appearance));
    localStorage.setItem(`chat_appearance_account_${accountId}_${activeId}`, JSON.stringify(appearance));
  } else {
    localStorage.setItem(`chat_appearance_${activeId}`, JSON.stringify(appearance));
  }
  localStorage.setItem('chat_appearance_global', JSON.stringify(appearance));
}

export async function fetchCloudUserAvatar(accountId) {
  if (!db || !accountId) return '';

  try {
    const usersRes = await db.collection('users').where({ uid: String(accountId) }).limit(1).get();
    const usersAvatar = usersRes.data?.[0]?.avatarUrl || usersRes.data?.[0]?.user_avatar || '';
    if (usersAvatar) return usersAvatar;

    const profileRes = await db.collection('user_profile').where({ user_id: String(accountId) }).limit(1).get();
    return profileRes.data?.[0]?.avatarUrl || profileRes.data?.[0]?.user_avatar || '';
  } catch (error) {
    console.warn('读取云端我方头像失败:', error);
    return '';
  }
}
