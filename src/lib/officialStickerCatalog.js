// Digitail 官方小黄人表情包语义字典
// 54 张官方成品，统一使用 public/official-stickers/official_54.png 这张 6x9 sprite。

export const OFFICIAL_STICKER_SHEETS = [
  { id: 'official_54', name: '官方表情包 · 小黄人 54 张', rows: 9, cols: 6 },
];

export const OFFICIAL_STICKER_CATALOG = [
  { key: 'knife_smirk', sheet: 'official_54', row: 0, col: 0, name: '菜刀冷笑', emotion: '危险发言', meaning: '开玩笑式威胁、黑化、别逼我', aliases: ['黑化', '刀', '别逼我', '危险', '微笑'] },
  { key: 'broken_heart', sheet: 'official_54', row: 0, col: 1, name: '心碎抱心', emotion: '心碎', meaning: '失落、心碎、被伤到、破防难过', aliases: ['心碎', '难过', '破防', '失落', '裂开'] },
  { key: 'double_hug', sheet: 'official_54', row: 0, col: 2, name: '贴贴抱抱', emotion: '抱抱', meaning: '亲密安慰、贴贴、抱抱、关系变暖', aliases: ['抱抱', '贴贴', '安慰', '亲密', '没事'] },
  { key: 'thumbs_up', sheet: 'official_54', row: 0, col: 3, name: '点赞认可', emotion: '认可', meaning: '赞同、认可、做得好、可以', aliases: ['点赞', '认可', '可以', '好评', '不错'] },
  { key: 'thumbs_down_angry', sheet: 'official_54', row: 0, col: 4, name: '差评不服', emotion: '不满', meaning: '不同意、差评、不服、这不行', aliases: ['差评', '不行', '不满', '不同意', '拒绝'] },
  { key: 'peace_wink', sheet: 'official_54', row: 0, col: 5, name: '比耶搞怪', emotion: '调皮', meaning: '耶、搞怪、活泼回应、轻松玩笑', aliases: ['耶', '比耶', '调皮', '搞怪', '开心'] },
  { key: 'finger_heart', sheet: 'official_54', row: 1, col: 0, name: '指尖比心', emotion: '喜欢', meaning: '比心、喜欢、表达好感、甜甜的认可', aliases: ['比心', '喜欢', '爱你', '心动', '甜'] },
  { key: 'fighting_fist', sheet: 'official_54', row: 1, col: 1, name: '冲呀加油', emotion: '加油', meaning: '鼓励、冲、打气、一起上', aliases: ['加油', '冲', '努力', '打气', '干劲'] },
  { key: 'ok_hand', sheet: 'official_54', row: 1, col: 2, name: 'OK没问题', emotion: 'OK', meaning: '确认、没问题、收到、安排', aliases: ['OK', '收到', '没问题', '安排', '可以'] },
  { key: 'pray_calm', sheet: 'official_54', row: 1, col: 3, name: '双手祈祷', emotion: '拜托', meaning: '拜托、祈祷、感谢、求顺利', aliases: ['拜托', '祈祷', '感谢', '保佑', '求求'] },
  { key: 'beer_cheers', sheet: 'official_54', row: 1, col: 4, name: '快乐干杯', emotion: '庆祝', meaning: '庆祝、干杯、开心聚会、放松一下', aliases: ['庆祝', '干杯', '开心', '放松', '聚会'] },
  { key: 'coffee_break', sheet: 'official_54', row: 1, col: 5, name: '咖啡续命', emotion: '续命', meaning: '喝咖啡、提神、打工续命、休息片刻', aliases: ['咖啡', '续命', '提神', '休息', '打工'] },
  { key: 'birthday_cake', sheet: 'official_54', row: 2, col: 0, name: '生日蛋糕', emotion: '祝福', meaning: '生日快乐、庆生、祝福、仪式感', aliases: ['生日', '蛋糕', '祝福', '庆生', '快乐'] },
  { key: 'rose_romance', sheet: 'official_54', row: 2, col: 1, name: '玫瑰送你', emotion: '喜欢', meaning: '送花、浪漫、喜欢、夸夸', aliases: ['玫瑰', '送花', '浪漫', '喜欢', '夸你'] },
  { key: 'wilted_sad', sheet: 'official_54', row: 2, col: 2, name: '花都谢了', emotion: '失落', meaning: '等太久、失落、被冷落、伤心', aliases: ['失落', '花谢了', '等太久', '伤心', '冷落'] },
  { key: 'bomb_excited', sheet: 'official_54', row: 2, col: 3, name: '炸弹来了', emotion: '爆炸', meaning: '爆炸消息、搞大事、情绪炸了', aliases: ['爆炸', '炸了', '搞事', '重磅', '炸弹'] },
  { key: 'poop_laugh', sheet: 'official_54', row: 2, col: 4, name: '屎到笑死', emotion: '笑死', meaning: '屎一样但好笑、离谱吐槽、低幼搞笑', aliases: ['笑死', '屎', '离谱', '恶搞', '吐槽'] },
  { key: 'double_handshake', sheet: 'official_54', row: 2, col: 5, name: '握手和解', emotion: '合作', meaning: '达成共识、握手、合作愉快、和解', aliases: ['握手', '合作', '和解', '成交', '达成共识'] },
  { key: 'party_pop', sheet: 'official_54', row: 3, col: 0, name: '派对庆祝', emotion: '庆祝', meaning: '撒花、庆祝、好消息、节日气氛', aliases: ['庆祝', '撒花', '派对', '好消息', '快乐'] },
  { key: 'gift_present', sheet: 'official_54', row: 3, col: 1, name: '礼物惊喜', emotion: '惊喜', meaning: '送礼物、惊喜、感谢、心意', aliases: ['礼物', '惊喜', '感谢', '心意', '送你'] },
  { key: 'red_packet', sheet: 'official_54', row: 3, col: 2, name: '红包到手', emotion: '发财', meaning: '红包、钱、奖励、发财好运', aliases: ['红包', '钱', '发财', '奖励', '好运'] },
  { key: 'mahjong_fa', sheet: 'official_54', row: 3, col: 3, name: '发财麻将', emotion: '发财', meaning: '发财、好运、打麻将、玄学加持', aliases: ['发财', '麻将', '好运', '玄学', '赢'] },
  { key: 'sparkler_celebrate', sheet: 'official_54', row: 3, col: 4, name: '烟花开心', emotion: '庆祝', meaning: '烟花、节日、开心庆祝、仪式感', aliases: ['烟花', '庆祝', '节日', '开心', '快乐'] },
  { key: 'skull_dead', sheet: 'official_54', row: 3, col: 5, name: '当场去世', emotion: '崩溃', meaning: '被震撼到死机、无了、彻底崩溃', aliases: ['死了', '无了', '崩溃', '寄了', '救命'] },
  { key: 'alarm_panic', sheet: 'official_54', row: 4, col: 0, name: '警报慌张', emotion: '慌张', meaning: '警报拉响、出事了、紧急情况、慌了', aliases: ['警报', '慌张', '紧急', '出事了', '救命'] },
  { key: 'shush_secret', sheet: 'official_54', row: 4, col: 1, name: '嘘别说', emotion: '保密', meaning: '嘘、保密、不要声张、悄悄说', aliases: ['嘘', '保密', '别说', '悄悄', '安静'] },
  { key: 'suspicious_sweat', sheet: 'official_54', row: 4, col: 2, name: '心虚斜眼', emotion: '心虚', meaning: '心虚、怀疑、尴尬冒汗、偷偷观察', aliases: ['心虚', '怀疑', '斜眼', '冒汗', '尴尬'] },
  { key: 'thinking_serious', sheet: 'official_54', row: 4, col: 3, name: '认真思考', emotion: '思考', meaning: '认真分析、思考、判断局势、有点严肃', aliases: ['思考', '认真', '分析', '判断', '严肃'] },
  { key: 'cute_teary', sheet: 'official_54', row: 4, col: 4, name: '感动泪眼', emotion: '感动', meaning: '被感动、可怜可爱、眼泪汪汪', aliases: ['感动', '泪眼', '可怜', '可爱', '谢谢'] },
  { key: 'giant_grin', sheet: 'official_54', row: 4, col: 5, name: '标准假笑', emotion: '尬笑', meaning: '露齿笑、尬住、礼貌微笑、装没事', aliases: ['尬笑', '假笑', '礼貌', '没事', '微笑'] },
  { key: 'sleepy_zzz', sheet: 'official_54', row: 5, col: 0, name: '困到冒泡', emotion: '困', meaning: '困了、犯困、想睡、晚安氛围', aliases: ['困', '睡觉', '晚安', '犯困', '累了'] },
  { key: 'pleading_tears', sheet: 'official_54', row: 5, col: 1, name: '委屈求求', emotion: '委屈', meaning: '委屈、求安慰、拜托、眼巴巴看着', aliases: ['委屈', '求求', '安慰', '眼巴巴', '拜托'] },
  { key: 'plain_sad', sheet: 'official_54', row: 5, col: 2, name: '普通难过', emotion: '难过', meaning: '难过、低落、不开心、轻度伤心', aliases: ['难过', '低落', '不开心', '伤心', '失落'] },
  { key: 'wavy_mouth_nervous', sheet: 'official_54', row: 5, col: 3, name: '小小害怕', emotion: '紧张', meaning: '害怕、紧张、慌但还撑着', aliases: ['害怕', '紧张', '慌', '怕怕', '撑住'] },
  { key: 'moon_sleep', sheet: 'official_54', row: 5, col: 4, name: '月亮睡觉', emotion: '晚安', meaning: '晚安、睡觉、下线休息、温柔告别', aliases: ['晚安', '睡觉', '休息', '下线', '困'] },
  { key: 'cool_sunglasses', sheet: 'official_54', row: 5, col: 5, name: '墨镜耍酷', emotion: '酷', meaning: '装酷、淡定、拿捏、自信回应', aliases: ['酷', '帅', '拿捏', '淡定', '可以'] },
  { key: 'sleepy_round_zzz', sheet: 'official_54', row: 6, col: 0, name: '圆脸困困', emotion: '困', meaning: '困到眯眼、打瞌睡、状态下线', aliases: ['困', '打瞌睡', '睡了', '晚安', '下线'] },
  { key: 'laugh_big_tears', sheet: 'official_54', row: 6, col: 1, name: '大笑飙泪', emotion: '笑死', meaning: '笑到流泪、超级绷不住、太好笑了', aliases: ['笑死', '笑哭', '哈哈哈', '绷不住', '爆笑'] },
  { key: 'kiss_heart', sheet: 'official_54', row: 6, col: 2, name: '亲亲爱心', emotion: '喜欢', meaning: '飞吻、亲亲、撒娇式表达喜欢', aliases: ['亲亲', '飞吻', '爱你', '喜欢', '比心'] },
  { key: 'pleading_cute', sheet: 'official_54', row: 6, col: 3, name: '可怜拜托', emotion: '拜托', meaning: '眼巴巴、求求、撒娇拜托、需要安慰', aliases: ['拜托', '求求', '可怜', '安慰', '眼巴巴'] },
  { key: 'plain_happy', sheet: 'official_54', row: 6, col: 4, name: '开心张嘴', emotion: '开心', meaning: '普通开心、自然回应、轻松愉快', aliases: ['开心', '高兴', '好呀', '可以', '愉快'] },
  { key: 'wide_eye_shock', sheet: 'official_54', row: 6, col: 5, name: '瞳孔地震', emotion: '震惊', meaning: '被突然吓到、没想到、反应不过来', aliases: ['震惊', '吓到', '啊', '真的假的', '反应不过来'] },
  { key: 'big_laugh_tears', sheet: 'official_54', row: 7, col: 0, name: '大牙笑哭', emotion: '笑死', meaning: '爆笑、笑得很夸张、气氛特别欢乐', aliases: ['笑死', '爆笑', '笑哭', '哈哈哈', '太好笑'] },
  { key: 'scream_face', sheet: 'official_54', row: 7, col: 1, name: '捂脸尖叫', emotion: '尖叫', meaning: '惊恐尖叫、太吓人了、强震惊', aliases: ['尖叫', '惊恐', '吓死', '啊啊啊', '震惊'] },
  { key: 'chin_think', sheet: 'official_54', row: 7, col: 2, name: '托腮思考', emotion: '思考', meaning: '琢磨、怀疑、认真想想、判断局势', aliases: ['思考', '琢磨', '我想想', '怀疑', '分析'] },
  { key: 'facepalm', sheet: 'official_54', row: 7, col: 3, name: '捂脸无语', emotion: '无语', meaning: '捂脸、没眼看、离谱到头疼', aliases: ['捂脸', '无语', '没眼看', '离谱', '头疼'] },
  { key: 'tiny_smile', sheet: 'official_54', row: 7, col: 4, name: '乖巧微笑', emotion: '开心', meaning: '轻轻开心、乖巧回应、温和接话', aliases: ['开心', '乖巧', '微笑', '收到', '可爱'] },
  { key: 'nervous_wobble', sheet: 'official_54', row: 7, col: 5, name: '紧张发抖', emotion: '紧张', meaning: '有点慌、心虚、不知道怎么接话', aliases: ['紧张', '心虚', '慌了', '害怕', '怎么办'] },
  { key: 'heart_drool', sheet: 'official_54', row: 8, col: 0, name: '花痴心动', emotion: '喜欢', meaning: '被可爱到、心动、馋了、喜欢得不行', aliases: ['喜欢', '心动', '花痴', '馋了', '好爱'] },
  { key: 'angry_shock', sheet: 'official_54', row: 8, col: 1, name: '皱眉震惊', emotion: '震惊', meaning: '震惊里带点不满、你认真的吗、信息量过大', aliases: ['震惊', '惊讶', '真的假的', '你认真的', '离谱'] },
  { key: 'cool_smirk', sheet: 'official_54', row: 8, col: 2, name: '墨镜淡定', emotion: '酷', meaning: '装酷、淡定、拿捏、自信回应', aliases: ['酷', '帅', '拿捏', '淡定', '可以'] },
  { key: 'waterfall_cry', sheet: 'official_54', row: 8, col: 3, name: '瀑布大哭', emotion: '大哭', meaning: '强烈难过、破防、被刀到、委屈爆发', aliases: ['大哭', '哭死', '破防', '难过', '委屈'] },
  { key: 'peace_calm', sheet: 'official_54', row: 8, col: 4, name: '安详闭眼', emotion: '平静', meaning: '平静、满足、松一口气、岁月静好', aliases: ['平静', '舒服', '安详', '松口气', '治愈'] },
  { key: 'zip_mouth', sheet: 'official_54', row: 8, col: 5, name: '拉链闭嘴', emotion: '闭嘴', meaning: '保密、我不说了、闭麦、懂了不讲', aliases: ['闭嘴', '保密', '闭麦', '我不说', '懂了'] },
];

export function getOfficialStickerKeywordPresets() {
  return Array.from(new Set(
    OFFICIAL_STICKER_CATALOG.flatMap(sticker => [sticker.emotion, ...(sticker.aliases || [])])
  )).slice(0, 48);
}

export function buildOfficialStickerPromptList() {
  return OFFICIAL_STICKER_CATALOG
    .map(sticker => `${sticker.name}：[sticker:${sticker.emotion}] / ${sticker.meaning}`)
    .join('\n');
}
