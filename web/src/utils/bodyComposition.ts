import { BodyCompositionResult, UserProfile } from "./cycleTypes";
import { Analysis } from "../api";

export function computeBodyComposition(
  profile: UserProfile,
  analysis?: Analysis | null
): BodyCompositionResult {
  const weight_kg = profile.current_weight_kg || 75.0;
  const weight_lb = weight_kg * 2.20462;
  const height_cm = profile.height_cm || 178;
  const height_m = height_cm / 100;
  const body_fat_pct = profile.current_body_fat_pct || 16.0;

  // Fat Mass & LBM
  const fat_mass_kg = weight_kg * (body_fat_pct / 100);
  const fat_mass_lb = fat_mass_kg * 2.20462;
  const lbm_kg = weight_kg - fat_mass_kg;
  const lbm_lb = lbm_kg * 2.20462;

  // SMM estimation (Janssen/Lee formula: SMM ~ 0.54 * FFM for athletic males)
  const smm_kg = lbm_kg * 0.54;
  const smm_lb = smm_kg * 2.20462;

  // BMI
  const bmi = weight_kg / (height_m * height_m);
  let bmi_category = { en: "Normal", zh: "正常标准", color: "#10b981" };
  if (bmi < 18.5) {
    bmi_category = { en: "Underweight", zh: "体重偏低", color: "#3b82f6" };
  } else if (bmi >= 24 && bmi < 28) {
    bmi_category = { en: "Overweight / Muscular", zh: "微重/肌量丰富", color: "#f59e0b" };
  } else if (bmi >= 28) {
    bmi_category = { en: "Heavy / Muscular", zh: "高重/强壮体格", color: "#ef4444" };
  }

  // FFMI & Normalized FFMI (Kouri et al. 1995)
  const ffmi = lbm_kg / (height_m * height_m);
  const normalized_ffmi = ffmi + 6.1 * (1.8 - height_m);

  // FFMI Ranking
  let ffmi_ranking = {
    percentile: 45,
    badge_en: "Average / Untrained",
    badge_zh: "普通大众水平",
    desc_en: "Typical for unconditioned individuals",
    desc_zh: "普通缺乏系统力量训练人群基准",
    tier: "novice",
  };

  if (normalized_ffmi < 18.0) {
    ffmi_ranking = {
      percentile: 15,
      badge_en: "Below Average",
      badge_zh: "偏瘦 / 骨骼肌偏低",
      desc_en: "Below average muscularity",
      desc_zh: "肌肉储备偏低，建议适当增加蛋白质与抗阻力量训练",
      tier: "beginner",
    };
  } else if (normalized_ffmi >= 18.0 && normalized_ffmi < 19.5) {
    ffmi_ranking = {
      percentile: 45,
      badge_en: "Average Fit",
      badge_zh: "大众基准体格",
      desc_en: "Average muscular build",
      desc_zh: "超越 45% 大众人群，基础体格良好",
      tier: "average",
    };
  } else if (normalized_ffmi >= 19.5 && normalized_ffmi < 21.0) {
    ffmi_ranking = {
      percentile: 72,
      badge_en: "Athletic Build",
      badge_zh: "进阶运动者",
      desc_en: "Top 28% muscularity among active lifters",
      desc_zh: "超越 72% 人群，具有明显的规律训练痕迹",
      tier: "athletic",
    };
  } else if (normalized_ffmi >= 21.0 && normalized_ffmi < 22.5) {
    ffmi_ranking = {
      percentile: 88,
      badge_en: "Advanced Muscular",
      badge_zh: "高阶健美力量级",
      desc_en: "Top 12% among athletic gym-goers",
      desc_zh: "超越 88% 人群，处于健身房顶尖梯队，力量与肌量俱佳",
      tier: "advanced",
    };
  } else if (normalized_ffmi >= 22.5 && normalized_ffmi < 24.0) {
    ffmi_ranking = {
      percentile: 96,
      badge_en: "Elite Natural",
      badge_zh: "精英自然巅峰",
      desc_en: "Top 4% natural bodybuilding level",
      desc_zh: "超越 96% 人群，属于自然健身者中的佼佼者",
      tier: "elite",
    };
  } else {
    ffmi_ranking = {
      percentile: 99,
      badge_en: "Natural Genetic Limit",
      badge_zh: "自然极限天花板",
      desc_en: "Top 1% near genetic ceiling for naturals",
      desc_zh: "超越 99% 人群，逼近人类自然遗传肌肉极限",
      tier: "limit",
    };
  }

  // Body Fat Ranking (for men)
  let body_fat_ranking = {
    percentile: 70,
    badge_en: "Optimal Fitness",
    badge_zh: "优质力量体脂",
    desc_en: "Balanced for strength performance and metabolic health",
    desc_zh: "兼顾大重量爆发力与心血管代谢健康的黄金区间",
  };

  if (body_fat_pct < 10) {
    body_fat_ranking = {
      percentile: 97,
      badge_en: "Contest Shredded",
      badge_zh: "极低竞技干度",
      desc_en: "Top 3% lean, stage-ready body fat",
      desc_zh: "极低皮脂，血管清晰，适合短期冲刺不建议长期维持",
    };
  } else if (body_fat_pct >= 10 && body_fat_pct < 13.5) {
    body_fat_ranking = {
      percentile: 90,
      badge_en: "Athletic Lean (Visible Abs)",
      badge_zh: "精炼体态 · 腹肌清晰",
      desc_en: "Top 10% athletic aesthetic with razor sharp definition",
      desc_zh: "超越 90% 人群，腹肌清晰分明，推重比极高",
    };
  } else if (body_fat_pct >= 13.5 && body_fat_pct <= 17.5) {
    body_fat_ranking = {
      percentile: 75,
      badge_en: "Optimal Fitness",
      badge_zh: "运动黄金体脂",
      desc_en: "Top 25% healthy composition for hybrid power & endurance",
      desc_zh: "超越 75% 人群，混合体能（大重量+半马）的理想体态",
    };
  } else if (body_fat_pct > 17.5 && body_fat_pct <= 22) {
    body_fat_ranking = {
      percentile: 45,
      badge_en: "Healthy Standard",
      badge_zh: "日常健康范围",
      desc_en: "Normal healthy range, suitable for mild cutting",
      desc_zh: "身体健康，建议通过周期化 Mini-Cut 提升推重比",
    };
  } else {
    body_fat_ranking = {
      percentile: 20,
      badge_en: "Higher Fat",
      badge_zh: "体脂偏高",
      desc_en: "Cutting phase recommended to reduce visceral load",
      desc_zh: "建议配合赤字饮食开展减脂期",
    };
  }

  // Strength-to-Weight Ratios
  let bench1rm: number | null = null;
  let squat1rm: number | null = null;
  let deadlift1rm: number | null = null;

  if (analysis?.compound_prs) {
    for (const pr of analysis.compound_prs) {
      if (pr.key === "bench_press" || pr.name_zh?.includes("卧推")) {
        bench1rm = Math.max(bench1rm || 0, pr.best_1rm_kg || pr.max_weight_kg || 0);
      }
      if (pr.key === "squat" || pr.name_zh?.includes("深蹲")) {
        squat1rm = Math.max(squat1rm || 0, pr.best_1rm_kg || pr.max_weight_kg || 0);
      }
      if (pr.key === "deadlift" || pr.name_zh?.includes("硬拉")) {
        deadlift1rm = Math.max(deadlift1rm || 0, pr.best_1rm_kg || pr.max_weight_kg || 0);
      }
    }
  }

  // Default fallbacks if not found in compound_prs:
  if (!bench1rm) bench1rm = 115.0;
  if (!squat1rm) squat1rm = 150.0;
  if (!deadlift1rm) deadlift1rm = 175.0;

  const bench_ratio = Number((bench1rm / weight_kg).toFixed(2));
  const squat_ratio = Number((squat1rm / weight_kg).toFixed(2));
  const deadlift_ratio = Number((deadlift1rm / weight_kg).toFixed(2));
  const total_ratio = Number(((bench1rm + squat1rm + deadlift1rm) / weight_kg).toFixed(2));

  return {
    weight_kg: Number(weight_kg.toFixed(1)),
    weight_lb: Number(weight_lb.toFixed(1)),
    height_cm,
    body_fat_pct: Number(body_fat_pct.toFixed(1)),
    fat_mass_kg: Number(fat_mass_kg.toFixed(1)),
    fat_mass_lb: Number(fat_mass_lb.toFixed(1)),
    lbm_kg: Number(lbm_kg.toFixed(1)),
    lbm_lb: Number(lbm_lb.toFixed(1)),
    smm_kg: Number(smm_kg.toFixed(1)),
    smm_lb: Number(smm_lb.toFixed(1)),
    bmi: Number(bmi.toFixed(1)),
    bmi_category,
    ffmi: Number(ffmi.toFixed(1)),
    normalized_ffmi: Number(normalized_ffmi.toFixed(1)),
    ffmi_ranking,
    body_fat_ranking,
    strength_ratios: {
      bench: bench_ratio,
      squat: squat_ratio,
      deadlift: deadlift_ratio,
      total: total_ratio,
    },
  };
}
