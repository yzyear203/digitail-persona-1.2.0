// Digitail 官方小黄人表情包语义字典
// 65 张官方成品，统一使用 public/official-stickers/official_65.png 这张 6x11 sprite。

const SHEET_ID = 'official_65';

export const OFFICIAL_STICKER_SHEETS = [
  { id: SHEET_ID, name: '官方表情包 · 小黄人 65 张', rows: 11, cols: 6 },
];

const RAW_STICKERS = [
  ['knife_smirk', 0, 0, '菜刀冷笑', '危险发言', '开玩笑式威胁、黑化、别逼我', ['黑化', '刀', '别逼我', '危险', '微笑']],
  ['broken_heart', 0, 1, '心碎抱心', '心碎', '失落、心碎、被伤到、破防难过', ['心碎', '难过', '破防', '失落', '裂开']],
  ['double_hug', 0, 2, '贴贴抱抱', '抱抱', '亲密安慰、贴贴、抱抱、关系变暖', ['抱抱', '贴贴', '安慰', '亲密', '没事']],
  ['thumbs_up', 0, 3, '点赞认可', '认可', '赞同、认可、做得好、可以', ['点赞', '认可', '可以', '好评', '不错']],
  ['thumbs_down_angry', 0, 4, '差评不服', '不满', '不同意、差评、不服、这不行', ['差评', '不行', '不满', '不同意', '拒绝']],
  ['peace_wink', 0, 5, '比耶搞怪', '调皮', '耶、搞怪、活泼回应、轻松玩笑', ['耶', '比耶', '调皮', '搞怪', '开心']],
  ['finger_heart', 1, 0, '指尖比心', '喜欢', '比心、喜欢、表达好感、甜甜的认可', ['比心', '喜欢', '爱你', '心动', '甜']],
  ['fighting_fist', 1, 1, '冲呀加油', '加油', '鼓励、冲、打气、一起上', ['加油', '冲', '努力', '打气', '干劲']],
  ['ok_hand', 1, 2, 'OK没问题', 'OK', '确认、没问题、收到、安排', ['OK', '收到', '没问题', '安排', '可以']],
  ['pray_calm', 1, 3, '双手祈祷', '拜托', '拜托、祈祷、感谢、求顺利', ['拜托', '祈祷', '感谢', '保佑', '求求']],
  ['beer_cheers', 1, 4, '快乐干杯', '庆祝', '庆祝、干杯、开心聚会、放松一下', ['庆祝', '干杯', '开心', '放松', '聚会']],
  ['coffee_break', 1, 5, '咖啡续命', '续命', '喝咖啡、提神、打工续命、休息片刻', ['咖啡', '续命', '提神', '休息', '打工']],
  ['birthday_cake', 2, 0, '生日蛋糕', '祝福', '生日快乐、庆生、祝福、仪式感', ['生日', '蛋糕', '祝福', '庆生', '快乐']],
  ['rose_romance', 2, 1, '玫瑰送你', '喜欢', '送花、浪漫、喜欢、夸夸', ['玫瑰', '送花', '浪漫', '喜欢', '夸你']],
  ['wilted_sad', 2, 2, '花都谢了', '失落', '等太久、失落、被冷落、伤心', ['失落', '花谢了', '等太久', '伤心', '冷落']],
  ['bomb_excited', 2, 3, '炸弹来了', '爆炸', '爆炸消息、搞大事、情绪炸了', ['爆炸', '炸了', '搞事', '重磅', '炸弹']],
  ['poop_laugh', 2, 4, '屎到笑死', '笑死', '屎一样但好笑、离谱吐槽、低幼搞笑', ['笑死', '屎', '离谱', '恶搞', '吐槽']],
  ['double_handshake', 2, 5, '握手和解', '合作', '达成共识、握手、合作愉快、和解', ['握手', '合作', '和解', '成交', '达成共识']],
  ['party_pop', 3, 0, '派对庆祝', '庆祝', '撒花、庆祝、好消息、节日气氛', ['庆祝', '撒花', '派对', '好消息', '快乐']],
  ['gift_present', 3, 1, '礼物惊喜', '惊喜', '送礼物、惊喜、感谢、心意', ['礼物', '惊喜', '感谢', '心意', '送你']],
  ['red_packet', 3, 2, '红包到手', '发财', '红包、钱、奖励、发财好运', ['红包', '钱', '发财', '奖励', '好运']],
  ['mahjong_fa', 3, 3, '发财麻将', '发财', '发财、好运、打麻将、玄学加持', ['发财', '麻将', '好运', '玄学', '赢']],
  ['sparkler_celebrate', 3, 4, '烟花开心', '庆祝', '烟花、节日、开心庆祝、仪式感', ['烟花', '庆祝', '节日', '开心', '快乐']],
  ['skull_dead', 3, 5, '当场去世', '崩溃', '被震撼到死机、无了、彻底崩溃', ['死了', '无了', '崩溃', '寄了', '救命']],
  ['alarm_panic', 4, 0, '警报慌张', '慌张', '警报拉响、出事了、紧急情况、慌了', ['警报', '慌张', '紧急', '出事了', '救命']],
  ['shush_secret', 4, 1, '嘘别说', '保密', '嘘、保密、不要声张、悄悄说', ['嘘', '保密', '别说', '悄悄', '安静']],
  ['suspicious_sweat', 4, 2, '心虚斜眼', '心虚', '心虚、怀疑、尴尬冒汗、偷偷观察', ['心虚', '怀疑', '斜眼', '冒汗', '尴尬']],
  ['thinking_serious', 4, 3, '认真思考', '思考', '认真分析、思考、判断局势、有点严肃', ['思考', '认真', '分析', '判断', '严肃']],
  ['cute_teary', 4, 4, '感动泪眼', '感动', '被感动、可怜可爱、眼泪汪汪', ['感动', '泪眼', '可怜', '可爱', '谢谢']],
  ['giant_grin', 4, 5, '标准假笑', '尬笑', '露齿笑、尬住、礼貌微笑、装没事', ['尬笑', '假笑', '礼貌', '没事', '微笑']],
  ['sleepy_zzz', 5, 0, '困到冒泡', '困', '困了、犯困、想睡、晚安氛围', ['困', '睡觉', '晚安', '犯困', '累了']],
  ['pleading_tears', 5, 1, '委屈求求', '委屈', '委屈、求安慰、拜托、眼巴巴看着', ['委屈', '求求', '安慰', '眼巴巴', '拜托']],
  ['plain_sad', 5, 2, '普通难过', '难过', '难过、低落、不开心、轻度伤心', ['难过', '低落', '不开心', '伤心', '失落']],
  ['wavy_mouth_nervous', 5, 3, '小小害怕', '紧张', '害怕、紧张、慌但还撑着', ['害怕', '紧张', '慌', '怕怕', '撑住']],
  ['moon_sleep', 5, 4, '月亮睡觉', '晚安', '晚安、睡觉、下线休息、温柔告别', ['晚安', '睡觉', '休息', '下线', '困']],
  ['cool_sunglasses', 5, 5, '墨镜耍酷', '酷', '装酷、淡定、拿捏、自信回应', ['酷', '帅', '拿捏', '淡定', '可以']],
  ['sleepy_round_zzz', 6, 0, '圆脸困困', '困', '困到眯眼、打瞌睡、状态下线', ['困', '打瞌睡', '睡了', '晚安', '下线']],
  ['laugh_big_tears', 6, 1, '大笑飙泪', '笑死', '笑到流泪、超级绷不住、太好笑了', ['笑死', '笑哭', '哈哈哈', '绷不住', '爆笑']],
  ['kiss_heart', 6, 2, '亲亲爱心', '喜欢', '飞吻、亲亲、撒娇式表达喜欢', ['亲亲', '飞吻', '爱你', '喜欢', '比心']],
  ['pleading_cute', 6, 3, '可怜拜托', '拜托', '眼巴巴、求求、撒娇拜托、需要安慰', ['拜托', '求求', '可怜', '安慰', '眼巴巴']],
  ['plain_happy', 6, 4, '开心张嘴', '开心', '普通开心、自然回应、轻松愉快', ['开心', '高兴', '好呀', '可以', '愉快']],
  ['wide_eye_shock', 6, 5, '瞳孔地震', '震惊', '被突然吓到、没想到、反应不过来', ['震惊', '吓到', '啊', '真的假的', '反应不过来']],
  ['big_laugh_tears', 7, 0, '大牙笑哭', '笑死', '爆笑、笑得很夸张、气氛特别欢乐', ['笑死', '爆笑', '笑哭', '哈哈哈', '太好笑']],
  ['scream_face', 7, 1, '捂脸尖叫', '尖叫', '惊恐尖叫、太吓人了、强震惊', ['尖叫', '惊恐', '吓死', '啊啊啊', '震惊']],
  ['chin_think', 7, 2, '托腮思考', '思考', '琢磨、怀疑、认真想想、判断局势', ['思考', '琢磨', '我想想', '怀疑', '分析']],
  ['facepalm', 7, 3, '捂脸无语', '无语', '捂脸、没眼看、离谱到头疼', ['捂脸', '无语', '没眼看', '离谱', '头疼']],
  ['tiny_smile', 7, 4, '乖巧微笑', '开心', '轻轻开心、乖巧回应、温和接话', ['开心', '乖巧', '微笑', '收到', '可爱']],
  ['nervous_wobble', 7, 5, '紧张发抖', '紧张', '有点慌、心虚、不知道怎么接话', ['紧张', '心虚', '慌了', '害怕', '怎么办']],
  ['heart_drool', 8, 0, '花痴心动', '喜欢', '被可爱到、心动、馋了、喜欢得不行', ['喜欢', '心动', '花痴', '馋了', '好爱']],
  ['angry_shock', 8, 1, '皱眉震惊', '震惊', '震惊里带点不满、你认真的吗、信息量过大', ['震惊', '惊讶', '真的假的', '你认真的', '离谱']],
  ['cool_smirk', 8, 2, '墨镜淡定', '酷', '装酷、淡定、拿捏、自信回应', ['酷', '帅', '拿捏', '淡定', '可以']],
  ['waterfall_cry', 8, 3, '瀑布大哭', '大哭', '强烈难过、破防、被刀到、委屈爆发', ['大哭', '哭死', '破防', '难过', '委屈']],
  ['peace_calm', 8, 4, '安详闭眼', '平静', '平静、满足、松一口气、岁月静好', ['平静', '舒服', '安详', '松口气', '治愈']],
  ['zip_mouth', 8, 5, '拉链闭嘴', '闭嘴', '保密、我不说了、闭麦、懂了不讲', ['闭嘴', '保密', '闭麦', '我不说', '懂了']],
  ['giant_grin_big', 9, 0, '露齿大笑', '开心', '咧嘴大笑、很开心、努力表现轻松', ['开心', '大笑', '露齿笑', '好耶', '哈哈']],
  ['bored_side_eye', 9, 1, '冷漠斜眼', '无语', '无语、嫌弃、冷淡旁观、不太想接话', ['无语', '嫌弃', '冷漠', '斜眼', '就这']],
  ['teary_sad_round', 9, 2, '泪眼委屈', '委屈', '委屈、想哭、求安慰、被戳中', ['委屈', '想哭', '可怜', '安慰', '抱抱']],
  ['look_up_speechless', 9, 3, '望天无奈', '无奈', '无奈、望天、懒得解释、救命', ['无奈', '望天', '救命', '离谱', '算了']],
  ['laugh_tears_alert', 9, 4, '笑到飙泪', '笑死', '特别好笑、笑到失控、欢乐到炸', ['笑死', '笑哭', '哈哈哈', '爆笑', '绷不住']],
  ['pleading_cute_alt', 9, 5, '泪眼拜托', '拜托', '求求、眼巴巴、撒娇式请求、很期待', ['拜托', '求求', '眼巴巴', '可怜', '撒娇']],
  ['cover_mouth_shy', 10, 0, '捂嘴偷笑', '害羞', '害羞、偷笑、不好意思、憋笑', ['害羞', '偷笑', '不好意思', '憋笑', '嘿嘿']],
  ['mask_sick', 10, 1, '口罩防护', '生病', '生病、不舒服、防护、注意健康', ['生病', '口罩', '不舒服', '健康', '防护']],
  ['sad_sweat', 10, 2, '冷汗委屈', '尴尬', '尴尬、压力大、汗流浃背、不太妙', ['尴尬', '汗', '压力', '不妙', '难办']],
  ['red_angry', 10, 3, '红温生气', '生气', '生气、红温、忍不了了、别惹我', ['生气', '红温', '怒', '烦', '别惹我']],
  ['wink_tongue', 10, 4, '吐舌调皮', '调皮', '调皮、开玩笑、卖萌、轻微挑衅', ['调皮', '吐舌', '卖萌', '开玩笑', '略略略']],
];

export const OFFICIAL_STICKER_CATALOG = RAW_STICKERS.map(([key, row, col, name, emotion, meaning, aliases]) => ({
  key,
  sheet: SHEET_ID,
  row,
  col,
  name,
  emotion,
  meaning,
  aliases,
}));

const DEFAULT_STICKER_KEYS = [
  'ok_hand',
  'chin_think',
  'facepalm',
  'laugh_big_tears',
  'wide_eye_shock',
  'double_hug',
  'plain_sad',
  'fighting_fist',
  'party_pop',
  'finger_heart',
  'sleepy_zzz',
  'mask_sick',
];

const CATEGORY_KEYWORDS = [
  { keys: ['double_hug', 'pleading_tears', 'plain_sad', 'waterfall_cry', 'broken_heart'], words: ['难过', '伤心', '哭', '委屈', '安慰', '抱抱', '低落', '失恋', '分手', '破防', '累'] },
  { keys: ['laugh_big_tears', 'big_laugh_tears', 'facepalm', 'look_up_speechless', 'poop_laugh'], words: ['笑', '哈哈', '离谱', '无语', '绷不住', '吐槽', '尴尬', '救命', '没眼看'] },
  { keys: ['wide_eye_shock', 'angry_shock', 'scream_face', 'alarm_panic', 'bomb_excited'], words: ['震惊', '吓', '真的假的', '啊啊', '爆炸', '出事', '紧急', '重磅'] },
  { keys: ['fighting_fist', 'ok_hand', 'thinking_serious', 'chin_think', 'pray_calm'], words: ['加油', '努力', '考试', '学习', '代码', 'bug', '问题', '分析', '怎么办', '求', '拜托'] },
  { keys: ['party_pop', 'gift_present', 'birthday_cake', 'sparkler_celebrate', 'red_packet'], words: ['生日', '快乐', '庆祝', '好消息', '礼物', '红包', '发财', '赢', '成功'] },
  { keys: ['finger_heart', 'kiss_heart', 'rose_romance', 'heart_drool', 'cover_mouth_shy'], words: ['喜欢', '爱', '心动', '可爱', '害羞', '亲亲', '比心', '甜'] },
  { keys: ['sleepy_zzz', 'sleepy_round_zzz', 'moon_sleep', 'coffee_break'], words: ['困', '睡', '晚安', '累', '咖啡', '熬夜', '续命'] },
  { keys: ['mask_sick', 'plain_sad', 'double_hug', 'pray_calm'], words: ['生病', '不舒服', '医院', '复查', '口罩', '健康', '手术'] },
  { keys: ['red_angry', 'thumbs_down_angry', 'knife_smirk', 'bored_side_eye'], words: ['生气', '烦', '红温', '不满', '别惹我', '差评', '拒绝'] },
];

function getStickerByKey(key) {
  return OFFICIAL_STICKER_CATALOG.find(sticker => sticker.key === key);
}

function normalizeContextText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function scoreSticker(sticker, contextText) {
  const context = normalizeContextText(contextText);
  if (!context) return DEFAULT_STICKER_KEYS.includes(sticker.key) ? 2 : 0;

  const searchable = [sticker.name, sticker.emotion, sticker.meaning, ...(sticker.aliases || [])]
    .join(' ')
    .toLowerCase();

  let score = 0;
  for (const token of [sticker.name, sticker.emotion, ...(sticker.aliases || [])]) {
    const normalizedToken = normalizeContextText(token);
    if (normalizedToken && context.includes(normalizedToken)) score += normalizedToken.length >= 2 ? 8 : 3;
  }

  for (const group of CATEGORY_KEYWORDS) {
    const hitCount = group.words.filter(word => context.includes(word.toLowerCase())).length;
    if (hitCount > 0 && group.keys.includes(sticker.key)) score += hitCount * 6;
  }

  if (context.includes(sticker.emotion.toLowerCase())) score += 8;
  if (searchable.includes(context.slice(-4))) score += 1;
  if (DEFAULT_STICKER_KEYS.includes(sticker.key)) score += 1;
  return score;
}

export function selectOfficialStickerCandidates(contextText = '', limit = 12) {
  const scored = OFFICIAL_STICKER_CATALOG
    .map(sticker => ({ sticker, score: scoreSticker(sticker, contextText) }))
    .sort((a, b) => b.score - a.score || a.sticker.row - b.sticker.row || a.sticker.col - b.sticker.col);

  const selected = [];
  const seenKeys = new Set();
  for (const item of scored) {
    if (item.score <= 0) continue;
    if (seenKeys.has(item.sticker.key)) continue;
    selected.push(item.sticker);
    seenKeys.add(item.sticker.key);
    if (selected.length >= limit) return selected;
  }

  for (const key of DEFAULT_STICKER_KEYS) {
    const sticker = getStickerByKey(key);
    if (sticker && !seenKeys.has(sticker.key)) {
      selected.push(sticker);
      seenKeys.add(sticker.key);
    }
    if (selected.length >= limit) break;
  }

  return selected;
}

export function getOfficialStickerKeywordPresets(contextText = '', limit = 24) {
  return Array.from(new Set(
    selectOfficialStickerCandidates(contextText, Math.max(12, Math.ceil(limit / 2)))
      .flatMap(sticker => [sticker.emotion, ...(sticker.aliases || [])])
  )).slice(0, limit);
}

export function buildOfficialStickerPromptList(contextText = '', options = {}) {
  const limit = Number(options.limit || 12);
  return selectOfficialStickerCandidates(contextText, limit)
    .map(sticker => `${sticker.name}：[sticker:${sticker.emotion}] / ${sticker.meaning}`)
    .join('\n');
}
