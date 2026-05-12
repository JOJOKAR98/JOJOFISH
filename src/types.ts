export type Rarity = 'common' | 'rare' | 'legendary' | 'epic' | 'mutant' | 'king';

export type Phase = 'idle' | 'waiting' | 'reeling' | 'result';

export type DirectionEventType = 'left' | 'right' | 'dive';

export type FailureReason = 'escaped' | 'timeout';

export interface Fish {
  id: string;
  name: string;
  rarity: Rarity;
  baseWeight: number;
  coinMin: number;
  coinMax: number;
  contribution: number;
  difficulty: number;
  silhouette: string;
  reveal: string;
}

export interface Rod {
  id: string;
  name: string;
  rarity: string;
  price: number;
  luck: number;
  tolerance: number;
  difficulty: number;
}

export interface Bait {
  id: string;
  name: string;
  price: number;
  luck: number;
  rareBoost: number;
  description: string;
}

export interface FishingCharacter {
  id: string;
  name: string;
  title: string;
  price: number;
  luck: number;
  focus: number;
  staminaSaver: number;
  description: string;
  palette: {
    skin: string;
    hair: string;
    hat: string;
    shirt: string;
    pants: string;
  };
}

export interface SeaZone {
  id: string;
  name: string;
  staminaCost: number;
  danger: number;
  mood: string;
}

export interface Anomaly {
  id: string;
  name: string;
  tone: string;
  description: string;
}

export interface PlayerState {
  playerId: string;
  coins: number;
  stamina: number;
  province: string;
  ownedRodIds: string[];
  equippedRodId: string;
  ownedBaitIds: string[];
  equippedBaitId: string;
  ownedCharacterIds: string[];
  equippedCharacterId: string;
  dailyLuckDate: string;
  provinceContribution: number;
  dailyCasts: number;
  dailyWeight: number;
  dailyCoins: number;
  totalWeight: number;
  totalCoins: number;
  statsDate: string;
  lastStaminaAt: number;
  starterGiftClaimed: boolean;
  totalCasts: number;
  newbieWins: number;
}

export interface ResultState {
  success: boolean;
  fish?: Fish;
  reason?: FailureReason;
  coins: number;
  contribution: number;
  weight?: number;
  message: string;
  reviveOffered: boolean;
  isNew?: boolean;
}
