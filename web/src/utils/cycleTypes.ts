export type Gender = "men" | "women";
export type MacroGoal = "cut" | "bulk" | "maintain";
export type CycleMode = "3:1" | "4:1" | "2:1" | "custom";
export type WorkoutType = "strength" | "cardio" | "rest" | "hybrid";

export interface BodyMetricEntry {
  date: string;
  weight_kg: number;
  body_fat_pct: number;
  notes?: string;
}

export interface UserProfile {
  height_cm: number;
  current_weight_kg: number;
  current_body_fat_pct: number;
  gender?: Gender;
  goal?: MacroGoal;
  target_weight_kg?: number;
  weekly_weight_change_kg?: number;
  daily_protein_g?: number;
  history_body_metrics: BodyMetricEntry[];
}

export interface CycleConfig {
  cycle_name: string;
  start_date: string;
  total_weeks: number;
  mode: CycleMode;
  load_multipliers: number[];
  week_names?: string[];
  weekly_template?: Record<number, DaySchedule>; // 0: Sun, 1: Mon, ..., 6: Sat (Peak PR Baseline)
}

export interface SetPlan {
  weight_kg: number;
  reps: number;
  rpe?: number;
  done?: boolean;
}

export interface MovementPlan {
  name: string;
  sets: SetPlan[];
  notes?: string;
}

export interface DaySchedule {
  title: string;
  type: WorkoutType;
  notes?: string;
  movements?: MovementPlan[];
  cardio_km?: number;
  target_hr_max?: number;
}

export interface CyclePlan {
  user_profile: UserProfile;
  cycle_config: CycleConfig;
  schedule: Record<string, DaySchedule>;
}

export interface BodyCompositionResult {
  weight_kg: number;
  weight_lb: number;
  height_cm: number;
  body_fat_pct: number;
  fat_mass_kg: number;
  fat_mass_lb: number;
  lbm_kg: number;
  lbm_lb: number;
  smm_kg: number;
  smm_lb: number;
  bmi: number;
  bmi_category: { en: string; zh: string; color: string };
  ffmi: number;
  normalized_ffmi: number;
  ffmi_ranking: {
    percentile: number;
    badge_en: string;
    badge_zh: string;
    desc_en: string;
    desc_zh: string;
    tier: string;
  };
  body_fat_ranking: {
    percentile: number;
    badge_en: string;
    badge_zh: string;
    desc_en: string;
    desc_zh: string;
  };
  strength_ratios: {
    bench: number | null;
    squat: number | null;
    deadlift: number | null;
    total: number | null;
  };
}
