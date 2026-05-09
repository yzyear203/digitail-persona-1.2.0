const CACHE_KEY = 'digitail_original_sticker_market_v1';

const EMOTION_ALIASES = {
  '无语': ['无语', '语塞', '沉默', '不是很懂', '翻白眼', '离谱', '啊这'],
  '震惊': ['震惊', '惊讶', '真的假的', '啊', '问号', '不敢信'],
  '笑死': ['笑死', '哈哈', '好笑', '绷不住', '乐', '爆笑'],
  '开心': ['开心', '好评', '耶', '可以', '不错', '爽'],
  '安慰': ['安慰', '抱抱', '拍拍', '没事', '委屈', '别难过'],
  '生气': ['生气', '烦', '别搞', '过分', '哼', '怒'],
  '害羞': ['害羞', '脸红', '别说了', '喜欢', '不好意思'],
  '崩溃': ['崩溃', '累', '裂开', '救命', '破防', '顶不住'],
  '疑惑': ['疑惑', '问号', '不懂', '什么', '你说啥', '啊'],
  '嘲讽': ['嘲讽', '阴阳', '就这', '少来', '呵呵', '嘴硬'],
  '摸鱼': ['摸鱼', '划水', '躺', '休息', '摆烂', '暂停营业'],
  '可爱': ['可爱', '萌', '乖', '收到', '宝宝', '嘿嘿'],
  '生活': ['吃饭', '睡觉', '早安', '晚安', '出门', '洗澡', '忙'],
  '职场': ['加班', '开会', '改完了', '收到', '已阅', 'deadline', '咖啡'],
  '社交': ['比心', '点赞', '握手', '拒绝', 'OK', '吃瓜', '溜了'],
};

const ORIGINAL_PACKS = [
  {
    id: 'daily_bean',
    name: '小豆日常',
    subtitle: '吃饭睡觉回消息，一套管够',
    theme: '生活化',
    accent: '#10b981',
    character: 'bean',
    installed: true,
    stickers: [
      { key: 'morning', name: '早安开机', emotion: '生活', text: '早安', sub: '今天也要慢慢来', face: 'smile', color: ['#ecfdf5', '#34d399'], tags: ['早安', '生活', '开心'] },
      { key: 'night', name: '晚安下线', emotion: '生活', text: '晚安', sub: '电量已低', face: 'sleep', color: ['#e0e7ff', '#6366f1'], tags: ['晚安', '睡觉', '生活'] },
      { key: 'eat', name: '饭点到了', emotion: '生活', text: '干饭', sub: '先吃为敬', face: 'happy', color: ['#fffbeb', '#f59e0b'], tags: ['吃饭', '干饭', '生活'] },
      { key: 'bath', name: '去洗澡了', emotion: '生活', text: '洗澡', sub: '暂时失联', face: 'calm', color: ['#ecfeff', '#06b6d4'], tags: ['洗澡', '等会', '生活'] },
      { key: 'busy', name: '现在有点忙', emotion: '生活', text: '忙着呢', sub: '稍等我一下', face: 'sweat', color: ['#f8fafc', '#94a3b8'], tags: ['忙', '稍等', '生活'] },
      { key: 'wait', name: '我在等你', emotion: '委屈', text: '等你', sub: '但我不说', face: 'sad', color: ['#fdf2f8', '#fb7185'], tags: ['等你', '委屈', '想你'] },
      { key: 'run', name: '我先溜了', emotion: '社交', text: '溜了', sub: '下次再聊', face: 'run', color: ['#f0f9ff', '#38bdf8'], tags: ['溜了', '出门', '社交'] },
      { key: 'received', name: '收到收到', emotion: '可爱', text: '收到', sub: '马上安排', face: 'ok', color: ['#f0fdf4', '#22c55e'], tags: ['收到', 'OK', '可爱'] },
    ],
  },
  {
    id: 'work_pause',
    name: '打工暂停',
    subtitle: '上班人的精神急救包',
    theme: '职场',
    accent: '#8b5cf6',
    character: 'square',
    installed: true,
    stickers: [
      { key: 'meeting', name: '又开会', emotion: '职场', text: '开会中', sub: '灵魂离席', face: 'blank', color: ['#f5f3ff', '#8b5cf6'], tags: ['开会', '职场', '无语'] },
      { key: 'coffee', name: '咖啡续命', emotion: '职场', text: '续命', sub: '今日燃料', face: 'sleep', color: ['#fef3c7', '#92400e'], tags: ['咖啡', '加班', '职场'] },
      { key: 'deadline', name: '死线压顶', emotion: '崩溃', text: '顶不住', sub: 'ddl 在追我', face: 'panic', color: ['#fee2e2', '#ef4444'], tags: ['deadline', '崩溃', '加班'] },
      { key: 'done', name: '终于改完', emotion: '开心', text: '改完了', sub: '别再改了', face: 'relief', color: ['#dcfce7', '#16a34a'], tags: ['改完了', '职场', '开心'] },
      { key: 'read', name: '已阅不回', emotion: '嘲讽', text: '已阅', sub: '但先不回', face: 'side', color: ['#f4f4f5', '#71717a'], tags: ['已阅', '职场', '冷漠'] },
      { key: 'fish', name: '战略摸鱼', emotion: '摸鱼', text: '摸鱼', sub: '合理休息', face: 'cool', color: ['#e0f2fe', '#0284c7'], tags: ['摸鱼', '划水', '职场'] },
      { key: 'overtime', name: '加班结界', emotion: '崩溃', text: '加班', sub: '人还在工位', face: 'cry', color: ['#ede9fe', '#7c3aed'], tags: ['加班', '崩溃', '职场'] },
      { key: 'boss', name: '老板来了', emotion: '震惊', text: '装忙', sub: '手速拉满', face: 'shock', color: ['#fff7ed', '#ea580c'], tags: ['老板', '震惊', '职场'] },
    ],
  },
  {
    id: 'emotion_rescue',
    name: '情绪急救包',
    subtitle: '聊天高频反应全覆盖',
    theme: '情绪',
    accent: '#f97316',
    character: 'round',
    installed: true,
    stickers: [
      { key: 'laugh', name: '绷不住了', emotion: '笑死', text: '笑死', sub: '真的绷不住', face: 'laugh', color: ['#fffbeb', '#f97316'], tags: ['笑死', '哈哈', '绷不住'] },
      { key: 'speechless', name: '无语凝噎', emotion: '无语', text: '啊这', sub: '让我缓缓', face: 'blank', color: ['#f8fafc', '#64748b'], tags: ['无语', '啊这', '离谱'] },
      { key: 'shocked', name: '这也行', emotion: '震惊', text: '啊？', sub: '真的假的', face: 'shock', color: ['#eef2ff', '#4f46e5'], tags: ['震惊', '疑惑', '问号'] },
      { key: 'sad', name: '委屈巴巴', emotion: '委屈', text: '委屈', sub: '但还要忍住', face: 'sad', color: ['#fdf2f8', '#db2777'], tags: ['委屈', '难过', '安慰'] },
      { key: 'angry', name: '有点火大', emotion: '生气', text: '生气', sub: '先别惹我', face: 'angry', color: ['#fee2e2', '#dc2626'], tags: ['生气', '别搞', '烦'] },
      { key: 'shy', name: '别说了啦', emotion: '害羞', text: '别说了', sub: '有点顶不住', face: 'shy', color: ['#ffe4e6', '#fb7185'], tags: ['害羞', '脸红', '喜欢'] },
      { key: 'hug', name: '给你抱抱', emotion: '安慰', text: '抱抱', sub: '没事的', face: 'hug', color: ['#ecfeff', '#0891b2'], tags: ['抱抱', '安慰', '没事'] },
      { key: 'broken', name: '我破防了', emotion: '崩溃', text: '破防', sub: '碎得很安详', face: 'melt', color: ['#f5f3ff', '#9333ea'], tags: ['破防', '崩溃', '裂开'] },
    ],
  },
  {
    id: 'social_moves',
    name: '社交小动作',
    subtitle: '比心、拒绝、点赞、吃瓜',
    theme: '社交',
    accent: '#06b6d4',
    character: 'bean',
    installed: true,
    stickers: [
      { key: 'heart', name: '给你比心', emotion: '社交', text: '比心', sub: '收到爱意', face: 'heart', color: ['#fdf2f8', '#f43f5e'], tags: ['比心', '喜欢', '社交'] },
      { key: 'like', name: '疯狂点赞', emotion: '社交', text: '点赞', sub: '这波可以', face: 'ok', color: ['#eff6ff', '#2563eb'], tags: ['点赞', '可以', '好评'] },
      { key: 'no', name: '婉拒了哈', emotion: '社交', text: '拒绝', sub: '但很礼貌', face: 'no', color: ['#fef2f2', '#ef4444'], tags: ['拒绝', '不要', '社交'] },
      { key: 'ok', name: 'OK 没问题', emotion: '社交', text: 'OK', sub: '包在我身上', face: 'ok', color: ['#f0fdf4', '#16a34a'], tags: ['OK', '收到', '社交'] },
      { key: 'please', name: '求求你啦', emotion: '可爱', text: '求求', sub: '拜托拜托', face: 'plead', color: ['#fff7ed', '#f97316'], tags: ['求求', '拜托', '可爱'] },
      { key: 'melon', name: '坐等吃瓜', emotion: '社交', text: '吃瓜', sub: '展开讲讲', face: 'side', color: ['#ecfccb', '#65a30d'], tags: ['吃瓜', '展开', '社交'] },
      { key: 'handshake', name: '达成共识', emotion: '社交', text: '握手', sub: '合作愉快', face: 'happy', color: ['#fefce8', '#ca8a04'], tags: ['握手', '合作', '社交'] },
      { key: 'secret', name: '我先闭嘴', emotion: '社交', text: '闭嘴', sub: '懂了懂了', face: 'zip', color: ['#f1f5f9', '#475569'], tags: ['闭嘴', '懂了', '社交'] },
    ],
  },
];

function normalizeSearchText(value) {
  return String(value || '').toLowerCase().replace(/[\s_\-—–]+/g, '');
}

function safeId(value) {
  return String(value || '')
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]+/g, '_')
    .slice(0, 80);
}

function faceSvg(face) {
  const common = 'stroke="#172033" stroke-width="7" stroke-linecap="round" fill="none"';
  const fillEye = 'fill="#172033"';
  const white = 'fill="#fff" opacity="0.9"';

  const faces = {
    smile: `<circle cx="92" cy="92" r="8" ${fillEye}/><circle cx="148" cy="92" r="8" ${fillEye}/><path d="M90 133 Q120 154 150 133" ${common}/>` ,
    happy: `<path d="M82 92 Q94 80 106 92" ${common}/><path d="M134 92 Q146 80 158 92" ${common}/><path d="M86 126 Q120 164 154 126" ${common}/>` ,
    laugh: `<path d="M80 90 Q96 78 112 92" ${common}/><path d="M128 92 Q144 78 160 90" ${common}/><path d="M82 128 Q120 171 158 128" ${common}/><circle cx="160" cy="138" r="9" fill="#38bdf8"/>` ,
    sad: `<circle cx="92" cy="96" r="8" ${fillEye}/><circle cx="148" cy="96" r="8" ${fillEye}/><path d="M92 145 Q120 126 148 145" ${common}/><path d="M158 106 C174 126 168 143 152 150" fill="#38bdf8"/>` ,
    sleep: `<path d="M82 96 Q96 102 110 96" ${common}/><path d="M132 96 Q146 102 160 96" ${common}/><path d="M96 138 Q120 148 144 138" ${common}/><text x="158" y="70" font-size="32" font-weight="900" fill="#172033">Z</text>` ,
    calm: `<path d="M82 95 Q96 101 110 95" ${common}/><path d="M132 95 Q146 101 160 95" ${common}/><path d="M96 134 Q120 144 144 134" ${common}/>` ,
    sweat: `<circle cx="92" cy="96" r="8" ${fillEye}/><circle cx="148" cy="96" r="8" ${fillEye}/><path d="M100 138 H140" ${common}/><path d="M164 76 C180 98 176 116 158 122" fill="#38bdf8"/>` ,
    run: `<circle cx="92" cy="94" r="8" ${fillEye}/><circle cx="148" cy="94" r="8" ${fillEye}/><path d="M99 132 Q120 143 141 132" ${common}/><path d="M48 146 H18 M57 162 H30" stroke="#fff" stroke-width="8" stroke-linecap="round" opacity=".7"/>` ,
    ok: `<circle cx="92" cy="94" r="8" ${fillEye}/><path d="M137 89 Q149 78 162 90" ${common}/><path d="M91 132 Q120 156 151 132" ${common}/><text x="155" y="162" font-size="34" font-weight="900" fill="#16a34a">✓</text>` ,
    blank: `<circle cx="92" cy="96" r="7" ${fillEye}/><circle cx="148" cy="96" r="7" ${fillEye}/><path d="M98 140 H142" ${common}/>` ,
    panic: `<ellipse cx="92" cy="96" rx="10" ry="14" ${white}/><ellipse cx="148" cy="96" rx="10" ry="14" ${white}/><circle cx="92" cy="100" r="5" ${fillEye}/><circle cx="148" cy="100" r="5" ${fillEye}/><ellipse cx="120" cy="143" rx="18" ry="14" fill="#172033"/>` ,
    relief: `<path d="M80 92 Q96 84 112 92" ${common}/><path d="M128 92 Q144 84 160 92" ${common}/><path d="M94 132 Q120 148 146 132" ${common}/>` ,
    side: `<circle cx="92" cy="96" r="8" ${fillEye}/><circle cx="148" cy="96" r="8" ${fillEye}/><path d="M103 139 Q124 132 145 139" ${common}/>` ,
    cool: `<path d="M74 88 H110 L102 112 H82 Z" fill="#172033"/><path d="M130 88 H166 L158 112 H138 Z" fill="#172033"/><path d="M110 98 H130" ${common}/><path d="M96 140 Q120 154 144 140" ${common}/>` ,
    cry: `<path d="M82 94 Q96 86 110 94" ${common}/><path d="M132 94 Q146 86 160 94" ${common}/><path d="M94 145 Q120 125 146 145" ${common}/><path d="M82 111 V158" stroke="#38bdf8" stroke-width="10" stroke-linecap="round"/><path d="M158 111 V158" stroke="#38bdf8" stroke-width="10" stroke-linecap="round"/>` ,
    shock: `<ellipse cx="92" cy="96" rx="9" ry="13" ${white}/><ellipse cx="148" cy="96" rx="9" ry="13" ${white}/><circle cx="92" cy="99" r="5" ${fillEye}/><circle cx="148" cy="99" r="5" ${fillEye}/><circle cx="120" cy="144" r="16" fill="#172033"/>` ,
    angry: `<path d="M78 84 L110 96" ${common}/><path d="M162 84 L130 96" ${common}/><circle cx="92" cy="101" r="7" ${fillEye}/><circle cx="148" cy="101" r="7" ${fillEye}/><path d="M92 146 Q120 128 148 146" ${common}/>` ,
    shy: `<circle cx="92" cy="94" r="8" ${fillEye}/><circle cx="148" cy="94" r="8" ${fillEye}/><path d="M98 132 Q120 146 142 132" ${common}/><ellipse cx="72" cy="120" rx="18" ry="10" fill="#fb7185" opacity=".55"/><ellipse cx="168" cy="120" rx="18" ry="10" fill="#fb7185" opacity=".55"/>` ,
    hug: `<circle cx="92" cy="94" r="8" ${fillEye}/><circle cx="148" cy="94" r="8" ${fillEye}/><path d="M92 130 Q120 152 148 130" ${common}/><path d="M56 148 Q88 178 120 150 Q152 178 184 148" ${common}/>` ,
    melt: `<circle cx="92" cy="92" r="7" ${fillEye}/><circle cx="148" cy="92" r="7" ${fillEye}/><path d="M96 134 Q120 148 144 134" ${common}/><path d="M72 168 C92 190 150 190 168 168" fill="#c4b5fd" opacity=".75"/>` ,
    heart: `<circle cx="92" cy="94" r="7" ${fillEye}/><circle cx="148" cy="94" r="7" ${fillEye}/><path d="M94 130 Q120 150 146 130" ${common}/><path d="M170 66 C170 46 202 46 202 68 C202 92 170 104 170 104 C170 104 138 92 138 68 C138 46 170 46 170 66Z" fill="#f43f5e"/>` ,
    no: `<circle cx="92" cy="96" r="8" ${fillEye}/><circle cx="148" cy="96" r="8" ${fillEye}/><path d="M98 143 H142" ${common}/><path d="M64 64 L176 176" stroke="#ef4444" stroke-width="12" stroke-linecap="round" opacity=".78"/>` ,
    plead: `<ellipse cx="92" cy="96" rx="12" ry="16" ${white}/><ellipse cx="148" cy="96" rx="12" ry="16" ${white}/><circle cx="92" cy="101" r="6" ${fillEye}/><circle cx="148" cy="101" r="6" ${fillEye}/><path d="M98 140 Q120 132 142 140" ${common}/>` ,
    zip: `<circle cx="92" cy="94" r="8" ${fillEye}/><circle cx="148" cy="94" r="8" ${fillEye}/><rect x="92" y="128" width="56" height="16" rx="4" fill="#172033"/><path d="M98 136 H142" stroke="#fff" stroke-width="4" stroke-dasharray="6 5"/>` ,
  };

  return faces[face] || faces.smile;
}

function characterBody(character, accent = '#10b981') {
  if (character === 'square') {
    return `<rect x="58" y="48" width="124" height="128" rx="38" fill="#fff" opacity=".96"/><circle cx="84" cy="50" r="18" fill="#fff" opacity=".9"/><circle cx="156" cy="50" r="18" fill="#fff" opacity=".9"/>`;
  }
  if (character === 'round') {
    return `<circle cx="120" cy="108" r="68" fill="#fff" opacity=".96"/><path d="M80 52 Q120 22 160 52" stroke="#fff" stroke-width="18" stroke-linecap="round" opacity=".88"/>`;
  }
  return `<path d="M62 118 C62 62 94 38 120 42 C146 38 178 62 178 118 C178 160 154 184 120 184 C86 184 62 160 62 118Z" fill="#fff" opacity=".96"/><circle cx="88" cy="50" r="15" fill="#fff" opacity=".9"/><circle cx="152" cy="50" r="15" fill="#fff" opacity=".9"/><circle cx="120" cy="36" r="7" fill="${accent}" opacity=".85"/>`;
}

function createAnimatedSvgDataUrl({ text, sub, face, color, character, accent }) {
  const [from, to] = color;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#0f172a" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect width="240" height="240" rx="52" fill="url(#bg)"/>
  <circle cx="200" cy="42" r="34" fill="rgba(255,255,255,.18)">
    <animate attributeName="r" values="28;38;28" dur="2.8s" repeatCount="indefinite"/>
  </circle>
  <circle cx="38" cy="190" r="24" fill="rgba(255,255,255,.14)">
    <animate attributeName="cy" values="190;178;190" dur="3s" repeatCount="indefinite"/>
  </circle>
  <g filter="url(#shadow)">
    <g>
      <animateTransform attributeName="transform" type="translate" values="0 0;0 -5;0 0" dur="1.7s" repeatCount="indefinite"/>
      ${characterBody(character, accent)}
      ${faceSvg(face)}
    </g>
  </g>
  <g>
    <rect x="32" y="164" width="176" height="42" rx="18" fill="rgba(15,23,42,.72)"/>
    <text x="120" y="192" text-anchor="middle" font-size="25" font-family="Arial, 'Microsoft YaHei', sans-serif" font-weight="900" fill="#fff">${text}</text>
  </g>
  <text x="120" y="224" text-anchor="middle" font-size="13" font-family="Arial, 'Microsoft YaHei', sans-serif" font-weight="800" fill="rgba(15,23,42,.7)">${sub}</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function normalizeSticker(pack, sticker, index) {
  const tags = Array.from(new Set([sticker.emotion, pack.theme, ...(sticker.tags || [])].filter(Boolean)));
  return {
    id: `official_${pack.id}_${safeId(sticker.key)}_${index}`,
    packId: pack.id,
    source: 'DigitailOriginal',
    license: 'official_owned_original_svg',
    name: sticker.name,
    category: pack.name,
    emotion: sticker.emotion,
    tags,
    triggerWords: tags,
    meaning: `${sticker.emotion} / ${tags.slice(1, 4).join(' / ')}`,
    url: createAnimatedSvgDataUrl({ ...sticker, character: pack.character, accent: pack.accent }),
    rawUrl: '',
    isCurated: true,
    isAnimated: true,
    text: sticker.text,
    sub: sticker.sub,
  };
}

function normalizePack(pack) {
  const stickers = pack.stickers.map((sticker, index) => normalizeSticker(pack, sticker, index));
  return {
    ...pack,
    stickers,
    cover: stickers[0]?.url || '',
    preview: stickers.slice(0, 4),
    count: stickers.length,
  };
}

const MARKET_PACKS = ORIGINAL_PACKS.map(normalizePack);
const ALL_STICKERS = MARKET_PACKS.flatMap(pack => pack.stickers);

function readInstalledPackIds() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed?.installedPackIds)) return parsed.installedPackIds;
  } catch {
    // ignore
  }
  return MARKET_PACKS.filter(pack => pack.installed).map(pack => pack.id);
}

function writeInstalledPackIds(packIds) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ installedPackIds: packIds }));
  } catch (error) {
    console.warn('表情包安装状态保存失败:', error);
  }
}

function scoreSticker(sticker, keyword) {
  const query = normalizeSearchText(keyword);
  if (!query) return sticker.isCurated ? 10 : 0;

  const aliases = EMOTION_ALIASES[keyword] || [keyword];
  const aliasList = Array.from(new Set([keyword, ...aliases].map(normalizeSearchText).filter(Boolean)));
  const text = normalizeSearchText(`${sticker.name} ${sticker.category} ${sticker.emotion} ${sticker.tags?.join(' ') || ''} ${sticker.meaning || ''} ${sticker.text || ''} ${sticker.sub || ''}`);

  let score = 0;
  for (const alias of aliasList) {
    if (!alias) continue;
    if (normalizeSearchText(sticker.emotion) === alias) score += 120;
    if (normalizeSearchText(sticker.name).includes(alias)) score += 90;
    if (normalizeSearchText(sticker.text).includes(alias)) score += 80;
    if (text.includes(alias)) score += 36;
    if (sticker.tags?.some(tag => normalizeSearchText(tag).includes(alias))) score += 30;
  }

  return score;
}

function pickRandom(items) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

export function getMarketStickerPacks() {
  const installedIds = new Set(readInstalledPackIds());
  return MARKET_PACKS.map(pack => ({ ...pack, installed: installedIds.has(pack.id) }));
}

export function installStickerPack(packId) {
  const installedIds = new Set(readInstalledPackIds());
  installedIds.add(packId);
  writeInstalledPackIds([...installedIds]);
  return getMarketStickerPacks();
}

export function removeStickerPack(packId) {
  const installedIds = new Set(readInstalledPackIds());
  installedIds.delete(packId);
  writeInstalledPackIds([...installedIds]);
  return getMarketStickerPacks();
}

export function getInstalledStickers() {
  const installedIds = new Set(readInstalledPackIds());
  return ALL_STICKERS.filter(sticker => installedIds.has(sticker.packId));
}

export function getSeedStickers() {
  return getInstalledStickers();
}

export function getStickerCacheSync() {
  return getInstalledStickers();
}

export async function loadChineseBqbStickers() {
  console.warn('外部 BQB 库已停用：当前版本只使用 Digitail 原创表情包，避免版权风险。');
  return [];
}

export async function findStickerByKeyword(keyword, options = {}) {
  const avoidIds = new Set(options.avoidIds || []);
  const stickers = getInstalledStickers();

  const scored = stickers
    .filter(item => !avoidIds.has(item.id))
    .map(item => ({ item, score: scoreSticker(item, keyword) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 40)
    .map(entry => entry.item);

  if (scored.length) return pickRandom(scored.slice(0, Math.min(8, scored.length)));
  return pickRandom(stickers.filter(item => !avoidIds.has(item.id)));
}

export function searchStickersSync(keyword, limit = 80) {
  const stickers = getInstalledStickers();
  const query = String(keyword || '').trim();
  if (!query) return stickers.slice(0, limit);

  return stickers
    .map(item => ({ item, score: scoreSticker(item, query) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(entry => entry.item);
}

export function searchMarketStickers(keyword, limit = 120) {
  const query = String(keyword || '').trim();
  if (!query) return ALL_STICKERS.slice(0, limit);

  return ALL_STICKERS
    .map(item => ({ item, score: scoreSticker(item, query) }))
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(entry => entry.item);
}

export function getStickerKeywordPresets() {
  return ['笑死', '无语', '疑惑', '委屈', '生气', '抱抱', '摸鱼', '收到', '吃饭', '晚安', '加班', '吃瓜'];
}

export const CHINESE_BQB_META = {
  packId: 'disabled_external_bqb',
  name: '外部 BQB 已停用',
  sourceUrl: '',
};
