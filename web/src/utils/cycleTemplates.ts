import { Analysis } from "../api";
import { CycleConfig, CyclePlan, DaySchedule, MovementPlan } from "./cycleTypes";

export function roundTo(num: number, step = 2.5): number {
  return Math.round(num / step) * step;
}

export interface PeakPRs {
  squat: number;
  bench: number;
  ohp: number;
  row: number;
  rdl: number;
  incline: number;
  bicep_curl: number;
  lsd_km: number;
  daily_run_km: number;
}

/**
 * Automatically extracts the best historical PRs from analysis.json.
 */
export function extractPeakPRsFromAnalysis(analysis: Analysis | null): PeakPRs {
  const result: PeakPRs = {
    squat: 130.0,
    bench: 102.5,
    ohp: 47.5,
    row: 87.5,
    rdl: 87.5,
    incline: 72.5,
    bicep_curl: 25.0,
    lsd_km: 10.0,
    daily_run_km: 5.0,
  };

  if (!analysis) return result;

  // 1. Check compound_prs
  if (analysis.compound_prs && Array.isArray(analysis.compound_prs)) {
    for (const item of analysis.compound_prs) {
      const topSet = item.top_sets?.[0];
      const topWeightKg = topSet?.weight_kg || item.max_weight_kg || 0;
      const rounded = roundTo(topWeightKg, 2.5);

      if (item.key === "bench_press" && rounded > 0) result.bench = rounded;
      if (item.key === "squat" && rounded > 0) result.squat = rounded;
      if (item.key === "barbell_row" && rounded > 0) result.row = rounded;
      if (item.key === "incline_bench_press" && rounded > 0) result.incline = rounded;
    }
  }

  // 2. Check movement_prs fallback
  if (analysis.movement_prs && Array.isArray(analysis.movement_prs)) {
    for (const m of analysis.movement_prs) {
      const w = roundTo(Number(m.max_weight_kg) || 0, 2.5);
      if (w <= 0) continue;

      if (m.name.includes("深蹲") && !m.name.includes("倒蹬") && w > result.squat) {
        result.squat = w;
      }
      if (m.name.includes("卧推") && !m.name.includes("哑铃") && !m.name.includes("上斜") && w > result.bench) {
        result.bench = w;
      }
      if (m.name.includes("上斜") && w > result.incline) {
        result.incline = w;
      }
      if (m.name.includes("划船") && w > result.row) {
        result.row = w;
      }
      if (m.name.includes("推举") && w > result.ohp) {
        result.ohp = w;
      }
      if (m.name.includes("罗马尼亚") && w > result.rdl) {
        result.rdl = w;
      }
    }
  }

  return result;
}

export function findPRForMovement(name: string, analysis: Analysis | null): number | null {
  if (!analysis) return null;

  // 1. compound_prs exact match
  if (analysis.compound_prs && Array.isArray(analysis.compound_prs)) {
    for (const c of analysis.compound_prs) {
      if (c.name_zh === name) {
        const topSet = c.top_sets?.[0];
        const w = topSet?.weight_kg || c.max_weight_kg || 0;
        if (w > 0) return w;
      }
    }
  }

  // 2. movement_prs exact match
  if (analysis.movement_prs && Array.isArray(analysis.movement_prs)) {
    for (const m of analysis.movement_prs) {
      if (m.name === name) {
        const w = Number(m.max_weight_kg) || 0;
        if (w > 0) return w;
      }
    }
  }

  // 3. compound_prs partial match (e.g. key match)
  if (analysis.compound_prs && Array.isArray(analysis.compound_prs)) {
    for (const c of analysis.compound_prs) {
      const zh = c.name_zh || "";
      if (name.includes(zh) || zh.includes(name)) {
        if (name.includes("上斜") && !zh.includes("上斜")) continue;
        if (!name.includes("上斜") && zh.includes("上斜")) continue;
        const topSet = c.top_sets?.[0];
        const w = topSet?.weight_kg || c.max_weight_kg || 0;
        if (w > 0) return w;
      }
    }
  }

  // 4. movement_prs partial match
  if (analysis.movement_prs && Array.isArray(analysis.movement_prs)) {
    for (const m of analysis.movement_prs) {
      const mn = m.name || "";
      if (name.includes(mn) || mn.includes(name)) {
        if (name.includes("上斜") && !mn.includes("上斜")) continue;
        if (!name.includes("上斜") && mn.includes("上斜")) continue;
        const w = Number(m.max_weight_kg) || 0;
        if (w > 0) return w;
      }
    }
  }

  return null;
}

/**
 * Syncs EVERY movement in the weekly schedule against the historical PR database.
 */
export function syncWeeklyTemplateFromAnalysis(
  currentTemplate: Record<number, DaySchedule>,
  analysis: Analysis | null
): { updatedTemplate: Record<number, DaySchedule>; syncedCount: number } {
  if (!analysis) return { updatedTemplate: currentTemplate, syncedCount: 0 };
  let count = 0;
  const updated: Record<number, DaySchedule> = {};

  for (const [keyStr, day] of Object.entries(currentTemplate)) {
    const key = Number(keyStr);
    if (!day.movements || day.movements.length === 0) {
      updated[key] = { ...day };
      continue;
    }

    const newMovs = day.movements.map((mov, mIdx) => {
      const prWeight = findPRForMovement(mov.name, analysis);
      if (prWeight && prWeight > 0) {
        count++;
        const rounded = roundTo(prWeight, 2.5);
        const newSets = mov.sets.map((s, sIdx) => ({
          ...s,
          weight_kg: mIdx === 0 && sIdx >= 2 ? roundTo(rounded * 0.9, 2.5) : rounded,
        }));
        return {
          ...mov,
          sets: newSets,
        };
      }
      return { ...mov };
    });

    updated[key] = {
      ...day,
      movements: newMovs,
    };
  }

  return { updatedTemplate: updated, syncedCount: count };
}

/**
 * Builds the default 7-day Weekly Peak Template (100% PR baseline).
 * Split accurately matching user's real training history:
 * 0 (Sun): 跑步 (Cardio Run LSD 10km)
 * 1 (Mon): 腿·肩 (Legs & Shoulders: 深蹲主项, 站姿推举, 罗马尼亚硬拉, 侧平举, 手腕弯举)
 * 2 (Tue): 跑步 (Cardio Run 5km)
 * 3 (Wed): 胸·三头·腹肌 (Chest, Triceps & Abs: 卧推主项, 上斜卧推, 双杠臂屈伸, 绳索下压)
 * 4 (Thu): 跑步 (Cardio Run 5km / 游泳)
 * 5 (Fri): 背·二头 1 (Back & Biceps 1: 引体向上主项, 杠铃划船, 哑铃划船, 面拉, EZ杆弯举)
 * 6 (Sat): 背·二头 2 (Back & Biceps 2: 杠铃划船主项, 引体向上, 哑铃划船, EZ杆弯举, 斜板面拉)
 */
export function buildDefaultWeeklyPeakTemplate(analysis?: Analysis | null, customPRs?: Partial<PeakPRs>): Record<number, DaySchedule> {
  const prs: PeakPRs = {
    ...extractPeakPRsFromAnalysis(analysis || null),
    ...customPRs,
  };

  return {
    // 0: Sunday - Weekend Long Slow Distance Run
    0: {
      title: "跑步 (LSD)",
      type: "cardio",
      cardio_km: prs.lsd_km,
      target_hr_max: 142,
    },

    // 1: Monday - Legs & Shoulders (深蹲)
    1: {
      title: "深蹲",
      type: "strength",
      movements: [
        {
          name: "深蹲",
          sets: [
            { weight_kg: prs.squat, reps: 5, rpe: 8.5, done: false },
            { weight_kg: prs.squat, reps: 5, rpe: 8.5, done: false },
            { weight_kg: roundTo(prs.squat * 0.9, 2.5), reps: 5, rpe: 7.5, done: false },
            { weight_kg: roundTo(prs.squat * 0.9, 2.5), reps: 5, rpe: 7.5, done: false },
          ],
        },
        {
          name: "站姿杠铃推举",
          sets: [
            { weight_kg: prs.ohp, reps: 8, rpe: 8.0, done: false },
            { weight_kg: prs.ohp, reps: 8, rpe: 8.0, done: false },
            { weight_kg: prs.ohp, reps: 8, rpe: 8.0, done: false },
          ],
        },
        {
          name: "杠铃罗马尼亚硬拉",
          sets: [
            { weight_kg: prs.rdl, reps: 10, rpe: 7.5, done: false },
            { weight_kg: prs.rdl, reps: 10, rpe: 7.5, done: false },
            { weight_kg: prs.rdl, reps: 10, rpe: 7.5, done: false },
          ],
        },
        {
          name: "悍马机侧平举",
          sets: [
            { weight_kg: 35, reps: 12, rpe: 7.5, done: false },
            { weight_kg: 35, reps: 12, rpe: 7.5, done: false },
          ],
        },
        {
          name: "单手哑铃手腕弯举（正手）",
          sets: [
            { weight_kg: 17.5, reps: 12, rpe: 7.0, done: false },
            { weight_kg: 17.5, reps: 12, rpe: 7.0, done: false },
          ],
        },
      ],
    },

    // 2: Tuesday - Cardio Run
    2: {
      title: "跑步",
      type: "cardio",
      cardio_km: prs.daily_run_km,
      target_hr_max: 145,
    },

    // 3: Wednesday - Chest, Triceps & Abs (卧推)
    3: {
      title: "卧推",
      type: "strength",
      movements: [
        {
          name: "杠铃卧推",
          sets: [
            { weight_kg: prs.bench, reps: 5, rpe: 9.0, done: false },
            { weight_kg: prs.bench, reps: 5, rpe: 9.0, done: false },
            { weight_kg: roundTo(prs.bench * 0.9, 2.5), reps: 5, rpe: 8.0, done: false },
            { weight_kg: roundTo(prs.bench * 0.9, 2.5), reps: 5, rpe: 8.0, done: false },
          ],
        },
        {
          name: "上斜杠铃卧推",
          sets: [
            { weight_kg: prs.incline, reps: 6, rpe: 8.0, done: false },
            { weight_kg: prs.incline, reps: 6, rpe: 8.0, done: false },
            { weight_kg: prs.incline, reps: 6, rpe: 8.0, done: false },
          ],
        },
        {
          name: "双杠臂屈伸（负重）",
          sets: [
            { weight_kg: 13.5, reps: 8, rpe: 8.0, done: false },
            { weight_kg: 13.5, reps: 8, rpe: 8.0, done: false },
            { weight_kg: 13.5, reps: 8, rpe: 8.0, done: false },
          ],
        },
        {
          name: "直杆绳索下压",
          sets: [
            { weight_kg: 55, reps: 12, rpe: 7.5, done: false },
            { weight_kg: 55, reps: 12, rpe: 7.5, done: false },
          ],
        },
      ],
    },

    // 4: Thursday - Cardio Run
    4: {
      title: "跑步",
      type: "cardio",
      cardio_km: prs.daily_run_km,
      target_hr_max: 142,
    },

    // 5: Friday - Back & Biceps (背·二头)
    5: {
      title: "背·二头",
      type: "strength",
      movements: [
        {
          name: "杠铃划船",
          sets: [
            { weight_kg: prs.row, reps: 8, rpe: 8.5, done: false },
            { weight_kg: prs.row, reps: 8, rpe: 8.5, done: false },
            { weight_kg: prs.row, reps: 8, rpe: 8.0, done: false },
          ],
        },
        {
          name: "引体向上",
          sets: [
            { weight_kg: 0, reps: 10, rpe: 8.0, done: false },
            { weight_kg: 0, reps: 10, rpe: 8.0, done: false },
            { weight_kg: 0, reps: 8, rpe: 8.0, done: false },
          ],
        },
        {
          name: "哑铃划船",
          sets: [
            { weight_kg: 27.5, reps: 12, rpe: 7.5, done: false },
            { weight_kg: 27.5, reps: 12, rpe: 7.5, done: false },
            { weight_kg: 27.5, reps: 12, rpe: 7.5, done: false },
          ],
        },
        {
          name: "EZ杆二头弯举",
          sets: [
            { weight_kg: prs.bicep_curl, reps: 12, rpe: 7.5, done: false },
            { weight_kg: prs.bicep_curl, reps: 12, rpe: 7.5, done: false },
            { weight_kg: prs.bicep_curl, reps: 12, rpe: 7.5, done: false },
          ],
        },
        {
          name: "Incline Dumbbell Face Pull",
          sets: [
            { weight_kg: 10, reps: 10, rpe: 7.5, done: false },
            { weight_kg: 10, reps: 10, rpe: 7.5, done: false },
            { weight_kg: 10, reps: 12, rpe: 7.5, done: false },
          ],
        },
      ],
    },

    // 6: Saturday - Back & Biceps (背·二头)
    6: {
      title: "背·二头",
      type: "strength",
      movements: [
        {
          name: "杠铃划船",
          sets: [
            { weight_kg: prs.row, reps: 8, rpe: 8.5, done: false },
            { weight_kg: prs.row, reps: 8, rpe: 8.5, done: false },
            { weight_kg: prs.row, reps: 8, rpe: 8.0, done: false },
          ],
        },
        {
          name: "引体向上",
          sets: [
            { weight_kg: 0, reps: 10, rpe: 8.0, done: false },
            { weight_kg: 0, reps: 10, rpe: 8.0, done: false },
            { weight_kg: 0, reps: 8, rpe: 8.0, done: false },
          ],
        },
        {
          name: "哑铃划船",
          sets: [
            { weight_kg: 27.5, reps: 12, rpe: 7.5, done: false },
            { weight_kg: 27.5, reps: 12, rpe: 7.5, done: false },
            { weight_kg: 27.5, reps: 12, rpe: 7.5, done: false },
          ],
        },
        {
          name: "EZ杆二头弯举",
          sets: [
            { weight_kg: prs.bicep_curl, reps: 12, rpe: 7.5, done: false },
            { weight_kg: prs.bicep_curl, reps: 12, rpe: 7.5, done: false },
            { weight_kg: prs.bicep_curl, reps: 12, rpe: 7.5, done: false },
          ],
        },
        {
          name: "Incline Dumbbell Face Pull",
          sets: [
            { weight_kg: 10, reps: 10, rpe: 7.5, done: false },
            { weight_kg: 10, reps: 10, rpe: 7.5, done: false },
            { weight_kg: 10, reps: 12, rpe: 7.5, done: false },
          ],
        },
      ],
    },
  };
}

/**
 * Scales a template day's workout for a target week based on the cycle multiplier.
 */
export function scaleWorkoutForWeek(
  templateDay: DaySchedule,
  multiplier: number,
  isDeload: boolean,
  weekIdx: number
): DaySchedule {
  if (templateDay.type === "rest") {
    return { ...templateDay };
  }

  if (templateDay.type === "cardio") {
    const origKm = templateDay.cardio_km || 5.0;
    const scaledKm = isDeload
      ? Math.round(origKm * 0.5 * 10) / 10
      : Math.round(origKm * multiplier * 10) / 10;
    return {
      ...templateDay,
      title: templateDay.title,
      cardio_km: scaledKm,
      notes: isDeload
        ? "超量恢复减载跑，极轻心率舒适巡航，让心肌与结缔组织充分排酸恢复。"
        : templateDay.notes,
    };
  }

  // Strength or Hybrid
  const scaledMovements: MovementPlan[] = (templateDay.movements || []).map((m, mIdx) => {
    // If deload: primary movement keeps 2 technique sets at 80% weight; secondary movements trimmed
    if (isDeload) {
      if (mIdx === 0) {
        const topSet = m.sets[0];
        const scaledWeight = topSet ? roundTo(topSet.weight_kg * 0.8, 2.5) : 0;
        return {
          ...m,
          sets: [
            { weight_kg: scaledWeight, reps: 3, rpe: 6.0, done: false },
            { weight_kg: scaledWeight, reps: 3, rpe: 6.0, done: false },
          ],
        };
      } else {
        // Minor secondary movement: 1 light set
        const topSet = m.sets[0];
        const scaledWeight = topSet ? roundTo(topSet.weight_kg * 0.75, 2.5) : 0;
        return {
          ...m,
          sets: [{ weight_kg: scaledWeight, reps: 8, rpe: 6.0, done: false }],
        };
      }
    }

    // Normal progression week (e.g. 90%, 95%, 100%)
    const sets = m.sets.map((s) => ({
      ...s,
      weight_kg: roundTo(s.weight_kg * multiplier, 2.5),
      rpe: Math.min(10, Math.max(6, Math.round(((s.rpe || 8) + (multiplier - 1.0) * 2) * 10) / 10)),
      done: false,
    }));

    return {
      ...m,
      sets,
    };
  });

  return {
    ...templateDay,
    title: templateDay.title,
    movements: scaledMovements,
    notes: isDeload
      ? "超量减载周：组数砍半，重量轻柔，彻底清空全身中枢疲劳，促进超量恢复。"
      : templateDay.notes,
  };
}

/**
 * Propagates the weekly peak template across all weeks of the cycle according to load_multipliers.
 */
export function propagateScheduleFromTemplate(
  config: CycleConfig,
  weeklyTemplate: Record<number, DaySchedule>
): Record<string, DaySchedule> {
  const result: Record<string, DaySchedule> = {};

  const [startY, startM, startD] = config.start_date.split("-").map(Number);
  const cycleStart = new Date(startY, startM - 1, startD);

  // Align start to Sunday of that week
  const sundayStart = new Date(cycleStart);
  sundayStart.setDate(sundayStart.getDate() - sundayStart.getDay());

  const totalWeeks = config.total_weeks || 4;
  const multipliers = config.load_multipliers || [0.90, 0.95, 1.00, 0.50];

  for (let w = 0; w < totalWeeks; w++) {
    const mult = multipliers[w] !== undefined ? multipliers[w] : 1.0;
    const isDeload = w === totalWeeks - 1 || mult <= 0.6;

    for (let d = 0; d < 7; d++) {
      const cur = new Date(sundayStart);
      cur.setDate(cur.getDate() + w * 7 + d);
      const dStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;

      const templateDay = weeklyTemplate[d];
      if (templateDay) {
        result[dStr] = scaleWorkoutForWeek(templateDay, mult, isDeload, w);
      }
    }
  }

  return result;
}

/**
 * Derives the baseline workout for a given date based on the cycle template and week's load multiplier.
 */
export function getCycleTemplateForDate(dateStr: string, plan: CyclePlan): DaySchedule {
  const { cycle_config } = plan;
  const [startY, startM, startD] = cycle_config.start_date.split("-").map(Number);
  const startDate = new Date(startY, startM - 1, startD);

  const [targetY, targetM, targetD] = dateStr.split("-").map(Number);
  const targetDate = new Date(targetY, targetM - 1, targetD);

  const diffTime = targetDate.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));
  const totalWeeks = cycle_config.total_weeks || 4;
  const weekIdx = Math.max(0, Math.min(totalWeeks - 1, Math.floor(diffDays / 7)));
  const multiplier = cycle_config.load_multipliers?.[weekIdx] ?? 1.0;
  const isDeload = weekIdx === totalWeeks - 1 || multiplier <= 0.6;

  const dayOfWeek = targetDate.getDay(); // 0: Sun, 1: Mon, 2: Tue, 3: Wed, 4: Thu, 5: Fri, 6: Sat

  const template = cycle_config.weekly_template || buildDefaultWeeklyPeakTemplate();
  const templateDay = template[dayOfWeek] || buildDefaultWeeklyPeakTemplate()[dayOfWeek];

  return scaleWorkoutForWeek(templateDay, multiplier, isDeload, weekIdx);
}

/** Strips legacy phase labels such as "[Peak 巅峰 100%] " from a day title. */
export function cleanDayTitle(title?: string): string {
  return (title || "").replace(/^\s*\[[^\]]*\]\s*/, "");
}
