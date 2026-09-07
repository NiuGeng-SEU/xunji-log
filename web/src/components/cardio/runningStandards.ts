import type { Activity } from './types';
import { parseMovingTime } from './utils';

export type RunningTierKey = 'beginner' | 'novice' | 'intermediate' | 'advanced' | 'elite';

export interface RunningTierInfo {
  tierKey: RunningTierKey;
  tierNameEn: string;
  tierNameZh: string;
  percentile: number;
  color: string;
  descEn: string;
  descZh: string;
}

export interface RunningTierResult {
  tierKey: RunningTierKey;
  tierNameEn: string;
  tierNameZh: string;
  percentile: number;
  color: string;
  equivalent5kSec?: number;
}

export interface PredictedPBRecord {
  key: string;
  distanceKm: number;
  predictedTimeSec: number;
  predictedPaceSec: number;
  tier: RunningTierResult;
}

export interface LastMonthPredictionResult {
  baseActivity: {
    date: string;
    distanceKm: number;
    durationMin: number;
    paceSec: number;
    title: string;
  } | null;
  predictions: PredictedPBRecord[];
}

/**
 * Standard Running Benchmarks for 25-35 Male Runners (RunningLevel / StrengthLevel standard)
 * Times in seconds for each tier.
 */
export const RUNNING_BENCHMARKS = {
  '5K': {
    distanceKm: 5.0,
    elite: 1060, // 17:40
    advanced: 1184, // 19:44
    intermediate: 1351, // 22:31
    novice: 1579, // 26:19
    beginner: 1889, // 31:29
  },
  '10K': {
    distanceKm: 10.0,
    elite: 2190, // 36:30
    advanced: 2450, // 40:50
    intermediate: 2800, // 46:40
    novice: 3280, // 54:40
    beginner: 3930, // 1:05:30
  },
  'Half Marathon': {
    distanceKm: 21.0975,
    elite: 4800, // 1:20:00
    advanced: 5400, // 1:30:00
    intermediate: 6180, // 1:43:00
    novice: 7260, // 2:01:00
    beginner: 8640, // 2:24:00
  },
  Marathon: {
    distanceKm: 42.195,
    elite: 10080, // 2:48:00
    advanced: 11280, // 3:08:00
    intermediate: 12900, // 3:35:00
    novice: 15300, // 4:15:00
    beginner: 18000, // 5:00:00
  },
} as const;

export const TIER_CONFIG: Record<RunningTierKey, { nameEn: string; nameZh: string; color: string; descEn: string; descZh: string }> = {
  elite: {
    nameEn: 'Elite',
    nameZh: '精英',
    color: '#f59e0b',
    descEn: 'Faster than 95% of runners',
    descZh: '超越 95% 跑者，竞技水准',
  },
  advanced: {
    nameEn: 'Advanced',
    nameZh: '高级',
    color: '#a855f7',
    descEn: 'Faster than 80% of runners',
    descZh: '超越 80% 跑者，持续进阶训练',
  },
  intermediate: {
    nameEn: 'Intermediate',
    nameZh: '中级',
    color: '#10b981',
    descEn: 'Faster than 50% of runners',
    descZh: '超越 50% 跑者，规律系统训练',
  },
  novice: {
    nameEn: 'Novice',
    nameZh: '新手',
    color: '#3b82f6',
    descEn: 'Faster than 20% of runners',
    descZh: '超越 20% 跑者，具备良好体能',
  },
  beginner: {
    nameEn: 'Beginner',
    nameZh: '初学',
    color: '#94a3b8',
    descEn: 'Faster than 5% of runners',
    descZh: '超越 5% 跑者，掌握基本节奏',
  },
};

/**
 * Calculate running rank degree for ANY running activity
 * Uses Pete Riegel formula to map (distance, time) -> equivalent 5K time
 */
export function calculateRunningTier(
  distanceMeters: number,
  durationSeconds: number
): RunningTierResult | null {
  const km = distanceMeters / 1000;
  if (km < 0.5 || durationSeconds <= 0) return null;

  // Pete Riegel formula: T2 = T1 * (D2 / D1)^1.06
  const t5k = durationSeconds * Math.pow(5.0 / km, 1.06);

  const b = RUNNING_BENCHMARKS['5K'];
  let tierKey: RunningTierKey = 'beginner';
  let pct = 5.0;

  if (t5k <= b.elite) {
    tierKey = 'elite';
    pct = 95.0 + Math.min(4.9, ((b.elite - t5k) / b.elite) * 20);
  } else if (t5k <= b.advanced) {
    tierKey = 'advanced';
    pct = 80.0 + ((b.advanced - t5k) / (b.advanced - b.elite)) * 15.0;
  } else if (t5k <= b.intermediate) {
    tierKey = 'intermediate';
    pct = 50.0 + ((b.intermediate - t5k) / (b.intermediate - b.advanced)) * 30.0;
  } else if (t5k <= b.novice) {
    tierKey = 'novice';
    pct = 20.0 + ((b.novice - t5k) / (b.novice - b.intermediate)) * 30.0;
  } else if (t5k <= b.beginner) {
    tierKey = 'beginner';
    pct = 5.0 + ((b.beginner - t5k) / (b.beginner - b.novice)) * 15.0;
  } else {
    tierKey = 'beginner';
    pct = Math.max(0.5, 5.0 - ((t5k - b.beginner) / 600) * 4.0);
  }

  const conf = TIER_CONFIG[tierKey];
  return {
    tierKey,
    tierNameEn: conf.nameEn,
    tierNameZh: conf.nameZh,
    percentile: Math.round(pct * 10) / 10,
    color: conf.color,
    equivalent5kSec: Math.round(t5k),
  };
}

/**
 * Calculate tier for a specific distance PB (5K, 10K, Half Marathon, Marathon)
 */
export function calculateSpecificDistanceTier(
  distKey: keyof typeof RUNNING_BENCHMARKS,
  timeSeconds: number
): RunningTierResult | null {
  if (timeSeconds <= 0) return null;
  const b = RUNNING_BENCHMARKS[distKey];
  if (!b) return null;

  let tierKey: RunningTierKey = 'beginner';
  let pct = 5.0;

  if (timeSeconds <= b.elite) {
    tierKey = 'elite';
    pct = 95.0 + Math.min(4.9, ((b.elite - timeSeconds) / b.elite) * 20);
  } else if (timeSeconds <= b.advanced) {
    tierKey = 'advanced';
    pct = 80.0 + ((b.advanced - timeSeconds) / (b.advanced - b.elite)) * 15.0;
  } else if (timeSeconds <= b.intermediate) {
    tierKey = 'intermediate';
    pct = 50.0 + ((b.intermediate - timeSeconds) / (b.intermediate - b.advanced)) * 30.0;
  } else if (timeSeconds <= b.novice) {
    tierKey = 'novice';
    pct = 20.0 + ((b.novice - timeSeconds) / (b.novice - b.intermediate)) * 30.0;
  } else if (timeSeconds <= b.beginner) {
    tierKey = 'beginner';
    pct = 5.0 + ((b.beginner - timeSeconds) / (b.beginner - b.novice)) * 15.0;
  } else {
    tierKey = 'beginner';
    pct = Math.max(0.5, 5.0 - ((timeSeconds - b.beginner) / 1200) * 4.0);
  }

  const conf = TIER_CONFIG[tierKey];
  return {
    tierKey,
    tierNameEn: conf.nameEn,
    tierNameZh: conf.nameZh,
    percentile: Math.round(pct * 10) / 10,
    color: conf.color,
  };
}

/**
 * Estimate predicted PBs based on last month running activity
 * Uses Pete Riegel endurance formula: T2 = T1 * (D2 / D1)^1.06
 */
export function predictPBsFromLastMonth(activities: Activity[]): LastMonthPredictionResult {
  const validRuns = activities.filter(
    (a) => a.type === 'Run' && a.distance >= 2000 && parseMovingTime(a.moving_time) > 0
  );

  if (validRuns.length === 0) {
    return { baseActivity: null, predictions: [] };
  }

  const months = Array.from(new Set(validRuns.map((a) => a.start_date_local.slice(0, 7)))).sort();
  const lastMonth = months.length > 1 ? months[months.length - 2] : months[months.length - 1];

  let targetRuns = validRuns.filter((a) => a.start_date_local.startsWith(lastMonth));
  if (targetRuns.length === 0) {
    targetRuns = validRuns.slice(0, 10);
  }

  let bestRun: Activity = targetRuns[0];
  let bestT5k = Infinity;

  for (const r of targetRuns) {
    const km = r.distance / 1000;
    const durSec = parseMovingTime(r.moving_time);
    const t5k = durSec * Math.pow(5.0 / km, 1.06);
    if (t5k < bestT5k) {
      bestT5k = t5k;
      bestRun = r;
    }
  }

  const baseKm = bestRun.distance / 1000;
  const baseDurSec = parseMovingTime(bestRun.moving_time);
  const basePaceSec = baseDurSec / baseKm;

  const targetDistances: { key: keyof typeof RUNNING_BENCHMARKS; distanceKm: number }[] = [
    { key: '5K', distanceKm: 5.0 },
    { key: '10K', distanceKm: 10.0 },
    { key: 'Half Marathon', distanceKm: 21.0975 },
    { key: 'Marathon', distanceKm: 42.195 },
  ];

  const predictions: PredictedPBRecord[] = targetDistances.map(({ key, distanceKm }) => {
    const predictedTimeSec = Math.round(baseDurSec * Math.pow(distanceKm / baseKm, 1.06));
    const predictedPaceSec = Math.round(predictedTimeSec / distanceKm);
    const tier = calculateSpecificDistanceTier(key, predictedTimeSec) || {
      tierKey: 'beginner',
      tierNameEn: 'Beginner',
      tierNameZh: '初学',
      percentile: 5.0,
      color: '#94a3b8',
    };

    return {
      key,
      distanceKm,
      predictedTimeSec,
      predictedPaceSec,
      tier,
    };
  });

  return {
    baseActivity: {
      date: bestRun.start_date_local.slice(0, 10),
      distanceKm: Math.round(baseKm * 10) / 10,
      durationMin: Math.round((baseDurSec / 60) * 10) / 10,
      paceSec: Math.round(basePaceSec),
      title: bestRun.name || 'Running',
    },
    predictions,
  };
}
