import { useEffect, useMemo, useRef, useState } from 'react';
import { BatteryCharging, Coins, Compass, ShoppingBag, Trophy } from 'lucide-react';
import { anomalies, baits, failureMessages, fishPool, hiddenKings, provinces, rods, seaZones } from './data/gameData';
import {
  clamp,
  createDefaultPlayer,
  createProvinceScores,
  getEquippedBait,
  getEquippedRod,
  getLuck,
  getProvinceRank,
  maybeAnomaly,
  pickFish,
  randomInt,
  todayKey,
} from './lib/game';
import {
  fetchDistrictScores,
  isOnlineLeaderboardEnabled,
  recordCatchOnline,
  type DistrictScore,
} from './lib/leaderboard';
import type { Anomaly, Fish, Phase, PlayerState, ResultState } from './types';

const SAVE_KEY = 'deep-sea-province-fishing-save-v2';
const CODEX_KEY = 'deep-sea-fish-codex-v1';

type Sheet = 'shopRod' | 'shopBait' | 'rankDistrict' | 'rankPlayer' | 'zone' | 'codex' | null;

type FishRecord = {
  id: string;
  count: number;
  maxWeight: number;
  firstDistrict: string;
};

type BroadcastItem = {
  id: string;
  district: string;
  fish: string;
  rarity: Fish['rarity'];
};

type ZoneUnlock = {
  unlocked: boolean;
  label: string;
};

const initialBroadcasts: BroadcastItem[] = [
  { id: 'BLACKTIDE', district: provinces[0], fish: '渊冠王', rarity: 'king' },
  { id: 'MOONHOOK', district: provinces[1], fish: '裂谷骨王', rarity: 'epic' },
  { id: 'SEA-009', district: provinces[2], fish: '黑潮巨影', rarity: 'legendary' },
];

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

type PlayerRankRow = {
  id: string;
  dailyCasts: number;
  dailyWeight: number;
  totalCasts: number;
  totalWeight: number;
};

const playerSeeds: PlayerRankRow[] = [];

const recoverStamina = (player: PlayerState): PlayerState => {
  const now = Date.now();
  const elapsedTicks = Math.floor((now - (player.lastStaminaAt || now)) / STAMINA_RESTORE_MS);
  const today = todayKey();
  const resetStats = player.statsDate !== today;
  return {
    ...player,
    dailyCasts: resetStats ? 0 : player.dailyCasts,
    dailyWeight: resetStats ? 0 : player.dailyWeight,
    statsDate: today,
    stamina: Math.min(MAX_STAMINA, player.stamina + elapsedTicks * STAMINA_RESTORE_AMOUNT),
    lastStaminaAt: elapsedTicks > 0 ? now : player.lastStaminaAt || now,
  };
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

const loadPlayer = (): PlayerState => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    const loaded = raw ? { ...createDefaultPlayer(), ...JSON.parse(raw) } : createDefaultPlayer();
    const normalized = provinces.includes(loaded.province) ? loaded : { ...loaded, province: provinces[0] };
    return recoverStamina(normalized);
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

const getRequiredHits = (fish: Fish | null) => (fish ? requiredHitsByRarity[fish.rarity] : 3);

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
  const [tension, setTension] = useState(45);
  const [progress, setProgress] = useState(0);
  const [timingValue, setTimingValue] = useState(0);
  const [timingDirection, setTimingDirection] = useState(1);
  const [hitCount, setHitCount] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [result, setResult] = useState<ResultState | null>(null);
  const [energyPrompt, setEnergyPrompt] = useState('');
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>(initialBroadcasts);
  const [toast, setToast] = useState('准备下竿');
  const [pulse, setPulse] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState('定位后加入广州区服 PK');
  const [codex, setCodex] = useState<Record<string, FishRecord>>(() => loadCodex());
  const [playerIdInput, setPlayerIdInput] = useState('');
  const [remoteProvinceScores, setRemoteProvinceScores] = useState<DistrictScore[]>([]);
  const [leaderboardOnline, setLeaderboardOnline] = useState(isOnlineLeaderboardEnabled());
  const intendedSuccessRef = useRef(true);
  const fightResolvedRef = useRef(false);

  const selectedZone = useMemo(() => seaZones.find((zone) => zone.id === selectedZoneId) ?? seaZones[0], [selectedZoneId]);
  const equippedRod = useMemo(() => getEquippedRod(player), [player]);
  const equippedBait = useMemo(() => getEquippedBait(player), [player]);
  const luck = useMemo(() => getLuck(player), [player]);
  const zoneUnlocks = useMemo(() => getZoneUnlocks(player, codex), [player, codex]);
  const localProvinceScores = useMemo(
    () => createProvinceScores(player.province, player.provinceContribution),
    [player.province, player.provinceContribution, result],
  );
  const provinceScores = remoteProvinceScores.length > 0 ? remoteProvinceScores : localProvinceScores;
  const provinceRank = getProvinceRank(provinceScores, player.province);
  const sceneClass =
    anomaly.id !== 'none'
      ? seaClassByTone[anomaly.tone] ?? 'sea-scene'
      : seaClassByZone[selectedZone.id] ?? 'sea-zone-normal';
  const tensionDanger = tension > 88 + equippedRod.tolerance || tension < 13;
  const canCast = phase === 'idle' && !!player.playerId;
  const visibleFish = phase === 'reeling' || !!result;
  const playerRankRows = useMemo(
    () =>
      [
        ...playerSeeds,
        {
          id: player.playerId || 'YOU',
          dailyCasts: player.dailyCasts,
          dailyWeight: Number(player.dailyWeight.toFixed(1)),
          totalCasts: player.totalCasts,
          totalWeight: Number(player.totalWeight.toFixed(1)),
        },
      ].sort((a, b) => b.dailyWeight - a.dailyWeight),
    [player.playerId, player.dailyCasts, player.dailyWeight, player.totalCasts, player.totalWeight],
  );

  useEffect(() => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(player));
  }, [player]);

  useEffect(() => {
    localStorage.setItem(CODEX_KEY, JSON.stringify(codex));
  }, [codex]);

  useEffect(() => {
    let cancelled = false;

    const loadScores = async () => {
      if (!isOnlineLeaderboardEnabled()) {
        setLeaderboardOnline(false);
        setRemoteProvinceScores([]);
        return;
      }

      try {
        const scores = await fetchDistrictScores();
        if (cancelled) return;
        setRemoteProvinceScores(scores);
        setLeaderboardOnline(true);
      } catch {
        if (cancelled) return;
        setLeaderboardOnline(false);
      }
    };

    void loadScores();
    const timer = window.setInterval(loadScores, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (zoneUnlocks[selectedZoneId]?.unlocked !== false) return;
    setSelectedZoneId('normal');
    setToast("\u6d77\u57df\u672a\u89e3\u9501\uff0c\u5148\u56de\u5230\u666e\u901a\u6d77\u57df");
  }, [selectedZoneId, zoneUnlocks]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPlayer((current) => recoverStamina(current));
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (phase !== 'waiting') return undefined;
    const timer = window.setInterval(() => setWaitLeft((value) => Math.max(0, value - 0.1)), 100);
    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'waiting' || waitLeft > 0 || !hookedFish) return;
    const duration =
      hookedFish.rarity === 'common'
        ? randomInt(50, 58) / 10
        : hookedFish.rarity === 'rare'
          ? randomInt(54, 62) / 10
          : hookedFish.rarity === 'legendary'
            ? randomInt(56, 64) / 10
            : randomInt(58, 66) / 10;
    setPhase('reeling');
    setRoundDuration(duration);
    setTimeLeft(duration);
    setTension(hookedFish.rarity === 'king' ? 58 : 43);
    setProgress(0);
    setHitCount(0);
    setMissCount(0);
    setTimingValue(randomInt(0, 30));
    setTimingDirection(1);
    setToast('来了！');
    setPulse(true);
  }, [phase, waitLeft, hookedFish]);

  useEffect(() => {
    if (phase !== 'reeling' || !hookedFish) return undefined;
    const timer = window.setInterval(() => {
      setTimeLeft((value) => {
        const next = Math.max(0, value - 0.1);
        if (next <= 0) finishFight(false, 'timeout');
        return next;
      });

      setTension((current) => {
        const drift = hookedFish.rarity === 'common' ? -0.12 : hookedFish.rarity === 'rare' ? 0.12 : hookedFish.rarity === 'legendary' ? 0.22 : 0.34;
        return clamp(current + drift + missCount * 0.24, 18, 98 + equippedRod.tolerance);
      });

      setTimingValue((value) => {
        const speed =
          hookedFish.rarity === 'common'
            ? 9.2
            : hookedFish.rarity === 'rare'
              ? 11
              : hookedFish.rarity === 'legendary'
                ? 12.8
                : hookedFish.rarity === 'epic'
                  ? 14
                  : 15.5;
        let next = value + timingDirection * speed;
        if (next >= 100) {
          next = 100;
          setTimingDirection(-1);
        }
        if (next <= 0) {
          next = 0;
          setTimingDirection(1);
        }
        return next;
      });
    }, 100);
    return () => window.clearInterval(timer);
  }, [phase, hookedFish, timingDirection, equippedRod, missCount]);

  useEffect(() => {
    if (!pulse) return undefined;
    const timer = window.setTimeout(() => setPulse(false), 180);
    return () => window.clearTimeout(timer);
  }, [pulse]);

  const rollSuccess = (fish: Fish, nextPlayer: PlayerState) => {
    if (nextPlayer.totalCasts < 5 && nextPlayer.newbieWins < 4 && fish.rarity !== 'king') return true;
    const base = fish.rarity === 'common' ? 0.85 : fish.rarity === 'rare' ? 0.55 : fish.rarity === 'legendary' ? 0.38 : fish.rarity === 'epic' ? 0.26 : 0.2;
    const rodBonus = equippedRod.difficulty * 0.006 + equippedRod.luck * 0.004;
    return Math.random() < clamp(base + rodBonus, 0.12, 0.92);
  };

  const castRod = () => {
    if (!canCast) return;
    if (zoneUnlocks[selectedZone.id]?.unlocked === false) {
      setToast(zoneUnlocks[selectedZone.id]?.label ?? "\u8fd9\u7247\u6d77\u57df\u8fd8\u6ca1\u89e3\u9501");
      return;
    }
    if (player.stamina < selectedZone.staminaCost) {
      setEnergyPrompt(`${selectedZone.name}要 ${selectedZone.staminaCost} 点体力，补一口气马上继续。`);
      return;
    }
    const nextAnomaly = maybeAnomaly(selectedZone);
    const nextPlayer = { ...player, stamina: player.stamina - selectedZone.staminaCost, lastStaminaAt: Date.now() };
    const fish = pickFish(nextPlayer, selectedZone, nextAnomaly);
    intendedSuccessRef.current = rollSuccess(fish, nextPlayer);
    fightResolvedRef.current = false;
    setPlayer(nextPlayer);
    setAnomaly(nextAnomaly);
    setHookedFish(fish);
    const duration =
      fish.rarity === 'common'
        ? randomInt(54, 62) / 10
        : fish.rarity === 'rare'
          ? randomInt(58, 66) / 10
          : fish.rarity === 'legendary'
            ? randomInt(62, 70) / 10
            : randomInt(66, 74) / 10;
    setWaitLeft(0);
    setPhase('reeling');
    setRoundDuration(duration);
    setTimeLeft(duration);
    setResult(null);
    setHitCount(0);
    setMissCount(0);
    setTimingValue(randomInt(0, 30));
    setProgress(0);
    setTension(fish.rarity === 'king' ? 58 : 43);
    setToast(fish.rarity === 'king' ? '\u6d77\u5e95\u6709\u4ec0\u4e48\u4e1c\u897f\u9192\u4e86\u2026\u2026' : '\u6765\u4e86\uff01');
    setPulse(true);
  };

  const finishFight = (success: boolean, reason?: ResultState['reason']) => {
    if (fightResolvedRef.current || !hookedFish) return;
    fightResolvedRef.current = true;

    let finalSuccess = success;
    if (!success && player.totalCasts < 5 && player.newbieWins < 4 && hookedFish.rarity !== 'king' && progress > 45) {
      finalSuccess = true;
    }

    const coins = finalSuccess ? randomInt(hookedFish.coinMin, hookedFish.coinMax) : 0;
    const weight = Number((hookedFish.baseWeight * (0.82 + Math.random() * 0.55)).toFixed(1));
    const contribution = finalSuccess ? hookedFish.contribution + Math.round(weight * 3) : 0;
    const missLine = Math.random() < 0.5 ? '你只差一点点。' : failureMessages[randomInt(0, failureMessages.length - 1)];
    const isNewCatch = finalSuccess && !codex[hookedFish.id];

    if (finalSuccess) {
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
      provinceContribution: current.provinceContribution + contribution,
      dailyCasts: current.dailyCasts + 1,
      dailyWeight: current.dailyWeight + (finalSuccess ? weight : 0),
      totalCasts: current.totalCasts + 1,
      totalWeight: current.totalWeight + (finalSuccess ? weight : 0),
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
      })
        .then(fetchDistrictScores)
        .then((scores) => {
          setRemoteProvinceScores(scores);
          setLeaderboardOnline(true);
        })
        .catch(() => {
          setLeaderboardOnline(false);
        });
    }

    if (finalSuccess && shouldBroadcastFish(hookedFish.rarity)) {
      setBroadcasts((items) => [
        { id: player.playerId || 'YOU', district: player.province, fish: hookedFish.name, rarity: hookedFish.rarity },
        ...items,
      ].slice(0, 5));
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
    setTension(44);
    setTimeLeft(6);
    setHitCount(0);
    setMissCount(0);
    setTimingValue(0);
    setToast('再来一杆？');
  };

  const getHitWindow = (fish: Fish | null) => {
    if (!fish) return { min: 42, max: 58 };
    const newbieWiden = player.totalCasts < 3 ? 3 : 0;
    const rodWiden = Math.min(2, Math.floor(equippedRod.difficulty / 6));
    const widen = newbieWiden + rodWiden;
    if (fish.rarity === 'common') return { min: 40 - widen, max: 60 + widen };
    if (fish.rarity === 'rare') return { min: 43 - widen, max: 57 + widen };
    if (fish.rarity === 'legendary') return { min: 45 - widen, max: 55 + widen };
    if (fish.rarity === 'epic') return { min: 47 - widen, max: 53 + widen };
    return { min: 48 - widen, max: 52 + widen };
  };

  const tapTiming = () => {
    if (phase !== 'reeling' || fightResolvedRef.current || !hookedFish) return;
    const hitWindow = getHitWindow(hookedFish);
    const isHit = timingValue >= hitWindow.min && timingValue <= hitWindow.max;

    if (isHit) {
      const nextHits = hitCount + 1;
      const requiredHits = getRequiredHits(hookedFish);
      setHitCount(nextHits);
      setProgress((nextHits / requiredHits) * 100);
      setTension((value) => clamp(value - 6, 18, 112));
      setToast(nextHits >= requiredHits ? '\u62c9\u4e0a\u6765\uff01' : `\u547d\u4e2d\uff01${nextHits}/${requiredHits}`);
      setPulse(true);
      setTimingValue(randomInt(0, 100) > 50 ? 12 : 88);
      setTimingDirection(randomInt(0, 1) === 0 ? 1 : -1);
      if (nextHits >= requiredHits) finishFight(true);
      return;
    }

    const nextMiss = missCount + 1;
    setMissCount(nextMiss);
    setTension((value) => clamp(value + 22, 18, 118));
    setProgress((value) => clamp(value - 18, 0, 100));
    setToast(nextMiss >= 3 ? '鱼线一松！' : '差一点！');
    setPulse(true);
    if (nextMiss >= 3) finishFight(false, 'escaped');
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

  const claimStarter = () => {
    const playerId = playerIdInput.trim();
    if (!playerId) return;
    setPlayer((current) => ({
      ...current,
      playerId,
      coins: current.starterGiftClaimed ? current.coins : current.coins + 600,
      ownedRodIds: current.ownedRodIds.includes('starter') ? current.ownedRodIds : [...current.ownedRodIds, 'starter'],
      equippedRodId: current.equippedRodId === 'basic' ? 'starter' : current.equippedRodId,
      starterGiftClaimed: true,
    }));
    setToast('新手礼包到账');
  };

  const watchEnergyAd = () => {
    setPlayer((current) => ({ ...current, stamina: Math.min(MAX_STAMINA, current.stamina + 30), lastStaminaAt: Date.now() }));
    setEnergyPrompt('');
    setToast('体力回来了！');
  };

  const watchLuckAd = () => {
    setPlayer((current) => ({ ...current, dailyLuckDate: todayKey() }));
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
    <main className="min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="flex min-h-screen items-center justify-center p-0 sm:p-4">
        <div className={`phone-frame weird-phone relative flex h-[100dvh] w-full max-w-[390px] flex-col overflow-hidden sm:h-[844px] ${sceneClass}`}>
          <FishingBackdrop phase={phase} rarity={hookedFish?.rarity} anomaly={anomaly.id !== 'none'} zoneId={selectedZone.id} pulse={pulse} />

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
                  {"\u9886\u53d6\u793c\u5305\u5e76\u5f00\u59cb"}
                </button>
              </div>
            </div>
          )}

          <header className="relative z-10 px-4 pt-3">
            <div className="mx-auto grid w-full max-w-[300px] grid-cols-3 gap-1.5">
              <TopStat icon={<Coins size={16} />} label={"\u91d1\u5e01"} value={player.coins} />
              <TopStat icon={<BatteryCharging size={16} />} label={"\u4f53\u529b"} value={player.stamina} />
              <TopStat icon={<Trophy size={16} />} label={"\u6392\u540d"} value={`#${provinceRank}`} />
            </div>
            <div className="sea-glass mx-auto mt-2 flex w-full max-w-[310px] items-center justify-between rounded-full px-2.5 py-1.5 text-[11px] font-bold backdrop-blur">
              <select
                value={player.province}
                onChange={(event) => setPlayer((current) => ({ ...current, province: event.target.value }))}
                className="max-w-24 bg-transparent text-white outline-none"
              >
                {provinces.map((province) => (
                  <option className="bg-slate-950" key={province} value={province}>
                    {province}
                  </option>
                ))}
              </select>
              <span className="truncate px-2 text-cyan-50/85">{anomaly.description}</span>
              <span className="text-amber-200">{"\u8fd0"} {luck}</span>
            </div>
            <div className="mx-auto mt-1.5 flex w-full max-w-[310px] items-center gap-2">
              <button
                onClick={requestLocation}
                disabled={locating}
                className="rounded-full border border-lime-200/30 bg-black/58 px-3 py-1 text-[11px] font-black text-lime-100 shadow-glow disabled:opacity-60"
              >
                {locating ? '定位中' : '定位参赛'}
              </button>
              <span className="min-w-0 flex-1 truncate text-[10px] font-bold text-lime-50/72">{locationMessage}</span>
            </div>
            <div className="mx-auto mt-1 flex w-full max-w-[310px] justify-between px-1 text-[10px] font-bold text-cyan-50/78">
              <span>ID {player.playerId || '--'}</span>
              <span>{"\u9975"} {equippedBait.name}</span>
              <span>{"\u4eca\u65e5"} {player.dailyCasts}{"\u6746"} / {player.dailyWeight.toFixed(1)}kg</span>
            </div>
          </header>

          <section className="relative z-10 flex flex-1 flex-col px-4 pb-3 pt-2">
            <div className="flex flex-col items-center text-center">
              <div>
                <div className="text-xs font-black text-cyan-50/80">{selectedZone.name}</div>
                <h1 className="text-2xl font-black leading-none tracking-normal text-white drop-shadow">JOJOFISH.COM</h1>
              </div>
              <button
                onClick={watchLuckAd}
                disabled={player.dailyLuckDate === todayKey()}
                className="mt-2 rounded-full border border-lime-200/40 bg-lime-200/90 px-2.5 py-1.5 text-[11px] font-black text-slate-950 shadow-glow disabled:bg-white/12 disabled:text-white/45"
              >
                {player.dailyLuckDate === todayKey() ? '已加成' : '幸运广告'}
              </button>
            </div>

            <BroadcastBar item={broadcasts[0]} />

            <div className="relative mt-2 flex min-h-0 flex-1 items-center justify-center pb-2">
              {visibleFish && (
                <>
                  <div className={`fish-shadow absolute bottom-[15%] h-16 rounded-[50%] bg-slate-950/80 ${hookedFish?.rarity === 'king' ? 'w-72' : hookedFish?.rarity === 'mutant' ? 'w-56' : 'w-36'}`} />
                  <div className="splash absolute bottom-[27%] h-20 w-20 rounded-full border-4 border-cyan-100/45" />
                </>
              )}
              {phase === 'idle' && (
                <div className="z-10 flex flex-col items-center gap-2">
                  <button onClick={castRod} className="rounded-full bg-amber-300 px-10 py-5 text-2xl font-black text-slate-950 shadow-gold active:scale-95">
                    {"\u629b\u7aff"}
                  </button>
                  <div className="grid w-44 grid-cols-2 gap-2">
                    <button onClick={() => setSheet('shopRod')} className="rounded-full bg-black/55 px-3 py-2 text-xs font-black text-lime-100 ring-1 ring-lime-200/25 backdrop-blur">
                      {"\u9c7c\u7aff"}
                    </button>
                    <button onClick={() => setSheet('shopBait')} className="rounded-full bg-black/55 px-3 py-2 text-xs font-black text-cyan-100 ring-1 ring-cyan-200/25 backdrop-blur">
                      {"\u9c7c\u9975"}
                    </button>
                  </div>
                </div>
              )}
              {phase === 'reeling' && (
                <TimingChallenge value={timingValue} hitWindow={getHitWindow(hookedFish)} hits={hitCount} requiredHits={getRequiredHits(hookedFish)} timeLeft={timeLeft} danger={timeLeft <= 2} />
              )}
            </div>

            <div className="sea-panel strong-panel relative z-10 mx-auto w-full max-w-[292px] rounded-[16px] p-2 backdrop-blur">
              <div className="min-h-5 text-center text-base font-black text-lime-100 drop-shadow">{toast}</div>
              <Meter label={"\u547d\u4e2d"} value={progress} max={100} compact />
            </div>
          </section>

          <footer className="relative z-20 space-y-2 bg-slate-950/50 px-4 pb-4 pt-3 backdrop-blur">
            {phase === 'reeling' && (
              <button
                onClick={tapTiming}
                className="h-20 w-full rounded-[26px] bg-lime-200 text-2xl font-black text-slate-950 shadow-glow active:scale-[0.98]"
              >
                {`\u770b\u51c6\u70b9\u51fb ${hitCount}/${getRequiredHits(hookedFish)}`}
              </button>
            )}
            <div className="mx-auto grid w-full max-w-[310px] grid-cols-4 gap-1.5">
              <SmallNav icon={<ShoppingBag size={17} />} label={"\u5546\u5e97"} onClick={() => setSheet('shopRod')} />
              <SmallNav icon={<Trophy size={17} />} label={"\u699c\u5355"} onClick={() => setSheet('rankDistrict')} />
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
              title={sheet === 'shopRod' ? "\u9c7c\u7aff\u5546\u5e97" : sheet === 'shopBait' ? "\u9c7c\u9975\u5546\u5e97" : sheet === 'rankDistrict' ? "\u533a\u57df\u699c\u5355" : sheet === 'rankPlayer' ? "\u73a9\u5bb6\u699c\u5355" : sheet === 'zone' ? "\u9009\u62e9\u6d77\u57df" : "\u9c7c\u7c7b\u56fe\u9274"}
              onClose={() => setSheet(null)}
            >
              {(sheet === 'shopRod' || sheet === 'shopBait') && <Shop mode={sheet === 'shopRod' ? 'rod' : 'bait'} player={player} equippedRodId={player.equippedRodId} equippedBaitId={player.equippedBaitId} onBuyRod={buyRod} onBuyBait={buyBait} onModeChange={(mode) => setSheet(mode === 'rod' ? 'shopRod' : 'shopBait')} />}
              {(sheet === 'rankDistrict' || sheet === 'rankPlayer') && <Rank mode={sheet === 'rankDistrict' ? 'district' : 'player'} scores={provinceScores} province={player.province} contribution={player.provinceContribution} broadcasts={broadcasts} playerRows={playerRankRows} playerId={player.playerId} leaderboardOnline={leaderboardOnline} onModeChange={(mode) => setSheet(mode === 'district' ? 'rankDistrict' : 'rankPlayer')} />}
              {sheet === 'zone' && (
                <ZonePickerUnlocked selectedZoneId={selectedZoneId} unlocks={zoneUnlocks} onPick={(id) => { setSelectedZoneId(id); setSheet(null); }} disabled={!canCast} />
              )}
              {sheet === 'codex' && <Codex codex={codex} />}
            </BottomSheet>
          )}
        </div>
      </div>
    </main>
  );
}

function TopStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-white/14 px-1.5 py-1.5 text-center backdrop-blur">
      <div className="mx-auto flex items-center justify-center gap-0.5 text-[10px] text-cyan-50/80">
        {icon}
        {label}
      </div>
      <div className="text-sm font-black">{value}</div>
    </div>
  );
}

function BroadcastBar({ item }: { item?: BroadcastItem }) {
  return (
    <div className="mx-auto mt-2 w-full max-w-[318px] rounded-2xl border border-amber-200/20 bg-black/52 px-3 py-2 shadow-glow backdrop-blur">
      <div className="mb-1 flex items-center justify-between text-[10px] font-black tracking-normal text-amber-100/90">
        <span>{"\u5168\u670d\u5e7f\u64ad"}</span>
        <span className="rounded-full bg-amber-200/12 px-2 py-0.5 text-[9px] text-amber-100">LEGEND+</span>
      </div>
      {item ? (
        <BroadcastLine item={item} />
      ) : (
        <div className="truncate text-xs font-black text-slate-300">{"\u7b49\u5f85\u7b2c\u4e00\u6761\u4f20\u8bf4\u6218\u62a5"}</div>
      )}
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
    <div className="truncate text-xs font-black leading-5 text-slate-100">
      <span className="text-lime-200">#{item.id}</span>
      <span className="mx-1 text-slate-500">/</span>
      <span className="text-cyan-200">{item.district}</span>
      <span className="mx-1 text-slate-300">{"\u9493\u8d77"}</span>
      <span className={fishTone}>{item.fish}</span>
    </div>
  );
}

function FishingBackdrop({ phase, rarity, anomaly, zoneId, pulse }: { phase: Phase; rarity?: Fish['rarity']; anomaly: boolean; zoneId: string; pulse: boolean }) {
  const bigShadow = rarity === 'king' || rarity === 'mutant';
  const zoneClass = `backdrop-${zoneId}`;

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${zoneClass}`}>
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
      <div className="boat-highlight absolute inset-x-8 bottom-[207px] h-2 rounded-full bg-lime-100/20" />
      <FishingGear active={phase === 'reeling'} biting={phase !== 'idle'} pulse={pulse} />
    </div>
  );
}

function FishingGear({ active, biting, pulse }: { active: boolean; biting: boolean; pulse: boolean }) {
  return (
    <svg className="fishing-gear absolute inset-0 h-full w-full" viewBox="0 0 390 844" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="rodGradient" x1="70" y1="720" x2="214" y2="286" gradientUnits="userSpaceOnUse">
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
        <path className={active ? 'gear-rod gear-rod-active' : 'gear-rod'} d="M58 720 C92 600 142 424 214 286" stroke="url(#rodGradient)" strokeWidth="10" strokeLinecap="round" fill="none" filter="url(#gearGlow)" />
        <path d="M46 738 C58 704 66 676 74 646" stroke="#020617" strokeWidth="28" strokeLinecap="round" fill="none" />
        <path d="M38 740 C54 726 72 718 95 710" stroke="#020617" strokeWidth="18" strokeLinecap="round" fill="none" />
        <circle cx="91" cy="650" r="25" fill="rgba(190,242,100,0.58)" stroke="#020617" strokeWidth="8" />
        <circle cx="91" cy="650" r="10" fill="none" stroke="#020617" strokeWidth="5" />
        <path d="M112 646 C130 642 138 650 145 660" stroke="#020617" strokeWidth="8" strokeLinecap="round" fill="none" />
        <circle cx="106" cy="567" r="8" fill="none" stroke="#d9f99d" strokeWidth="3" />
        <circle cx="135" cy="461" r="7" fill="none" stroke="#d9f99d" strokeWidth="3" />
        <circle cx="174" cy="352" r="6" fill="none" stroke="#d9f99d" strokeWidth="3" />
        <circle cx="214" cy="286" r="7" fill="#ecfccb" filter="url(#gearGlow)" />

        <g className={active ? 'gear-line gear-line-active' : 'gear-line'}>
          <path d="M214 286 C223 366 219 430 212 506" stroke="rgba(255,255,255,0.88)" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M214 286 C223 366 219 430 212 506" stroke="rgba(190,242,100,0.24)" strokeWidth="6" strokeLinecap="round" fill="none" />
          <g className={biting ? 'gear-bobber gear-bobber-bite' : 'gear-bobber'}>
            <circle cx="212" cy="506" r="11" fill="#fb7185" stroke="#ecfccb" strokeWidth="3" filter="url(#gearGlow)" />
            <path d="M202 506 H222" stroke="#ecfccb" strokeWidth="3" strokeLinecap="round" />
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
}: {
  value: number;
  hitWindow: { min: number; max: number };
  hits: number;
  requiredHits: number;
  timeLeft: number;
  danger?: boolean;
}) {
  return (
    <div className={`strong-panel z-10 w-full max-w-[340px] -translate-y-24 rounded-[22px] bg-black/50 px-3 py-3 text-center shadow-glow backdrop-blur ${danger ? 'bg-rose-950/88' : ''}`}>
      <div className="text-2xl font-black">{"\u6765\u4e86\uff01"}</div>
      <div className="mt-1 text-xs font-bold text-slate-100/85">{"\u770b\u51c6\u7eff\u533a\u70b9\u51fb"}</div>
      <div className="mt-3 flex justify-center gap-1.5">
        {Array.from({ length: requiredHits }).map((_, index) => (
          <span key={index} className={`h-3 w-7 rounded-full ${index < hits ? 'bg-amber-300 shadow-gold' : 'bg-white/16'}`} />
        ))}
      </div>
      <div className="relative mt-3 h-10 rounded-md bg-slate-900/95 ring-1 ring-white/10">
        <div
          className="absolute top-1 h-8 rounded-[5px] bg-emerald-300/35 ring-1 ring-emerald-100/40"
          style={{
            left: `${hitWindow.min}%`,
            width: `${hitWindow.max - hitWindow.min}%`,
          }}
        />
        <div className="absolute inset-y-1 left-1/2 w-px bg-white/15" />
        <div className="timing-dot absolute top-0 h-10 w-4 rounded-[4px] border border-lime-50 bg-lime-200 shadow-glow" style={{ left: `calc(${value}% - 8px)` }} />
      </div>
      <div className="mt-2 text-base font-black text-lime-100">{timeLeft.toFixed(1)}s</div>
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
    <button onClick={onClick} className="flex h-9 items-center justify-center gap-1 rounded-xl bg-white/10 text-xs font-black text-white active:scale-95">
      {icon}
      {label}
    </button>
  );
}

function ResultCard({ result, onClose }: { result: ResultState; onClose: () => void }) {
  return (
    <div onClick={onClose} className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/38 px-4 backdrop-blur-[1px]">
      <div className="strong-panel relative max-h-[calc(100%-170px)] w-full max-w-[326px] overflow-y-auto rounded-[24px] p-4 text-center shadow-glow backdrop-blur">
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
                <div className="text-[11px] font-black text-cyan-100">{"\u91cd\u91cf"}</div>
                <div className="mt-0.5 text-2xl font-black text-white">{result.weight}<span className="ml-1 text-sm text-cyan-100">kg</span></div>
              </div>
              <div className="rounded-[18px] border border-amber-200/30 bg-amber-200/20 px-2 py-2.5">
                <div className="text-[11px] font-black text-amber-100">{"\u91d1\u5e01"}</div>
                <div className="coin-burst mt-0.5 text-2xl font-black text-amber-100">+{result.coins}</div>
              </div>
            </div>
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
  const bodyClass =
    fish.rarity === 'king'
      ? 'from-lime-100 via-teal-200 to-rose-200'
      : fish.rarity === 'mutant'
        ? 'from-rose-300 via-fuchsia-300 to-slate-200'
        : fish.rarity === 'epic'
          ? 'from-violet-200 via-fuchsia-300 to-cyan-200'
          : fish.rarity === 'legendary'
            ? 'from-yellow-100 via-lime-200 to-teal-200'
        : fish.rarity === 'rare'
          ? 'from-emerald-200 via-cyan-200 to-blue-200'
          : 'from-sky-100 via-slate-100 to-cyan-200';

  return (
    <div className={`prize-fish-wrap relative mx-auto mt-4 flex h-32 w-full items-center justify-center overflow-hidden rounded-[26px] border border-white/10 bg-white/10 ${rareGlow ? 'shadow-gold' : ''}`}>
      <div className="absolute inset-x-8 bottom-4 h-8 rounded-full bg-cyan-100/10 blur-md" />
      <div className="relative flex items-center">
        <div className={`h-20 w-40 rounded-[55%] bg-gradient-to-r ${bodyClass} shadow-glow`} />
        <div className={`-ml-4 h-14 w-14 rotate-45 rounded-tl-[80%] bg-gradient-to-br ${bodyClass}`} />
        <div className="absolute left-[7.5rem] top-5 h-3 w-3 rounded-full bg-slate-950" />
        <div className="absolute left-4 top-0 h-10 w-10 -rotate-12 rounded-full border-t-8 border-cyan-50/70" />
      </div>
      <div className="absolute bottom-2 text-xs font-black text-white/70">{"\u9493\u4e0a\u6765\u4e86\uff01"}</div>
    </div>
  );
}

function BottomSheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-end bg-slate-950/55 backdrop-blur-sm">
      <div className="max-h-[72%] w-full overflow-y-auto rounded-t-[30px] bg-slate-950 p-4 shadow-glow">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-black">{title}</h2>
          <button onClick={onClose} className="rounded-full bg-white/10 px-4 py-2 text-sm font-black">关闭</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Shop({ mode, player, equippedRodId, equippedBaitId, onBuyRod, onBuyBait, onModeChange }: { mode: 'rod' | 'bait'; player: PlayerState; equippedRodId: string; equippedBaitId: string; onBuyRod: (id: string) => void; onBuyBait: (id: string) => void; onModeChange: (mode: 'rod' | 'bait') => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-1">
        <button onClick={() => onModeChange('rod')} className={`rounded-xl py-2 text-sm font-black ${mode === 'rod' ? 'bg-lime-200 text-slate-950' : 'text-slate-200'}`}>{"\u9c7c\u7aff"}</button>
        <button onClick={() => onModeChange('bait')} className={`rounded-xl py-2 text-sm font-black ${mode === 'bait' ? 'bg-cyan-200 text-slate-950' : 'text-slate-200'}`}>{"\u9c7c\u9975"}</button>
      </div>
      {mode === 'rod' ? (
        <div className="space-y-2">
          {rods.map((rod) => {
            const owned = player.ownedRodIds.includes(rod.id);
            const equipped = equippedRodId === rod.id;
            return (
              <button key={rod.id} onClick={() => onBuyRod(rod.id)} className={`w-full rounded-2xl border p-3 text-left ${equipped ? 'border-amber-200 bg-amber-300/20' : 'border-white/10 bg-white/10'}`}>
                <div className="flex justify-between text-base font-black">
                  <span>{rod.name}</span>
                  <span>{equipped ? "\u4f7f\u7528\u4e2d" : owned ? "\u88c5\u5907" : `${rod.price}\u91d1\u5e01`}</span>
                </div>
                <div className="mt-1 text-xs text-slate-300">{"\u5e78\u8fd0"} +{rod.luck} {"\u5bb9\u9519"} +{rod.tolerance} {"\u624b\u611f"} +{rod.difficulty}</div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {baits.map((bait) => {
            const owned = player.ownedBaitIds.includes(bait.id);
            const equipped = equippedBaitId === bait.id;
            return (
              <button key={bait.id} onClick={() => onBuyBait(bait.id)} className={`w-full rounded-2xl border p-3 text-left ${equipped ? 'border-cyan-200 bg-cyan-300/20' : 'border-white/10 bg-white/10'}`}>
                <div className="flex justify-between text-base font-black">
                  <span>{bait.name}</span>
                  <span>{equipped ? "\u4f7f\u7528\u4e2d" : owned ? "\u4f7f\u7528" : `${bait.price}\u91d1\u5e01`}</span>
                </div>
                <div className="mt-1 text-xs text-slate-300">{"\u5e78\u8fd0"} +{bait.luck} {"\u51fa\u8d27\u611f"} +{bait.rareBoost} ? {bait.description}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Rank({ mode, scores, province, contribution, broadcasts, playerRows, playerId, leaderboardOnline, onModeChange }: { mode: 'district' | 'player'; scores: DistrictScore[]; province: string; contribution: number; broadcasts: BroadcastItem[]; playerRows: PlayerRankRow[]; playerId: string; leaderboardOnline: boolean; onModeChange: (mode: 'district' | 'player') => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-1">
        <button onClick={() => onModeChange('district')} className={`rounded-xl py-2 text-sm font-black ${mode === 'district' ? 'bg-lime-200 text-slate-950' : 'text-slate-200'}`}>{"\u533a\u57df\u699c"}</button>
        <button onClick={() => onModeChange('player')} className={`rounded-xl py-2 text-sm font-black ${mode === 'player' ? 'bg-cyan-200 text-slate-950' : 'text-slate-200'}`}>{"\u73a9\u5bb6\u699c"}</button>
      </div>
      <div className={`rounded-2xl px-3 py-2 text-[11px] font-black ${leaderboardOnline ? 'bg-lime-200/15 text-lime-100' : 'bg-amber-200/12 text-amber-100'}`}>
        {leaderboardOnline ? "\u8054\u7f51\u699c\u5355\u5df2\u540c\u6b65" : "\u672a\u914d\u7f6e\u8054\u7f51\u699c\u5355\uff0c\u6682\u7528\u672c\u5730\u6570\u636e"}
      </div>
      {mode === 'district' ? (
        <div className="space-y-3">
          <div className="space-y-2">
            {scores.map((item, index) => (
              <div key={item.province} className={`flex justify-between rounded-2xl px-3 py-2 text-sm font-bold ${item.province === province ? 'bg-amber-300/20 text-amber-100' : 'bg-white/10'}`}>
                <span>{index + 1}. {item.province}</span>
                <span>{item.score}</span>
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-cyan-300/12 p-3 text-xs text-cyan-50">{"\u4f60\u4e3a"} {province} {"\u8d21\u732e"} {contribution} {"\u5206"}</div>
        </div>
      ) : (
        <div className="space-y-2">
          {playerRows.slice(0, 8).map((item, index) => (
            <div key={item.id} className={`rounded-2xl px-3 py-2 text-xs font-bold ${item.id === playerId ? 'bg-lime-200/20 text-lime-100' : 'bg-white/10 text-slate-200'}`}>
              <div className="flex justify-between text-sm font-black"><span>{index + 1}. {item.id}</span><span>{"\u4eca\u65e5"} {item.dailyWeight.toFixed(1)}kg</span></div>
              <div className="mt-1 grid grid-cols-2 gap-1 text-[11px] text-slate-300">
                <span>{"\u4eca\u65e5"} {item.dailyCasts} {"\u6746"}</span><span>{"\u603b"} {item.totalCasts} {"\u6746"}</span>
                <span>{"\u4eca\u65e5"} {item.dailyWeight.toFixed(1)}kg</span><span>{"\u603b"} {item.totalWeight.toFixed(1)}kg</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-2">
        {broadcasts.slice(0, 3).map((item, index) => (
          <div key={`${item.id}-${item.fish}-${index}`} className="rounded-2xl bg-white/10 px-3 py-2 text-xs text-slate-200">
            <BroadcastLine item={item} />
          </div>
        ))}
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
                {discovered ? <MiniFish fish={fish} /> : <div className="h-10 w-24 rounded-[50%] bg-black blur-[1px]" />}
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
  const bodyClass =
    fish.rarity === 'king'
      ? 'from-lime-100 via-teal-200 to-rose-200'
      : fish.rarity === 'mutant'
        ? 'from-rose-300 via-fuchsia-300 to-slate-200'
        : fish.rarity === 'epic'
          ? 'from-violet-200 via-fuchsia-300 to-cyan-200'
          : fish.rarity === 'legendary'
            ? 'from-yellow-100 via-lime-200 to-teal-200'
        : fish.rarity === 'rare'
          ? 'from-emerald-200 via-cyan-200 to-blue-200'
          : 'from-sky-100 via-slate-100 to-cyan-200';

  return (
    <div className="relative flex scale-75 items-center">
      <div className={`h-12 w-24 rounded-[55%] bg-gradient-to-r ${bodyClass} shadow-glow`} />
      <div className={`-ml-3 h-9 w-9 rotate-45 rounded-tl-[80%] bg-gradient-to-br ${bodyClass}`} />
      <div className="absolute left-[4.7rem] top-3 h-2 w-2 rounded-full bg-slate-950" />
    </div>
  );
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

export default App;
