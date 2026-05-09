import type { Anomaly, Bait, Fish, Rod, SeaZone } from '../types';

export const provinces = [
  '越秀区',
  '海珠区',
  '荔湾区',
  '天河区',
  '白云区',
  '黄埔区',
  '番禺区',
  '花都区',
  '南沙区',
  '从化区',
  '增城区',
];

export const rods: Rod[] = [
  { id: 'basic', name: '\u666e\u901a\u9c7c\u7aff', rarity: '\u666e\u901a', price: 0, luck: 0, tolerance: 0, difficulty: 0 },
  { id: 'starter', name: '\u65b0\u624b\u6d77\u7aff', rarity: '\u8d60\u9001', price: 0, luck: 1, tolerance: 2, difficulty: 1 },
  { id: 'fine', name: '\u7cbe\u826f\u9c7c\u7aff', rarity: '\u7cbe\u826f', price: 260, luck: 3, tolerance: 5, difficulty: 4 },
  { id: 'rare', name: '\u7a00\u6709\u9c7c\u7aff', rarity: '\u7a00\u6709', price: 680, luck: 6, tolerance: 8, difficulty: 7 },
  { id: 'fog', name: '\u96fe\u6e2f\u77ed\u7aff', rarity: '\u7cbe\u826f', price: 920, luck: 7, tolerance: 9, difficulty: 8 },
  { id: 'tide', name: '\u9ed1\u6f6e\u5f39\u7aff', rarity: '\u7a00\u6709', price: 1260, luck: 8, tolerance: 10, difficulty: 9 },
  { id: 'epic', name: '\u53f2\u8bd7\u9c7c\u7aff', rarity: '\u53f2\u8bd7', price: 1380, luck: 9, tolerance: 11, difficulty: 10 },
  { id: 'moon', name: '\u8840\u6708\u63a7\u7aff', rarity: '\u53f2\u8bd7', price: 1880, luck: 10, tolerance: 12, difficulty: 11 },
  { id: 'abyss', name: '\u88c2\u8c37\u91cd\u7aff', rarity: '\u53f2\u8bd7', price: 2360, luck: 12, tolerance: 13, difficulty: 12 },
  { id: 'legend', name: '\u4f20\u8bf4\u9c7c\u7aff', rarity: '\u4f20\u8bf4', price: 2880, luck: 13, tolerance: 14, difficulty: 13 },
  { id: 'crown', name: '\u6e0a\u51a0\u9c7c\u7aff', rarity: '\u4f20\u8bf4', price: 4200, luck: 15, tolerance: 16, difficulty: 14 },
];

export const baits: Bait[] = [
  { id: 'plain', name: '\u666e\u901a\u9c7c\u9975', price: 0, luck: 0, rareBoost: 0, description: '\u7a33\u5b9a\uff0c\u4ec0\u4e48\u90fd\u80fd\u54ac\u4e00\u53e3\u3002' },
  { id: 'shrimp', name: '\u591c\u5149\u867e\u56e2', price: 90, luck: 1, rareBoost: 1, description: '\u6c34\u4e0b\u4f1a\u5fae\u5fae\u53d1\u4eae\u3002' },
  { id: 'clam', name: '\u788e\u8d1d\u8089', price: 140, luck: 1, rareBoost: 2, description: '\u66f4\u5bb9\u6613\u5f15\u6765\u5927\u4e00\u70b9\u7684\u9c7c\u3002' },
  { id: 'glow', name: '\u8367\u5149\u9c7c\u7cdc', price: 220, luck: 2, rareBoost: 2, description: '\u50cf\u5f00\u7bb1\u524d\u7684\u90a3\u4e00\u70b9\u5149\u3002' },
  { id: 'mist', name: '\u8ff7\u96fe\u8f6f\u9975', price: 360, luck: 3, rareBoost: 3, description: '\u96fe\u6d77\u91cc\u7279\u522b\u597d\u7528\u3002' },
  { id: 'blood', name: '\u8840\u6708\u7ea2\u9975', price: 520, luck: 4, rareBoost: 4, description: '\u5f02\u5e38\u6d77\u57df\u91cc\u4f1a\u53d8\u70ed\u3002' },
  { id: 'black', name: '\u9ed1\u6f6e\u6c89\u9975', price: 680, luck: 5, rareBoost: 5, description: '\u4e0b\u6c89\u5f88\u5feb\uff0c\u50cf\u6709\u4e1c\u897f\u5728\u62c9\u3002' },
  { id: 'bell', name: '\u4f4e\u9e23\u94c3\u9975', price: 860, luck: 6, rareBoost: 6, description: '\u4f1a\u5728\u6c34\u4e0b\u53d1\u51fa\u7ec6\u5c0f\u56de\u58f0\u3002' },
  { id: 'rift', name: '\u88c2\u8c37\u9aa8\u9975', price: 1080, luck: 7, rareBoost: 7, description: '\u6df1\u6d77\u5f02\u79cd\u4f3c\u4e4e\u4f1a\u591a\u770b\u4e00\u773c\u3002' },
  { id: 'king', name: '\u9c7c\u738b\u8bf1\u9975', price: 1680, luck: 9, rareBoost: 9, description: '\u522b\u95ee\u5b83\u95fb\u8d77\u6765\u50cf\u4ec0\u4e48\u3002' },
];

const commonNames = [
  '银浪鲤', '灯鳍鱼', '青背鲭', '白沫鲷', '月点鳗', '铜鳞鲫', '细尾鲈', '礁边鲳', '浅潮鲮', '碎星沙丁',
  '蓝口鲻', '雾鳞小鲨', '海草鲤', '泡沫鳕', '短须鲶', '潮斑鱼', '灰鳍鲷', '银针鱼', '斑点鲯', '夜光小鲉',
  '湾口鲈', '绿眼鲭', '海纹鲤', '软骨鳐', '浮木鱼', '珍珠鲫', '黑尾鲳', '白线鳗', '浅滩鲷', '泥金鲻',
  '浪尖鲈', '贝壳鲤', '薄翼鳐', '微光鲭', '圆吻鲶', '小月鲷', '盐风鲫', '碎鳞鳕', '蓝斑鲉', '潮泡鱼',
  '银须鲶', '灰月鲳', '星砂鲻', '暗纹鲈', '短鳍鲷', '海雾鲫', '浅蓝鳗', '白腹鲭', '绿潮鲤', '细鳞鲯',
];

const rareNames = [
  '翡翠鳐', '星斑电鳗', '幽灯鲨', '赤鳍琉璃鱼', '雾冠鲷', '蓝焰鳕', '镜鳞海鲤', '夜潮鲉', '金须鳗', '月影鳐',
  '珊瑚龙鱼', '银冠鲭', '暗香鲈', '紫尾鲳', '雪目鲨', '灯塔鲶', '碧火鲫', '海晶鲷', '霜鳍鳗', '绿星鲉',
  '潮音鳐', '白虹鲈', '赤月鲭', '黑珠鲷', '幽纹鳕', '青焰鲳', '银雾鲨', '星灯鲤', '幻鳞鳗', '远潮鲯',
];

const legendaryNames = [
  '海王金鳞', '幽蓝龙鲤', '赤潮皇鲷', '黑曜巨鳐', '星门鲸鲨', '月冕电鳗', '雾海玄鲈', '碧落灯王鱼', '沉船守卫鲶', '潮汐银皇',
  '深渊白冠', '珊瑚古龙鱼', '风暴金尾', '夜航星鲨', '琉璃海主', '青铜巨口鱼', '天穹鳞王', '破浪玄鳕', '万潮鲸鲤', '孤灯帝鲉',
];

const epicNames = [
  '裂谷骨王', '血月魔鳐', '黑潮巨牙', '寂静海魇', '深雾冕鲨', '逆流古鳗', '沉钟海兽', '暗礁吞星鱼', '幽渊战鲷', '赤灯巡海者',
];

const mutantNames = ['黑潮棘骨', '血月裂口鱼', '死雾白眼鲨'];

const makeFish = (
  names: string[],
  rarity: Fish['rarity'],
  config: {
    weight: number;
    coinMin: number;
    coinMax: number;
    contribution: number;
    difficulty: number;
    prefix: string;
    reveal: string;
  },
): Fish[] =>
  names.map((name, index) => ({
    id: `${config.prefix}-${index + 1}`,
    name,
    rarity,
    baseWeight: Number((config.weight + index * 0.18).toFixed(1)),
    coinMin: config.coinMin + index * 2,
    coinMax: config.coinMax + index * 3,
    contribution: config.contribution + index,
    difficulty: config.difficulty + Math.floor(index / 6),
    silhouette:
      rarity === 'mutant'
        ? '水下有一团不该存在的黑影贴着船底游过。'
        : rarity === 'epic'
          ? '海面下掠过巨大的暗光轮廓。'
          : rarity === 'legendary'
            ? '鱼线尽头传来像钟声一样的震动。'
            : rarity === 'rare'
              ? '一道发光鱼影从暗流里翻身。'
              : '一团鱼影贴着浪尖晃动。',
    reveal: `${name}${config.reveal}`,
  }));

export const fishPool: Fish[] = [
  ...makeFish(commonNames, 'common', {
    weight: 1.8,
    coinMin: 16,
    coinMax: 36,
    contribution: 10,
    difficulty: 16,
    prefix: 'common',
    reveal: '被甩上甲板，水珠和金币一起乱跳。',
  }),
  ...makeFish(rareNames, 'rare', {
    weight: 5.8,
    coinMin: 90,
    coinMax: 170,
    contribution: 70,
    difficulty: 38,
    prefix: 'rare',
    reveal: '发出怪异幽光，区服频道开始刷屏。',
  }),
  ...makeFish(legendaryNames, 'legendary', {
    weight: 12,
    coinMin: 240,
    coinMax: 430,
    contribution: 170,
    difficulty: 56,
    prefix: 'legendary',
    reveal: '像从深海传说里醒来，整片海面都亮了一下。',
  }),
  ...makeFish(epicNames, 'epic', {
    weight: 20,
    coinMin: 520,
    coinMax: 860,
    contribution: 360,
    difficulty: 68,
    prefix: 'epic',
    reveal: '拖着异常浪涌现身，船舷都震了一下。',
  }),
  ...makeFish(mutantNames, 'mutant', {
    weight: 28,
    coinMin: 760,
    coinMax: 1280,
    contribution: 620,
    difficulty: 76,
    prefix: 'mutant',
    reveal: '不像鱼，更像从怪海里伸出的答案。',
  }),
];

export const hiddenKings: Fish[] = [
  {
    id: 'abyss-crown',
    name: '渊冠王',
    rarity: 'king',
    baseWeight: 38,
    coinMin: 1200,
    coinMax: 2200,
    contribution: 1600,
    difficulty: 86,
    silhouette: '巨大的冠状黑影压住了整片海。',
    reveal: '今日隐藏鱼王现身：渊冠王。它的影子比船还长。',
  },
  {
    id: 'silent-emperor',
    name: '寂潮帝鱼',
    rarity: 'king',
    baseWeight: 41,
    coinMin: 1400,
    coinMax: 2400,
    contribution: 1800,
    difficulty: 90,
    silhouette: '海面突然无声，只有鱼线在慢慢下沉。',
    reveal: '寂潮帝鱼被拉出海面，所有浪声都慢了半拍。',
  },
  {
    id: 'red-moon-lord',
    name: '赤月海主',
    rarity: 'king',
    baseWeight: 45,
    coinMin: 1600,
    coinMax: 2800,
    contribution: 2200,
    difficulty: 94,
    silhouette: '一轮暗红色圆影从海底升起。',
    reveal: '赤月海主撞破浪峰，像把夜色撕开了口子。',
  },
];

export const anomalies: Anomaly[] = [
  { id: 'none', name: '海况平稳', tone: 'normal', description: '海风正常，水下却仍然有东西在等。' },
  { id: 'black-tide', name: '黑潮来袭', tone: 'black', description: '黑潮贴着船底经过，鱼线传来沉重回响。' },
  { id: 'blood-moon', name: '血月降临', tone: 'red', description: '远处的月色泛红，水花像被点亮。' },
  { id: 'mist', name: '深海迷雾', tone: 'mist', description: '雾气压低了海面，浮标忽远忽近。' },
  { id: 'hum', name: '诡异低鸣', tone: 'violet', description: '船舷下传来低鸣，像有什么在回应鱼钩。' },
  { id: 'quiet', name: '海面突然安静', tone: 'quiet', description: '浪声消失了几秒，鱼线自己绷直。' },
];

export const seaZones: SeaZone[] = [
  { id: 'normal', name: '普通海域', staminaCost: 1, danger: 0, mood: '浪光轻晃，适合再来一杆。' },
  { id: 'black', name: '黑潮海域', staminaCost: 2, danger: 10, mood: '黑色水带从船下穿过，浮标在里面若隐若现。' },
  { id: 'rift', name: '深海裂谷', staminaCost: 3, danger: 15, mood: '海底裂谷像一条看不见尽头的缝。' },
  { id: 'moon', name: '血月海域', staminaCost: 3, danger: 18, mood: '红色月影落在海面，水下躁动得厉害。' },
];

export const failureMessages = [
  '刚刚那东西……不一般。',
  '它还在下面。',
  '你似乎错过了什么。',
  '海面恢复了平静。',
  '鱼线松开的瞬间，船底传来一声闷响。',
];

export const broadcastSeeds = [
  '天河区玩家钓起了今日第一条深海异种！',
  '海珠区区服发现黑潮异常！',
  '番禺区玩家征服了今日隐藏鱼王！',
  '越秀区玩家在深海裂谷拉出发光鱼影！',
  '白云区区服今日积分突然暴涨！',
];
