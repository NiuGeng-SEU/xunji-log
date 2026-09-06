import React, { useEffect, useMemo, useState } from "react";
import { CompoundPr, CompoundPrSet } from "../api";
import { useWeightUnit } from "../units";
import { useLanguage } from "../language";
import strengthStandardsRaw from "../data/strengthStandards.json";

interface StandardsData {
  levels: Record<
    string,
    {
      percentile: number;
      name_en: string;
      name_zh: string;
      desc_en: string;
      desc_zh: string;
    }
  >;
  exercises: Record<
    string,
    {
      key: string;
      name_en: string;
      name_zh: string;
      icon: string;
      gif: string;
      standards: {
        by_weight_kg: Array<{
          bw_kg: number;
          beginner: number;
          novice: number;
          intermediate: number;
          advanced: number;
          elite: number;
        }>;
        by_weight_lb: Array<{
          bw_lb: number;
          beginner: number;
          novice: number;
          intermediate: number;
          advanced: number;
          elite: number;
        }>;
      };
    }
  >;
}

const standardsData = strengthStandardsRaw as unknown as StandardsData;

export interface BenchmarkThresholds {
  beginner: number;
  novice: number;
  intermediate: number;
  advanced: number;
  elite: number;
}

export function getBenchmarksForBw(
  exerciseKey: string,
  bwKg: number
): BenchmarkThresholds {
  const ex = standardsData.exercises[exerciseKey];
  if (!ex) {
    return { beginner: 0, novice: 0, intermediate: 0, advanced: 0, elite: 0 };
  }
  const rows = ex.standards.by_weight_kg;
  if (!rows || rows.length === 0) {
    return { beginner: 0, novice: 0, intermediate: 0, advanced: 0, elite: 0 };
  }

  if (bwKg <= rows[0].bw_kg) return rows[0];
  if (bwKg >= rows[rows.length - 1].bw_kg) return rows[rows.length - 1];

  for (let i = 0; i < rows.length - 1; i++) {
    const r0 = rows[i];
    const r1 = rows[i + 1];
    if (bwKg >= r0.bw_kg && bwKg <= r1.bw_kg) {
      const t = (bwKg - r0.bw_kg) / (r1.bw_kg - r0.bw_kg);
      return {
        beginner: Math.round((r0.beginner + t * (r1.beginner - r0.beginner)) * 10) / 10,
        novice: Math.round((r0.novice + t * (r1.novice - r0.novice)) * 10) / 10,
        intermediate: Math.round((r0.intermediate + t * (r1.intermediate - r0.intermediate)) * 10) / 10,
        advanced: Math.round((r0.advanced + t * (r1.advanced - r0.advanced)) * 10) / 10,
        elite: Math.round((r0.elite + t * (r1.elite - r0.elite)) * 10) / 10,
      };
    }
  }
  return rows[0];
}

export interface StrengthTierResult {
  percentile: number;
  tierKey: "beginner" | "novice" | "intermediate" | "advanced" | "elite";
  tierNameEn: string;
  tierNameZh: string;
  tierColor: string;
  nextTierNameEn: string | null;
  nextTierNameZh: string | null;
  targetWeightKg: number;
  weightToNextKg: number;
  weightToNextLb: number;
}

export function calculateStrengthTier(
  est1rmKg: number,
  benchmarks: BenchmarkThresholds
): StrengthTierResult {
  const points = [
    { w: 0, pct: 0 },
    { w: benchmarks.beginner, pct: 5 },
    { w: benchmarks.novice, pct: 20 },
    { w: benchmarks.intermediate, pct: 50 },
    { w: benchmarks.advanced, pct: 80 },
    { w: benchmarks.elite, pct: 95 },
    { w: benchmarks.elite * 1.25, pct: 99.9 },
  ];

  if (est1rmKg <= 0) {
    return {
      percentile: 0,
      tierKey: "beginner",
      tierNameEn: "Beginner",
      tierNameZh: "初学",
      tierColor: "#94a3b8",
      nextTierNameEn: "Novice",
      nextTierNameZh: "新手",
      targetWeightKg: benchmarks.novice,
      weightToNextKg: benchmarks.novice,
      weightToNextLb: Math.round(benchmarks.novice * 2.20462),
    };
  }

  let pct = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    if (est1rmKg >= p0.w && est1rmKg <= p1.w) {
      if (p1.w === p0.w) pct = p0.pct;
      else pct = p0.pct + ((est1rmKg - p0.w) / (p1.w - p0.w)) * (p1.pct - p0.pct);
      break;
    }
  }
  if (est1rmKg > points[points.length - 1].w) {
    pct = 99.9;
  }
  pct = Math.min(99.9, Math.max(0, Math.round(pct * 10) / 10));

  let tierKey: "beginner" | "novice" | "intermediate" | "advanced" | "elite" = "beginner";
  let tierNameEn = "Beginner";
  let tierNameZh = "初学";
  let tierColor = "#94a3b8";
  let nextTierNameEn: string | null = "Novice";
  let nextTierNameZh: string | null = "新手";
  let targetWeightKg = benchmarks.novice;

  if (pct >= 95) {
    tierKey = "elite";
    tierNameEn = "Elite";
    tierNameZh = "精英";
    tierColor = "#f59e0b"; // Gold / Amber
    nextTierNameEn = null;
    nextTierNameZh = null;
    targetWeightKg = benchmarks.elite * 1.1;
  } else if (pct >= 80) {
    tierKey = "advanced";
    tierNameEn = "Advanced";
    tierNameZh = "高级";
    tierColor = "#a855f7"; // Purple
    nextTierNameEn = "Elite";
    nextTierNameZh = "精英";
    targetWeightKg = benchmarks.elite;
  } else if (pct >= 50) {
    tierKey = "intermediate";
    tierNameEn = "Intermediate";
    tierNameZh = "中级";
    tierColor = "#10b981"; // Emerald
    nextTierNameEn = "Advanced";
    nextTierNameZh = "高级";
    targetWeightKg = benchmarks.advanced;
  } else if (pct >= 20) {
    tierKey = "novice";
    tierNameEn = "Novice";
    tierNameZh = "新手";
    tierColor = "#3b82f6"; // Blue
    nextTierNameEn = "Intermediate";
    nextTierNameZh = "中级";
    targetWeightKg = benchmarks.intermediate;
  } else {
    tierKey = "beginner";
    tierNameEn = "Beginner";
    tierNameZh = "初学";
    tierColor = "#94a3b8"; // Slate
    nextTierNameEn = "Novice";
    nextTierNameZh = "新手";
    targetWeightKg = benchmarks.novice;
  }

  const weightToNextKg = Math.max(0, Math.round((targetWeightKg - est1rmKg) * 10) / 10);
  const weightToNextLb = Math.max(0, Math.round(weightToNextKg * 2.20462 * 10) / 10);

  return {
    percentile: pct,
    tierKey,
    tierNameEn,
    tierNameZh,
    tierColor,
    nextTierNameEn,
    nextTierNameZh,
    targetWeightKg,
    weightToNextKg,
    weightToNextLb,
  };
}

interface MaxPrCardProps {
  prs?: CompoundPr[];
}

export default function MaxPrCard({ prs }: MaxPrCardProps) {
  const { unit } = useWeightUnit();
  const { language, t } = useLanguage();

  const [bodyweightKg, setBodyweightKg] = useState<number>(() => {
    const saved = localStorage.getItem("xunji-user-bw-kg");
    return saved ? Number(saved) : 75;
  });

  const [activeModalExercise, setActiveModalExercise] = useState<CompoundPr | null>(null);

  const handleSetBw = (bw: number) => {
    setBodyweightKg(bw);
    localStorage.setItem("xunji-user-bw-kg", String(bw));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeModalExercise) {
        setActiveModalExercise(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeModalExercise]);

  if (!prs || prs.length === 0) {
    return null;
  }

  const formatWeightVal = (valKg: number, valLb: number) => {
    const val = unit === "lb" ? valLb : valKg;
    const rounded = Math.round(val * 10) / 10;
    return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
  };

  return (
    <div className="max-pr-section">
      <div className="max-pr-card-container">
        {/* Header */}
        <div className="max-pr-header">
          <div className="max-pr-title-group">
            <h2 className="max-pr-title">Max & PR</h2>
            <span className="max-pr-subtitle">
              {t("Strength Standards · 1RM Benchmark", "五大黄金复合动作 · 力量评级与预估极限")}
            </span>
          </div>

          <div className="max-pr-header-actions">
            <div className="max-pr-bw-selector">
              <span className="max-pr-bw-label">{t("Bodyweight", "体重")}:</span>
              <div className="max-pr-bw-pills">
                {[65, 70, 75, 80].map((bw) => (
                  <button
                    key={bw}
                    type="button"
                    className={`max-pr-bw-btn ${bodyweightKg === bw ? "active" : ""}`}
                    onClick={() => handleSetBw(bw)}
                  >
                    {unit === "lb" ? `${Math.round(bw * 2.20462)} lb` : `${bw} kg`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 5 Compound Lift Items */}
        <div className="max-pr-list">
          {prs.map((pr) => {
            const benchmarks = getBenchmarksForBw(pr.key, bodyweightKg);
            const tier = calculateStrengthTier(pr.best_1rm_kg, benchmarks);
            const isZh = language === "zh";

            return (
              <div
                key={pr.key}
                className="max-pr-item clickable"
                onClick={() => setActiveModalExercise(pr)}
                role="button"
                tabIndex={0}
              >
                <div className="max-pr-item-left">
                  <div className="max-pr-icon-circle">
                    <img src={pr.icon} alt={pr.name_en} className="max-pr-icon-img" />
                  </div>

                  <div className="max-pr-info">
                    <div className="max-pr-name-row">
                      <span className="max-pr-name">
                        {isZh ? pr.name_zh : pr.name_en}
                      </span>
                      <span
                        className="max-pr-tier-badge"
                        style={{
                          color: tier.tierColor,
                          backgroundColor: `${tier.tierColor}18`,
                          borderColor: `${tier.tierColor}35`,
                        }}
                      >
                        {isZh ? tier.tierNameZh : tier.tierNameEn} {tier.percentile}%
                      </span>
                    </div>

                    <div className="max-pr-gauge-container">
                      <div className="max-pr-gauge-track">
                        <div
                          className="max-pr-gauge-fill"
                          style={{
                            width: `${Math.min(100, Math.max(4, tier.percentile))}%`,
                            backgroundColor: tier.tierColor,
                          }}
                        />
                      </div>
                      <span className="max-pr-gauge-hint">
                        {t(
                          `Top ${Math.max(1, Math.round(100 - tier.percentile))}% lifters`,
                          `超越 ${tier.percentile}% 训练者`
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="max-pr-item-right">
                  <div className="max-pr-stat-col">
                    <div className="max-pr-stat-val">
                      {formatWeightVal(pr.max_weight_kg, pr.max_weight_lb)}
                      <span className="max-pr-stat-unit"> {unit}</span>
                    </div>
                    <span className="max-pr-stat-lbl">{t("Max", "极限")}</span>
                  </div>

                  <div className="max-pr-stat-divider" />

                  <div className="max-pr-stat-col">
                    <div className="max-pr-stat-val highlight">
                      {formatWeightVal(pr.best_1rm_kg, pr.best_1rm_lb)}
                      <span className="max-pr-stat-unit"> {unit}</span>
                    </div>
                    <span className="max-pr-stat-lbl">{t("Est. 1RM", "预估 1RM")}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal / Detail View */}
      {activeModalExercise && (
        <ExerciseDetailModal
          exercise={activeModalExercise}
          bodyweightKg={bodyweightKg}
          onClose={() => setActiveModalExercise(null)}
        />
      )}
    </div>
  );
}

function ExerciseDetailModal({
  exercise,
  bodyweightKg,
  onClose,
}: {
  exercise: CompoundPr;
  bodyweightKg: number;
  onClose: () => void;
}) {
  const { unit } = useWeightUnit();
  const { language, t } = useLanguage();
  const isZh = language === "zh";

  const benchmarks = getBenchmarksForBw(exercise.key, bodyweightKg);
  const tier = calculateStrengthTier(exercise.best_1rm_kg, benchmarks);

  const displayBw = unit === "lb" ? `${Math.round(bodyweightKg * 2.20462)} lb` : `${bodyweightKg} kg`;

  const formatVal = (kg: number) => {
    const val = unit === "lb" ? kg * 2.20462 : kg;
    const rounded = Math.round(val * 10) / 10;
    return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
  };

  const levelsList = [
    { key: "beginner", nameEn: "Beginner", nameZh: "初学者", pct: 5, weightKg: benchmarks.beginner, color: "#94a3b8" },
    { key: "novice", nameEn: "Novice", nameZh: "新手", pct: 20, weightKg: benchmarks.novice, color: "#3b82f6" },
    { key: "intermediate", nameEn: "Intermediate", nameZh: "中级", pct: 50, weightKg: benchmarks.intermediate, color: "#10b981" },
    { key: "advanced", nameEn: "Advanced", nameZh: "高级", pct: 80, weightKg: benchmarks.advanced, color: "#a855f7" },
    { key: "elite", nameEn: "Elite", nameZh: "精英", pct: 95, weightKg: benchmarks.elite, color: "#f59e0b" },
  ];

  return (
    <div className="max-pr-modal-backdrop" onClick={onClose}>
      <div className="max-pr-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="max-pr-modal-header">
          <div className="max-pr-modal-title-group">
            <div className="max-pr-icon-circle modal-icon">
              <img src={exercise.icon} alt={exercise.name_en} className="max-pr-icon-img" />
            </div>
            <div>
              <h3 className="max-pr-modal-title">
                {isZh ? exercise.name_zh : exercise.name_en}
              </h3>
              <p className="max-pr-modal-sub">
                {isZh ? exercise.name_en : exercise.name_zh} · {t("Standards @", "参考体重")} {displayBw}
              </p>
            </div>
          </div>
          <button className="max-pr-modal-close" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="max-pr-modal-body">
          {/* Top Demo: Animation GIF & Key Metrics */}
          <div className="max-pr-modal-hero">
            <div className="max-pr-modal-gif-container">
              <img
                src={exercise.gif}
                alt={`${exercise.name_en} Demonstration`}
                className="max-pr-modal-gif"
              />
              <span className="max-pr-modal-gif-tag">{t("Biomechanics Demo", "动作轨迹演示")}</span>
            </div>

            <div className="max-pr-modal-stats">
              {/* Est 1RM Stat */}
              <div className="max-pr-stat-card highlight">
                <span className="max-pr-stat-card-label">{t("Estimated 1RM", "预估单次极限 (1RM)")}</span>
                <div className="max-pr-stat-card-val">
                  {formatVal(exercise.best_1rm_kg)} <span className="stat-unit">{unit}</span>
                </div>
                <div className="max-pr-stat-card-meta">
                  {exercise.best_1rm_weight} {exercise.best_1rm_unit} × {exercise.best_1rm_reps} reps · {exercise.best_1rm_date}
                </div>
              </div>

              {/* Max Weight Stat */}
              <div className="max-pr-stat-card">
                <span className="max-pr-stat-card-label">{t("Max Working Weight", "最高训练负重 (Max Weight)")}</span>
                <div className="max-pr-stat-card-val">
                  {formatVal(exercise.max_weight_kg)} <span className="stat-unit">{unit}</span>
                </div>
                <div className="max-pr-stat-card-meta">
                  {exercise.max_orig_weight} {exercise.max_orig_unit} × {exercise.max_reps} reps · {exercise.max_date}
                </div>
              </div>

              {/* Tier & Lifetime Sets */}
              <div className="max-pr-stat-card mini">
                <div>
                  <span className="max-pr-stat-card-label">{t("Strength Tier", "力量等级")}</span>
                  <div className="tier-tag-pill" style={{ color: tier.tierColor, backgroundColor: `${tier.tierColor}18` }}>
                    {isZh ? tier.tierNameZh : tier.tierNameEn} ({tier.percentile}%)
                  </div>
                </div>
                <div>
                  <span className="max-pr-stat-card-label">{t("Lifetime Sets", "累计组数")}</span>
                  <div className="tier-sets-val">{exercise.total_sets} {t("sets", "组")}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Strength Level Gauge & Fitting Line */}
          <div className="max-pr-gauge-card">
            <div className="max-pr-gauge-header">
              <h4>{t("Strength Level Milestone Curve", "力量进阶曲线与同体重百分位")}</h4>
              <span className="tier-standing-pill" style={{ backgroundColor: `${tier.tierColor}20`, color: tier.tierColor }}>
                {t(
                  `Stronger than ${tier.percentile}% of lifters`,
                  `超越同体重 ${tier.percentile}% 的训练者`
                )}
              </span>
            </div>

            {/* Visual Milestones Bar */}
            <div className="max-pr-milestones-track">
              {/* Markers for 5 tiers */}
              {levelsList.map((lvl) => (
                <div
                  key={lvl.key}
                  className="milestone-mark"
                  style={{ left: `${Math.min(98, Math.max(2, lvl.pct))}%` }}
                >
                  <div className="milestone-dot" style={{ borderColor: lvl.color }} />
                  <span className="milestone-lbl">{isZh ? lvl.nameZh : lvl.nameEn} ({lvl.pct}%)</span>
                  <span className="milestone-wt">{formatVal(lvl.weightKg)} {unit}</span>
                </div>
              ))}

              {/* User Position Pin */}
              <div
                className="user-pin"
                style={{
                  left: `${Math.min(97, Math.max(3, tier.percentile))}%`,
                  borderColor: tier.tierColor,
                }}
              >
                <div className="user-pin-bubble" style={{ backgroundColor: tier.tierColor }}>
                  {formatVal(exercise.best_1rm_kg)} {unit} ({tier.percentile}%)
                </div>
                <div className="user-pin-arrow" style={{ borderTopColor: tier.tierColor }} />
              </div>
            </div>

            {/* Next Tier Incentive Hint */}
            <div className="max-pr-next-hint">
              {tier.nextTierNameEn ? (
                <>
                  <span className="next-icon">🎯</span>
                  <span>
                    {t(
                      `Next Goal: Add +${formatVal(tier.weightToNextKg)} ${unit} to Est. 1RM to reach ${tier.nextTierNameEn} (${isZh ? tier.nextTierNameZh : tier.nextTierNameEn})!`,
                      `下一进阶目标：Est. 1RM 再提升 +${formatVal(tier.weightToNextKg)} ${unit}，即可晋级 ${tier.nextTierNameZh} (${tier.nextTierNameEn})！`
                    )}
                  </span>
                </>
              ) : (
                <>
                  <span className="next-icon">🏆</span>
                  <span>
                    {t(
                      "Incredible achievement! You have attained Elite standard in this lift.",
                      "无可匹敌！你已经达到该动作的精英 (Elite) 级别！"
                    )}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Standards Benchmark Table */}
          <div className="max-pr-table-card">
            <h4>
              {t("Strength Standards Reference (StrengthLevel.com)", "StrengthLevel 官方等级标准参考")}
              <span className="table-sub"> · {t("Male, Bodyweight", "男子，体重")} {displayBw}</span>
            </h4>
            <table className="max-pr-standards-table">
              <thead>
                <tr>
                  <th>{t("Level", "等级")}</th>
                  <th>{t("Percentile", "同级比例")}</th>
                  <th>{t("Standard 1RM", "标准 1RM")}</th>
                  <th>{t("Description", "技术与经验要求")}</th>
                  <th>{t("Status", "达成状态")}</th>
                </tr>
              </thead>
              <tbody>
                {levelsList.map((lvl) => {
                  const isReached = exercise.best_1rm_kg >= lvl.weightKg;
                  const isCurrent = tier.tierKey === lvl.key;
                  return (
                    <tr key={lvl.key} className={`${isCurrent ? "current-row" : ""} ${isReached ? "reached-row" : ""}`}>
                      <td>
                        <span className="table-level-badge" style={{ color: lvl.color, borderColor: `${lvl.color}40`, backgroundColor: `${lvl.color}15` }}>
                          {isZh ? lvl.nameZh : lvl.nameEn}
                        </span>
                      </td>
                      <td>{t(`Stronger than ${lvl.pct}%`, `超越 ${lvl.pct}%`)}</td>
                      <td className="table-wt-val">
                        <strong>{formatVal(lvl.weightKg)} {unit}</strong>
                      </td>
                      <td className="table-desc">
                        {lvl.key === "beginner" && t("Practiced properly for >1 month", "掌握标准动作，系统训练超1个月")}
                        {lvl.key === "novice" && t("Trained regularly for >6 months", "规律进阶训练超6个月")}
                        {lvl.key === "intermediate" && t("Trained consistently for >2 years", "严谨系统训练超2年")}
                        {lvl.key === "advanced" && t("Progressed diligently for >5 years", "持续深耕训练超5年")}
                        {lvl.key === "elite" && t("Dedicated athlete / competitive caliber", "达到力量举/专业竞技水准")}
                      </td>
                      <td>
                        {isReached ? (
                          <span className="status-badge done">✓ {t("Achieved", "已达成")}</span>
                        ) : (
                          <span className="status-badge pending">
                            +{formatVal(Math.max(0, lvl.weightKg - exercise.best_1rm_kg))} {unit}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Top Sets Logged */}
          {exercise.top_sets && exercise.top_sets.length > 0 && (
            <div className="max-pr-history-card">
              <h4>{t("Top PR Sets in Log History", "历史最佳 PR 组纪录")}</h4>
              <div className="max-pr-history-list">
                {exercise.top_sets.slice(0, 5).map((s: CompoundPrSet, idx: number) => (
                  <div key={idx} className="max-pr-history-item">
                    <span className="hist-rank">#{idx + 1}</span>
                    <span className="hist-val">
                      {unit === "lb" ? `${s.weight_lb} lb` : `${s.weight_kg} kg`} × {s.reps} reps
                    </span>
                    <span className="hist-e1rm">
                      Est. 1RM: {unit === "lb" ? `${s.est_1rm_lb} lb` : `${s.est_1rm_kg} kg`}
                    </span>
                    <span className="hist-date">{s.date}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
