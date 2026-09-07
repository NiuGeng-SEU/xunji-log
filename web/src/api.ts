export interface Analysis {
  date_start: string;
  date_end: string;
  n_days: number;
  n_sessions: number;
  n_movements: number;
  total_volume_kg: number;
  total_sets: number;
  total_done_sets: number;
  total_duration_min: number;
  avg_session_duration_min: number;
  avg_sessions_per_week: number;
  max_streak_days: number;
  avg_gap_days: number;
  monthly: {
    labels: string[];
    sessions: number[];
    days: number[];
    volume_tons: number[];
    duration_hours: number[];
    cardio_km: number[];
    cardio_kcal: number[];
  };
  weekly: { labels: string[]; sessions: number[] };
  cardio: {
    n_sessions: number;
    n_strength_sessions: number;
    total_km: number;
    total_kcal: number;
    avg_hr: number;
    max_hr: number;
  };
  dow: { labels: string[]; sessions: number[] };
  hour_of_day: { labels: string[]; sessions: number[] };
  categories: { labels: string[]; sessions: number[] };
  top_movements: Array<{
    name: string;
    days: number;
    sessions: number;
    sets: number;
    volume_kg: number;
    category: string;
  }>;
  daily: Array<{
    date: string;
    sessions: number;
    volume_kg: number;
    duration_min: number;
    cardio_km: number;
    cardio_kcal: number;
  }>;
  category_monthly: {
    labels: string[];
    series: Array<{ name: string; data: number[] }>;
  };
  category_monthly_sessions?: {
    labels: string[];
    series: Array<{ name: string; data: number[] }>;
  };
  movement_monthly_days?: {
    labels: string[];
    series: Array<{ name: string; data: number[] }>;
  };
  movement_trends: {
    labels: string[];
    series: Array<{ name: string; data: number[] }>;
  };
  movement_prs: Array<{
    name: string;
    max_weight_kg: number;
    reps: string;
    date: string;
    category: string;
  }>;
  cardio_sessions: Array<{
    date: string;
    title: string;
    distance_km: number;
    kcal: number;
    duration_min: number;
    avg_hr: number;
  }>;
  strength_summary?: StrengthSummary;
  compound_prs?: CompoundPr[];
}

export interface CompoundPrSet {
  date: string;
  weight: number;
  reps: number;
  unit: string;
  weight_kg: number;
  weight_lb: number;
  est_1rm_kg: number;
  est_1rm_lb: number;
}

export interface CompoundPr {
  key: string;
  name_en: string;
  name_zh: string;
  icon: string;
  gif: string;
  max_weight_kg: number;
  max_weight_lb: number;
  max_reps: number;
  max_date: string;
  max_orig_weight: number;
  max_orig_unit: string;
  best_1rm_kg: number;
  best_1rm_lb: number;
  best_1rm_weight: number;
  best_1rm_reps: number;
  best_1rm_date: string;
  best_1rm_unit: string;
  total_sets: number;
  top_sets?: CompoundPrSet[];
  recent_sets?: CompoundPrSet[];
  history?: CompoundPrSet[];
}

export interface StrengthSummary {
  total_workouts: number;
  total_volume_kg: number;
  total_duration_hours: number;
  total_years: number;
  calendar_years: number;
  latest_activity: {
    date: string;
    title: string;
    duration_min: number;
    volume_kg: number;
  };
  workout_dates: string[];
  workout_details: Record<string, { date: string; title: string; duration_min: number; volume_kg: number }>;
  compound_prs?: CompoundPr[];
  streaks: {
    current_days: number;
    max_days: number;
    current_weeks: number;
    max_weeks: number;
  };
  goals: {
    weekly_target: number;
    monthly_target: number;
    yearly_target: number;
    this_week: {
      workouts: number;
      duration_hours: number;
      diff_last_week: number;
    };
    this_month: {
      workouts: number;
      duration_hours: number;
      diff_last_month: number;
    };
    this_year: {
      workouts: number;
      duration_hours: number;
      diff_last_year: number;
    };
  };
}

export async function fetchAnalysis(): Promise<Analysis> {
  // 1. In local dev mode with proxy, try /api/analysis first
  if (import.meta.env.DEV) {
    try {
      const res = await fetch("/api/analysis");
      if (res.ok) return await res.json();
    } catch {
      // fallback to static
    }
  }

  // 2. Try static data path (works for GitHub Pages, Vercel, and static dist)
  const base = import.meta.env.BASE_URL || "./";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const staticUrl = `${normalizedBase}data/analysis.json`;

  try {
    const res = await fetch(staticUrl);
    if (res.ok) return await res.json();
  } catch {
    // fallback
  }

  // 3. Try standard /api/analysis if running on custom server
  try {
    const res = await fetch("/api/analysis");
    if (res.ok) return await res.json();
  } catch {
    // fallback
  }

  // 4. Fallback to direct relative path
  try {
    const fallbackRes = await fetch("./data/analysis.json");
    if (fallbackRes.ok) return await fallbackRes.json();
  } catch {
    // fallback
  }

  throw new Error("Unable to load workout analysis data.");
}

export async function refreshAnalysis(): Promise<void> {
  const res = await fetch("/api/refresh", { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
}

export interface DaySet {
  index?: number;
  done: boolean;
  weight_kg: number | null;
  reps: string | null;
  rpe: string | null;
  rest_seconds: number | null;
  volume_kg: number;
  cardio: {
    distance_km: number | null;
    kcal: number | null;
    avg_hr: number | null;
    max_hr: number | null;
    duration_sec: number | null;
  } | null;
}

export interface DayMovement {
  name: string;
  category: string;
  is_cardio: boolean;
  sets_count: number;
  done_sets: number;
  volume_kg: number;
  max_weight_kg: number | null;
  cardio_km: number;
  cardio_kcal: number;
  sets: DaySet[];
}

export interface DaySession {
  localid?: number;
  title: string;
  note: string;
  start_time: string | null;
  end_time: string | null;
  duration_min: number;
  volume_kg: number;
  cardio_km: number;
  cardio_kcal: number;
  categories: Record<string, number>;
  movements: DayMovement[];
  n_movements: number;
  n_sets: number;
}

export interface DayDetail {
  datestr: string;
  count: number;
  summary: {
    sessions: number;
    volume_kg: number;
    duration_min: number;
    cardio_km: number;
    cardio_kcal: number;
    n_movements: number;
    n_sets: number;
    categories: Array<{ name: string; count: number }>;
    top_movements: Array<{ name: string; volume_kg: number; category: string }>;
  };
  insights: string[];
  compare: {
    volume_vs_avg?: number;
    duration_vs_avg?: number;
  };
  sessions: DaySession[];
}

export async function fetchDayDetail(datestr: string): Promise<DayDetail> {
  const res = await fetch(`/api/day/${datestr}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Failed to load ${datestr}`);
  }
  return res.json();
}

export type DrillType =
  | "day"
  | "month"
  | "week"
  | "category"
  | "movement"
  | "dow"
  | "hour"
  | "hour_bucket";

export interface DrillQuery {
  type: DrillType;
  key: string;
}

export interface DrillResult {
  type: DrillType;
  view?: "day" | "movement" | "category" | "period" | "rhythm" | "aggregate";
  key: string;
  title: string;
  day?: DayDetail;
  movement?: MovementDrill;
  category?: CategoryDrill;
  summary?: {
    sessions: number;
    days: number;
    volume_kg: number;
    duration_min: number;
    cardio_km: number;
    cardio_kcal: number;
    n_sets: number;
    n_movements: number;
    categories: Array<{ name: string; count: number }>;
    top_movements: Array<{
      name: string;
      volume_kg: number;
      category: string;
      days?: number;
      sets?: number;
    }>;
  };
  insights?: string[];
  daily?: Array<{
    date: string;
    sessions: number;
    volume_kg: number;
    duration_min: number;
    cardio_km: number;
    cardio_kcal: number;
  }>;
  series?: {
    dates: string[];
    volume_kg?: number[];
    sessions?: number[];
    cardio_km?: number[];
    max_weight_kg?: number[];
  };
  sessions_preview?: Array<{
    datestr: string;
    title: string;
    start_time: string | null;
    end_time: string | null;
    duration_min: number;
    volume_kg: number;
    cardio_km: number;
    n_movements: number;
    n_sets: number;
    categories: Record<string, number>;
    movement_names: string[];
  }>;
  progression?: Array<{
    date: string;
    max_weight_kg: number | null;
    volume_kg: number;
    sets: number;
    best_reps: string | null;
    cardio_km: number | null;
  }>;
  monthly?: { labels: string[]; volume_tons: number[] };
  date_start?: string | null;
  date_end?: string | null;
}

export interface MovementHistoryEntry {
  date: string;
  session_title: string;
  start_time: string | null;
  sets: Array<{
    index?: number;
    done: boolean;
    weight_kg: number | null;
    reps: string | null;
    rpe: string | null;
    volume_kg: number;
    cardio_km?: number | null;
    cardio_kcal?: number | null;
  }>;
  done_sets: number;
  max_weight_kg: number | null;
  volume_kg: number;
  is_cardio: boolean;
}

export interface MovementDrill {
  name: string;
  category: string;
  pr: {
    max_weight_kg: number;
    reps: string;
    date: string;
    volume_kg: number;
  } | null;
  stats: {
    training_days: number;
    total_sets: number;
    total_volume_kg: number;
    first_date: string | null;
    last_date: string | null;
    early_avg_weight_kg: number | null;
    late_avg_weight_kg: number | null;
  };
  insights: string[];
  progression: Array<{
    date: string;
    max_weight_kg: number | null;
    volume_kg: number;
    sets: number;
    best_reps: string | null;
    cardio_km: number | null;
  }>;
  monthly: {
    labels: string[];
    volume_tons: number[];
    max_weight_kg: number[];
    training_days: number[];
  };
  history: MovementHistoryEntry[];
}

export interface CategoryDrill {
  name: string;
  movements: Array<{
    name: string;
    days: number;
    sets: number;
    volume_kg: number;
  }>;
}

export async function fetchDrill(type: DrillType, key: string): Promise<DrillResult> {
  const qs = new URLSearchParams({ type, key }).toString();

  // 1. In local dev mode with proxy, try /api/drill first
  if (import.meta.env.DEV) {
    try {
      const res = await fetch(`/api/drill?${qs}`);
      if (res.ok) {
        const text = await res.text();
        if (text.startsWith("{")) {
          return JSON.parse(text);
        }
      }
    } catch {
      // fallback to static
    }
  }

  // 2. Try static pre-generated drill JSON (works on GitHub Pages / Vercel)
  const base = import.meta.env.BASE_URL || "./";
  const cleanBase = base.endsWith("/") ? base : `${base}/`;
  const safeKey = key.replace(/\//g, "_");
  const staticUrl = `${cleanBase}data/drill/${type}/${encodeURIComponent(safeKey)}.json`;

  try {
    const res = await fetch(staticUrl);
    if (res.ok) {
      const text = await res.text();
      if (text.startsWith("{")) {
        return JSON.parse(text);
      }
    }
  } catch {
    // fallback
  }

  // 3. Try custom backend if not yet tried
  try {
    const res = await fetch(`/api/drill?${qs}`);
    if (res.ok) {
      const text = await res.text();
      if (text.startsWith("{")) {
        return JSON.parse(text);
      }
    }
  } catch {
    // fallback
  }

  // 4. If type is 'day', and no record exists (e.g. rest day or empty day), return friendly empty day
  if (type === "day") {
    return {
      type: "day",
      view: "day",
      key,
      title: `${key} 训练日详情`,
      day: {
        datestr: key,
        count: 0,
        summary: {
          sessions: 0,
          volume_kg: 0,
          duration_min: 0,
          cardio_km: 0,
          cardio_kcal: 0,
          n_movements: 0,
          n_sets: 0,
          categories: [],
          top_movements: [],
        },
        insights: ["该日为休息日，无训练记录。"],
        compare: {},
        sessions: [],
      },
    };
  }

  throw new Error(`暂无 ${type}: ${key} 的详细下钻数据`);
}

/** 从 echarts click 事件取类目名（兼容 axis / pie）。 */
export function chartClickName(params: unknown): string | null {
  const p = params as {
    name?: string;
    data?: unknown;
    seriesType?: string;
  };
  if (typeof p?.name === "string" && p.name) return p.name;
  if (Array.isArray(p?.data) && typeof p.data[0] === "string") return p.data[0];
  if (p?.data && typeof p.data === "object" && p.data !== null && "name" in p.data) {
    const n = (p.data as { name?: string }).name;
    if (n) return n;
  }
  return null;
}

export function chartClickIndex(params: unknown): number | null {
  const p = params as { dataIndex?: number };
  return typeof p?.dataIndex === "number" ? p.dataIndex : null;
}
