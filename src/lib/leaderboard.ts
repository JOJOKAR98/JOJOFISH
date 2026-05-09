import { provinces } from '../data/gameData';
import type { Fish } from '../types';
import { todayKey } from './game';

export type DistrictScore = {
  province: string;
  score: number;
};

type CatchPayload = {
  playerId: string;
  province: string;
  fishId: string;
  fishName: string;
  rarity: Fish['rarity'];
  weight: number;
  score: number;
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isOnlineLeaderboardEnabled = () => Boolean(supabaseUrl && supabaseAnonKey);

const supabaseFetch = async (path: string, init?: RequestInit) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Online leaderboard is not configured');
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
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
  const scoreDate = todayKey();
  const query = new URLSearchParams({
    select: 'province,score',
    score_date: `eq.${scoreDate}`,
    order: 'score.desc',
  });
  const response = await supabaseFetch(`/rest/v1/district_scores?${query.toString()}`);
  const rows = (await response.json()) as DistrictScore[];
  return normalizeDistrictScores(rows);
};

export const recordCatchOnline = async (payload: CatchPayload) => {
  await supabaseFetch('/rest/v1/rpc/record_catch', {
    method: 'POST',
    body: JSON.stringify({
      p_score_date: todayKey(),
      p_player_id: payload.playerId,
      p_province: payload.province,
      p_fish_id: payload.fishId,
      p_fish_name: payload.fishName,
      p_rarity: payload.rarity,
      p_weight: payload.weight,
      p_score: payload.score,
    }),
  });
};
