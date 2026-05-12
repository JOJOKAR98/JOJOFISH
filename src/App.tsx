import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { BatteryCharging, Coins, Compass, LockKeyhole, MapPin, Trophy, UserRound, Users } from 'lucide-react';
import { anomalies, baits, characters, failureMessages, fishPool, hiddenKings, provinces, rods, seaZones } from './data/gameData';
import {
  clamp,
  createDefaultPlayer,
  getEquippedBait,
  getEquippedCharacter,
  getEquippedRod,
  getLuck,
  maybeAnomaly,
  pickFish,
  randomInt,
  todayKey,
} from './lib/game';
import {
  fetchBroadcasts,
  fetchDistrictScores,
  fetchOnlineStatus,
  fetchPlayerRankRows,
  isOnlineLeaderboardEnabled,
  recordCatchOnline,
  type BroadcastItem,
  type DistrictScore,
  type PlayerRankRow,
} from './lib/leaderboard';
import { fetchPlayerSave, savePlayerSave } from './lib/playerStorage';
import type { Anomaly, Bait, Fish, FishRecord, FishingCharacter, Phase, PlayerState, ResultState, Rod, SeaZone } from './types';
import packageJson from '../package.json';

const SAVE_KEY = 'deep-sea-province-fishing-save-v2';
const CODEX_KEY = 'deep-sea-fish-codex-v1';
const APP_VERSION = packageJson.version;

type Sheet = 'shopRod' | 'shopBait' | 'character' | 'rankDistrict' | 'rankPlayer' | 'zone' | 'district' | 'codex' | null;
type PlayerRankMode = 'dailyWeight' | 'dailyCoins' | 'totalCasts' | 'totalCoins';
type TugFeedback = 'soft' | 'bite' | 'hit' | 'miss';

type ZoneUnlock = {
  unlocked: boolean;
  label: string;
};

const shouldBroadcastFish = (rarity: Fish['rarity']) => ['legendary', 'epic', 'mutant', 'king'].includes(rarity);

const allFish = [...fishPool, ...hiddenKings];

const getZoneUnlocks = (player: PlayerState, codex: Record<string, FishRecord>): Record<string, ZoneUnlock> => {
  const discovered = Object.keys(codex).length;
  const rareOrAbove = Object.keys(codex).filter((id) => {
    const fish = allFish.find((item) => item.id === id);
    return fish ? fish.rarity !== 'common' : false;
  }).length;
  const legendaryOrAbove = Object.keys(codex).filter((id) => {
    const fish = allFish.find((item) => item.id === id);
    return fish ? ['legendary', 'epic', 'mutant', 'king'].includes(fish.rarity) : false;
  }).length;

  return {
    normal: { unlocked: true, label: "\u9ed8\u8ba4\u5f00\u653e" },
    black: {
      unlocked: player.totalCasts >= 10 && discovered >= 3,
      label: "\u9700\u603b\u9493\u9c7c10\u6746 + \u56fe\u92743\u79cd",
    },
    rift: {
      unlocked: player.totalCasts >= 30 && discovered >= 8 && rareOrAbove >= 2,
      label: "\u9700\u603b\u9493\u9c7c30\u6746 + \u56fe\u92748\u79cd + \u7a00\u67092\u79cd",
    },
    moon: {
      unlocked: player.totalCasts >= 60 && player.totalWeight >= 500 && legendaryOrAbove >= 1,
      label: "\u9700\u603b\u9493\u9c7c60\u6746 + \u603b\u91cd500kg + \u4f20\u8bf41\u79cd",
    },
  };
};

const MAX_STAMINA = 100;
const STAMINA_RESTORE_MS = 60000;
const STAMINA_RESTORE_AMOUNT = 5;
const LUCK_AD_COOLDOWN_MS = 60 * 60 * 1000;

const recoverStamina = (player: PlayerState): PlayerState => {
  const now = Date.now();
  const elapsedTicks = Math.floor((now - (player.lastStaminaAt || now)) / STAMINA_RESTORE_MS);
  const today = todayKey();
  const resetStats = player.statsDate !== today;
  const nextStamina = Math.min(MAX_STAMINA, player.stamina + elapsedTicks * STAMINA_RESTORE_AMOUNT);
  const nextLastStaminaAt = elapsedTicks > 0 ? now : player.lastStaminaAt || now;
  if (!resetStats && nextStamina === player.stamina && nextLastStaminaAt === player.lastStaminaAt) {
    return player;
  }
  return {
    ...player,
    dailyCasts: resetStats ? 0 : player.dailyCasts,
    dailyWeight: resetStats ? 0 : player.dailyWeight,
    dailyCoins: resetStats ? 0 : player.dailyCoins,
    statsDate: today,
    stamina: nextStamina,
    lastStaminaAt: nextLastStaminaAt,
  };
};

const formatStaminaCountdown = (player: PlayerState, now: number) => {
  if (player.stamina >= MAX_STAMINA) return "\u5df2\u6ee1";
  const elapsed = Math.max(0, now - (player.lastStaminaAt || now));
  const remainingMs = STAMINA_RESTORE_MS - (elapsed % STAMINA_RESTORE_MS);
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const formatCooldown = (ms: number) => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const districtCenters = [
  { name: '越秀区', lat: 23.1291, lng: 113.2644 },
  { name: '海珠区', lat: 23.0833, lng: 113.3172 },
  { name: '荔湾区', lat: 23.1259, lng: 113.2442 },
  { name: '天河区', lat: 23.1246, lng: 113.3616 },
  { name: '白云区', lat: 23.1579, lng: 113.2732 },
  { name: '黄埔区', lat: 23.1814, lng: 113.4806 },
  { name: '番禺区', lat: 22.9376, lng: 113.3842 },
  { name: '花都区', lat: 23.4037, lng: 113.2202 },
  { name: '南沙区', lat: 22.8016, lng: 113.5252 },
  { name: '从化区', lat: 23.5489, lng: 113.5865 },
  { name: '增城区', lat: 23.2611, lng: 113.8109 },
];

const distanceKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const radius = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
};

const inferGuangzhouDistrict = (lat: number, lng: number) => {
  return districtCenters
    .map((district) => ({
      ...district,
      distance: distanceKm(lat, lng, district.lat, district.lng),
    }))
    .sort((a, b) => a.distance - b.distance)[0];
};

const seaClassByTone: Record<string, string> = {
  normal: 'sea-scene',
  black: 'sea-black',
  red: 'sea-red',
  mist: 'sea-mist',
  violet: 'sea-violet',
  quiet: 'sea-quiet',
};

const seaClassByZone: Record<string, string> = {
  normal: 'sea-zone-normal',
  black: 'sea-zone-black',
  rift: 'sea-zone-rift',
  moon: 'sea-zone-moon',
};

const normalizePlayer = (player: Partial<PlayerState>): PlayerState => {
  const loaded = { ...createDefaultPlayer(), ...player };
  const normalized = provinces.includes(loaded.province) ? loaded : { ...loaded, province: provinces[0] };
  return recoverStamina(normalized);
};

const loadPlayer = (): PlayerState => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? normalizePlayer(JSON.parse(raw)) : createDefaultPlayer();
  } catch {
    return createDefaultPlayer();
  }
};

const loadCodex = (): Record<string, FishRecord> => {
  try {
    const raw = localStorage.getItem(CODEX_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const rarityLabel: Record<Fish['rarity'], string> = {
  common: '普通鱼',
  rare: '稀有鱼',
  legendary: '传说鱼',
  epic: '史诗鱼',
  mutant: '深海异种',
  king: '隐藏鱼王',
};

const resultLine = (fish: Fish) => {
  if (fish.catchType === 'junk') return '这也能钓上来？';
  if (fish.catchType === 'chest') return '捞到宝箱了！';
  if (fish.rarity === 'king') return '海底有什么东西醒了……';
  if (fish.rarity === 'rare' || fish.rarity === 'legendary' || fish.rarity === 'epic' || fish.rarity === 'mutant') return '出货了！';
  return '\u606d\u559c\u4f60';
};

const requiredHitsByRarity: Record<Fish['rarity'], number> = {
  common: 3,
  rare: 4,
  legendary: 5,
  epic: 6,
  mutant: 7,
  king: 8,
};

const getRequiredHits = (fish: Fish | null) => {
  if (!fish) return 3;
  if (fish.catchType === 'junk') return 2;
  if (fish.catchType === 'chest') return Math.min(7, 2 + (fish.rewardTier ?? 1));
  return requiredHitsByRarity[fish.rarity];
};

const baseProgressGainByRarity: Record<Fish['rarity'], number> = {
  common: 38,
  rare: 30,
  legendary: 24,
  epic: 20,
  mutant: 17,
  king: 15,
};

const getGearControl = (rod: Rod, bait: Bait, character: FishingCharacter) => {
  return rod.difficulty * 0.45 + rod.tolerance * 0.3 + bait.rareBoost * 0.35 + character.focus * 0.85;
};

const getWindowDistance = (value: number, hitWindow: { min: number; max: number }) => {
  if (value < hitWindow.min) return hitWindow.min - value;
  if (value > hitWindow.max) return value - hitWindow.max;
  return 0;
};

const getWindowAccuracy = (value: number, hitWindow: { min: number; max: number }) => {
  const center = (hitWindow.min + hitWindow.max) / 2;
  const halfWidth = Math.max(1, (hitWindow.max - hitWindow.min) / 2);
  return clamp(1 - Math.abs(value - center) / halfWidth, 0, 1);
};

const getProgressGain = (
  fish: Fish,
  accuracy: number,
  rod: Rod,
  bait: Bait,
  character: FishingCharacter,
  zone: SeaZone,
) => {
  const gearControl = getGearControl(rod, bait, character);
  const difficultyPenalty = fish.difficulty * 0.08 + zone.danger * 0.12;
  const accuracyScale = 0.78 + accuracy * 0.48;
  return clamp((baseProgressGainByRarity[fish.rarity] + gearControl * 0.42 - difficultyPenalty) * accuracyScale, 8, 46);
};

const pickChestRewardBait = (tier: number) => {
  const candidates = baits.filter((bait) => bait.price > 0 && bait.rareBoost <= tier + 4);
  if (candidates.length === 0) return null;
  const minIndex = Math.max(0, Math.min(candidates.length - 1, tier - 2));
  const maxIndex = Math.min(candidates.length - 1, tier + 2);
  return candidates[randomInt(minIndex, maxIndex)];
};

const getTimeoutGraceProgress = (fish: Fish, rod: Rod, bait: Bait, character: FishingCharacter) => {
  const gearControl = getGearControl(rod, bait, character);
  const base = fish.rarity === 'common' ? 88 : fish.rarity === 'rare' ? 91 : 94;
  return clamp(base - gearControl * 0.18, 84, 94);
};

const getTimingSpeed = (fish: Fish, rod: Rod, character: FishingCharacter) => {
  const base =
    fish.rarity === 'common'
      ? 130
      : fish.rarity === 'rare'
        ? 152
        : fish.rarity === 'legendary'
          ? 176
          : fish.rarity === 'epic'
            ? 198
            : fish.rarity === 'mutant'
              ? 220
              : 238;
  return base * clamp(1 - character.focus * 0.018 - rod.difficulty * 0.006, 0.86, 1);
};

const fishHash = (name: string) => {
  let value = 0;
  for (const char of name) value = (value * 31 + char.charCodeAt(0)) % 9973;
  return value;
};

const getFishVisual = (fish: Fish) => {
  const idNumber = Number(fish.id.match(/\d+/)?.[0] ?? fish.id.length);
  const hash = fishHash(`${fish.id}-${fish.name}`) + idNumber * 37;
  const rareTone: Record<Fish['rarity'], [string, string, string]> = {
    common: ['#8fd0f1', '#fff2bf', '#2d86ad'],
    rare: ['#8cf0c8', '#dff39a', '#2d86ad'],
    legendary: ['#ffd464', '#fff2bf', '#38bdf8'],
    epic: ['#c4b5fd', '#f0abfc', '#67e8f9'],
    mutant: ['#fb7185', '#f0abfc', '#334155'],
    king: ['#dff39a', '#67e8f9', '#fb7185'],
  };
  const keywordTones: Array<[string, [string, string, string]]> = [
    ['血', ['#fb7185', '#fecaca', '#7f1d1d']],
    ['月', ['#fca5a5', '#fff2bf', '#7c3aed']],
    ['黑', ['#334155', '#94a3b8', '#020617']],
    ['墨', ['#1e293b', '#67e8f9', '#020617']],
    ['金', ['#ffd464', '#fff2bf', '#d97706']],
    ['星', ['#fde68a', '#bae6fd', '#2563eb']],
    ['骨', ['#f5f5dc', '#d6d3d1', '#57534e']],
    ['灯', ['#fde68a', '#67e8f9', '#0f766e']],
    ['雾', ['#e2e8f0', '#bae6fd', '#64748b']],
    ['幽', ['#a7f3d0', '#c4b5fd', '#155e75']],
  ];
  const colors = keywordTones.find(([keyword]) => fish.name.includes(keyword))?.[1] ?? rareTone[fish.rarity];
  const shape = fish.name.includes('鳗') || fish.name.includes('蛇') ? 'eel' : fish.name.includes('龟') || fish.name.includes('蚌') ? 'round' : fish.name.includes('骨') || fish.name.includes('刺') ? 'spike' : (['long', 'round', 'spike', 'wide', 'hook', 'flat'][hash % 6]);
  const pattern = fish.name.includes('星') ? 'star' : fish.name.includes('斑') || hash % 5 === 0 ? 'spots' : fish.name.includes('纹') || hash % 3 === 0 ? 'stripes' : hash % 7 === 0 ? 'mask' : 'fin';
  const feature = fish.rarity === 'king' || fish.name.includes('王') ? 'crown' : fish.name.includes('灯') || fish.name.includes('眼') ? 'light' : fish.name.includes('须') || fish.name.includes('鲶') ? 'whisker' : fish.rarity === 'mutant' ? 'fang' : 'none';

  return {
    hash,
    colors,
    shape,
    pattern,
    feature,
    bodyTop: 18 + (hash % 13),
    bodyWidth: 42 + ((hash >> 2) % 18),
    bodyHeight: 38 + ((hash >> 4) % 20),
    tailTop: 18 + ((hash >> 1) % 16),
    tailWidth: 18 + ((hash >> 3) % 14),
    headWidth: 16 + ((hash >> 5) % 10),
    headHeight: 32 + ((hash >> 6) % 17),
    eyeTop: 30 + ((hash >> 7) % 18),
    markY: 28 + ((hash >> 8) % 28),
    markSize: 5 + ((hash >> 9) % 7),
    dorsalLeft: 32 + ((hash >> 10) % 22),
    tailAngle: -12 + ((hash >> 11) % 25),
    scaleY: 92 + ((hash >> 12) % 20),
  };
};

function App() {
  const [player, setPlayer] = useState<PlayerState>(() => loadPlayer());
  const [phase, setPhase] = useState<Phase>('idle');
  const [selectedZoneId, setSelectedZoneId] = useState('normal');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [anomaly, setAnomaly] = useState<Anomaly>(anomalies[0]);
  const [hookedFish, setHookedFish] = useState<Fish | null>(null);
  const [waitLeft, setWaitLeft] = useState(0);
  const [timeLeft, setTimeLeft] = useState(6);
  const [roundDuration, setRoundDuration] = useState(6);
  const [progress, setProgress] = useState(0);
  const [timingValue, setTimingValue] = useState(0);
  const [timingTarget, setTimingTarget] = useState({ min: 48, max: 52 });
  const [hitCount, setHitCount] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [result, setResult] = useState<ResultState | null>(null);
  const [energyPrompt, setEnergyPrompt] = useState('');
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [activeBroadcast, setActiveBroadcast] = useState<BroadcastItem | null>(null);
  const [toast, setToast] = useState('准备下竿');
  const [pulse, setPulse] = useState(false);
  const [tugFeedback, setTugFeedback] = useState<TugFeedback | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState('定位后加入广州区服 PK');
  const [codex, setCodex] = useState<Record<string, FishRecord>>(() => loadCodex());
  const [playerIdInput, setPlayerIdInput] = useState('');
  const [remoteProvinceScores, setRemoteProvinceScores] = useState<DistrictScore[]>([]);
  const [remotePlayerRows, setRemotePlayerRows] = useState<PlayerRankRow[]>([]);
  const [leaderboardOnline, setLeaderboardOnline] = useState(isOnlineLeaderboardEnabled());
  const [saveOnline, setSaveOnline] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const fightResolvedRef = useRef(false);
  const timingValueRef = useRef(0);
  const timingDirectionRef = useRef(1);
  const lastTimingFrameRef = useRef<number | null>(null);
  const timingLockedRef = useRef(false);
  const lastBroadcastKeyRef = useRef('');
  const tugTimerRef = useRef<number | null>(null);
  const nextAmbientTugAtRef = useRef(0);
  const timeLeftRef = useRef(timeLeft);
  const progressRef = useRef(progress);
  const saveHydratedRef = useRef(false);

  const selectedZone = useMemo(() => seaZones.find((zone) => zone.id === selectedZoneId) ?? seaZones[0], [selectedZoneId]);
  const equippedRod = useMemo(() => getEquippedRod(player), [player]);
  const equippedBait = useMemo(() => getEquippedBait(player), [player]);
  const equippedCharacter = useMemo(() => getEquippedCharacter(player), [player]);
  const luck = useMemo(() => getLuck(player), [player]);
  const zoneUnlocks = useMemo(() => getZoneUnlocks(player, codex), [player, codex]);
  const provinceScores = remoteProvinceScores;
  const sceneClass =
    anomaly.id !== 'none'
      ? seaClassByTone[anomaly.tone] ?? 'sea-scene'
      : seaClassByZone[selectedZone.id] ?? 'sea-zone-normal';
  const castCost = Math.max(1, selectedZone.staminaCost - equippedCharacter.staminaSaver);
  const staminaCountdown = formatStaminaCountdown(player, nowTick);
  const luckAdRemaining = Math.max(0, LUCK_AD_COOLDOWN_MS - (nowTick - (player.lastLuckAdAt || 0)));
  const luckAdReady = luckAdRemaining <= 0;
  const canCast = phase === 'idle' && !!player.playerId;
  const visibleFish = phase === 'reeling' || !!result;

  const setTimingLine = (value: number, direction = timingDirectionRef.current) => {
    const next = clamp(value, 0, 100);
    timingValueRef.current = next;
    timingDirectionRef.current = direction >= 0 ? 1 : -1;
    lastTimingFrameRef.current = performance.now();
    setTimingValue(next);
  };

  const resetTimingChallenge = (fish: Fish) => {
    setTimingTarget(createHitWindow(fish));
    setTimingLine(randomInt(0, 100) > 50 ? 8 : 92, randomInt(0, 1) === 0 ? 1 : -1);
    timingLockedRef.current = false;
  };

  const loadRemoteSave = async (playerId: string, fallbackPlayer?: PlayerState, fallbackCodex?: Record<string, FishRecord>) => {
    const normalizedPlayerId = playerId.trim().slice(0, 32);
    if (!normalizedPlayerId) return false;

    setLoadingSave(true);
    try {
      const remoteSave = await fetchPlayerSave(normalizedPlayerId);
      if (remoteSave?.player) {
        setPlayer(normalizePlayer(remoteSave.player));
        setCodex(remoteSave.codex ?? {});
        setSaveOnline(true);
        return true;
      }

      if (fallbackPlayer) {
        await savePlayerSave(normalizedPlayerId, {
          player: { ...fallbackPlayer, playerId: normalizedPlayerId },
          codex: fallbackCodex ?? {},
        });
      }
      setSaveOnline(true);
      return false;
    } catch {
      setSaveOnline(false);
      return false;
    } finally {
      saveHydratedRef.current = true;
      setPlayerIdInput('');
      setLoadingSave(false);
    }
  };

  const triggerTug = (kind: TugFeedback = 'soft') => {
    if (tugTimerRef.current) {
      window.clearTimeout(tugTimerRef.current);
    }

    setTugFeedback(null);
    window.requestAnimationFrame(() => {
      setTugFeedback(kind);
      const duration = kind === 'bite' ? 230 : kind === 'miss' ? 190 : kind === 'hit' ? 160 : 130;
      tugTimerRef.current = window.setTimeout(() => {
        setTugFeedback(null);
        tugTimerRef.current = null;
      }, duration);
    });

    if ('vibrate' in navigator) {
      const pattern = kind === 'bite' ? [10, 24, 12] : kind === 'miss' ? 16 : kind === 'hit' ? 9 : 6;
      navigator.vibrate(pattern);
    }
  };


  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(player));
  }, [player]);

  useEffect(() => {
    localStorage.setItem(CODEX_KEY, JSON.stringify(codex));
  }, [codex]);

  useEffect(() => {
    if (!player.playerId) return;
    saveHydratedRef.current = false;
    void loadRemoteSave(player.playerId);
  }, []);

  useEffect(() => {
    if (!player.playerId || !saveHydratedRef.current) return undefined;
    const timer = window.setTimeout(() => {
      void savePlayerSave(player.playerId, { player, codex })
        .then(() => setSaveOnline(true))
        .catch(() => setSaveOnline(false));
    }, 450);

    return () => window.clearTimeout(timer);
  }, [player, codex]);

  useEffect(() => {
    let cancelled = false;

    const loadScores = async () => {
      if (!isOnlineLeaderboardEnabled()) {
        setLeaderboardOnline(false);
        setRemoteProvinceScores([]);
        setRemotePlayerRows([]);
        return;
      }

      try {
        const [, scores, rows, nextBroadcasts] = await Promise.all([
          fetchOnlineStatus(),
          fetchDistrictScores(),
          fetchPlayerRankRows(player.playerId),
          fetchBroadcasts(),
        ]);
        if (cancelled) return;
        setRemoteProvinceScores(scores);
        setRemotePlayerRows(rows);
        setBroadcasts(nextBroadcasts);
        setLeaderboardOnline(true);
      } catch {
        if (cancelled) return;
        setRemoteProvinceScores([]);
        setRemotePlayerRows([]);
        setBroadcasts([]);
        setLeaderboardOnline(false);
      }
    };

    void loadScores();
    const timer = window.setInterval(loadScores, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [player.playerId]);

  useEffect(() => {
    if (zoneUnlocks[selectedZoneId]?.unlocked !== false) return;
    setSelectedZoneId('normal');
    setToast("\u6d77\u57df\u672a\u89e3\u9501\uff0c\u5148\u56de\u5230\u666e\u901a\u6d77\u57df");
  }, [selectedZoneId, zoneUnlocks]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
      setPlayer((current) => recoverStamina(current));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    return () => {
      if (tugTimerRef.current) {
        window.clearTimeout(tugTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const next = broadcasts[0];
    if (!next || !shouldBroadcastFish(next.rarity)) return undefined;

    const key = `${next.id}-${next.district}-${next.fish}-${next.rarity}`;
    if (lastBroadcastKeyRef.current === key) return undefined;

    lastBroadcastKeyRef.current = key;
    setActiveBroadcast(next);
    const timer = window.setTimeout(() => setActiveBroadcast(null), 5200);
    return () => window.clearTimeout(timer);
  }, [broadcasts]);

  useEffect(() => {
    if (phase !== 'waiting') return undefined;
    const timer = window.setInterval(() => setWaitLeft((value) => Math.max(0, value - 0.1)), 100);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'waiting' || waitLeft > 0 || !hookedFish) return;
    const duration =
      hookedFish.rarity === 'common'
        ? randomInt(62, 70) / 10
        : hookedFish.rarity === 'rare'
          ? randomInt(66, 76) / 10
          : hookedFish.rarity === 'legendary'
            ? randomInt(70, 82) / 10
            : randomInt(74, 88) / 10;
    setPhase('reeling');
    setRoundDuration(duration);
    setTimeLeft(duration);
    setProgress(0);
    setHitCount(0);
    setMissCount(0);
    timingLockedRef.current = false;
    setTimingLine(randomInt(0, 30), 1);
    setTimingTarget(createHitWindow(hookedFish));
    setToast('来了！');
    setPulse(true);
    triggerTug('bite');
  }, [phase, waitLeft, hookedFish]);

  useEffect(() => {
    if (phase !== 'reeling' || !hookedFish) return undefined;
    const rarityPull =
      hookedFish.rarity === 'king'
        ? 180
        : hookedFish.rarity === 'mutant' || hookedFish.rarity === 'epic'
          ? 120
          : hookedFish.rarity === 'legendary'
            ? 80
            : 0;

    nextAmbientTugAtRef.current = Date.now() + randomInt(420, 900);
    const timer = window.setInterval(() => {
      const now = Date.now();
      if (now < nextAmbientTugAtRef.current || timingLockedRef.current) return;

      triggerTug('soft');
      const tenseBonus = timeLeftRef.current <= 2 || progressRef.current >= 72 ? 140 : 0;
      nextAmbientTugAtRef.current = now + randomInt(760, 1280) - rarityPull - tenseBonus;
    }, 120);

    return () => window.clearInterval(timer);
  }, [phase, hookedFish]);

  useEffect(() => {
    if (phase !== 'reeling' || !hookedFish) return undefined;
    const timer = window.setInterval(() => {
      setTimeLeft((value) => {
        const next = Math.max(0, value - 0.05);
        if (next <= 0) finishFight(false, 'timeout');
        return next;
      });

    }, 50);
    return () => window.clearInterval(timer);
  }, [phase, hookedFish]);

  useEffect(() => {
    if (phase !== 'reeling' || !hookedFish) return undefined;
    let frame = 0;
    lastTimingFrameRef.current = performance.now();

    const tick = (now: number) => {
      if (timingLockedRef.current) {
        lastTimingFrameRef.current = now;
        frame = window.requestAnimationFrame(tick);
        return;
      }

      const previous = lastTimingFrameRef.current ?? now;
      const elapsedSeconds = clamp((now - previous) / 1000, 0, 0.05);
      lastTimingFrameRef.current = now;

      let next = timingValueRef.current + timingDirectionRef.current * getTimingSpeed(hookedFish, equippedRod, equippedCharacter) * elapsedSeconds;
      if (next >= 100) {
        next = 100;
        timingDirectionRef.current = -1;
      } else if (next <= 0) {
        next = 0;
        timingDirectionRef.current = 1;
      }

      timingValueRef.current = next;
      setTimingValue(next);
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [phase, hookedFish, equippedRod, equippedCharacter]);

  useEffect(() => {
    if (!pulse) return undefined;
    const timer = window.setTimeout(() => setPulse(false), 180);
    return () => window.clearTimeout(timer);
  }, [pulse]);

  const castRod = () => {
    if (!canCast) return;
    if (zoneUnlocks[selectedZone.id]?.unlocked === false) {
      setToast(zoneUnlocks[selectedZone.id]?.label ?? "\u8fd9\u7247\u6d77\u57df\u8fd8\u6ca1\u89e3\u9501");
      return;
    }
    if (player.stamina < castCost) {
      setEnergyPrompt(`${selectedZone.name}要 ${castCost} 点体力，补一口气马上继续。`);
      return;
    }
    const nextAnomaly = maybeAnomaly(selectedZone);
    const nextPlayer = { ...player, stamina: player.stamina - castCost, lastStaminaAt: Date.now() };
    const fish = pickFish(nextPlayer, selectedZone, nextAnomaly);
    fightResolvedRef.current = false;
    timingLockedRef.current = false;
    setPlayer(nextPlayer);
    setAnomaly(nextAnomaly);
    setHookedFish(fish);
    const duration =
      fish.rarity === 'common'
        ? randomInt(66, 76) / 10
        : fish.rarity === 'rare'
          ? randomInt(70, 82) / 10
          : fish.rarity === 'legendary'
            ? randomInt(76, 88) / 10
            : randomInt(82, 96) / 10;
    setWaitLeft(0);
    setPhase('reeling');
    setRoundDuration(duration);
    setTimeLeft(duration);
    setResult(null);
    setHitCount(0);
    setMissCount(0);
    timingLockedRef.current = false;
    setTimingLine(randomInt(0, 30), 1);
    setTimingTarget(createHitWindow(fish));
    setProgress(0);
    setToast(fish.rarity === 'king' ? '\u6d77\u5e95\u6709\u4ec0\u4e48\u4e1c\u897f\u9192\u4e86\u2026\u2026' : '\u6765\u4e86\uff01');
    setPulse(true);
    triggerTug('bite');
  };

  const finishFight = (success: boolean, reason?: ResultState['reason']) => {
    if (fightResolvedRef.current || !hookedFish) return;
    fightResolvedRef.current = true;

    let finalSuccess = success;
    if (!success && reason === 'timeout' && progress >= getTimeoutGraceProgress(hookedFish, equippedRod, equippedBait, equippedCharacter)) {
      finalSuccess = true;
    }
    if (!success && player.totalCasts < 5 && player.newbieWins < 4 && hookedFish.rarity !== 'king' && progress > 45) {
      finalSuccess = true;
    }

    const chestTier = hookedFish.catchType === 'chest' ? hookedFish.rewardTier ?? 1 : 0;
    const rewardBait = finalSuccess && chestTier > 0 && Math.random() < 0.18 + chestTier * 0.12 ? pickChestRewardBait(chestTier) : null;
    const coins = finalSuccess ? randomInt(hookedFish.coinMin, hookedFish.coinMax) : 0;
    const weight = Number((hookedFish.baseWeight * (0.82 + Math.random() * 0.55)).toFixed(1));
    const isFishCatch = hookedFish.catchType !== 'junk' && hookedFish.catchType !== 'chest';
    const contribution = finalSuccess && isFishCatch ? hookedFish.contribution + Math.round(weight * 3) : 0;
    const missLine = Math.random() < 0.5 ? '你只差一点点。' : failureMessages[randomInt(0, failureMessages.length - 1)];
    const isNewCatch = finalSuccess && isFishCatch && !codex[hookedFish.id];

    if (finalSuccess && isFishCatch) {
      setCodex((current) => {
        const existing = current[hookedFish.id];
        return {
          ...current,
          [hookedFish.id]: {
            id: hookedFish.id,
            count: (existing?.count ?? 0) + 1,
            maxWeight: Math.max(existing?.maxWeight ?? 0, weight),
            firstDistrict: existing?.firstDistrict ?? player.province,
          },
        };
      });
    }

    setPlayer((current) => ({
      ...current,
      coins: current.coins + coins,
      ownedBaitIds: rewardBait && !current.ownedBaitIds.includes(rewardBait.id) ? [...current.ownedBaitIds, rewardBait.id] : current.ownedBaitIds,
      provinceContribution: current.provinceContribution + contribution,
      dailyCasts: current.dailyCasts + 1,
      dailyWeight: current.dailyWeight + (finalSuccess && isFishCatch ? weight : 0),
      dailyCoins: current.dailyCoins + coins,
      totalCasts: current.totalCasts + 1,
      totalWeight: current.totalWeight + (finalSuccess && isFishCatch ? weight : 0),
      totalCoins: current.totalCoins + coins,
      newbieWins: current.totalCasts < 5 && finalSuccess ? current.newbieWins + 1 : current.newbieWins,
    }));

    if (finalSuccess && contribution > 0) {
      void recordCatchOnline({
        playerId: player.playerId || 'UNKNOWN',
        province: player.province,
        fishId: hookedFish.id,
        fishName: hookedFish.name,
        rarity: hookedFish.rarity,
        weight,
        score: contribution,
        coins,
      })
        .then(() => Promise.all([
          fetchDistrictScores(),
          fetchPlayerRankRows(player.playerId),
          fetchBroadcasts(),
        ]))
        .then(([scores, rows, nextBroadcasts]) => {
          setRemoteProvinceScores(scores);
          setRemotePlayerRows(rows);
          setBroadcasts(nextBroadcasts);
          setLeaderboardOnline(true);
        })
        .catch(() => {
          setLeaderboardOnline(false);
        });
    }

    setResult({
      success: finalSuccess,
      fish: finalSuccess ? hookedFish : undefined,
      reason,
      coins,
      contribution,
      weight: finalSuccess ? weight : undefined,
      message: finalSuccess ? hookedFish.reveal : missLine,
      reviveOffered: false,
      isNew: isNewCatch,
      rewardBaitName: rewardBait?.name,
      rewardKind: hookedFish.catchType ?? 'fish',
    });
    setToast(finalSuccess ? resultLine(hookedFish) : '刚刚那东西……不一般。');
    setPhase('result');
    setHitCount(0);
    setPulse(true);
  };

  const resetRound = () => {
    fightResolvedRef.current = false;
    setPhase('idle');
    setHookedFish(null);
    setResult(null);
    setProgress(0);
    setTimeLeft(6);
    setHitCount(0);
    setMissCount(0);
    timingLockedRef.current = false;
    setTimingLine(0, 1);
    setTimingTarget({ min: 48, max: 52 });
    setToast('再来一杆？');
  };

  const getHitWindowWidth = (fish: Fish | null) => {
    if (!fish) return 5;
    const newbieWiden = player.totalCasts < 8 ? 2 : 0;
    const rodWiden = Math.min(3.5, equippedRod.difficulty * 0.16 + equippedRod.tolerance * 0.1);
    const characterWiden = equippedCharacter.focus * 0.55;
    const widen = newbieWiden + rodWiden + characterWiden;
    if (fish.rarity === 'common') return 15 + widen;
    if (fish.rarity === 'rare') return 12.5 + widen;
    if (fish.rarity === 'legendary') return 10.5 + widen;
    if (fish.rarity === 'epic') return 9 + widen;
    return 8 + widen;
  };

  const createHitWindow = (fish: Fish | null) => {
    const width = getHitWindowWidth(fish);
    const half = width / 2;
    const center = randomInt(Math.ceil(half * 10), Math.floor((100 - half) * 10)) / 10;
    return {
      min: clamp(center - half, 0, 100),
      max: clamp(center + half, 0, 100),
    };
  };

  const tapTiming = () => {
    if (phase !== 'reeling' || fightResolvedRef.current || timingLockedRef.current || !hookedFish) return;
    const currentTimingValue = timingValue;
    const windowDistance = getWindowDistance(currentTimingValue, timingTarget);
    const isHit = currentTimingValue >= timingTarget.min && currentTimingValue <= timingTarget.max;
    const requiredHits = getRequiredHits(hookedFish);

    if (isHit) {
      timingLockedRef.current = true;
      const accuracy = getWindowAccuracy(currentTimingValue, timingTarget);
      const gain = getProgressGain(hookedFish, accuracy, equippedRod, equippedBait, equippedCharacter, selectedZone);
      const nextProgress = clamp(progress + gain, 0, 100);
      const nextHits = nextProgress >= 100 ? requiredHits : Math.min(requiredHits, hitCount + 1);
      flushSync(() => {
        setHitCount(nextHits);
        setMissCount((value) => Math.max(0, value - 1));
        setProgress(nextProgress);
        setToast(nextProgress >= 100 ? '\u62c9\u4e0a\u6765\uff01' : `\u7cbe\u51c6\u6536\u7ebf\uff01+${Math.round(gain)}%`);
        setPulse(true);
      });
      triggerTug('hit');
      if (nextProgress < 100) {
        window.setTimeout(() => {
          if (!fightResolvedRef.current) resetTimingChallenge(hookedFish);
        }, 80);
      } else {
        finishFight(true);
      }
      return;
    }

    const nextMiss = missCount + 1;
    setMissCount(nextMiss);
    setProgress((value) => clamp(value - Math.min(14, 7 + windowDistance * 0.28), 0, 100));
    setToast(`\u672a\u547d\u4e2d ${windowDistance.toFixed(1)}%`);
    setPulse(true);
    triggerTug('miss');
    setTimingTarget(createHitWindow(hookedFish));
    setTimingLine(randomInt(0, 100) > 50 ? 8 : 92, randomInt(0, 1) === 0 ? 1 : -1);
  };

  const buyRod = (rodId: string) => {
    const rod = rods.find((item) => item.id === rodId);
    if (!rod) return;
    if (player.ownedRodIds.includes(rodId)) {
      setPlayer((current) => ({ ...current, equippedRodId: rodId }));
      return;
    }
    if (player.coins < rod.price) return;
    setPlayer((current) => ({
      ...current,
      coins: current.coins - rod.price,
      ownedRodIds: [...current.ownedRodIds, rodId],
      equippedRodId: rodId,
    }));
  };

  const buyBait = (baitId: string) => {
    const bait = baits.find((item) => item.id === baitId);
    if (!bait) return;
    if (player.ownedBaitIds.includes(baitId)) {
      setPlayer((current) => ({ ...current, equippedBaitId: baitId }));
      return;
    }
    if (player.coins < bait.price) return;
    setPlayer((current) => ({
      ...current,
      coins: current.coins - bait.price,
      ownedBaitIds: [...current.ownedBaitIds, baitId],
      equippedBaitId: baitId,
    }));
  };

  const buyCharacter = (characterId: string) => {
    const character = characters.find((item) => item.id === characterId);
    if (!character) return;
    if (player.ownedCharacterIds.includes(characterId)) {
      setPlayer((current) => ({ ...current, equippedCharacterId: characterId }));
      setToast(`${character.name} 已上岸`);
      return;
    }
    if (player.coins < character.price) {
      setToast('金币不够，先多钓几杆');
      return;
    }
    setPlayer((current) => ({
      ...current,
      coins: current.coins - character.price,
      ownedCharacterIds: [...current.ownedCharacterIds, characterId],
      equippedCharacterId: characterId,
    }));
    setToast(`${character.name} 加入队伍`);
  };

  const claimStarter = async () => {
    const playerId = playerIdInput.trim();
    if (!playerId) return;
    const normalizedPlayerId = playerId.slice(0, 32);
    saveHydratedRef.current = false;
    const starterPlayer = {
      ...player,
      playerId: normalizedPlayerId,
      coins: player.starterGiftClaimed ? player.coins : player.coins + 600,
      ownedRodIds: player.ownedRodIds.includes('starter') ? player.ownedRodIds : [...player.ownedRodIds, 'starter'],
      equippedRodId: player.equippedRodId === 'basic' ? 'starter' : player.equippedRodId,
      starterGiftClaimed: true,
    };

    const loadedRemote = await loadRemoteSave(normalizedPlayerId, starterPlayer, codex);
    if (!loadedRemote) {
      setPlayer(starterPlayer);
    }
    setToast('新手礼包到账');
  };

  const watchEnergyAd = () => {
    setPlayer((current) => ({ ...current, stamina: Math.min(MAX_STAMINA, current.stamina + 30), lastStaminaAt: Date.now() }));
    setEnergyPrompt('');
    setToast('体力回来了！');
  };

  const watchLuckAd = () => {
    if (!luckAdReady) return;
    setPlayer((current) => ({ ...current, dailyLuckDate: todayKey(), lastLuckAdAt: Date.now() }));
    setToast('今天手气热起来了');
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage('当前浏览器不支持定位，可手动选择区服');
      return;
    }

    setLocating(true);
    setLocationMessage('正在请求定位授权...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const district = inferGuangzhouDistrict(position.coords.latitude, position.coords.longitude);
        setPlayer((current) => ({ ...current, province: district.name }));
        setLocationMessage(`已定位到 ${district.name} 附近，加入该区 PK`);
        setToast(`${district.name} 上船！`);
        setLocating(false);
      },
      () => {
        setLocationMessage('定位未授权或失败，可手动选择区服');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  };

  return (
    <main className="stardew-ui min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="flex min-h-screen items-center justify-center p-0 sm:p-4">
        <div className={`phone-frame weird-phone relative flex h-[100dvh] w-full max-w-[390px] flex-col overflow-hidden sm:h-[844px] ${sceneClass} ${tugFeedback ? `fish-tug fish-tug-${tugFeedback}` : ''}`}>
          <FishingBackdrop phase={phase} rarity={hookedFish?.rarity} anomaly={anomaly.id !== 'none'} zoneId={selectedZone.id} pulse={pulse} character={equippedCharacter} />

          {!player.playerId && (
            <div className="absolute inset-0 z-[70] flex items-center justify-center bg-slate-950/78 p-6 backdrop-blur">
              <div className="w-full max-w-[320px] rounded-[28px] border border-lime-200/20 bg-black/72 p-5 text-center shadow-glow">
                <div className="text-2xl font-black text-lime-100">{"\u8f93\u5165\u73a9\u5bb6 ID"}</div>
                <p className="mt-2 text-xs leading-5 text-slate-300">{"\u9996\u6b21\u4e0a\u7ebf\u8d60\u9001 600 \u91d1\u5e01\u548c\u65b0\u624b\u6d77\u7aff\uff0c\u8f93\u5165 ID \u540e\u52a0\u5165\u5e7f\u5dde\u533a\u670d PK\u3002"}</p>
                <input
                  value={playerIdInput}
                  onChange={(event) => setPlayerIdInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') claimStarter();
                  }}
                  maxLength={16}
                  placeholder="JOJOFISH01"
                  className="mt-4 h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-center text-lg font-black uppercase text-white outline-none"
                />
                <button onClick={claimStarter} className="mt-3 h-12 w-full rounded-2xl bg-lime-200 text-base font-black text-slate-950 shadow-glow">
                  {loadingSave ? "\u6b63\u5728\u540c\u6b65\u5b58\u6863" : "\u9886\u53d6\u793c\u5305\u5e76\u5f00\u59cb"}
                </button>
              </div>
            </div>
          )}

          <header className="relative z-10 px-4 pt-3">
            <div className="mx-auto flex w-full max-w-[350px] items-start justify-between gap-2">
              <PlayerHud id={player.playerId || '--'} coins={player.coins} character={equippedCharacter} />
              <EnergyHud stamina={player.stamina} countdown={staminaCountdown} />
            </div>
            <div className="pk-card mx-auto mt-2 w-full max-w-[350px] rounded-[18px] px-3 py-2 backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <div className="pk-title flex min-w-0 items-center gap-1.5 text-[13px] font-black text-lime-100">
                  <MapPin size={14} />
                  <span className="truncate">广州区服 PK</span>
                </div>
                <div className="shrink-0 rounded-full bg-amber-200/14 px-2 py-0.5 text-[10px] font-black text-amber-100">运 {luck}</div>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <button
                  onClick={() => setSheet('district')}
                  className="district-select district-picker-button flex h-8 min-w-0 flex-1 items-center justify-between gap-2 rounded-full px-2 text-[12px] font-black outline-none active:scale-[0.99]"
                >
                  <span className="truncate">{player.province}</span>
                  <span className="shrink-0 text-[10px]">全部区</span>
                </button>
                <button
                  onClick={requestLocation}
                  disabled={locating}
                  className="location-button h-8 shrink-0 rounded-full px-3 text-[12px] font-black active:scale-95 disabled:opacity-60"
                >
                  {locating ? '定位中' : '定位'}
                </button>
              </div>
              <div className="mt-1.5 truncate text-[10px] font-bold text-cyan-50/82">{locationMessage} · {anomaly.description} · {saveOnline ? "\u5b58\u6863\u5df2\u5165\u5e93" : "\u672c\u5730\u7f13\u5b58"}</div>
            </div>
          </header>

          <section className="relative z-10 flex flex-1 flex-col px-4 pb-3 pt-1">
            <div className="luck-ad-dock absolute z-30 text-center">
              <button
                onClick={watchLuckAd}
                disabled={!luckAdReady}
                className={`luck-button rounded-full border border-lime-200/40 bg-lime-200/90 px-3 py-1.5 text-[11px] font-black text-slate-950 shadow-glow disabled:bg-white/12 disabled:text-white/45 ${!luckAdReady ? 'luck-button-cooling' : ''}`}
              >
                {luckAdReady ? '幸运广告' : formatCooldown(luckAdRemaining)}
              </button>
            </div>

            <BroadcastBar item={activeBroadcast} />

            <div className="action-stage relative mt-2 flex min-h-0 flex-1 items-center justify-center pb-2">
              {visibleFish && (
                <>
                  <div className={`fish-shadow absolute bottom-[15%] h-16 rounded-[50%] bg-slate-950/80 ${hookedFish?.rarity === 'king' ? 'w-72' : hookedFish?.rarity === 'mutant' ? 'w-56' : 'w-36'}`} />
                  <div className="splash absolute bottom-[27%] h-20 w-20 rounded-full border-4 border-cyan-100/45" />
                </>
              )}
              {phase === 'idle' && (
                <div className="action-stack idle-action-stack z-10 flex flex-col items-center gap-3">
                  <button onClick={castRod} className="cast-button idle-cast-button rounded-full bg-amber-300 px-10 py-5 text-2xl font-black text-slate-950 shadow-gold active:scale-95">
                    {"\u629b\u7aff"}
                  </button>
                  <div className="hidden">
                    <button onClick={() => setSheet('shopRod')} className="gear-shop-button rounded-full bg-black/55 px-3 py-2 text-xs font-black text-lime-100 ring-1 ring-lime-200/25 backdrop-blur">
                      {"\u9c7c\u7aff"}
                    </button>
                    <button onClick={() => setSheet('shopBait')} className="gear-shop-button rounded-full bg-black/55 px-3 py-2 text-xs font-black text-cyan-100 ring-1 ring-cyan-200/25 backdrop-blur">
                      {"\u9c7c\u9975"}
                    </button>
                  </div>
                  <button onClick={() => setSheet('character')} className="hidden">
                    <UserRound size={15} />
                    <span>角色 {equippedCharacter.name}</span>
                  </button>
                </div>
              )}
              {phase === 'reeling' && (
                <div className="action-stack reeling-action-stack z-10 flex w-full flex-col items-center gap-3">
                  <TimingChallenge
                    value={timingValue}
                    hitWindow={timingTarget}
                    hits={hitCount}
                    requiredHits={getRequiredHits(hookedFish)}
                    timeLeft={timeLeft}
                    danger={timeLeft <= 2}
                    onTap={tapTiming}
                  />
                  <button
                    onPointerDown={(event) => {
                      event.preventDefault();
                      tapTiming();
                    }}
                    className="cast-button timing-action-button rounded-full bg-lime-200 px-10 py-5 text-2xl font-black text-slate-950 shadow-glow active:scale-[0.98]"
                  >
                    <span className="timing-action-main">{"\u70b9\u51fb\u6536\u7ebf"}</span>
                    <span className="timing-action-sub">{`\u547d\u4e2d ${hitCount}/${getRequiredHits(hookedFish)} \u00b7 ${Math.round(progress)}%`}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="hidden">
              <div className="min-h-5 text-center text-base font-black text-lime-100 drop-shadow">{toast}</div>
              <Meter label={"\u547d\u4e2d"} value={progress} max={100} compact />
            </div>
          </section>

          <footer className="hud-footer relative z-20 space-y-2 bg-slate-950/50 px-4 pb-4 pt-3 backdrop-blur">
            <div className="app-version-badge" aria-label={`Version ${APP_VERSION}`}>v{APP_VERSION}</div>
            <div className="footer-gear-panel mx-auto grid w-full max-w-[310px] grid-cols-3 gap-1.5">
              <button onClick={() => setSheet('shopBait')} className="gear-shop-button footer-tool-button rounded-full bg-black/55 px-2 py-2 text-[11px] font-black text-cyan-100 ring-1 ring-cyan-200/25 backdrop-blur">
                {"\u9c7c\u9975"}
              </button>
              <button onClick={() => setSheet('character')} className="character-entry-button footer-tool-button rounded-full px-2 py-2 text-[11px] font-black">
                <UserRound size={14} />
                <span>角色</span>
              </button>
              <button onClick={() => setSheet('shopRod')} className="gear-shop-button footer-tool-button rounded-full bg-black/55 px-2 py-2 text-[11px] font-black text-lime-100 ring-1 ring-lime-200/25 backdrop-blur">
                {"\u9c7c\u7aff"}
              </button>
            </div>
            <div className="mx-auto grid w-full max-w-[310px] grid-cols-4 gap-1.5">
              <SmallNav icon={<Trophy size={17} />} label={"\u533a\u57df\u699c"} onClick={() => setSheet('rankDistrict')} />
              <SmallNav icon={<Users size={17} />} label={"\u73a9\u5bb6\u699c"} onClick={() => setSheet('rankPlayer')} />
              <SmallNav icon={<Compass size={17} />} label={"\u6d77\u57df"} onClick={() => setSheet('zone')} />
              <SmallNav icon={<Coins size={17} />} label={"\u56fe\u9274"} onClick={() => setSheet('codex')} />
            </div>
          </footer>

          {result && <ResultCard result={result} onClose={resetRound} />}
          {energyPrompt && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-5 backdrop-blur">
              <div className="w-full rounded-[24px] bg-slate-950 p-5 text-center shadow-glow">
                <h2 className="text-2xl font-black">体力不足</h2>
                <p className="mt-2 text-sm text-slate-300">{energyPrompt}</p>
                <button onClick={watchEnergyAd} className="mt-4 h-14 w-full rounded-2xl bg-cyan-300 font-black text-slate-950">
                  模拟广告恢复体力
                </button>
              </div>
            </div>
          )}
          {sheet && (
            <BottomSheet
              title={sheet === 'shopRod' ? "\u9c7c\u7aff\u5546\u5e97" : sheet === 'shopBait' ? "\u9c7c\u9975\u5546\u5e97" : sheet === 'character' ? "\u9009\u62e9\u89d2\u8272" : sheet === 'rankDistrict' ? "\u533a\u57df\u699c\u5355" : sheet === 'rankPlayer' ? "\u73a9\u5bb6\u699c\u5355" : sheet === 'zone' ? "\u9009\u62e9\u6d77\u57df" : sheet === 'district' ? "\u9009\u62e9\u5e7f\u5dde\u533a\u670d" : "\u9c7c\u7c7b\u56fe\u9274"}
              onClose={() => setSheet(null)}
            >
              {(sheet === 'shopRod' || sheet === 'shopBait') && <Shop mode={sheet === 'shopRod' ? 'rod' : 'bait'} player={player} equippedRodId={player.equippedRodId} equippedBaitId={player.equippedBaitId} onBuyRod={buyRod} onBuyBait={buyBait} />}
              {sheet === 'character' && <CharacterPicker player={player} equippedCharacterId={player.equippedCharacterId} onPick={buyCharacter} />}
              {sheet === 'rankDistrict' && <DistrictRank scores={provinceScores} province={player.province} contribution={player.provinceContribution} leaderboardOnline={leaderboardOnline} />}
              {sheet === 'rankPlayer' && <PlayerRank broadcasts={broadcasts} playerRows={remotePlayerRows} playerId={player.playerId} leaderboardOnline={leaderboardOnline} />}
              {sheet === 'zone' && (
                <ZonePickerUnlocked selectedZoneId={selectedZoneId} unlocks={zoneUnlocks} onPick={(id) => { setSelectedZoneId(id); setSheet(null); }} disabled={!canCast} />
              )}
              {sheet === 'district' && <DistrictPicker province={player.province} onPick={(province) => { setPlayer((current) => ({ ...current, province })); setSheet(null); }} />}
              {sheet === 'codex' && <Codex codex={codex} />}
            </BottomSheet>
          )}
        </div>
      </div>
    </main>
  );
}

function PlayerHud({ id, coins, character }: { id: string; coins: number; character: FishingCharacter }) {
  return (
    <div className="player-hud flex min-w-0 flex-1 items-center gap-2 rounded-[20px] px-2.5 py-2 backdrop-blur">
      <AvatarPortrait character={character} />
      <div className="min-w-0 text-left">
        <div className="truncate text-[13px] font-black leading-4 text-white">{id}</div>
        <div className="mt-0.5 flex items-center gap-1 text-[12px] font-black leading-4 text-amber-100">
          <Coins size={13} />
          <span>{coins}</span>
        </div>
      </div>
    </div>
  );
}

function AvatarPortrait({ character }: { character: FishingCharacter }) {
  return (
    <div className="player-avatar-wrap grid h-10 w-10 shrink-0 place-items-center rounded-2xl">
      <div className="player-avatar-pixel">
        <CharacterPortrait character={character} />
      </div>
    </div>
  );
}

function EnergyHud({ stamina, countdown }: { stamina: number; countdown: string }) {
  return (
    <div className="energy-hud w-[112px] rounded-[18px] px-2.5 py-2 text-right backdrop-blur">
      <div className="flex items-center justify-end gap-1 text-[12px] font-black text-lime-100">
        <BatteryCharging size={14} />
        <span>{stamina}/100</span>
      </div>
      <div className="mt-0.5 text-[10px] font-black text-cyan-50/82">{countdown === "\u5df2\u6ee1" ? "\u4f53\u529b\u5df2\u6ee1" : `${countdown} +5`}</div>
    </div>
  );
}

function BroadcastBar({ item }: { item?: BroadcastItem | null }) {
  if (!item) return null;

  return (
    <div className="broadcast-float pointer-events-none absolute left-1/2 top-1 z-40 w-[calc(100%-40px)] max-w-[338px] -translate-x-1/2 overflow-hidden rounded-[18px] px-3 py-1.5">
      <div className="broadcast-track flex items-center gap-2 whitespace-nowrap">
        <span className="broadcast-badge shrink-0">全服广播</span>
        <BroadcastLine item={item} />
      </div>
    </div>
  );
}

function BroadcastLine({ item }: { item: BroadcastItem }) {
  const fishTone =
    item.rarity === 'king'
      ? 'text-rose-200'
      : item.rarity === 'mutant'
        ? 'text-fuchsia-200'
        : item.rarity === 'epic'
          ? 'text-violet-200'
          : 'text-amber-200';

  return (
    <div className="broadcast-line min-w-max text-[11px] font-black leading-5 text-slate-100">
      <span className="text-lime-200">#{item.id}</span>
      <span className="mx-1 text-slate-500">·</span>
      <span className="text-cyan-200">{item.district}</span>
      <span className="mx-1 text-slate-300">{"\u9493\u8d77"}</span>
      <span className={fishTone}>{item.fish}</span>
    </div>
  );
}

function FishingBackdrop({ phase, rarity, anomaly, zoneId, pulse, character }: { phase: Phase; rarity?: Fish['rarity']; anomaly: boolean; zoneId: string; pulse: boolean; character: FishingCharacter }) {
  const bigShadow = rarity === 'king' || rarity === 'mutant';
  const zoneClass = `backdrop-${zoneId}`;

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${zoneClass}`}>
      <div className="pixel-sky-grid absolute inset-0" />
      <div className="pixel-sun absolute right-10 top-16 h-20 w-20" />
      <div className="pixel-hills pixel-hills-back absolute inset-x-[-24px] top-[32%] h-24" />
      <div className="pixel-hills pixel-hills-front absolute inset-x-[-18px] top-[38%] h-24" />
      <div className="pixel-field absolute inset-x-0 top-[42%] h-20" />
      <div className="pixel-reeds pixel-reeds-left absolute left-3 top-[54%] h-24 w-16" />
      <div className="pixel-reeds pixel-reeds-right absolute right-4 top-[56%] h-20 w-16" />
      <div className="abyss-moon absolute right-10 top-20 h-20 w-20 rounded-full" />
      <div className="distant-cloud cloud-a absolute left-8 top-28 h-8 w-24 rounded-full bg-lime-100/12 blur-sm" />
      <div className="distant-cloud cloud-b absolute right-2 top-36 h-7 w-20 rounded-full bg-cyan-100/10 blur-sm" />
      <div className={`distant-island absolute left-[-12px] top-[35%] h-14 w-44 rounded-[50%] ${anomaly ? 'bg-slate-950/40' : 'bg-emerald-950/30'}`} />
      <div className="horizon-line absolute inset-x-0 top-[43%] h-px bg-white/40" />
      <div className="sea-glint sea-glint-a absolute left-8 top-[45%] h-4 w-28" />
      <div className="sea-glint sea-glint-b absolute right-10 top-[49%] h-4 w-24" />
      <div className="sea-surface absolute inset-x-0 top-[43%] h-[34%]" />
      <div className="current-ribbons absolute inset-x-[-30px] top-[48%] h-[26%]" />
      <div className={`wave-layer absolute inset-x-0 top-[48%] h-[30%] opacity-80 ${anomaly ? 'storm-wave' : ''}`} />
      <div className="wave-foam wave-foam-a absolute left-[-20%] top-[54%] h-10 w-[145%]" />
      <div className="wave-foam wave-foam-b absolute left-[-35%] top-[65%] h-10 w-[160%]" />
      <div className={`near-wave near-wave-a absolute inset-x-[-18px] bottom-[218px] h-16 ${anomaly ? 'storm-near-wave' : ''}`} />
      <div className={`near-wave near-wave-b absolute inset-x-[-34px] bottom-[188px] h-20 ${anomaly ? 'storm-near-wave' : ''}`} />
      <div className="sea-sparks absolute inset-x-0 top-[50%] h-[24%]" />
      <div className={`underwater-shadow absolute left-1/2 top-[64%] h-20 -translate-x-1/2 rounded-[50%] bg-slate-950/35 blur-md ${bigShadow ? 'w-72 opacity-80' : 'w-44 opacity-45'} ${phase === 'reeling' ? 'fish-shadow' : ''}`} />
      <div className="boat-rim absolute inset-x-[-20px] bottom-[144px] h-24 rounded-t-[50%] bg-gradient-to-b from-stone-700 via-stone-950 to-slate-950 shadow-2xl" />
      <FishingGear active={phase === 'reeling'} biting={phase !== 'idle'} pulse={pulse} />
      <div className="boat-highlight absolute inset-x-8 bottom-[207px] h-2 rounded-full bg-lime-100/20" />
      <PixelAngler character={character} casting={phase !== 'idle' || pulse} />
    </div>
  );
}

function PixelAngler({ character, casting }: { character: FishingCharacter; casting: boolean }) {
  return (
    <div
      className={`pixel-angler absolute left-8 bottom-[194px] ${casting ? 'pixel-angler-casting' : ''}`}
      style={{
        '--skin': character.palette.skin,
        '--hair': character.palette.hair,
        '--hat': character.palette.hat,
        '--shirt': character.palette.shirt,
        '--pants': character.palette.pants,
      } as React.CSSProperties}
      aria-hidden="true"
    >
      <div className="angler-shadow" />
      <div className="angler-leg angler-leg-a" />
      <div className="angler-leg angler-leg-b" />
      <div className="angler-body" />
      <div className="angler-head" />
      <div className="angler-hair" />
      <div className="angler-hat" />
      <div className="angler-arm angler-arm-back" />
      <div className="angler-arm angler-arm-front" />
      <div className="angler-hand" />
    </div>
  );
}

function FishingGear({ active, biting, pulse }: { active: boolean; biting: boolean; pulse: boolean }) {
  return (
    <svg className="fishing-gear absolute inset-0 h-full w-full" viewBox="0 0 390 844" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="rodGradient" x1="96" y1="604" x2="230" y2="318" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0f172a" />
          <stop offset="0.35" stopColor="#7c4a18" />
          <stop offset="0.76" stopColor="#a16207" />
          <stop offset="1" stopColor="#ecfccb" />
        </linearGradient>
        <filter id="gearGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#bef264" floodOpacity="0.42" />
        </filter>
      </defs>

      <g className={`${pulse ? 'gear-yank' : ''}`}>
        <path className={active ? 'gear-rod gear-rod-active' : 'gear-rod'} d="M96 604 C126 522 169 414 230 318" stroke="url(#rodGradient)" strokeWidth="5.5" strokeLinecap="round" fill="none" filter="url(#gearGlow)" />
        <path d="M78 650 C85 635 93 617 100 599" stroke="#020617" strokeWidth="10" strokeLinecap="round" fill="none" />
        <path d="M70 655 C80 651 91 645 101 637" stroke="#020617" strokeWidth="8" strokeLinecap="round" fill="none" />
        <circle cx="107" cy="609" r="10" fill="rgba(190,242,100,0.58)" stroke="#020617" strokeWidth="4" />
        <circle cx="107" cy="609" r="4" fill="none" stroke="#020617" strokeWidth="3" />
        <path d="M116 607 C126 606 131 611 134 617" stroke="#020617" strokeWidth="4" strokeLinecap="round" fill="none" />
        <circle cx="110" cy="576" r="4.5" fill="none" stroke="#d9f99d" strokeWidth="2.5" />
        <circle cx="143" cy="487" r="4" fill="none" stroke="#d9f99d" strokeWidth="2.5" />
        <circle cx="184" cy="392" r="3.5" fill="none" stroke="#d9f99d" strokeWidth="2.5" />
        <circle cx="230" cy="318" r="4" fill="#ecfccb" filter="url(#gearGlow)" />

        <g className={active ? 'gear-line gear-line-active' : 'gear-line'}>
          <path d="M230 318 C235 388 229 456 216 516" stroke="rgba(255,255,255,0.88)" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M230 318 C235 388 229 456 216 516" stroke="rgba(190,242,100,0.24)" strokeWidth="4" strokeLinecap="round" fill="none" />
          <g className={biting ? 'gear-bobber gear-bobber-bite' : 'gear-bobber'}>
            <circle cx="216" cy="516" r="10" fill="#fb7185" stroke="#ecfccb" strokeWidth="3" filter="url(#gearGlow)" />
            <path d="M207 516 H225" stroke="#ecfccb" strokeWidth="3" strokeLinecap="round" />
          </g>
        </g>
      </g>
    </svg>
  );
}

function BigBubble({ title, detail, danger }: { title: string; detail: string; danger?: boolean }) {
  return (
    <div className={`z-10 rounded-[24px] px-8 py-5 text-center shadow-glow backdrop-blur ${danger ? 'bg-rose-500/78' : 'bg-slate-950/58'}`}>
      <div className="text-4xl font-black">{title}</div>
      <div className="mt-1 text-sm font-bold text-slate-100/85">{detail}</div>
    </div>
  );
}

function TimingChallenge({
  value,
  hitWindow,
  hits,
  requiredHits,
  timeLeft,
  danger,
  onTap,
}: {
  value: number;
  hitWindow: { min: number; max: number };
  hits: number;
  requiredHits: number;
  timeLeft: number;
  danger?: boolean;
  onTap: () => void;
}) {
  const remainingHits = Math.max(0, requiredHits - hits);

  return (
    <div className={`timing-panel strong-panel z-10 w-full max-w-[360px] rounded-[22px] bg-black/65 px-3 py-3 text-center shadow-glow backdrop-blur ${danger ? 'bg-rose-950/88' : ''}`}>
      <div className="text-2xl font-black">{"\u6536\u7ebf\u5224\u5b9a"}</div>
      <div className="mt-1 text-xs font-bold text-amber-100">{"\u7ea2\u767d\u6307\u9488\u8fdb\u5165\u9ec4\u8272\u547d\u4e2d\u69fd\u65f6\u70b9\u51fb"}</div>
      <div className="timing-hit-counter mt-2 grid grid-cols-2 gap-2">
        <span>{`\u547d\u4e2d ${hits}/${requiredHits}`}</span>
        <span>{remainingHits > 0 ? `\u8fd8\u5dee ${remainingHits} \u6b21` : "\u53ef\u4ee5\u6536\u6746"}</span>
      </div>
      <div className="mt-3 flex justify-center gap-1.5">
        {Array.from({ length: requiredHits }).map((_, index) => (
          <span key={index} className={`h-3 w-7 rounded-full ${index < hits ? 'bg-amber-300 shadow-gold' : 'bg-white/16'}`} />
        ))}
      </div>
      <button
        type="button"
        onPointerDown={(event) => {
          event.preventDefault();
          onTap();
        }}
        className="timing-lane relative mt-3 h-16 w-full overflow-hidden rounded-[14px] text-left active:scale-[0.99]"
      >
        <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/25" />
        <div
          className="timing-target absolute top-1/2 h-12 -translate-y-1/2 rounded-[10px]"
          style={{
            left: `${hitWindow.min}%`,
            width: `${hitWindow.max - hitWindow.min}%`,
          }}
        >
          <span className="timing-target-label absolute inset-0 flex items-center justify-center text-[11px] font-black tracking-[0.2em]">HIT</span>
        </div>
        <div className="timing-needle absolute top-0 h-full" style={{ left: `${value}%`, transform: 'translateX(-50%)' }}>
          <span className="absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 bg-rose-500" />
          <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white" />
          <span className="timing-needle-cap timing-needle-cap-top" />
          <span className="timing-needle-cap timing-needle-cap-bottom" />
        </div>
      </button>
      <div className="mt-2 text-base font-black text-amber-100">{timeLeft.toFixed(1)}s</div>
    </div>
  );
}

function Meter({ label, value, max, danger, zones, compact }: { label: string; value: number; max: number; danger?: boolean; zones?: boolean; compact?: boolean }) {
  const percent = clamp((value / max) * 100, 0, 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-black text-slate-200">
        <span>{label}</span>
        <span className={danger ? 'text-rose-200' : 'text-white'}>{Math.round(percent)}%</span>
      </div>
      <div className={`relative ${compact ? 'h-3' : 'h-5'} overflow-hidden rounded-full bg-slate-900 ring-1 ring-white/10`}>
        {zones && (
          <>
            <div className="absolute left-[18%] top-0 h-full w-[70%] bg-emerald-300/20" />
            <div className="absolute right-0 top-0 h-full w-[10%] bg-rose-400/35" />
          </>
        )}
        <div className={`relative h-full rounded-full transition-all ${danger ? 'bg-rose-400' : 'bg-lime-200'}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function SmallNav({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="small-nav flex h-9 items-center justify-center gap-1 rounded-xl bg-white/10 text-xs font-black text-white active:scale-95">
      {icon}
      {label}
    </button>
  );
}

function ResultCard({ result, onClose }: { result: ResultState; onClose: () => void }) {
  return (
    <div onClick={onClose} className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/38 px-4 backdrop-blur-[1px]">
      <div className="result-panel strong-panel relative max-h-[calc(100%-170px)] w-full max-w-[326px] overflow-y-auto rounded-[24px] p-4 text-center shadow-glow backdrop-blur">
        {result.success && result.fish ? (
          <>
            {result.isNew && <span className="absolute left-3 top-3 z-10 rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-black text-white shadow-gold">NEW</span>}
            <div className="mx-auto w-fit rounded-full bg-lime-200 px-3 py-1 text-xs font-black text-slate-950 shadow-glow">{resultLine(result.fish)}</div>
            <div className="relative">
              <PrizeFish fish={result.fish} />
            </div>
            <div className="mt-2 text-xs font-black tracking-wide text-cyan-100">{rarityLabel[result.fish.rarity]}</div>
            <div className="mt-1 text-2xl font-black leading-tight text-white drop-shadow">{result.fish.name}</div>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <div className="rounded-[18px] border border-cyan-200/25 bg-cyan-200/15 px-2 py-2.5">
                <div className="text-[11px] font-black text-cyan-100">{result.rewardKind === 'fish' || !result.rewardKind ? "\u91cd\u91cf" : "打捞物"}</div>
                <div className="mt-0.5 text-2xl font-black text-white">{result.weight}<span className="ml-1 text-sm text-cyan-100">kg</span></div>
              </div>
              <div className="rounded-[18px] border border-amber-200/30 bg-amber-200/20 px-2 py-2.5">
                <div className="text-[11px] font-black text-amber-100">{"\u91d1\u5e01"}</div>
                <div className="coin-burst mt-0.5 text-2xl font-black text-amber-100">+{result.coins}</div>
              </div>
            </div>
            {result.rewardBaitName && <div className="mt-2 rounded-[14px] bg-lime-200/20 px-2 py-1.5 text-[12px] font-black text-lime-100">额外获得：{result.rewardBaitName}</div>}
            <div className="mt-2 text-[11px] text-slate-300">{"\u5730\u533a\u8d21\u732e +"}{result.contribution}</div>
            <p className="mt-1.5 text-[11px] leading-4 text-slate-400">{result.message}</p>
          </>
        ) : (
          <>
            <div className="text-2xl font-black text-rose-100">{"\u5dee\u4e00\u70b9\uff01"}</div>
            <div className="mx-auto mt-4 h-16 w-72 rounded-[50%] bg-black/80 fish-shadow" />
            <p className="mt-4 text-base font-black text-white">{"\u521a\u521a\u90a3\u4e1c\u897f\u2026\u2026\u4e0d\u4e00\u822c\u3002"}</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">{result.message}</p>
            <p className="mt-1 text-xs text-cyan-100">{"\u5b83\u8fd8\u5728\u4e0b\u9762\u3002"}</p>
          </>
        )}
        <div className="mt-3 border-t border-white/10 pt-2 text-[10px] font-bold text-slate-400">{"\u70b9\u51fb\u4efb\u610f\u4f4d\u7f6e\u7ee7\u7eed"}</div>
      </div>
    </div>
  );
}
function PrizeFish({ fish }: { fish: Fish }) {
  const rareGlow = fish.rarity === 'king' || fish.rarity === 'rare' || fish.rarity === 'mutant';

  return (
    <div className={`prize-fish-wrap relative mx-auto mt-4 flex h-32 w-full items-center justify-center overflow-hidden rounded-[26px] border border-white/10 bg-white/10 ${rareGlow ? 'shadow-gold' : ''}`}>
      <div className="absolute inset-x-8 bottom-4 h-8 rounded-full bg-cyan-100/10 blur-md" />
      {fish.catchType === 'chest' ? <PixelChest fish={fish} /> : fish.catchType === 'junk' ? <PixelJunk fish={fish} /> : <PixelFish fish={fish} size="large" />}
      <div className="absolute bottom-2 text-xs font-black text-white/70">{"\u9493\u4e0a\u6765\u4e86\uff01"}</div>
    </div>
  );
}

function PixelChest({ fish }: { fish: Fish }) {
  return <div className={`pixel-chest pixel-chest-${fish.chestQuality ?? 'wood'}`} aria-label={fish.name}><span /><i /></div>;
}

function PixelJunk({ fish }: { fish: Fish }) {
  const kind = fish.id.includes('tire') ? 'tire' : fish.id.includes('seaweed') ? 'seaweed' : fish.id.includes('boot') ? 'boot' : 'can';
  return <div className={`pixel-junk pixel-junk-${kind}`} aria-label={fish.name}><span /><i /><b /></div>;
}

function PixelFish({ fish, size = 'small', hidden }: { fish: Fish; size?: 'small' | 'large'; hidden?: boolean }) {
  const visual = getFishVisual(fish);
  const style = {
    '--fish-main': visual.colors[0],
    '--fish-mid': visual.colors[1],
    '--fish-dark': visual.colors[2],
    '--fish-spot-x': `${18 + (visual.hash % 38)}%`,
    '--fish-body-top': `${visual.bodyTop}%`,
    '--fish-body-width': `${visual.bodyWidth}%`,
    '--fish-body-height': `${visual.bodyHeight}%`,
    '--fish-tail-top': `${visual.tailTop}%`,
    '--fish-tail-width': `${visual.tailWidth}%`,
    '--fish-head-width': `${visual.headWidth}%`,
    '--fish-head-height': `${visual.headHeight}%`,
    '--fish-eye-top': `${visual.eyeTop}%`,
    '--fish-mark-y': `${visual.markY}%`,
    '--fish-mark-size': `${visual.markSize}%`,
    '--fish-dorsal-left': `${visual.dorsalLeft}%`,
    '--fish-tail-angle': `${visual.tailAngle}deg`,
    '--fish-scale-y': `${visual.scaleY / 100}`,
  } as React.CSSProperties;

  return (
    <div
      className={`pixel-fish pixel-fish-${size} fish-shape-${visual.shape} fish-pattern-${visual.pattern} fish-feature-${visual.feature} ${hidden ? 'pixel-fish-hidden' : ''}`}
      style={style}
      aria-label={fish.name}
    >
      <span className="pf-tail" />
      <span className="pf-body" />
      <span className="pf-head" />
      <span className="pf-eye" />
      <span className="pf-fin pf-fin-top" />
      <span className="pf-fin pf-fin-bottom" />
      <span className="pf-mark pf-mark-a" />
      <span className="pf-mark pf-mark-b" />
      <span className="pf-mark pf-mark-c" />
      <span className="pf-feature" />
    </div>
  );
}

function BottomSheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-end bg-slate-950/55 backdrop-blur-sm">
      <div className="bottom-sheet-panel max-h-[72%] w-full overflow-y-auto rounded-t-[30px] bg-slate-950 p-4 shadow-glow">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-black">{title}</h2>
          <button onClick={onClose} className="rounded-full bg-white/10 px-4 py-2 text-sm font-black">关闭</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Shop({ mode, player, equippedRodId, equippedBaitId, onBuyRod, onBuyBait }: { mode: 'rod' | 'bait'; player: PlayerState; equippedRodId: string; equippedBaitId: string; onBuyRod: (id: string) => void; onBuyBait: (id: string) => void }) {
  return (
    <div className="space-y-3">
      {mode === 'rod' ? (
        <div className="space-y-2">
          {rods.map((rod) => {
            const owned = player.ownedRodIds.includes(rod.id);
            const equipped = equippedRodId === rod.id;
            const locked = !owned;
            return (
              <button key={rod.id} onClick={() => onBuyRod(rod.id)} className={`shop-item w-full rounded-2xl border p-3 text-left ${locked ? 'shop-locked' : ''} ${equipped ? 'shop-equipped border-amber-200 bg-amber-300/20' : 'border-white/10 bg-white/10'}`}>
                <div className="flex items-center justify-between gap-2 text-base font-black">
                  <span className="flex min-w-0 items-center gap-2">
                    {locked && <LockKeyhole className="shop-lock-icon shrink-0" size={15} />}
                    <span className="truncate">{rod.name}</span>
                  </span>
                  <span className="shrink-0">{equipped ? "\u4f7f\u7528\u4e2d" : owned ? "\u88c5\u5907" : `${rod.price}\u91d1\u5e01`}</span>
                </div>
                <div className="mt-1 text-xs text-slate-300">{"\u5e78\u8fd0"} +{rod.luck} {"\u5bb9\u9519"} +{rod.tolerance} {"\u624b\u611f"} +{rod.difficulty}</div>
                {locked && <div className="mt-2 text-[11px] font-black opacity-80">解锁后可装备</div>}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {baits.map((bait) => {
            const owned = player.ownedBaitIds.includes(bait.id);
            const equipped = equippedBaitId === bait.id;
            const locked = !owned;
            return (
              <button key={bait.id} onClick={() => onBuyBait(bait.id)} className={`shop-item w-full rounded-2xl border p-3 text-left ${locked ? 'shop-locked' : ''} ${equipped ? 'shop-equipped border-cyan-200 bg-cyan-300/20' : 'border-white/10 bg-white/10'}`}>
                <div className="flex items-center justify-between gap-2 text-base font-black">
                  <span className="flex min-w-0 items-center gap-2">
                    {locked && <LockKeyhole className="shop-lock-icon shrink-0" size={15} />}
                    <span className="truncate">{bait.name}</span>
                  </span>
                  <span className="shrink-0">{equipped ? "\u4f7f\u7528\u4e2d" : owned ? "\u4f7f\u7528" : `${bait.price}\u91d1\u5e01`}</span>
                </div>
                <div className="mt-1 text-xs text-slate-300">{"\u5e78\u8fd0"} +{bait.luck} {"\u51fa\u8d27\u611f"} +{bait.rareBoost} ? {bait.description}</div>
                {locked && <div className="mt-2 text-[11px] font-black opacity-80">解锁后可使用</div>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CharacterPicker({ player, equippedCharacterId, onPick }: { player: PlayerState; equippedCharacterId: string; onPick: (id: string) => void }) {
  return (
    <div className="character-grid grid grid-cols-2 gap-2">
      {characters.map((character) => {
        const owned = player.ownedCharacterIds.includes(character.id);
        const equipped = equippedCharacterId === character.id;
        return (
          <button
            key={character.id}
            onClick={() => onPick(character.id)}
            className={`character-card rounded-2xl border p-3 text-left ${equipped ? 'character-card-active border-amber-200 bg-amber-300/20' : owned ? 'bg-white/10' : 'bg-black/35'}`}
          >
            <div className="flex items-start gap-2">
              <CharacterPortrait character={character} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black">{character.name}</div>
                <div className="mt-0.5 truncate text-[10px] font-bold opacity-75">{character.title}</div>
                <div className="mt-1 text-[11px] font-black">
                  {equipped ? '使用中' : owned ? '换上' : `${character.price}金币`}
                </div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[10px] font-black">
              <span>运 +{character.luck}</span>
              <span>稳 +{character.focus}</span>
              <span>省 {character.staminaSaver}</span>
            </div>
            <p className="mt-2 text-[11px] leading-4 opacity-75">{character.description}</p>
          </button>
        );
      })}
    </div>
  );
}

function CharacterPortrait({ character }: { character: FishingCharacter }) {
  return (
    <div
      className="character-portrait relative shrink-0"
      style={{
        '--skin': character.palette.skin,
        '--hair': character.palette.hair,
        '--hat': character.palette.hat,
        '--shirt': character.palette.shirt,
        '--pants': character.palette.pants,
      } as React.CSSProperties}
    >
      <span className="portrait-leg portrait-leg-a" />
      <span className="portrait-leg portrait-leg-b" />
      <span className="portrait-body" />
      <span className="portrait-head" />
      <span className="portrait-hair" />
      <span className="portrait-hat" />
    </div>
  );
}

function DistrictRank({ scores, province, contribution, leaderboardOnline }: { scores: DistrictScore[]; province: string; contribution: number; leaderboardOnline: boolean }) {
  return (
    <div className="space-y-3">
      <div className={`rounded-2xl px-3 py-2 text-[11px] font-black ${leaderboardOnline ? 'bg-lime-200/15 text-lime-100' : 'bg-amber-200/12 text-amber-100'}`}>
        {leaderboardOnline ? "\u8054\u7f51\u699c\u5355\u5df2\u540c\u6b65" : "\u8054\u7f51\u699c\u5355\u672a\u8fde\u63a5"}
      </div>
      <div className="space-y-2">
        {leaderboardOnline && scores.length > 0 ? (
          scores.map((item, index) => (
            <div key={item.province} className={`rank-row flex justify-between rounded-2xl px-3 py-2 text-sm font-bold ${item.province === province ? 'rank-row-active bg-amber-300/20 text-amber-100' : 'bg-white/10'}`}>
              <span>{index + 1}. {item.province}</span>
              <span>{item.score}</span>
            </div>
          ))
        ) : (
          <div className="rank-row rounded-2xl bg-white/10 px-3 py-3 text-sm font-bold text-slate-300">{"\u6682\u65e0\u8054\u7f51\u533a\u57df\u699c\u6570\u636e"}</div>
        )}
      </div>
      <div className="rank-note rounded-2xl bg-cyan-300/12 p-3 text-xs text-cyan-50">{"\u4f60\u4e3a"} {province} {"\u8d21\u732e"} {contribution} {"\u5206"}</div>
    </div>
  );
}

function PlayerRank({ broadcasts, playerRows, playerId, leaderboardOnline }: { broadcasts: BroadcastItem[]; playerRows: PlayerRankRow[]; playerId: string; leaderboardOnline: boolean }) {
  const [mode, setMode] = useState<PlayerRankMode>('dailyWeight');
  const configs: Array<{ mode: PlayerRankMode; label: string; unit: string; getValue: (row: PlayerRankRow) => number }> = [
    { mode: 'dailyWeight', label: "\u6bcf\u65e5\u91cd\u91cf", unit: 'kg', getValue: (row) => row.dailyWeight },
    { mode: 'dailyCoins', label: "\u6bcf\u65e5\u91d1\u5e01", unit: "\u91d1\u5e01", getValue: (row) => row.dailyCoins ?? row.dailyScore ?? 0 },
    { mode: 'totalCasts', label: "\u603b\u9493\u9c7c\u6570", unit: "\u6761", getValue: (row) => row.totalCasts },
    { mode: 'totalCoins', label: "\u603b\u91d1\u5e01", unit: "\u91d1\u5e01", getValue: (row) => row.totalCoins ?? row.dailyScore ?? 0 },
  ];
  const active = configs.find((config) => config.mode === mode) ?? configs[0];
  const sortedRows = [...playerRows]
    .sort((a, b) => active.getValue(b) - active.getValue(a))
    .slice(0, 8);

  return (
    <div className="space-y-3">
      <div className={`rounded-2xl px-3 py-2 text-[11px] font-black ${leaderboardOnline ? 'bg-lime-200/15 text-lime-100' : 'bg-amber-200/12 text-amber-100'}`}>
        {leaderboardOnline ? "\u8054\u7f51\u699c\u5355\u5df2\u540c\u6b65" : "\u8054\u7f51\u699c\u5355\u672a\u8fde\u63a5"}
      </div>
      <div className="rank-tabs grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-1">
        {configs.map((config) => (
          <button
            key={config.mode}
            onClick={() => setMode(config.mode)}
            className={`rounded-xl py-2 text-xs font-black ${mode === config.mode ? 'bg-lime-200 text-slate-950' : 'text-slate-200'}`}
          >
            {config.label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {leaderboardOnline && sortedRows.length > 0 ? (
          sortedRows.map((item, index) => {
            const value = active.getValue(item);
            const formattedValue = active.unit === 'kg' ? value.toFixed(1) : Math.round(value).toString();
            return (
              <div key={`${active.mode}-${item.id}`} className={`rank-row rounded-2xl px-3 py-2 text-xs font-bold ${item.id === playerId ? 'rank-row-active bg-lime-200/20 text-lime-100' : 'bg-white/10 text-slate-200'}`}>
                <div className="flex justify-between text-sm font-black">
                  <span>{index + 1}. {item.id}</span>
                  <span>{formattedValue}{active.unit}</span>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-1 text-[11px] text-slate-300">
                  <span>{"\u4eca\u65e5"} {item.dailyWeight.toFixed(1)}kg</span><span>{"\u4eca\u65e5"} {Math.round(item.dailyCoins ?? item.dailyScore ?? 0)} {"\u91d1\u5e01"}</span>
                  <span>{"\u603b"} {item.totalCasts} {"\u6761"}</span><span>{"\u603b"} {Math.round(item.totalCoins ?? item.dailyScore ?? 0)} {"\u91d1\u5e01"}</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rank-row rounded-2xl bg-white/10 px-3 py-3 text-sm font-bold text-slate-300">{"\u6682\u65e0\u8054\u7f51\u73a9\u5bb6\u699c\u6570\u636e"}</div>
        )}
      </div>
      <div className="space-y-2">
        {leaderboardOnline && broadcasts.length > 0 ? (
          broadcasts.slice(0, 3).map((item, index) => (
            <div key={`${item.id}-${item.fish}-${index}`} className="rank-row rounded-2xl bg-white/10 px-3 py-2 text-xs text-slate-200">
              <BroadcastLine item={item} />
            </div>
          ))
        ) : (
          <div className="rank-row rounded-2xl bg-white/10 px-3 py-3 text-sm font-bold text-slate-300">{"\u6682\u65e0\u8054\u7f51\u5e7f\u64ad"}</div>
        )}
      </div>
    </div>
  );
}

function Codex({ codex }: { codex: Record<string, FishRecord> }) {
  const categories: Array<{ key: Fish['rarity']; label: string; fish: Fish[] }> = [
    { key: 'common', label: '普通', fish: fishPool.filter((fish) => fish.rarity === 'common') },
    { key: 'rare', label: '稀有', fish: fishPool.filter((fish) => fish.rarity === 'rare') },
    { key: 'legendary', label: '传说', fish: fishPool.filter((fish) => fish.rarity === 'legendary') },
    { key: 'epic', label: '史诗', fish: fishPool.filter((fish) => fish.rarity === 'epic') },
    { key: 'mutant', label: '异种', fish: fishPool.filter((fish) => fish.rarity === 'mutant') },
    { key: 'king', label: '鱼王', fish: hiddenKings },
  ];
  const [activeRarity, setActiveRarity] = useState<Fish['rarity']>('common');
  const fishList = [...fishPool, ...hiddenKings];
  const activeCategory = categories.find((category) => category.key === activeRarity) ?? categories[0];
  const unlocked = fishList.filter((fish) => codex[fish.id]).length;
  const categoryUnlocked = activeCategory.fish.filter((fish) => codex[fish.id]).length;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-lime-200/10 p-3 text-sm font-bold text-lime-50">
        已发现 {unlocked}/{fishList.length} 种怪鱼
      </div>
      <div className="grid grid-cols-3 gap-2">
        {categories.map((category) => {
          const discovered = category.fish.filter((fish) => codex[fish.id]).length;
          return (
            <button
              key={category.key}
              onClick={() => setActiveRarity(category.key)}
              className={`rounded-2xl px-3 py-2 text-xs font-black ${
                activeRarity === category.key ? 'bg-lime-200 text-slate-950 shadow-glow' : 'bg-white/10 text-slate-100'
              }`}
            >
              {category.label}
              <span className="ml-1 opacity-70">
                {discovered}/{category.fish.length}
              </span>
            </button>
          );
        })}
      </div>
      <div className="rounded-2xl border border-lime-200/15 bg-black/30 px-3 py-2 text-sm font-bold text-lime-50">
        {activeCategory.label}图鉴：{categoryUnlocked}/{activeCategory.fish.length}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {activeCategory.fish.map((fish) => {
          const record = codex[fish.id];
          const discovered = !!record;
          return (
            <div
              key={fish.id}
              className={`rounded-2xl border p-3 ${
                discovered ? 'border-lime-200/30 bg-white/10' : 'border-white/10 bg-black/35'
              }`}
            >
              <div className="flex h-20 items-center justify-center rounded-xl bg-slate-950/60">
                {discovered ? <MiniFish fish={fish} /> : <PixelFish fish={fish} hidden />}
              </div>
              <div className="mt-2 text-sm font-black">{discovered ? fish.name : '未知黑影'}</div>
              <div className="text-xs text-lime-100/70">{discovered ? rarityLabel[fish.rarity] : '还在水下'}</div>
              {discovered ? (
                <div className="mt-2 space-y-1 text-[11px] text-slate-200/80">
                  <div>钓获 {record.count} 次</div>
                  <div>最大 {record.maxWeight.toFixed(1)} kg</div>
                  <div>首次 {record.firstDistrict}</div>
                </div>
              ) : (
                <div className="mt-2 text-[11px] leading-5 text-slate-400">钓到后解锁名字、重量和区服记录</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniFish({ fish }: { fish: Fish }) {
  return <PixelFish fish={fish} />;
}

function ZonePicker({ selectedZoneId, unlocks, onPick, disabled }: { selectedZoneId: string; unlocks: Record<string, ZoneUnlock>; onPick: (id: string) => void; disabled: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {seaZones.map((zone) => (
        <button
          key={zone.id}
          disabled={disabled}
          onClick={() => onPick(zone.id)}
          className={`rounded-2xl border p-3 text-left disabled:opacity-50 ${selectedZoneId === zone.id ? 'border-cyan-200 bg-cyan-300/20' : 'border-white/10 bg-white/10'}`}
        >
          <div className="font-black">{zone.name}</div>
          <div className="mt-1 text-xs text-slate-300">消耗 {zone.staminaCost} 体力</div>
        </button>
      ))}
    </div>
  );
}

function ZonePickerUnlocked({ selectedZoneId, unlocks, onPick, disabled }: { selectedZoneId: string; unlocks: Record<string, ZoneUnlock>; onPick: (id: string) => void; disabled: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {seaZones.map((zone) => {
        const unlock = unlocks[zone.id] ?? { unlocked: true, label: "\u5df2\u5f00\u653e" };
        const locked = !unlock.unlocked;
        return (
          <button
            key={zone.id}
            disabled={disabled || locked}
            onClick={() => onPick(zone.id)}
            className={`rounded-2xl border p-3 text-left disabled:opacity-50 ${selectedZoneId === zone.id ? 'border-cyan-200 bg-cyan-300/20' : locked ? 'border-white/10 bg-black/35' : 'border-white/10 bg-white/10'}`}
          >
            <div className="flex items-center justify-between gap-2 font-black">
              <span>{zone.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] ${locked ? 'bg-slate-700 text-slate-300' : 'bg-lime-200 text-slate-950'}`}>
                {locked ? "\u672a\u89e3\u9501" : "\u5df2\u89e3\u9501"}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-300">{"\u6d88\u8017"} {zone.staminaCost} {"\u4f53\u529b"}</div>
            <div className="mt-2 text-[11px] leading-4 text-slate-400">{unlock.label}</div>
          </button>
        );
      })}
    </div>
  );
}

function DistrictPicker({ province, onPick }: { province: string; onPick: (province: string) => void }) {
  return (
    <div className="district-picker-grid grid grid-cols-2 gap-2">
      {provinces.map((district) => (
        <button
          key={district}
          onClick={() => onPick(district)}
          className={`district-option rounded-2xl border p-3 text-left ${province === district ? 'district-option-active border-amber-200 bg-amber-300/20' : 'border-white/10 bg-white/10'}`}
        >
          <div className="font-black">{district}</div>
          <div className="mt-1 text-[11px] text-slate-300">{province === district ? "\u5f53\u524d\u533a\u670d" : "\u70b9\u51fb\u5207\u6362"}</div>
        </button>
      ))}
    </div>
  );
}

export default App;
