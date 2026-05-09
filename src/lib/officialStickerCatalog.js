// Digitail 官方小黄人表情包语义字典
// sheet/row/col 对应用户提供的 3 张官方表情包大图，后续接入图片资源时按格子裁切。

export const OFFICIAL_STICKER_SHEETS = [
  { id: 'basic_reactions', name: '官方表情包 · 基础情绪', rows: 4, cols: 5 },
  { id: 'social_life', name: '官方表情包 · 社交生活', rows: 5, cols: 5 },
  { id: 'advanced_reactions', name: '官方表情包 · 进阶反应', rows: 4, cols: 5 },
];

export const OFFICIAL_STICKER_CATALOG = [
  // Sheet 1: 基础情绪 4x5
  { key: 'smile_hello', sheet: 'basic_reactions', row: 0, col: 0, name: '乖巧开心', emotion: '开心', meaning: '轻松开心、乖巧回应、普通打招呼', aliases: ['开心', '你好', '乖', '可爱', '收到'] },
  { key: 'nervous_wobble', sheet: 'basic_reactions', row: 0, col: 1, name: '紧张发抖', emotion: '紧张', meaning: '有点慌、心虚、不知道怎么接话', aliases: ['紧张', '心虚', '慌了', '害怕', '怎么办'] },
  { key: 'heart_drool', sheet: 'basic_reactions', row: 0, col: 2, name: '花痴心动', emotion: '喜欢', meaning: '被可爱到、心动、馋了、喜欢得不行', aliases: ['喜欢', '心动', '花痴', '馋了', '好爱'] },
  { key: 'shock_open_mouth', sheet: 'basic_reactions', row: 0, col: 3, name: '瞳孔地震', emotion: '震惊', meaning: '震惊、没想到、真的假的、信息量太大', aliases: ['震惊', '惊讶', '真的假的', '啊', '离谱'] },
  { key: 'cool_sunglasses', sheet: 'basic_reactions', row: 0, col: 4, name: '墨镜耍酷', emotion: '酷', meaning: '装酷、淡定、拿捏、自信回应', aliases: ['酷', '帅', '拿捏', '淡定', '可以'] },
  { key: 'waterfall_cry', sheet: 'basic_reactions', row: 1, col: 0, name: '瀑布大哭', emotion: '大哭', meaning: '强烈难过、破防、被刀到、委屈爆发', aliases: ['大哭', '哭死', '破防', '难过', '委屈'] },
  { key: 'peace_calm', sheet: 'basic_reactions', row: 1, col: 1, name: '安详闭眼', emotion: '平静', meaning: '平静、满足、松一口气、岁月静好', aliases: ['平静', '舒服', '安详', '松口气', '治愈'] },
  { key: 'zip_mouth', sheet: 'basic_reactions', row: 1, col: 2, name: '拉链闭嘴', emotion: '闭嘴', meaning: '保密、我不说了、闭麦、懂了不讲', aliases: ['闭嘴', '保密', '闭麦', '我不说', '懂了'] },
  { key: 'sleepy_zzz', sheet: 'basic_reactions', row: 1, col: 3, name: '困到冒泡', emotion: '困', meaning: '困了、犯困、想睡、晚安氛围', aliases: ['困', '睡觉', '晚安', '犯困', '累了'] },
  { key: 'laugh_tears', sheet: 'basic_reactions', row: 1, col: 4, name: '笑到飙泪', emotion: '笑死', meaning: '爆笑、绷不住、太好笑了', aliases: ['笑死', '哈哈', '爆笑', '绷不住', '乐'] },
  { key: 'sad_sweat', sheet: 'basic_reactions', row: 2, col: 0, name: '冷汗委屈', emotion: '尴尬', meaning: '尴尬、压力大、汗流浃背、不太妙', aliases: ['尴尬', '汗', '压力', '不妙', '难办'] },
  { key: 'red_angry', sheet: 'basic_reactions', row: 2, col: 1, name: '红温生气', emotion: '生气', meaning: '生气、红温、忍不了了、别惹我', aliases: ['生气', '红温', '怒', '烦', '别惹我'] },
  { key: 'wink_tongue', sheet: 'basic_reactions', row: 2, col: 2, name: '吐舌调皮', emotion: '调皮', meaning: '调皮、开玩笑、卖萌、轻微挑衅', aliases: ['调皮', '吐舌', '卖萌', '开玩笑', '略略略'] },
  { key: 'big_teeth_grin', sheet: 'basic_reactions', row: 2, col: 3, name: '露齿假笑', emotion: '尬笑', meaning: '尬笑、强行微笑、表面镇定', aliases: ['尬笑', '假笑', '强颜欢笑', '还行', '没事'] },
  { key: 'side_eye', sheet: 'basic_reactions', row: 2, col: 4, name: '斜眼无语', emotion: '无语', meaning: '无语、嫌弃、你认真的吗、冷眼旁观', aliases: ['无语', '嫌弃', '斜眼', '就这', '啊这'] },
  { key: 'teary_sad', sheet: 'basic_reactions', row: 3, col: 0, name: '泪眼汪汪', emotion: '委屈', meaning: '委屈、想哭、求安慰、被戳中', aliases: ['委屈', '想哭', '可怜', '安慰', '抱抱'] },
  { key: 'look_up_speechless', sheet: 'basic_reactions', row: 3, col: 1, name: '望天无奈', emotion: '无奈', meaning: '无奈、翻白眼、懒得解释、救命', aliases: ['无奈', '翻白眼', '救命', '离谱', '算了'] },
  { key: 'laugh_spark', sheet: 'basic_reactions', row: 3, col: 2, name: '笑到发光', emotion: '笑死', meaning: '特别好笑、气氛很欢乐、乐疯了', aliases: ['笑死', '乐疯了', '哈哈哈', '太好笑', '开心'] },
  { key: 'pleading_hands', sheet: 'basic_reactions', row: 3, col: 3, name: '拜托拜托', emotion: '拜托', meaning: '求求、拜托、撒娇式请求、很期待', aliases: ['拜托', '求求', '期待', '可怜', '撒娇'] },
  { key: 'cover_mouth_shy', sheet: 'basic_reactions', row: 3, col: 4, name: '捂嘴害羞', emotion: '害羞', meaning: '害羞、偷笑、不好意思、憋笑', aliases: ['害羞', '偷笑', '不好意思', '憋笑', '嘿嘿'] },

  // Sheet 2: 社交生活 5x5
  { key: 'broken_heart', sheet: 'social_life', row: 0, col: 0, name: '心碎抱心', emotion: '心碎', meaning: '失落、心碎、被伤到、破防难过', aliases: ['心碎', '难过', '破防', '失落', '裂开'] },
  { key: 'double_hug', sheet: 'social_life', row: 0, col: 1, name: '贴贴抱抱', emotion: '抱抱', meaning: '亲密安慰、贴贴、抱抱、关系变暖', aliases: ['抱抱', '贴贴', '安慰', '亲密', '没事'] },
  { key: 'thumbs_up', sheet: 'social_life', row: 0, col: 2, name: '点赞认可', emotion: '认可', meaning: '赞同、认可、做得好、可以', aliases: ['点赞', '认可', '可以', '好评', '不错'] },
  { key: 'thumbs_down_angry', sheet: 'social_life', row: 0, col: 3, name: '差评不服', emotion: '不满', meaning: '不同意、差评、不服、这不行', aliases: ['差评', '不行', '不满', '不同意', '拒绝'] },
  { key: 'double_handshake', sheet: 'social_life', row: 0, col: 4, name: '握手和解', emotion: '合作', meaning: '达成共识、握手、合作愉快、和解', aliases: ['握手', '合作', '和解', '成交', '达成共识'] },
  { key: 'peace_wink', sheet: 'social_life', row: 1, col: 0, name: '比耶搞怪', emotion: '调皮', meaning: '耶、搞怪、活泼回应、轻松玩笑', aliases: ['耶', '比耶', '调皮', '搞怪', '开心'] },
  { key: 'finger_heart', sheet: 'social_life', row: 1, col: 1, name: '指尖比心', emotion: '喜欢', meaning: '比心、喜欢、表达好感、甜甜的认可', aliases: ['比心', '喜欢', '爱你', '心动', '甜'] },
  { key: 'fighting_fist', sheet: 'social_life', row: 1, col: 2, name: '冲呀加油', emotion: '加油', meaning: '鼓励、冲、打气、一起上', aliases: ['加油', '冲', '努力', '打气', '干劲'] },
  { key: 'ok_hand', sheet: 'social_life', row: 1, col: 3, name: 'OK没问题', emotion: 'OK', meaning: '确认、没问题、收到、安排', aliases: ['OK', '收到', '没问题', '安排', '可以'] },
  { key: 'pray_calm', sheet: 'social_life', row: 1, col: 4, name: '双手祈祷', emotion: '拜托', meaning: '拜托、祈祷、感谢、求顺利', aliases: ['拜托', '祈祷', '感谢', '保佑', '求求'] },
  { key: 'beer_cheers', sheet: 'social_life', row: 2, col: 0, name: '快乐干杯', emotion: '庆祝', meaning: '庆祝、干杯、开心聚会、放松一下', aliases: ['庆祝', '干杯', '开心', '放松', '聚会'] },
  { key: 'coffee_break', sheet: 'social_life', row: 2, col: 1, name: '咖啡续命', emotion: '续命', meaning: '喝咖啡、提神、打工续命、休息片刻', aliases: ['咖啡', '续命', '提神', '休息', '打工'] },
  { key: 'birthday_cake', sheet: 'social_life', row: 2, col: 2, name: '生日蛋糕', emotion: '祝福', meaning: '生日快乐、庆生、祝福、仪式感', aliases: ['生日', '蛋糕', '祝福', '庆生', '快乐'] },
  { key: 'rose_romance', sheet: 'social_life', row: 2, col: 3, name: '玫瑰送你', emotion: '喜欢', meaning: '送花、浪漫、喜欢、夸夸', aliases: ['玫瑰', '送花', '浪漫', '喜欢', '夸你'] },
  { key: 'wilted_sad', sheet: 'social_life', row: 2, col: 4, name: '花都谢了', emotion: '失落', meaning: '等太久、失落、被冷落、伤心', aliases: ['失落', '花谢了', '等太久', '伤心', '冷落'] },
  { key: 'knife_smirk', sheet: 'social_life', row: 3, col: 0, name: '菜刀冷笑', emotion: '危险发言', meaning: '开玩笑式威胁、黑化、别逼我', aliases: ['黑化', '刀', '别逼我', '危险', '微笑'] },
  { key: 'bomb_excited', sheet: 'social_life', row: 3, col: 1, name: '炸弹来了', emotion: '爆炸', meaning: '爆炸消息、搞大事、情绪炸了', aliases: ['爆炸', '炸了', '搞事', '重磅', '炸弹'] },
  { key: 'poop_laugh', sheet: 'social_life', row: 3, col: 2, name: '屎到笑死', emotion: '笑死', meaning: '屎一样但好笑、离谱吐槽、低幼搞笑', aliases: ['笑死', '屎', '离谱', '恶搞', '吐槽'] },
  { key: 'moon_sleep', sheet: 'social_life', row: 3, col: 3, name: '月亮睡觉', emotion: '晚安', meaning: '晚安、睡觉、下线休息、温柔告别', aliases: ['晚安', '睡觉', '休息', '下线', '困'] },
  { key: 'cool_happy', sheet: 'social_life', row: 3, col: 4, name: '墨镜开心', emotion: '酷', meaning: '开心又装酷、轻松拿捏、状态很好', aliases: ['酷', '开心', '帅', '拿捏', '爽'] },
  { key: 'party_pop', sheet: 'social_life', row: 4, col: 0, name: '派对庆祝', emotion: '庆祝', meaning: '撒花、庆祝、好消息、节日气氛', aliases: ['庆祝', '撒花', '派对', '好消息', '快乐'] },
  { key: 'gift_present', sheet: 'social_life', row: 4, col: 1, name: '礼物惊喜', emotion: '惊喜', meaning: '送礼物、惊喜、感谢、心意', aliases: ['礼物', '惊喜', '感谢', '心意', '送你'] },
  { key: 'red_packet', sheet: 'social_life', row: 4, col: 2, name: '红包到手', emotion: '发财', meaning: '红包、钱、奖励、发财好运', aliases: ['红包', '钱', '发财', '奖励', '好运'] },
  { key: 'mahjong_fa', sheet: 'social_life', row: 4, col: 3, name: '发财麻将', emotion: '发财', meaning: '发财、好运、打麻将、玄学加持', aliases: ['发财', '麻将', '好运', '玄学', '赢'] },
  { key: 'sparkler_celebrate', sheet: 'social_life', row: 4, col: 4, name: '烟花开心', emotion: '庆祝', meaning: '烟花、节日、开心庆祝、仪式感', aliases: ['烟花', '庆祝', '节日', '开心', '快乐'] },

  // Sheet 3: 进阶反应 4x5
  { key: 'skull_dead', sheet: 'advanced_reactions', row: 0, col: 0, name: '当场去世', emotion: '崩溃', meaning: '被震撼到死机、无了、彻底崩溃', aliases: ['死了', '无了', '崩溃', '寄了', '救命'] },
  { key: 'alarm_panic', sheet: 'advanced_reactions', row: 0, col: 1, name: '警报慌张', emotion: '慌张', meaning: '警报拉响、出事了、紧急情况、慌了', aliases: ['警报', '慌张', '紧急', '出事了', '救命'] },
  { key: 'shush_secret', sheet: 'advanced_reactions', row: 0, col: 2, name: '嘘别说', emotion: '保密', meaning: '嘘、保密、不要声张、悄悄说', aliases: ['嘘', '保密', '别说', '悄悄', '安静'] },
  { key: 'suspicious_sweat', sheet: 'advanced_reactions', row: 0, col: 3, name: '心虚斜眼', emotion: '心虚', meaning: '心虚、怀疑、尴尬冒汗、偷偷观察', aliases: ['心虚', '怀疑', '斜眼', '冒汗', '尴尬'] },
  { key: 'thinking_serious', sheet: 'advanced_reactions', row: 0, col: 4, name: '认真思考', emotion: '思考', meaning: '认真分析、思考、判断局势、有点严肃', aliases: ['思考', '认真', '分析', '判断', '严肃'] },
  { key: 'cute_teary', sheet: 'advanced_reactions', row: 1, col: 0, name: '感动泪眼', emotion: '感动', meaning: '被感动、可怜可爱、眼泪汪汪', aliases: ['感动', '泪眼', '可怜', '可爱', '谢谢'] },
  { key: 'giant_grin', sheet: 'advanced_reactions', row: 1, col: 1, name: '标准假笑', emotion: '尬笑', meaning: '露齿笑、尬住、礼貌微笑、装没事', aliases: ['尬笑', '假笑', '礼貌', '没事', '微笑'] },
  { key: 'sleepy_hands', sheet: 'advanced_reactions', row: 1, col: 2, name: '趴着犯困', emotion: '困', meaning: '困到趴下、想睡、精神下线', aliases: ['困', '想睡', '下线', '累', '晚安'] },
  { key: 'pleading_tears', sheet: 'advanced_reactions', row: 1, col: 3, name: '委屈求求', emotion: '委屈', meaning: '委屈、求安慰、拜托、眼巴巴看着', aliases: ['委屈', '求求', '安慰', '眼巴巴', '拜托'] },
  { key: 'plain_sad', sheet: 'advanced_reactions', row: 1, col: 4, name: '普通难过', emotion: '难过', meaning: '难过、低落、不开心、轻度伤心', aliases: ['难过', '低落', '不开心', '伤心', '失落'] },
  { key: 'wavy_mouth_nervous', sheet: 'advanced_reactions', row: 2, col: 0, name: '小小害怕', emotion: '紧张', meaning: '害怕、紧张、慌但还撑着', aliases: ['害怕', '紧张', '慌', '怕怕', '撑住'] },
  { key: 'kiss_heart', sheet: 'advanced_reactions', row: 2, col: 1, name: '飞吻爱心', emotion: '喜欢', meaning: '飞吻、爱你、表达喜欢、甜蜜回应', aliases: ['飞吻', '爱你', '喜欢', '亲亲', '比心'] },
  { key: 'moved_tears', sheet: 'advanced_reactions', row: 2, col: 2, name: '感动捧脸', emotion: '感动', meaning: '感动得想哭、被暖到、谢谢你', aliases: ['感动', '暖到', '谢谢', '想哭', '温柔'] },
  { key: 'plain_happy', sheet: 'advanced_reactions', row: 2, col: 3, name: '普通开心', emotion: '开心', meaning: '普通开心、自然回应、轻松愉快', aliases: ['开心', '愉快', '好呀', '可以', '不错'] },
  { key: 'mask_sick', sheet: 'advanced_reactions', row: 2, col: 4, name: '口罩防护', emotion: '生病', meaning: '生病、不舒服、防护、注意健康', aliases: ['生病', '口罩', '不舒服', '健康', '防护'] },
  { key: 'wide_eye_shock', sheet: 'advanced_reactions', row: 3, col: 0, name: '吓到瞪眼', emotion: '震惊', meaning: '突然震惊、被吓到、反应不过来', aliases: ['震惊', '吓到', '啊', '突然', '反应不过来'] },
  { key: 'big_laugh_tears', sheet: 'advanced_reactions', row: 3, col: 1, name: '爆笑流泪', emotion: '笑死', meaning: '爆笑、笑到流泪、超级绷不住', aliases: ['笑死', '爆笑', '哈哈哈', '绷不住', '笑哭'] },
  { key: 'scream_face', sheet: 'advanced_reactions', row: 3, col: 2, name: '尖叫震惊', emotion: '尖叫', meaning: '惊恐尖叫、太吓人了、强震惊', aliases: ['尖叫', '惊恐', '震惊', '吓死', '啊啊啊'] },
  { key: 'chin_think', sheet: 'advanced_reactions', row: 3, col: 3, name: '托腮思考', emotion: '思考', meaning: '琢磨、怀疑、认真思考、我想想', aliases: ['思考', '琢磨', '我想想', '怀疑', '分析'] },
  { key: 'facepalm', sheet: 'advanced_reactions', row: 3, col: 4, name: '捂脸无语', emotion: '无语', meaning: '捂脸、无语、没眼看、离谱到头疼', aliases: ['捂脸', '无语', '没眼看', '离谱', '头疼'] },
];

export function getOfficialStickerKeywordPresets() {
  return Array.from(new Set(
    OFFICIAL_STICKER_CATALOG.flatMap(sticker => [sticker.emotion, ...(sticker.aliases || [])])
  )).slice(0, 36);
}

export function buildOfficialStickerPromptList() {
  return OFFICIAL_STICKER_CATALOG
    .map(sticker => `${sticker.name}：[sticker:${sticker.emotion}] / ${sticker.meaning}`)
    .join('\n');
}
