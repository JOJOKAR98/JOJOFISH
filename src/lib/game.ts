import { anomalies, baits, characters, fishPool, hiddenKings, junkItems, provinces, rods, treasureChests } from '../data/gameData';
import type { Anomaly, Bait, Fish, FishingCharacter, PlayerState, Rod, SeaZone } from '../types';

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
  playerId: '',
  coins: 180,
  stamina: 100,
  province: provinces[0],
  ownedRodIds: ['basic'],
  equippedRodId: 'basic',
  ownedBaitIds: ['plain'],
  equippedBaitId: 'plain',
  ownedCharacterIds: ['brook-mallow'],
  equippedCharacterId: 'brook-mallow',
  avatarId: 'boy-river',
  dailyLuckDate: '',
  lastLuckAdAt: 0,
  provinceContribution: 0,
  dailyCasts: 0,
  dailyWeight: 0,
  dailyCoins: 0,
  totalWeight: 0,
  totalCoins: 0,
  statsDate: todayKey(),
  lastStaminaAt: Date.now(),
  starterGiftClaimed: false,
  totalCasts: 0,
  newbieWins: 0,
});

export const getEquippedRod = (player: PlayerState): Rod => {
  return rods.find((rod) => rod.id === player.equippedRodId) ?? rods[0];
};

export const getEquippedBait = (player: PlayerState): Bait => {
  return baits.find((bait) => bait.id === player.equippedBaitId) ?? baits[0];
};

export const getEquippedCharacter = (player: PlayerState): FishingCharacter => {
  return characters.find((character) => character.id === player.equippedCharacterId) ?? characters[0];
};

export const getLuck = (player: PlayerState) => {
  const rod = getEquippedRod(player);
  const bait = getEquippedBait(player);
  const character = getEquippedCharacter(player);
  const daily = Date.now() - (player.lastLuckAdAt || 0) < 60 * 60 * 1000 ? 12 : 0;
  return rod.luck + bait.luck + character.luck + daily;
};

export const maybeAnomaly = (zone: SeaZone): Anomaly => {
  const base = 0.18 + zone.danger / 120;
  if (Math.random() > base) return anomalies[0];
  return anomalies[randomInt(1, anomalies.length - 1)];
};

export const pickFish = (player: PlayerState, zone: SeaZone, anomaly: Anomaly): Fish => {
  const luck = getLuck(player);
  const bait = getEquippedBait(player);
  const anomalyBoost = anomaly.id === 'none' ? 0 : 1;
  const zoneBoost = zone.danger / 12;
  const baitBoost = bait.rareBoost;
  const dailyKing = getDailyKing();
  const junkWeight = Math.max(42, 78 - luck * 0.8 - baitBoost * 1.2 + zone.danger * 0.28);
  const chestBase = 170 + luck * 2.4 + baitBoost * 5.5 + anomalyBoost * 64 + zoneBoost * 13;
  const candidates = [
    ...junkItems.map((fish, index) => ({
      fish,
      weight: Math.max(0.8, junkWeight - index * 0.85),
    })),
    ...treasureChests.map((fish) => {
      const tier = fish.rewardTier ?? 1;
      return {
        fish,
        weight: Math.max(0.04, chestBase / (tier * tier * 1.9)),
      };
    }),
    ...fishPool.map((fish) => {
      const rarityBoost =
        fish.rarity === 'common'
          ? Math.max(48, 80 - baitBoost * 2.4 - zoneBoost * 0.8)
          : fish.rarity === 'rare'
            ? 10 + luck * 0.7 + baitBoost * 1.25 + anomalyBoost * 8 + zoneBoost
            : fish.rarity === 'legendary'
              ? 4.6 + luck * 0.42 + baitBoost * 0.7 + anomalyBoost * 5.8 + zoneBoost
              : fish.rarity === 'epic'
                ? 2.4 + luck * 0.28 + baitBoost * 0.44 + anomalyBoost * 4.6 + zoneBoost
                : 0.75 + luck * 0.12 + baitBoost * 0.2 + anomalyBoost * 2.8 + zoneBoost * 0.7;
      return { fish, weight: rarityBoost };
    }),
    {
      fish: dailyKing,
      weight: 0.55 + luck * 0.035 + baitBoost * 0.035 + anomalyBoost * 0.8 + zoneBoost * 0.16,
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
