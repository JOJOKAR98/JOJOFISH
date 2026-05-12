import type { FishRecord, PlayerState } from '../types';

export type PlayerSave = {
  player: PlayerState;
  codex: Record<string, FishRecord>;
  updatedAt?: string;
};

const apiBase = (import.meta.env.VITE_LEADERBOARD_API_URL as string | undefined) || '/api';

const normalizePlayerId = (playerId: string) => playerId.trim().slice(0, 32);

const apiFetch = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${apiBase.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Player storage request failed: ${response.status}`);
  }

  return response;
};

export const fetchPlayerSave = async (playerId: string) => {
  const normalizedPlayerId = normalizePlayerId(playerId);
  if (!normalizedPlayerId) return null;

  const response = await apiFetch(`/players/${encodeURIComponent(normalizedPlayerId)}/save`);
  return (await response.json()) as PlayerSave | null;
};

export const savePlayerSave = async (playerId: string, save: PlayerSave) => {
  const normalizedPlayerId = normalizePlayerId(playerId);
  if (!normalizedPlayerId) return;

  await apiFetch(`/players/${encodeURIComponent(normalizedPlayerId)}/save`, {
    method: 'PUT',
    body: JSON.stringify(save),
  });
};
