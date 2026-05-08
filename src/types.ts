export type Rarity = 'common' | 'rare' | 'legendary' | 'epic' | 'mutant' | 'king';

export type Phase = 'idle' | 'waiting' | 'reeling' | 'result';

export type DirectionEventType = 'left' | 'right' | 'dive';

export type FailureReason = 'escaped' | 'snapped' | 'timeout';

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
  coins: number;
  stamina: number;
  province: string;
  ownedRodIds: string[];
  equippedRodId: string;
  dailyLuckDate: string;
  provinceContribution: number;
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
}
