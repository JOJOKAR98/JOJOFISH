import type { Anomaly, Bait, Fish, FishingCharacter, Rod, SeaZone } from '../types';

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

const legacyCharacters: FishingCharacter[] = [
  {
    id: 'brook-mallow',
    name: '溪桥小满',
    title: '新手钓手',
    price: 0,
    luck: 0,
    focus: 0,
    staminaSaver: 0,
    description: '动作稳，适合刚上岸的第一天。',
    palette: { skin: '#f0b98a', hair: '#5b321e', hat: '#d69742', shirt: '#6aaa4d', pants: '#315d7c' },
  },
  {
    id: 'wheat-chen',
    name: '麦田阿澄',
    title: '清晨收线人',
    price: 240,
    luck: 1,
    focus: 1,
    staminaSaver: 0,
    description: '看水纹很准，偶尔能多等到好鱼。',
    palette: { skin: '#f3c59a', hair: '#6e4328', hat: '#ffd464', shirt: '#8ccf5d', pants: '#7c4626' },
  },
  {
    id: 'oak-lia',
    name: '橡木莉雅',
    title: '林边守漂者',
    price: 520,
    luck: 1,
    focus: 2,
    staminaSaver: 1,
    description: '手腕轻，长时间钓鱼更省体力。',
    palette: { skin: '#eeb17d', hair: '#7a2d22', hat: '#9b6437', shirt: '#3f7f3c', pants: '#4b77b5' },
  },
  {
    id: 'dock-nanfeng',
    name: '码头南风',
    title: '老码头学徒',
    price: 900,
    luck: 2,
    focus: 2,
    staminaSaver: 1,
    description: '熟悉潮声，抛竿节奏更干净。',
    palette: { skin: '#d9966f', hair: '#3f2a1d', hat: '#3c9dc4', shirt: '#fff2bf', pants: '#5d3a22' },
  },
  {
    id: 'rain-jing',
    name: '雨棚阿井',
    title: '雨天钓法师',
    price: 1360,
    luck: 2,
    focus: 3,
    staminaSaver: 1,
    description: '雨声越密，手越不抖。',
    palette: { skin: '#efc097', hair: '#28323a', hat: '#587da1', shirt: '#7ea9df', pants: '#3f2a1d' },
  },
  {
    id: 'glow-muxia',
    name: '萤灯牧夏',
    title: '夜岸寻光者',
    price: 1900,
    luck: 3,
    focus: 3,
    staminaSaver: 2,
    description: '懂得用微光骗出稀有鱼影。',
    palette: { skin: '#f4c99f', hair: '#4a2a1a', hat: '#dff39a', shirt: '#2f9b49', pants: '#315d7c' },
  },
  {
    id: 'barn-qinghe',
    name: '谷仓青禾',
    title: '谷仓冠军',
    price: 2600,
    luck: 3,
    focus: 4,
    staminaSaver: 2,
    description: '力气足，控线时更能稳住节奏。',
    palette: { skin: '#cf865f', hair: '#2b1a12', hat: '#c84b36', shirt: '#f0b45d', pants: '#1f5f7f' },
  },
  {
    id: 'fog-sangyu',
    name: '雾港桑榆',
    title: '雾港领钩人',
    price: 3400,
    luck: 4,
    focus: 4,
    staminaSaver: 3,
    description: '能在雾里分清暗流和大鱼。',
    palette: { skin: '#e8ad84', hair: '#5b321e', hat: '#9aba66', shirt: '#d69b84', pants: '#243f73' },
  },
  {
    id: 'star-luobai',
    name: '星渠洛白',
    title: '星渠记录员',
    price: 4500,
    luck: 5,
    focus: 5,
    staminaSaver: 3,
    description: '会记住每一次鱼群经过的时辰。',
    palette: { skin: '#f1c7a4', hair: '#26343f', hat: '#fff2bf', shirt: '#4b77b5', pants: '#5d3a22' },
  },
  {
    id: 'golden-lanzhou',
    name: '金穗岚舟',
    title: '金穗钓王',
    price: 6200,
    luck: 6,
    focus: 6,
    staminaSaver: 4,
    description: '抛竿像割麦一样利落，专门挑战鱼王。',
    palette: { skin: '#f2b17b', hair: '#6e4328', hat: '#ffd464', shirt: '#c84b36', pants: '#3f7f3c' },
  },
];

export const characters: FishingCharacter[] = [
  { id: 'brook-mallow', name: '\u6eaa\u6865\u963f\u6ee1', title: '\u7537\u00b7\u65b0\u624b\u9493\u624b', avatarKind: 'male', price: 0, luck: 0, focus: 0, staminaSaver: 0, description: '\u52a8\u4f5c\u7a33\uff0c\u9002\u5408\u521a\u4e0a\u5cb8\u7684\u7b2c\u4e00\u5929\u3002', palette: { skin: '#f0b98a', hair: '#5b321e', hat: '#d69742', shirt: '#6aaa4d', pants: '#315d7c' } },
  { id: 'dock-nanfeng', name: '\u7801\u5934\u5357\u98ce', title: '\u7537\u00b7\u8001\u7801\u5934\u5b66\u5f92', avatarKind: 'male', price: 320, luck: 1, focus: 1, staminaSaver: 0, description: '\u719f\u6089\u6f6e\u58f0\uff0c\u62ac\u7aff\u8282\u594f\u66f4\u5e72\u51c0\u3002', palette: { skin: '#d9966f', hair: '#3f2a1d', hat: '#3c9dc4', shirt: '#fff2bf', pants: '#5d3a22' } },
  { id: 'barn-qinghe', name: '\u8c37\u4ed3\u9752\u79be', title: '\u7537\u00b7\u8c37\u4ed3\u51a0\u519b', avatarKind: 'male', price: 780, luck: 2, focus: 2, staminaSaver: 1, description: '\u529b\u6c14\u8db3\uff0c\u63a7\u7ebf\u65f6\u66f4\u80fd\u7a33\u4f4f\u8282\u594f\u3002', palette: { skin: '#cf865f', hair: '#2b1a12', hat: '#c84b36', shirt: '#f0b45d', pants: '#1f5f7f' } },
  { id: 'fog-sangyu', name: '\u96fe\u6e2f\u6851\u6986', title: '\u7537\u00b7\u96fe\u6e2f\u9886\u822a\u5458', avatarKind: 'male', price: 1380, luck: 3, focus: 3, staminaSaver: 2, description: '\u80fd\u5728\u96fe\u91cc\u5206\u6e05\u6697\u6d41\u548c\u5927\u9c7c\u5f71\u3002', palette: { skin: '#e8ad84', hair: '#5b321e', hat: '#9aba66', shirt: '#d69b84', pants: '#243f73' } },
  { id: 'golden-lanzhou', name: '\u91d1\u7a57\u5c9a\u821f', title: '\u7537\u00b7\u91d1\u7a57\u9493\u738b', avatarKind: 'male', price: 2600, luck: 4, focus: 4, staminaSaver: 3, description: '\u629b\u7aff\u50cf\u5272\u9ea6\u4e00\u6837\u5229\u843d\uff0c\u4e13\u95e8\u6311\u6218\u9c7c\u738b\u3002', palette: { skin: '#f2b17b', hair: '#6e4328', hat: '#ffd464', shirt: '#c84b36', pants: '#3f7f3c' } },
  { id: 'wheat-chen', name: '\u9ea6\u7530\u963f\u6f84', title: '\u5973\u00b7\u6e05\u6668\u6536\u7ebf\u4eba', avatarKind: 'female', price: 240, luck: 1, focus: 1, staminaSaver: 0, description: '\u770b\u6c34\u7eb9\u5f88\u51c6\uff0c\u5076\u5c14\u80fd\u591a\u7b49\u5230\u597d\u9c7c\u3002', palette: { skin: '#f3c59a', hair: '#6e4328', hat: '#ffd464', shirt: '#8ccf5d', pants: '#7c4626' } },
  { id: 'oak-lia', name: '\u6a61\u6728\u8389\u96c5', title: '\u5973\u00b7\u6797\u8fb9\u5b88\u6f02\u8005', avatarKind: 'female', price: 620, luck: 1, focus: 2, staminaSaver: 1, description: '\u624b\u8155\u8f7b\uff0c\u957f\u65f6\u95f4\u9493\u9c7c\u66f4\u7701\u4f53\u529b\u3002', palette: { skin: '#eeb17d', hair: '#7a2d22', hat: '#9b6437', shirt: '#3f7f3c', pants: '#4b77b5' } },
  { id: 'rain-jing', name: '\u96e8\u68da\u963f\u4e95', title: '\u5973\u00b7\u96e8\u5929\u9493\u6cd5\u5e08', avatarKind: 'female', price: 1080, luck: 2, focus: 3, staminaSaver: 1, description: '\u96e8\u58f0\u8d8a\u5bc6\uff0c\u624b\u8d8a\u4e0d\u6296\u3002', palette: { skin: '#efc097', hair: '#28323a', hat: '#587da1', shirt: '#7ea9df', pants: '#3f2a1d' } },
  { id: 'glow-muxia', name: '\u8424\u706f\u7267\u590f', title: '\u5973\u00b7\u591c\u5cb8\u5bfb\u5149\u8005', avatarKind: 'female', price: 1760, luck: 3, focus: 3, staminaSaver: 2, description: '\u61c2\u5f97\u7528\u5fae\u5149\u9a97\u51fa\u7a00\u6709\u9c7c\u5f71\u3002', palette: { skin: '#f4c99f', hair: '#4a2a1a', hat: '#dff39a', shirt: '#2f9b49', pants: '#315d7c' } },
  { id: 'star-luobai', name: '\u661f\u6e1a\u6d1b\u767d', title: '\u5973\u00b7\u661f\u6e1a\u8bb0\u5f55\u5458', avatarKind: 'female', price: 2400, luck: 4, focus: 4, staminaSaver: 3, description: '\u4f1a\u8bb0\u4f4f\u6bcf\u4e00\u6b21\u9c7c\u7fa4\u7ecf\u8fc7\u7684\u65f6\u8fb0\u3002', palette: { skin: '#f1c7a4', hair: '#26343f', hat: '#fff2bf', shirt: '#4b77b5', pants: '#5d3a22' } },
  { id: 'avatar-carp', name: '\u9526\u9ca4\u5934\u50cf', title: '\u9c7c\u56fe\u6807\u00b7\u8f6c\u8fd0', avatarKind: 'fish', fishIcon: 'carp', price: 420, luck: 1, focus: 1, staminaSaver: 0, description: '\u628a\u597d\u8fd0\u6302\u5728\u5934\u50cf\u4e0a\uff0c\u8d77\u7801\u770b\u7740\u5f88\u7075\u3002', palette: { skin: '#ffce73', hair: '#b13b2d', hat: '#ffe066', shirt: '#ff7a45', pants: '#2f6d83' } },
  { id: 'avatar-moonfish', name: '\u6708\u5149\u9c7c\u5934\u50cf', title: '\u9c7c\u56fe\u6807\u00b7\u591c\u9493', avatarKind: 'fish', fishIcon: 'moon', price: 860, luck: 2, focus: 2, staminaSaver: 1, description: '\u50cf\u4e00\u7247\u5c0f\u6708\u4eae\u6f02\u5728\u6d77\u9762\u4e0a\u3002', palette: { skin: '#dbeafe', hair: '#60a5fa', hat: '#fef3c7', shirt: '#93c5fd', pants: '#1e3a8a' } },
  { id: 'avatar-goldfish', name: '\u91d1\u5c3e\u9c7c\u5934\u50cf', title: '\u9c7c\u56fe\u6807\u00b7\u8d22\u8fd0', avatarKind: 'fish', fishIcon: 'gold', price: 1280, luck: 3, focus: 2, staminaSaver: 1, description: '\u95ea\u7740\u5c0f\u91d1\u5149\uff0c\u7279\u522b\u9002\u5408\u70b9\u5f00\u5b9d\u7bb1\u3002', palette: { skin: '#ffd464', hair: '#f97316', hat: '#fff2bf', shirt: '#fbbf24', pants: '#92400e' } },
  { id: 'avatar-ghostfish', name: '\u5e7d\u96fe\u9c7c\u5934\u50cf', title: '\u9c7c\u56fe\u6807\u00b7\u602a\u6d77', avatarKind: 'fish', fishIcon: 'ghost', price: 1980, luck: 4, focus: 3, staminaSaver: 2, description: '\u4e0d\u5413\u4eba\uff0c\u4f46\u6c34\u4e0b\u4e1c\u897f\u4f1a\u591a\u770b\u4e00\u773c\u3002', palette: { skin: '#c4b5fd', hair: '#7c3aed', hat: '#e9d5ff', shirt: '#8b5cf6', pants: '#312e81' } },
  { id: 'avatar-kingfish', name: '\u9c7c\u738b\u5934\u50cf', title: '\u9c7c\u56fe\u6807\u00b7\u6df1\u6d77', avatarKind: 'fish', fishIcon: 'king', price: 3200, luck: 5, focus: 4, staminaSaver: 3, description: '\u6d77\u5e95\u6709\u4e1c\u897f\u9192\u4e86\uff0c\u4f60\u5047\u88c5\u5b83\u662f\u597d\u670b\u53cb\u3002', palette: { skin: '#67e8f9', hair: '#0f766e', hat: '#fde68a', shirt: '#14b8a6', pants: '#164e63' } },
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

export const junkItems: Fish[] = [
  {
    id: 'junk-tire',
    name: '\u7834\u8f6e\u80ce',
    rarity: 'common',
    catchType: 'junk',
    baseWeight: 8.8,
    coinMin: 2,
    coinMax: 10,
    contribution: 0,
    difficulty: 18,
    silhouette: '\u6c34\u4e0b\u4e00\u4e2a\u5706\u5708\u6162\u6162\u7ffb\u8fc7\u6765\u3002',
    reveal: '\u4f60\u9493\u8d77\u4e86\u4e00\u4e2a\u7834\u8f6e\u80ce\uff0c\u8239\u4e0a\u7a81\u7136\u5b89\u9759\u4e86\u4e00\u79d2\u3002',
  },
  {
    id: 'junk-seaweed',
    name: '\u7f20\u7ed5\u6d77\u8349',
    rarity: 'common',
    catchType: 'junk',
    baseWeight: 1.2,
    coinMin: 1,
    coinMax: 6,
    contribution: 0,
    difficulty: 12,
    silhouette: '\u4e00\u56e2\u6c34\u8349\u50cf\u9c7c\u5c3e\u4e00\u6837\u6643\u52a8\u3002',
    reveal: '\u4e00\u5927\u56e2\u6d77\u8349\u88ab\u62c9\u4e0a\u6765\uff0c\u91cc\u9762\u4f3c\u4e4e\u8fd8\u85cf\u7740\u58f0\u97f3\u3002',
  },
  {
    id: 'junk-can',
    name: '\u751f\u9508\u7f50\u5934',
    rarity: 'common',
    catchType: 'junk',
    baseWeight: 0.6,
    coinMin: 1,
    coinMax: 8,
    contribution: 0,
    difficulty: 14,
    silhouette: '\u4e00\u70b9\u94c1\u5149\u5728\u6d6a\u4e0b\u95ea\u4e86\u4e00\u4e0b\u3002',
    reveal: '\u751f\u9508\u7f50\u5934\u649e\u5728\u8239\u677f\u4e0a\uff0c\u53d1\u51fa\u5f88\u6709\u8282\u594f\u7684\u54cd\u58f0\u3002',
  },
  {
    id: 'junk-boot',
    name: '\u6ce5\u6c99\u957f\u9774',
    rarity: 'common',
    catchType: 'junk',
    baseWeight: 2.4,
    coinMin: 2,
    coinMax: 12,
    contribution: 0,
    difficulty: 16,
    silhouette: '\u4e00\u53ea\u5947\u602a\u7684\u957f\u5f62\u9ed1\u5f71\u8d34\u7740\u9c7c\u94a9\u6447\u6643\u3002',
    reveal: '\u4e00\u53ea\u6ce5\u6c99\u957f\u9774\u88ab\u62c9\u4e0a\u6765\uff0c\u5b83\u770b\u8d77\u6765\u6bd4\u9c7c\u8fd8\u7d2f\u3002',
  },
];

export const treasureChests: Fish[] = [
  {
    id: 'chest-wood',
    name: '\u6f02\u6d41\u6728\u7bb1',
    rarity: 'rare',
    catchType: 'chest',
    chestQuality: 'wood',
    rewardTier: 1,
    baseWeight: 4.2,
    coinMin: 45,
    coinMax: 95,
    contribution: 0,
    difficulty: 28,
    silhouette: '\u65b9\u65b9\u6b63\u6b63\u7684\u5f71\u5b50\u649e\u5728\u6d6e\u6807\u4e0b\u3002',
    reveal: '\u6728\u7bb1\u54d7\u5566\u4e00\u58f0\u6253\u5f00\uff0c\u91cc\u9762\u6709\u4e9b\u6d77\u6c34\u6ce1\u8fc7\u7684\u5b9d\u8d27\u3002',
  },
  {
    id: 'chest-bronze',
    name: '\u9752\u94dc\u6d77\u7bb1',
    rarity: 'legendary',
    catchType: 'chest',
    chestQuality: 'bronze',
    rewardTier: 2,
    baseWeight: 7.5,
    coinMin: 120,
    coinMax: 240,
    contribution: 0,
    difficulty: 42,
    silhouette: '\u9752\u7eff\u8272\u7684\u6697\u5149\u5728\u6c34\u4e0b\u8f6c\u4e86\u4e00\u5708\u3002',
    reveal: '\u9752\u94dc\u6d77\u7bb1\u6253\u5f00\uff0c\u4e00\u80a1\u51b7\u5149\u4ece\u7bb1\u7f1d\u91cc\u6d8c\u51fa\u6765\u3002',
  },
  {
    id: 'chest-silver',
    name: '\u94f6\u6f6e\u5bc6\u5323',
    rarity: 'legendary',
    catchType: 'chest',
    chestQuality: 'silver',
    rewardTier: 3,
    baseWeight: 10.6,
    coinMin: 260,
    coinMax: 520,
    contribution: 0,
    difficulty: 54,
    silhouette: '\u4e00\u4e2a\u53d1\u4eae\u7684\u5bc6\u5323\u4f3c\u4e4e\u81ea\u5df1\u5728\u4e0a\u6d6e\u3002',
    reveal: '\u94f6\u6f6e\u5bc6\u5323\u5f39\u5f00\uff0c\u6d77\u98ce\u90fd\u88ab\u7167\u4eae\u4e86\u4e00\u4e0b\u3002',
  },
  {
    id: 'chest-gold',
    name: '\u91d1\u9cde\u5b9d\u7bb1',
    rarity: 'epic',
    catchType: 'chest',
    chestQuality: 'gold',
    rewardTier: 4,
    baseWeight: 14.8,
    coinMin: 560,
    coinMax: 980,
    contribution: 0,
    difficulty: 66,
    silhouette: '\u91d1\u8272\u9cde\u5149\u4ece\u6d77\u9762\u4e0b\u4e00\u95ea\u800c\u8fc7\u3002',
    reveal: '\u91d1\u9cde\u5b9d\u7bb1\u6253\u5f00\uff0c\u91d1\u5e01\u548c\u7a00\u6709\u9c7c\u9975\u4e00\u8d77\u6eda\u4e86\u51fa\u6765\u3002',
  },
  {
    id: 'chest-abyss',
    name: '\u6df1\u6d77\u738b\u5323',
    rarity: 'epic',
    catchType: 'chest',
    chestQuality: 'abyss',
    rewardTier: 5,
    baseWeight: 22,
    coinMin: 1100,
    coinMax: 1900,
    contribution: 0,
    difficulty: 78,
    silhouette: '\u6d77\u5e95\u4f3c\u4e4e\u6709\u4e00\u53ea\u5173\u7740\u7684\u773c\u775b\u88ab\u62c9\u4e86\u4e0a\u6765\u3002',
    reveal: '\u6df1\u6d77\u738b\u5323\u5f00\u542f\uff0c\u91cc\u9762\u7684\u5149\u50cf\u4ece\u5f88\u8fdc\u7684\u6d77\u5e95\u7167\u6765\u3002',
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
