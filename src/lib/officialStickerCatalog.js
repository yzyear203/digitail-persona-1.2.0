// Digitail 官方小黄人表情包语义字典
// 18 张官方成品，统一使用 public/official-stickers/official_18.webp 这张 5x4 sprite。

export const OFFICIAL_STICKER_SHEETS = [
  { id: 'official_18', name: '官方表情包 · 小黄人 18 张', rows: 4, cols: 5 },
];

export const OFFICIAL_STICKER_CATALOG = [
  { key: 'knife_smirk', sheet: 'official_18', row: 0, col: 0, name: '菜刀冷笑', emotion: '危险发言', meaning: '开玩笑式威胁、黑化、别逼我', aliases: ['黑化', '刀', '别逼我', '危险', '微笑'] },
  { key: 'broken_heart', sheet: 'official_18', row: 0, col: 1, name: '心碎抱心', emotion: '心碎', meaning: '失落、心碎、被伤到、破防难过', aliases: ['心碎', '难过', '破防', '失落', '裂开'] },
  { key: 'double_hug', sheet: 'official_18', row: 0, col: 2, name: '贴贴抱抱', emotion: '抱抱', meaning: '亲密安慰、贴贴、抱抱、关系变暖', aliases: ['抱抱', '贴贴', '安慰', '亲密', '没事'] },
  { key: 'thumbs_up', sheet: 'official_18', row: 0, col: 3, name: '点赞认可', emotion: '认可', meaning: '赞同、认可、做得好、可以', aliases: ['点赞', '认可', '可以', '好评', '不错'] },
  { key: 'thumbs_down_angry', sheet: 'official_18', row: 0, col: 4, name: '差评不服', emotion: '不满', meaning: '不同意、差评、不服、这不行', aliases: ['差评', '不行', '不满', '不同意', '拒绝'] },
  { key: 'peace_wink', sheet: 'official_18', row: 1, col: 0, name: '比耶搞怪', emotion: '调皮', meaning: '耶、搞怪、活泼回应、轻松玩笑', aliases: ['耶', '比耶', '调皮', '搞怪', '开心'] },
  { key: 'finger_heart', sheet: 'official_18', row: 1, col: 1, name: '指尖比心', emotion: '喜欢', meaning: '比心、喜欢、表达好感、甜甜的认可', aliases: ['比心', '喜欢', '爱你', '心动', '甜'] },
  { key: 'fighting_fist', sheet: 'official_18', row: 1, col: 2, name: '冲呀加油', emotion: '加油', meaning: '鼓励、冲、打气、一起上', aliases: ['加油', '冲', '努力', '打气', '干劲'] },
  { key: 'ok_hand', sheet: 'official_18', row: 1, col: 3, name: 'OK没问题', emotion: 'OK', meaning: '确认、没问题、收到、安排', aliases: ['OK', '收到', '没问题', '安排', '可以'] },
  { key: 'pray_calm', sheet: 'official_18', row: 1, col: 4, name: '双手祈祷', emotion: '拜托', meaning: '拜托、祈祷、感谢、求顺利', aliases: ['拜托', '祈祷', '感谢', '保佑', '求求'] },
  { key: 'beer_cheers', sheet: 'official_18', row: 2, col: 0, name: '快乐干杯', emotion: '庆祝', meaning: '庆祝、干杯、开心聚会、放松一下', aliases: ['庆祝', '干杯', '开心', '放松', '聚会'] },
  { key: 'coffee_break', sheet: 'official_18', row: 2, col: 1, name: '咖啡续命', emotion: '续命', meaning: '喝咖啡、提神、打工续命、休息片刻', aliases: ['咖啡', '续命', '提神', '休息', '打工'] },
  { key: 'birthday_cake', sheet: 'official_18', row: 2, col: 2, name: '生日蛋糕', emotion: '祝福', meaning: '生日快乐、庆生、祝福、仪式感', aliases: ['生日', '蛋糕', '祝福', '庆生', '快乐'] },
  { key: 'rose_romance', sheet: 'official_18', row: 2, col: 3, name: '玫瑰送你', emotion: '喜欢', meaning: '送花、浪漫、喜欢、夸夸', aliases: ['玫瑰', '送花', '浪漫', '喜欢', '夸你'] },
  { key: 'wilted_sad', sheet: 'official_18', row: 2, col: 4, name: '花都谢了', emotion: '失落', meaning: '等太久、失落、被冷落、伤心', aliases: ['失落', '花谢了', '等太久', '伤心', '冷落'] },
  { key: 'bomb_excited', sheet: 'official_18', row: 3, col: 0, name: '炸弹来了', emotion: '爆炸', meaning: '爆炸消息、搞大事、情绪炸了', aliases: ['爆炸', '炸了', '搞事', '重磅', '炸弹'] },
  { key: 'poop_laugh', sheet: 'official_18', row: 3, col: 1, name: '屎到笑死', emotion: '笑死', meaning: '屎一样但好笑、离谱吐槽、低幼搞笑', aliases: ['笑死', '屎', '离谱', '恶搞', '吐槽'] },
  { key: 'double_handshake', sheet: 'official_18', row: 3, col: 2, name: '握手和解', emotion: '合作', meaning: '达成共识、握手、合作愉快、和解', aliases: ['握手', '合作', '和解', '成交', '达成共识'] },
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
