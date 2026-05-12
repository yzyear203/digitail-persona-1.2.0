import { getMessagePlainText } from '../../../lib/stickerMessage';

export const CONTROL_MARKER_REGEX = /<del>[\s\S]*?<\/del>|<\/?recall>|\[recall[:：][\s\S]*?\]|\[quote:[\s\S]*?\]/g;

export function normalizeControlMarkers(text) {
  return String(text || '')
    .replace(/\[recall[:：]\s*([^\]]{1,240})\]/g, '<recall>$1</recall>');
}

export function extractDeclaredUserName(text) {
  const normalizedText = String(text || '').trim();
  const patterns = [
    /(?:我叫|叫我|我的名字是|我名字叫|本人叫)([\u4e00-\u9fa5A-Za-z0-9_·•]{1,16})/,
    /我是([\u4e00-\u9fa5A-Za-z0-9_·•]{1,16})(?:$|[，。,.!！?？\s])/,
  ];

  for (const pattern of patterns) {
    const matched = normalizedText.match(pattern)?.[1]?.trim();
    if (matched) return matched;
  }

  return '';
}

export function stripControlMarkers(text) {
  return normalizeControlMarkers(text).replace(CONTROL_MARKER_REGEX, '').trim();
}

export function formatMessageForModel(message) {
  return stripControlMarkers(getMessagePlainText(message));
}

export function getLatestUserMessage(messagesSnapshot) {
  return [...(messagesSnapshot || [])].reverse().find(m => m.role === 'user' && formatMessageForModel(m));
}

export function getLastUserQuote(messagesSnapshot) {
  const lastUserMsg = getLatestUserMessage(messagesSnapshot);
  const quoteText = formatMessageForModel(lastUserMsg) || '最近这条消息';
  return quoteText.replace(/\s+/g, ' ').slice(0, 24);
}

export function buildDebugQuoteRecallParts(replyParts, messagesSnapshot, fallbackText) {
  const quoteText = getLastUserQuote(messagesSnapshot);
  const baseParts = Array.isArray(replyParts) && replyParts.length > 0
    ? replyParts.map(part => stripControlMarkers(part)).filter(Boolean)
    : ['引用测试：如果组件正常，这条气泡顶部会显示引用框。'];

  const testParts = baseParts.length >= 2 ? baseParts : [baseParts[0], fallbackText];

  return testParts.map((part, index) => {
    if (index % 2 === 0) return `[quote: ${quoteText}]${part}`;
    return `<recall>${part || fallbackText}</recall>`;
  });
}
