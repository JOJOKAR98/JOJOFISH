import { anomalies, fishPool, hiddenKings, provinces, rods } from '../data/gameData';
import type { Anomaly, Fish, PlayerState, Rod, SeaZone } from '../types';

export const todayKey = () => {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export const getDailyKing = () => {
  const key = todayKey().replace(/-/g, '');
  const index = Number(key) % hiddenKings.length;
  return hiddenKings[index];
};

export const createDefaultPlayer = (): PlayerState => ({
  coins: 180,
  stamina: 8,
  province: '天河区',
  ownedRodIds: ['basic'],
  equippedRodId: 'basic',
  dailyLuckDate: '',
  provinceContribution: 0,
  totalCasts: 0,
  newbieWins: 0,
});

export const getEquippedRod = (player: PlayerState): Rod => {
  return rods.find((rod) => rod.id === player.equippedRodId) ?? rods[0];
};

export const getLuck = (player: PlayerState) => {
  const rod = getEquippedRod(player);
  const daily = player.dailyLuckDate === todayKey() ? 12 : 0;
  return rod.luck + daily;
};

export const maybeAnomaly = (zone: SeaZone): Anomaly => {
  const base = 0.18 + zone.danger / 120;
  if (Math.random() > base) return anomalies[0];
  return anomalies[randomInt(1, anomalies.length - 1)];
};

export const pickFish = (player: PlayerState, zone: SeaZone, anomaly: Anomaly): Fish => {
  const luck = getLuck(player);
  const anomalyBoost = anomaly.id === 'none' ? 0 : 1;
  const zoneBoost = zone.danger / 12;
  const dailyKing = getDailyKing();
  const candidates = [
    ...fishPool.map((fish) => {
      const rarityBoost =
        fish.rarity === 'common'
          ? 80
          : fish.rarity === 'rare'
            ? 10 + luck * 0.7 + anomalyBoost * 8 + zoneBoost
            : fish.rarity === 'legendary'
              ? 4.6 + luck * 0.42 + anomalyBoost * 5.8 + zoneBoost
              : fish.rarity === 'epic'
                ? 2.4 + luck * 0.28 + anomalyBoost * 4.6 + zoneBoost
                : 0.75 + luck * 0.12 + anomalyBoost * 2.8 + zoneBoost * 0.7;
      return { fish, weight: rarityBoost };
    }),
    {
      fish: dailyKing,
      weight: 0.55 + luck * 0.035 + anomalyBoost * 0.8 + zoneBoost * 0.16,
    },
  ];

  const total = candidates.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of candidates) {
    roll -= item.weight;
    if (roll <= 0) return item.fish;
  }
  return fishPool[0];
};

export const createProvinceScores = (playerProvince: string, playerContribution: number) => {
  const scores = provinces.map((province, index) => ({
    province,
    score:
      9200 -
      index * 610 +
      randomInt(-220, 360) +
      (province === playerProvince ? playerContribution : 0),
  }));

  return scores.sort((a, b) => b.score - a.score);
};

export const getProvinceRank = (scores: ReturnType<typeof createProvinceScores>, province: string) => {
  return scores.findIndex((item) => item.province === province) + 1;
};
