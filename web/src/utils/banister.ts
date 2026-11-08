import { Analysis } from "../api";
import { DaySchedule } from "./cycleTypes";
import { cleanDayTitle } from "./cycleTemplates";

export interface BanisterPoint {
  date: string;
  ctl: number;   // Fitness (Chronic Training Load)
  atl: number;   // Fatigue (Acute Training Load)
  tsb: number;   // Form (Training Stress Balance = CTL - ATL)
  load: number;  // Daily Training Impulse / TRIMP
  isFuture: boolean;
  dayType?: string;
  title?: string;
}

export interface BanisterSimulationResult {
  points: BanisterPoint[];
  todayIndex: number;
  todayDate: string;
  alerts: Array<{
    date: string;
    tsb: number;
    level: "warning" | "danger" | "optimal";
    message_en: string;
    message_zh: string;
  }>;
}

// Convert a scheduled day's planned workout into an estimated Training Impulse (TRIMP / Load)
export function computePlannedDailyLoad(day: DaySchedule | undefined): number {
  if (!day) return 0;
  if (day.type === "rest") return 0;

  let load = 0;
  if (day.movements && day.movements.length > 0) {
    let volume = 0;
    for (const mov of day.movements) {
      for (const set of mov.sets) {
        volume += (set.weight_kg || 0) * (set.reps || 0);
      }
    }
    // Standard normalization: 7,200kg volume ~ 60 load units
    load += volume / 120;
  }

  if (day.cardio_km && day.cardio_km > 0) {
    // 10km run ~ 120 load units
    load += day.cardio_km * 12;
  }

  return Math.round(load * 10) / 10;
}

export function simulateBanister(
  analysis: Analysis | null,
  schedule: Record<string, DaySchedule>,
  futureDays = 28
): BanisterSimulationResult {
  const points: BanisterPoint[] = [];
  const alerts: BanisterSimulationResult["alerts"] = [];

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Time constants
  const tau1 = 42; // CTL fitness decay (days)
  const tau2 = 7;  // ATL fatigue decay (days)

  // 1. Build map of past loads from analysis.daily (take past 120 days up to today)
  const pastMap = new Map<string, number>();
  if (analysis?.daily) {
    for (const day of analysis.daily) {
      if (day.date <= todayStr) {
        const strLoad = (day.volume_kg || 0) / 120;
        const carLoad = (day.cardio_km || 0) * 12;
        pastMap.set(day.date, strLoad + carLoad);
      }
    }
  }

  // Generate sequence of dates from 90 days ago to today + futureDays
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 90);

  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + futureDays);

  let curCtl = 45; // baseline starting seed
  let curAtl = 40;
  let todayIndex = -1;

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const isFuture = dStr > todayStr;
    const isToday = dStr === todayStr;

    let dailyLoad = 0;
    let dayType = "rest";
    let title: string | undefined = undefined;

    if (isFuture) {
      const planned = schedule[dStr];
      dailyLoad = computePlannedDailyLoad(planned);
      dayType = planned?.type || "rest";
      title = planned?.title ? cleanDayTitle(planned.title) : undefined;
    } else {
      dailyLoad = pastMap.get(dStr) || 0;
      if (dailyLoad > 0) {
        dayType = "workout";
      }
    }

    // Banister exponential moving average
    curCtl = curCtl + (dailyLoad - curCtl) / tau1;
    curAtl = curAtl + (dailyLoad - curAtl) / tau2;
    const curTsb = curCtl - curAtl;

    const roundedCtl = Math.round(curCtl * 10) / 10;
    const roundedAtl = Math.round(curAtl * 10) / 10;
    const roundedTsb = Math.round(curTsb * 10) / 10;

    if (isToday) {
      todayIndex = points.length;
    }

    points.push({
      date: dStr,
      ctl: roundedCtl,
      atl: roundedAtl,
      tsb: roundedTsb,
      load: Math.round(dailyLoad * 10) / 10,
      isFuture,
      dayType,
      title,
    });

    // Check future alerts
    if (isFuture) {
      if (roundedTsb < -30) {
        alerts.push({
          date: dStr,
          tsb: roundedTsb,
          level: "danger",
          message_en: `High Fatigue Alert (Form: ${roundedTsb}). High risk of overtraining or injury. Consider trimming secondary sets or adding a deload day.`,
          message_zh: `深度疲劳预警（竞技状态 Form: ${roundedTsb}）。伤病与过度训练风险高，建议适当缩减退让组或插入减载日。`,
        });
      } else if (roundedTsb >= -25 && roundedTsb <= -10) {
        // Optimal progressive overload zone
      }
    }
  }

  return {
    points,
    todayIndex: todayIndex >= 0 ? todayIndex : points.length - futureDays,
    todayDate: todayStr,
    alerts,
  };
}
