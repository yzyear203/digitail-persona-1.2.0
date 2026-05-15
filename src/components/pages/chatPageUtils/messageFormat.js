import { getMessagePlainText } from '../../../lib/stickerMessage';

export const CONTROL_MARKER_REGEX = /<del>[\s\S]*?<\/del>|<\/?recall>|\[recall[:：][\s\S]*?\]|\[quote_ref:[\s\S]*?\]|\[quote:[\s\S]*?\]/g;
const HTML_LINE_BREAK_REGEX = /<\s*br\s*\/?\s*>/gi;
const NAME_QUERY_GUARD_REGEX = /(我叫(?:什么|啥|谁)|叫什么|叫啥|名字(?:是)?什么|我的名字(?:是)?什么|你知道我叫|记得我叫|\?|？)/;
const BAD_NAME_VALUE_REGEX = /^(什么|啥|谁|哪位|名字|什么名字|啥名字|干什么|干嘛|干啥|做什么|做啥|真的喜欢你)$/;

export function normalizeControlMarkers(text) {
  return String(text || '')
    .replace(/\[recall[:：]\s*([^\]]{1,240})\]/g, '<recall>$1</recall>')
    .replace(HTML_LINE_BREAK_REGEX, '\n');
}

function normalizeDeclaredName(value) {
  return String(value || '')
    .replace(/[“”"'`]/g, '')
    .replace(/[，。,.!！?？；;：:、\s].*$/g, '')
    .trim()
    .slice(0, 16);
}

function isSafeDeclaredName(value) {
  const name = normalizeDeclaredName(value);
  return Boolean(name)
    && name.length <= 16
    && !BAD_NAME_VALUE_REGEX.test(name)
    && !/(什么|怎么|为何|为什么|谁|吗|呢|干什么|干嘛|干啥|做什么|做啥)/.test(name);
}

export function extractDeclaredUserName(text) {
  const normalizedText = String(text || '').trim();
  if (!normalizedText || NAME_QUERY_GUARD_REGEX.test(normalizedText)) return '';

  const patterns = [
    /(?:^|[，。,.!！\s])(?:我叫|叫我|我的名字是|我名字叫|本人叫)\s*([\u4e00-\u9fa5A-Za-z0-9_·•]{1,16})(?:$|[，。,.!！\s])/, 
    /(?:^|[，。,.!！\s])我是\s*([\u4e00-\u9fa5A-Za-z0-9_·•]{1,16})(?:$|[，。,.!！\s])/,
  ];

  for (const pattern of patterns) {
    const matched = normalizedText.match(pattern)?.[1]?.trim();
    if (isSafeDeclaredName(matched)) return normalizeDeclaredName(matched);
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
