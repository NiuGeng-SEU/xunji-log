import React, { useMemo } from "react";
import { Analysis } from "../../api";
import { useWeightUnit, formatWeight } from "../../units";
import { useLanguage } from "../../language";

interface Props {
  movementName: string;
  plannedWeightKg: number;
  plannedReps: number;
  analysis: Analysis | null;
  onApplyPresetWeight?: (weightKg: number) => void;
}

export default function MovementHistoryDiff({
  movementName,
  plannedWeightKg,
  plannedReps,
  analysis,
  onApplyPresetWeight,
}: Props) {
  const { t } = useLanguage();
  const { unit } = useWeightUnit();

  // Look up movement in analysis.compound_prs or top_movements
  const record = useMemo(() => {
    if (!analysis) return null;
    const trimmed = (movementName || "").trim().toLowerCase();

    // 1. Check compound_prs
    if (analysis.compound_prs) {
      const found = analysis.compound_prs.find((c) => {
        const nameZh = (c.name_zh || "").toLowerCase();
        const nameEn = (c.name_en || "").toLowerCase();
        return nameZh.includes(trimmed) || trimmed.includes(nameZh) || nameEn.includes(trimmed) || trimmed.includes(nameEn);
      });
      if (found) return found;
    }

    // 2. Check top_movements
    if (analysis.top_movements) {
      const found = analysis.top_movements.find((m) => m.name.toLowerCase() === trimmed);
      if (found) {
        return {
          name_zh: found.name,
          name_en: found.name,
          best_1rm_kg: Math.round((found.volume_kg / Math.max(1, found.sets)) * 1.2),
          max_weight_kg: Math.round(found.volume_kg / Math.max(1, found.sets)),
          max_reps: 5,
          max_date: analysis.date_end,
          recent_sets: [],
        };
      }
    }

    return null;
  }, [analysis, movementName]);

  if (!movementName || !record) {
    return (
      <div className="history-diff-empty">
        <span className="info-icon">ℹ️</span>
        <span>{t("Select or enter a standard movement to compare historic PRs and last sessions.", "选择或输入常见动作名称，右侧将自动对比历史最佳 PR 与上次完成组数。")}</span>
      </div>
    );
  }

  const best1rm = record.best_1rm_kg || record.max_weight_kg || 0;
  const maxWeight = record.max_weight_kg || 0;
  const maxReps = record.max_reps || 1;
  const maxDate = record.max_date || "";

  // Compare planned with last known max/set
  const weightDiff = plannedWeightKg > 0 ? plannedWeightKg - maxWeight : 0;
  const isOverload = weightDiff > 0;
  const isDeload = weightDiff < -10;

  return (
    <div className="history-diff-card">
      <div className="diff-header-row">
        <div className="diff-title-col">
          <span className="diff-tag">{t("Historic Benchmark", "历史档案对比")}</span>
          <h4 className="diff-movement-title">{record.name_zh || movementName}</h4>
        </div>

        {onApplyPresetWeight && maxWeight > 0 && (
          <div className="diff-actions-col">
            <button
              type="button"
              className="btn-diff-action"
              onClick={() => onApplyPresetWeight(maxWeight)}
              title={t("Copy last top set weight", "直接采用历史重量")}
            >
              📋 {t("Use", "采用")} {formatWeight(maxWeight, unit)}
            </button>
            <button
              type="button"
              className="btn-diff-action highlight"
              onClick={() => onApplyPresetWeight(maxWeight + 2.5)}
              title={t("Overload +2.5kg", "在上次基础上超负荷 +2.5kg")}
            >
              ⚡ +2.5kg
            </button>
          </div>
        )}
      </div>

      <div className="diff-stats-grid">
        <div className="diff-stat-item">
          <div className="stat-lbl">{t("Estimated 1RM", "预估极限 1RM")}</div>
          <div className="stat-val blue">{formatWeight(best1rm, unit)}</div>
          <div className="stat-sub">{t("All-time Peak", "历史巅峰极值")}</div>
        </div>

        <div className="diff-stat-item">
          <div className="stat-lbl">{t("Last Top Weight", "最高组记录")}</div>
          <div className="stat-val amber">{formatWeight(maxWeight, unit)}</div>
          <div className="stat-sub">{maxReps} {t("Reps", "次")} · {maxDate}</div>
        </div>

        <div className="diff-stat-item">
          <div className="stat-lbl">{t("Planned Target", "本次计划负荷")}</div>
          <div className="stat-val primary">{formatWeight(plannedWeightKg, unit)}</div>
          <div className="stat-sub">{plannedReps} {t("Reps", "次")}</div>
        </div>

        <div className="diff-stat-item">
          <div className="stat-lbl">{t("Delta vs History", "相比历史差异")}</div>
          <div className={`stat-val ${isOverload ? "green" : isDeload ? "blue" : "neutral"}`}>
            {weightDiff === 0 ? "—" : `${isOverload ? "+" : ""}${formatWeight(weightDiff, unit)}`}
          </div>
          <div className="stat-sub">
            {isOverload ? t("↗ Progressive Overload", "↗ 渐进超负荷冲刺") : isDeload ? t("↘ Deload / Recovery", "↘ 减载与技术巩固") : t("Steady weight", "同等负荷打磨")}
          </div>
        </div>
      </div>
    </div>
  );
}
