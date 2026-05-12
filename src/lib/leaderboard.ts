import { provinces } from '../data/gameData';
import type { Fish } from '../types';
import { todayKey } from './game';

export type DistrictScore = {
  province: string;
  score: number;
};

export type PlayerRankRow = {
  id: string;
  rank?: number;
  dailyCasts: number;
  dailyWeight: number;
  dailyScore: number;
  dailyCoins?: number;
  totalCasts: number;
  totalWeight: number;
  totalCoins?: number;
};

export type BroadcastItem = {
  id: string;
  district: string;
  fish: string;
  rarity: Fish['rarity'];
  createdAt?: string;
};

type CatchPayload = {
  playerId: string;
  province: string;
  fishId: string;
  fishName: string;
  rarity: Fish['rarity'];
  weight: number;
  score: number;
  coins: number;
};

const apiBase = (import.meta.env.VITE_LEADERBOARD_API_URL as string | undefined) || '/api';

export const isOnlineLeaderboardEnabled = () => Boolean(apiBase);

const apiFetch = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${apiBase.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Leaderboard request failed: ${response.status}`);
  }

  return response;
};

export const normalizeDistrictScores = (scores: DistrictScore[]) => {
  const scoreMap = new Map(scores.map((item) => [item.province, item.score]));
  return provinces
    .map((province) => ({
      province,
      score: scoreMap.get(province) ?? 0,
    }))
    .sort((a, b) => b.score - a.score);
};

export const fetchDistrictScores = async () => {
  const query = new URLSearchParams({ date: todayKey() });
  const response = await apiFetch(`/leaderboard/districts?${query.toString()}`);
  const rows = (await response.json()) as DistrictScore[];
  return normalizeDistrictScores(rows);
};

export const fetchPlayerRankRows = async (playerId?: string) => {
  const query = new URLSearchParams({ date: todayKey(), limit: '20' });
  if (playerId) query.set('playerId', playerId);
  const response = await apiFetch(`/leaderboard/players?${query.toString()}`);
  return (await response.json()) as PlayerRankRow[];
};

export const fetchBroadcasts = async () => {
  const query = new URLSearchParams({ limit: '10' });
  const response = await apiFetch(`/broadcasts?${query.toString()}`);
  return (await response.json()) as BroadcastItem[];
};

export const fetchOnlineStatus = async () => {
  await apiFetch('/health');
  return true;
};

export const recordCatchOnline = async (payload: CatchPayload) => {
  await apiFetch('/catches', {
    method: 'POST',
    body: JSON.stringify({
      scoreDate: todayKey(),
      playerId: payload.playerId,
      province: payload.province,
      fishId: payload.fishId,
      fishName: payload.fishName,
      rarity: payload.rarity,
      weight: payload.weight,
      score: payload.score,
      coins: payload.coins,
    }),
  });
};
