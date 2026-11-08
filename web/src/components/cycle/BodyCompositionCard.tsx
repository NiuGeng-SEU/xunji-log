import React, { useMemo, useState } from "react";
import { BodyCompositionResult, BodyMetricEntry, CycleConfig, UserProfile } from "../../utils/cycleTypes";
import { useWeightUnit, formatWeight, KG_PER_LB } from "../../units";
import { useLanguage } from "../../language";
import { useAuth } from "../../utils/auth";
import Chart, { axisStyle } from "../Chart";

interface Props {
  profile: UserProfile;
  cycleConfig: CycleConfig;
  composition: BodyCompositionResult;
  onUpdateProfile: (updated: UserProfile) => Promise<boolean> | void;
  onOpenLogin?: () => void;
}

// US Navy Circumference-based Body Fat % Formula
function calcNavyBodyFat(
  gender: "men" | "women",
  heightCm: number,
  neckCm: number,
  waistCm: number,
  hipCm?: number
): number | null {
  if (heightCm <= 0 || neckCm <= 0 || waistCm <= 0) return null;
  if (gender === "women") {
    const hip = hipCm || waistCm;
    if (waistCm + hip <= neckCm) return null;
    const val =
      495 /
        (1.29579 -
          0.35004 * Math.log10(waistCm + hip - neckCm) +
          0.22100 * Math.log10(heightCm)) -
      450;
    if (isNaN(val) || !isFinite(val)) return null;
    return Math.max(8, Math.min(60, Math.round(val * 10) / 10));
  } else {
    if (waistCm <= neckCm) return null;
    const val =
      495 /
        (1.0324 -
          0.19077 * Math.log10(waistCm - neckCm) +
          0.15456 * Math.log10(heightCm)) -
      450;
    if (isNaN(val) || !isFinite(val)) return null;
    return Math.max(3, Math.min(50, Math.round(val * 10) / 10));
  }
}

function getBodyFatTier(bf: number, gender: "men" | "women") {
  if (gender === "women") {
    if (bf < 16) return { en: "Extremely Lean", zh: "极低体脂 / 赛季状态", color: "#8b5cf6" };
    if (bf <= 20) return { en: "Athletic / Cut", zh: "运动健美 / 腹肌清晰", color: "#10b981" };
    if (bf <= 24) return { en: "Fitness / Lean", zh: "健康紧致 / 良好线条", color: "#059669" };
    if (bf <= 31) return { en: "Average / Healthy", zh: "大众标准 / 健康体态", color: "#2563eb" };
    return { en: "Overfat", zh: "偏高 / 建议减脂", color: "#f59e0b" };
  } else {
    if (bf < 10) return { en: "Extremely Lean", zh: "极低体脂 / 赛季状态", color: "#8b5cf6" };
    if (bf <= 14) return { en: "Athletic / Cut", zh: "运动健美 / 腹肌清晰", color: "#10b981" };
    if (bf <= 17) return { en: "Fitness / Lean", zh: "健康紧致 / 腹肌轮廓", color: "#059669" };
    if (bf <= 24) return { en: "Average / Healthy", zh: "大众标准 / 匀称健康", color: "#2563eb" };
    return { en: "Overfat", zh: "偏高 / 建议减脂", color: "#f59e0b" };
  }
}

export default function BodyCompositionCard({
  profile,
  cycleConfig,
  composition,
  onUpdateProfile,
  onOpenLogin,
}: Props) {
  const { t } = useLanguage();
  const { unit } = useWeightUnit();
  const { isAdmin } = useAuth();

  const getTodayStr = () => new Date().toISOString().slice(0, 10);

  const [inputDate, setInputDate] = useState(getTodayStr());
  const [inputWeight, setInputWeight] = useState(
    unit === "lb"
      ? (profile.current_weight_kg * 2.20462).toFixed(1)
      : profile.current_weight_kg.toString()
  );
  const [inputFat, setInputFat] = useState(profile.current_body_fat_pct.toString());
  const [inputNotes, setInputNotes] = useState("");
  const [showCalculator, setShowCalculator] = useState(false);

  // Soft ruler calculator state
  const [calcNeck, setCalcNeck] = useState("38");
  const [calcWaist, setCalcWaist] = useState("84");
  const [calcHip, setCalcHip] = useState("96");

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // Display metrics
  const displayWeight = formatWeight(composition.weight_kg, unit);
  const displayLbm = formatWeight(composition.lbm_kg, unit);
  const displayFat = formatWeight(composition.fat_mass_kg, unit);
  const displaySmm = formatWeight(composition.smm_kg, unit);

  // Keep input weight synchronized if unit toggles
  React.useEffect(() => {
    setInputWeight(
      unit === "lb"
        ? (profile.current_weight_kg * 2.20462).toFixed(1)
        : profile.current_weight_kg.toString()
    );
  }, [unit, profile.current_weight_kg]);

  // Calculator logic
  const userGender = profile.gender || "men";
  const userHeightCm = profile.height_cm || 178;

  const calculatedFat = useMemo(() => {
    const neck = Number(calcNeck);
    const waist = Number(calcWaist);
    const hip = Number(calcHip);
    return calcNavyBodyFat(userGender, userHeightCm, neck, waist, hip);
  }, [userGender, userHeightCm, calcNeck, calcWaist, calcHip]);

  const calculatedTier = useMemo(() => {
    if (calculatedFat == null) return null;
    return getBodyFatTier(calculatedFat, userGender);
  }, [calculatedFat, userGender]);

  const handleApplyCalculatedFat = () => {
    if (calculatedFat != null) {
      setInputFat(calculatedFat.toString());
    }
  };

  // 1. Build the full cycle timeline (e.g. 28 days for 4 weeks)
  const totalWeeks = cycleConfig?.total_weeks || 4;
  const totalDays = totalWeeks * 7;
  const startDateStr = cycleConfig?.start_date || "2026-11-01";

  const timelineDates = useMemo(() => {
    const list: string[] = [];
    const [sY, sM, sD] = startDateStr.split("-").map(Number);
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(sY, sM - 1, sD + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      list.push(`${y}-${m}-${day}`);
    }
    return list;
  }, [startDateStr, totalDays]);

  // 2. Base weight of the cycle (first recorded entry or current_weight_kg)
  const baseWeightKg = useMemo(() => {
    const history = profile.history_body_metrics || [];
    if (history.length > 0) {
      return history[0].weight_kg;
    }
    return profile.current_weight_kg || 77.0;
  }, [profile.history_body_metrics, profile.current_weight_kg]);

  // 3. Weekly rate of change based on goal (Mini-Cut / Bulk / Maintenance)
  const weeklyRateKg = useMemo(() => {
    if (profile.goal === "cut") {
      if (profile.weekly_weight_change_kg && profile.weekly_weight_change_kg < 0) {
        return profile.weekly_weight_change_kg;
      }
      return -0.4;
    } else if (profile.goal === "bulk") {
      if (profile.weekly_weight_change_kg && profile.weekly_weight_change_kg > 0) {
        return profile.weekly_weight_change_kg;
      }
      return 0.25;
    } else {
      return 0;
    }
  }, [profile.goal, profile.weekly_weight_change_kg]);

  // 4. Projected weight series across the 28 days
  const projectedSeriesData = useMemo(() => {
    return timelineDates.map((_, idx) => {
      const projKg = baseWeightKg + idx * (weeklyRateKg / 7);
      const displayVal = unit === "lb" ? projKg * 2.20462 : projKg;
      return Math.round(displayVal * 10) / 10;
    });
  }, [timelineDates, baseWeightKg, weeklyRateKg, unit]);

  // 5. Actual measurements mapped by date
  const actualMetricMap = useMemo(() => {
    const map = new Map<string, BodyMetricEntry>();
    for (const m of profile.history_body_metrics || []) {
      map.set(m.date, m);
    }
    return map;
  }, [profile.history_body_metrics]);

  const actualWeightSeriesData = useMemo(() => {
    return timelineDates.map((dateStr) => {
      const m = actualMetricMap.get(dateStr);
      if (!m) return null;
      const displayVal = unit === "lb" ? m.weight_kg * 2.20462 : m.weight_kg;
      return Math.round(displayVal * 10) / 10;
    });
  }, [timelineDates, actualMetricMap, unit]);

  const actualFatSeriesData = useMemo(() => {
    return timelineDates.map((dateStr) => {
      const m = actualMetricMap.get(dateStr);
      return m ? m.body_fat_pct : null;
    });
  }, [timelineDates, actualMetricMap]);

  const targetWeightDisplay = profile.target_weight_kg
    ? Math.round((unit === "lb" ? profile.target_weight_kg * 2.20462 : profile.target_weight_kg) * 10) / 10
    : null;

  // Header metric summaries
  const latestEntry =
    profile.history_body_metrics && profile.history_body_metrics.length > 0
      ? profile.history_body_metrics[profile.history_body_metrics.length - 1]
      : { date: startDateStr, weight_kg: baseWeightKg, body_fat_pct: profile.current_body_fat_pct };

  const totalDeficitGoalKg = profile.target_weight_kg
    ? Number((latestEntry.weight_kg - profile.target_weight_kg).toFixed(1))
    : null;
  const totalDeficitGoalDisplay =
    totalDeficitGoalKg != null
      ? unit === "lb"
        ? `${(totalDeficitGoalKg * 2.20462).toFixed(1)} lb`
        : `${totalDeficitGoalKg > 0 ? "-" : "+"}${Math.abs(totalDeficitGoalKg)} kg`
      : null;

  const weeklyPaceDisplay =
    unit === "lb"
      ? `${(weeklyRateKg * 2.20462).toFixed(2)} lb/${t("wk", "周")}`
      : `${weeklyRateKg > 0 ? "+" : ""}${weeklyRateKg} kg/${t("wk", "周")}`;

  // ECharts Option with Projection Line & Actual Points
  const chartOption = useMemo(() => {
    const todayStr = getTodayStr();
    const markLineData: any[] = [];

    if (targetWeightDisplay) {
      markLineData.push({
        yAxis: targetWeightDisplay,
        lineStyle: { color: "#10b981", width: 2, type: "dashed" },
        label: {
          formatter: `🎯 ${t("Target", "目标")}: ${targetWeightDisplay} ${unit.toUpperCase()}`,
          position: "insideEndTop",
          color: "#059669",
          fontSize: 11,
          fontWeight: "bold",
        },
      });
    }

    if (timelineDates.includes(todayStr)) {
      markLineData.push({
        xAxis: todayStr,
        lineStyle: { color: "#3b82f6", width: 1.5, type: "dashed" },
        label: {
          formatter: `${t("Today", "今日")}`,
          position: "insideEndBottom",
          color: "#2563eb",
          fontSize: 11,
          fontWeight: "bold",
        },
      });
    }

    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(255, 255, 255, 0.96)",
        borderColor: "#cbd5e1",
        textStyle: { color: "#1e293b", fontSize: 12 },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const pIdx = params[0].dataIndex;
          const dateStr = timelineDates[pIdx];
          const m = actualMetricMap.get(dateStr);
          const projVal = projectedSeriesData[pIdx];

          const diffDays = Math.floor(
            (new Date(dateStr).getTime() - new Date(startDateStr).getTime()) / (1000 * 3600 * 24)
          );
          const weekNum = Math.floor(diffDays / 7) + 1;

          let html = `<div style="font-weight:700;margin-bottom:6px;color:#0f172a;">${dateStr} <span style="font-size:11px;color:#64748b;font-weight:normal;">(Week ${weekNum})</span></div>`;
          html += `<div style="color:#6366f1;margin-bottom:3px;">● ${t("Projected Plan", "计划预测轨迹")}: <b>${projVal} ${unit.toUpperCase()}</b></div>`;

          if (m) {
            const displayW = unit === "lb" ? (m.weight_kg * 2.20462).toFixed(1) : m.weight_kg.toFixed(1);
            const delta = Number((Number(displayW) - projVal).toFixed(1));
            const deltaTag =
              delta === 0
                ? `<span style="color:#10b981;font-weight:600;">(与预测完全一致)</span>`
                : delta > 0
                ? `<span style="color:#f59e0b;font-weight:600;">(高于计划 +${delta})</span>`
                : `<span style="color:#059669;font-weight:600;">(低于计划 ${delta})</span>`;

            html += `<div style="color:#2563eb;margin-bottom:3px;">● ${t("Actual Weight", "实测体重")}: <b>${displayW} ${unit.toUpperCase()}</b> ${deltaTag}</div>`;
            html += `<div style="color:#d97706;margin-bottom:3px;">● ${t("Body Fat", "实测体脂率")}: <b>${m.body_fat_pct}%</b></div>`;

            const lbmKg = m.weight_kg * (1 - m.body_fat_pct / 100);
            const displayLbm = unit === "lb" ? (lbmKg * 2.20462).toFixed(1) : lbmKg.toFixed(1);
            html += `<div style="color:#059669;margin-bottom:3px;">● ${t("Lean Mass (LBM)", "去脂体重")}: <b>${displayLbm} ${unit.toUpperCase()}</b></div>`;

            if (m.notes) {
              html += `<div style="font-size:11px;color:#64748b;margin-top:5px;border-top:1px dashed #e2e8f0;padding-top:4px;">📝 ${m.notes}</div>`;
            }
          } else {
            html += `<div style="font-size:11px;color:#94a3b8;margin-top:2px;"><i>${t("No measurement logged yet", "当日暂无实测记录")}</i></div>`;
          }

          return html;
        },
      },
      legend: {
        data: [
          t("Projected Trajectory", "计划预测轨迹"),
          t("Actual Weight", "实测体重"),
          t("Body Fat %", "实测体脂率"),
        ],
        top: 0,
        textStyle: { color: "#64748b", fontSize: 11 },
      },
      grid: {
        left: 45,
        right: 45,
        top: 36,
        bottom: 25,
      },
      xAxis: {
        type: "category",
        data: timelineDates,
        ...axisStyle,
        axisLabel: {
          color: "#94a3b8",
          fontSize: 11,
          formatter: (val: string) => val.slice(5),
        },
      },
      yAxis: [
        {
          type: "value",
          name: `${t("Weight", "体重")} (${unit.toUpperCase()})`,
          nameTextStyle: { color: "#94a3b8", fontSize: 10 },
          ...axisStyle,
          scale: true,
          splitLine: { lineStyle: { color: "#f1f5f9" } },
        },
        {
          type: "value",
          name: `${t("Body Fat", "体脂率")} (%)`,
          nameTextStyle: { color: "#94a3b8", fontSize: 10 },
          ...axisStyle,
          scale: true,
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: t("Projected Trajectory", "计划预测轨迹"),
          type: "line",
          data: projectedSeriesData,
          smooth: 0.15,
          symbol: "none",
          lineStyle: { width: 2, color: "#6366f1", type: "dashed" },
          itemStyle: { color: "#6366f1" },
          markLine: markLineData.length > 0 ? { silent: true, symbol: "none", data: markLineData } : undefined,
        },
        {
          name: t("Actual Weight", "实测体重"),
          type: "line",
          data: actualWeightSeriesData,
          connectNulls: true,
          smooth: 0.2,
          symbol: "circle",
          symbolSize: 8,
          lineStyle: { width: 3, color: "#2563eb" },
          itemStyle: { color: "#2563eb", borderColor: "#ffffff", borderWidth: 1.5 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(37, 99, 235, 0.16)" },
                { offset: 1, color: "rgba(37, 99, 235, 0.0)" },
              ],
            },
          },
        },
        {
          name: t("Body Fat %", "实测体脂率"),
          type: "line",
          yAxisIndex: 1,
          data: actualFatSeriesData,
          connectNulls: true,
          smooth: 0.2,
          symbol: "diamond",
          symbolSize: 8,
          lineStyle: { width: 2.2, color: "#d97706" },
          itemStyle: { color: "#d97706" },
        },
      ],
    };
  }, [
    timelineDates,
    projectedSeriesData,
    actualWeightSeriesData,
    actualFatSeriesData,
    actualMetricMap,
    targetWeightDisplay,
    startDateStr,
    unit,
    t,
  ]);

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      if (onOpenLogin) onOpenLogin();
      return;
    }

    let wKg = Number(inputWeight);
    if (unit === "lb") {
      wKg = wKg * KG_PER_LB;
    }
    const fatPct = Number(inputFat);
    if (isNaN(wKg) || wKg <= 30 || isNaN(fatPct) || fatPct <= 3) {
      alert(t("Please enter a valid weight (>30 kg) and body fat (>3%)", "请输入有效的体重（>30kg）与体脂率（>3%）"));
      return;
    }

    const logDate = inputDate.trim() || getTodayStr();
    const newEntry: BodyMetricEntry = {
      date: logDate,
      weight_kg: Number(wKg.toFixed(2)),
      body_fat_pct: Number(fatPct.toFixed(1)),
      notes: inputNotes.trim() || undefined,
    };

    // Update existing date record or add new
    const existing = [...(profile.history_body_metrics || [])];
    const existingIdx = existing.findIndex((item) => item.date === logDate);
    if (existingIdx >= 0) {
      existing[existingIdx] = newEntry;
    } else {
      existing.push(newEntry);
    }
    existing.sort((a, b) => a.date.localeCompare(b.date));

    // The most recent record sets current_weight_kg & current_body_fat_pct
    const latest = existing[existing.length - 1];

    const updatedProfile: UserProfile = {
      ...profile,
      current_weight_kg: latest.weight_kg,
      current_body_fat_pct: latest.body_fat_pct,
      history_body_metrics: existing,
    };

    setIsSaving(true);
    setSaveStatus(null);
    try {
      const ok = await onUpdateProfile(updatedProfile);
      setSaveStatus({
        ok: true,
        msg: ok
          ? t("✓ Saved to data/cycle_plan.json dataset successfully!", "✓ 体重与体脂记录已更新并自动持久化写入 data/cycle_plan.json 数据集！")
          : t("✓ Updated in local browser cache", "✓ 已更新并存入浏览器缓存"),
      });
      setInputNotes("");
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err) {
      console.error(err);
      setSaveStatus({
        ok: false,
        msg: t("Failed to save, please retry", "保存失败，请重试"),
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="body-composition-card">
      <div className="composition-header">
        <div>
          <h3 className="card-section-title">
            ⚖️ {t("Body Composition & Population Benchmark", "体成分解析与同龄人群段位排名")}
          </h3>
        </div>
      </div>

      {/* Grid of Key Composition Metrics */}
      <div className="composition-grid">
        <div className="comp-metric-box">
          <div className="comp-lbl">{t("Body Weight", "当前体重")}</div>
          <div className="comp-val primary">{displayWeight}</div>
          <div className="comp-sub">
            BMI: <b>{composition.bmi}</b> (
            <span style={{ color: composition.bmi_category.color }}>
              {t(composition.bmi_category.en, composition.bmi_category.zh)}
            </span>
            )
          </div>
        </div>

        <div className="comp-metric-box">
          <div className="comp-lbl">{t("Body Fat %", "当前体脂率")}</div>
          <div className="comp-val amber">{composition.body_fat_pct}%</div>
          <div className="comp-sub">
            {t("Fat Mass", "纯脂肪重")}: {displayFat}
          </div>
        </div>

        <div className="comp-metric-box">
          <div className="comp-lbl">{t("Lean Mass (LBM)", "去脂体重 (瘦体重)")}</div>
          <div className="comp-val green">{displayLbm}</div>
          <div className="comp-sub">
            {t("Skeletal Muscle (SMM)", "骨骼肌估算")}: ~{displaySmm}
          </div>
        </div>

        <div className="comp-metric-box highlight">
          <div className="comp-lbl">{t("Normalized FFMI (MMBI)", "去脂肌肉指数 (FFMI / MMBI)")}</div>
          <div className="comp-val purple">{composition.normalized_ffmi}</div>
          <div className="comp-sub">
            {t("Raw FFMI", "原始 FFMI")}: {composition.ffmi} · {t("Height", "身高")}: {composition.height_cm}cm
          </div>
        </div>
      </div>

      {/* Population Ranking & Badges Cluster */}
      <div className="population-ranking-section">
        <h4 className="ranking-section-subtitle">
          🏆 {t("Population Percentiles & Rank Tiers", "人群常模百分位与段位勋章")}
        </h4>

        <div className="ranking-cards-cluster">
          {/* FFMI Rank */}
          <div className="ranking-badge-card ffmi-card">
            <div className="badge-tag-row">
              <span className="badge-pill purple">FFMI {composition.normalized_ffmi}</span>
              <span className="badge-percentile">
                {t("Top", "超越")} <b>{composition.ffmi_ranking.percentile}%</b> {t("Lifters", "人群")}
              </span>
            </div>
            <div className="badge-title">
              {t(composition.ffmi_ranking.badge_en, composition.ffmi_ranking.badge_zh)}
            </div>
            <p className="badge-desc">
              {t(composition.ffmi_ranking.desc_en, composition.ffmi_ranking.desc_zh)}
            </p>
            <div className="percentile-track">
              <div
                className="percentile-bar purple"
                style={{ width: `${composition.ffmi_ranking.percentile}%` }}
              />
            </div>
          </div>

          {/* Body Fat Rank */}
          <div className="ranking-badge-card fat-card">
            <div className="badge-tag-row">
              <span className="badge-pill amber">{composition.body_fat_pct}% BF</span>
              <span className="badge-percentile">
                {t("Top", "超越")} <b>{composition.body_fat_ranking.percentile}%</b> {t("Aesthetics", "形体")}
              </span>
            </div>
            <div className="badge-title">
              {t(composition.body_fat_ranking.badge_en, composition.body_fat_ranking.badge_zh)}
            </div>
            <p className="badge-desc">
              {t(composition.body_fat_ranking.desc_en, composition.body_fat_ranking.desc_zh)}
            </p>
            <div className="percentile-track">
              <div
                className="percentile-bar amber"
                style={{ width: `${composition.body_fat_ranking.percentile}%` }}
              />
            </div>
          </div>

          {/* Big-3 Strength-to-Weight Ratio */}
          <div className="ranking-badge-card ratio-card">
            <div className="badge-tag-row">
              <span className="badge-pill blue">
                {t("Big 3 Total", "三大项推重比")}: {composition.strength_ratios.total}× BW
              </span>
              <span className="badge-percentile">
                {t("Top 15% Lifters", "超越 ~85% 训练者")}
              </span>
            </div>
            <div className="ratio-sub-row">
              <span>{t("Bench", "卧推")}: <b>{composition.strength_ratios.bench}×</b></span>
              <span>{t("Squat", "深蹲")}: <b>{composition.strength_ratios.squat}×</b></span>
              <span>{t("Deadlift", "硬拉")}: <b>{composition.strength_ratios.deadlift}×</b></span>
            </div>
            <p className="badge-desc">
              {t(
                "Elite push-to-bodyweight strength. Bench press > 1.5x bodyweight puts you in the advanced lifter echelon.",
                "力量举推重比极高。卧推突破 1.5 倍自重，深蹲接近 2 倍自重，处于进阶力量运动员级别。"
              )}
            </p>
            <div className="percentile-track">
              <div className="percentile-bar blue" style={{ width: "85%" }} />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Body Weight & Body Fat Trajectory Figure with Prediction */}
      <div className="weight-trend-section">
        <div className="weight-trend-header">
          <div className="weight-trend-title-wrap">
            <h4 className="trend-section-subtitle">
              📈 {t("Body Weight Trajectory & Cycle Projection", "体重轨迹与周期减脂预测")}
            </h4>
            <div className="trend-subtitle-desc">
              <span className="text-proj-indigo">-- {t("Projected Plan", "计划预测轨迹")}</span>
              <span className="dot-sep">·</span>
              <span className="text-actual-blue">● {t("Actual Weigh-in", "实测打卡")}</span>
              <span className="dot-sep">·</span>
              <span className="text-fat-amber">◆ {t("Body Fat %", "体脂率")}</span>
              {profile.target_weight_kg && (
                <>
                  <span className="dot-sep">·</span>
                  <span className="text-target-green">
                    🎯 {t("Goal Target", "目标基准")}: {formatWeight(profile.target_weight_kg, unit)}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="weight-metrics-cluster">
            <div className="weight-badge">
              <span className="lbl">{t("Base Weight", "基准体重")}</span>
              <span className="val blue">{formatWeight(baseWeightKg, unit)}</span>
            </div>
            {targetWeightDisplay && (
              <div className="weight-badge">
                <span className="lbl">{t("Target Weight", "目标体重")}</span>
                <span className="val green">{targetWeightDisplay} {unit.toUpperCase()}</span>
              </div>
            )}
            {totalDeficitGoalDisplay && (
              <div className="weight-badge">
                <span className="lbl">{profile.goal === "cut" ? t("To Target", "距目标") : t("Delta", "目标差距")}</span>
                <span className="val green">{totalDeficitGoalDisplay}</span>
              </div>
            )}
            <div className="weight-badge">
              <span className="lbl">{t("Planned Pace", "计划速率")}</span>
              <span className="val purple">{weeklyPaceDisplay}</span>
            </div>
            <div className="weight-badge">
              <span className="lbl">{t("Current Body Fat", "当前体脂")}</span>
              <span className="val amber">{composition.body_fat_pct}%</span>
            </div>
          </div>
        </div>

        <div className="weight-chart-wrapper">
          <Chart option={chartOption} height={270} />
        </div>
      </div>

      {/* 5. Fast Weigh-in Input Form & Navy Body Fat Calculator (Protected by Owner Lock) */}
      <div className="weighin-control-card">
        <div className="weighin-control-header">
          <div>
            <h4 className="weighin-control-title">
              📝 {t("Log Body Weight & Body Fat", "记录体重与体脂打卡")}
            </h4>
            <p className="weighin-control-hint">
              {isAdmin
                ? t(
                    "Input your measurements. Automatically updates and persists directly to the database.",
                    "录入测量数据，将自动保存至体重数据库并即时刷新上方趋势曲线与去脂常模。"
                  )
                : t(
                    "Weight logging and body fat measurements are locked for visitors.",
                    "体重与体脂打卡功能处于访客只读状态。站长解锁后可录入测量数据。"
                  )}
            </p>
          </div>

          {isAdmin && (
            <button
              type="button"
              className={`btn-calc-toggle${showCalculator ? " is-active" : ""}`}
              onClick={() => setShowCalculator(!showCalculator)}
            >
              📐 {showCalculator ? t("Close Tape Calculator", "收起皮尺计算器") : t("Tape Measure Body Fat Calculator", "软皮尺测体脂计算器")}
            </button>
          )}
        </div>

        {!isAdmin ? (
          <div className="weighin-locked-banner">
            <div className="locked-banner-text">
              <span className="locked-banner-icon">🔒</span>
              <div>
                <div className="locked-banner-title">
                  {t("Owner Access Required", "站长专属打卡入口")}
                </div>
                <div className="locked-banner-desc">
                  {t(
                    "Weigh-in logging is protected. Unlock with owner credentials to record new body measurements.",
                    "当前处于公开只读模式。站长解锁后可录入每日称重与软皮尺测量数据，并自动存入数据库。"
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn-cycle-login"
              onClick={onOpenLogin}
            >
              🔒 {t("Owner Unlock", "站长解锁")}
            </button>
          </div>
        ) : (
          <>
            {/* Navy Tape Measure Calculator Panel */}
            {showCalculator && (
              <div className="navy-calculator-panel">
                <div className="calc-panel-header">
                  <div className="calc-title">
                    📐 {t("U.S. Navy Body Fat Calculator (Tape Measure Method)", "美国海军软皮尺体脂公式计算器")}
                  </div>
                  <div className="calc-desc">
                    {t(
                      "Uses neck and waist circumferences (measured with a soft ruler) to estimate body fat with clinical accuracy.",
                      "国际公认的无仪器高精度测量法：仅需一条软皮尺，测量颈围与腰围即可估算体脂率。"
                    )}
                  </div>
                </div>

                <div className="calc-inputs-grid">
                  <div className="calc-field">
                    <label>
                      {t("Neck Circumference (cm)", "颈围 (cm)")}
                      <span className="field-hint">{t("Typically 36~41 cm, stable", "成年人极稳定，一般 36~41cm")}</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      className="cycle-input"
                      value={calcNeck}
                      onChange={(e) => setCalcNeck(e.target.value)}
                    />
                  </div>

                  <div className="calc-field">
                    <label>
                      {t("Waist Circumference (cm)", "腰围 (cm)")}
                      <span className="field-hint">{t("Horizontally at navel in morning", "晨起空腹，软皮尺水平经过肚脐一周")}</span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      className="cycle-input"
                      value={calcWaist}
                      onChange={(e) => setCalcWaist(e.target.value)}
                    />
                  </div>

                  {userGender === "women" && (
                    <div className="calc-field">
                      <label>
                        {t("Hip Circumference (cm)", "臀围 (cm)")}
                        <span className="field-hint">{t("Widest point of hips", "臀部最宽处水平一周")}</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        className="cycle-input"
                        value={calcHip}
                        onChange={(e) => setCalcHip(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="calc-result-box">
                    <div className="result-lbl">{t("Calculated Body Fat", "估算体脂率结果")}</div>
                    <div className="result-val-row">
                      <span className="result-number">
                        {calculatedFat != null ? `${calculatedFat}%` : "—"}
                      </span>
                      {calculatedTier && (
                        <span
                          className="result-tier-pill"
                          style={{ color: calculatedTier.color, borderColor: calculatedTier.color }}
                        >
                          {t(calculatedTier.en, calculatedTier.zh)}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn-apply-calc"
                      onClick={handleApplyCalculatedFat}
                      disabled={calculatedFat == null}
                    >
                      ✓ {t("Apply to Body Fat % Input", "填入下方体脂率")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Input Form */}
            <form className="quick-weighin-form" onSubmit={handleAddLog}>
              <div className="weighin-inputs-row">
                <div className="input-group">
                  <label>{t("Measurement Date", "测量日期")}</label>
                  <input
                    type="date"
                    className="cycle-input"
                    value={inputDate}
                    onChange={(e) => setInputDate(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>{t("Body Weight", "体重")} ({unit.toUpperCase()})</label>
                  <input
                    type="number"
                    step="0.1"
                    className="cycle-input"
                    value={inputWeight}
                    onChange={(e) => setInputWeight(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>{t("Body Fat %", "体脂率 (%)")}</label>
                  <input
                    type="number"
                    step="0.1"
                    className="cycle-input"
                    value={inputFat}
                    onChange={(e) => setInputFat(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group flex-2">
                  <label>{t("Notes", "打卡备注 (如晨起空腹)")}</label>
                  <input
                    type="text"
                    className="cycle-input"
                    placeholder={t("e.g. morning fasting", "例如：晨起空腹、排便后")}
                    value={inputNotes}
                    onChange={(e) => setInputNotes(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn-log-weighin" disabled={isSaving}>
                  {isSaving ? t("Saving…", "正在保存…") : `💾 ${t("Save to Database", "记录并保存至数据库")}`}
                </button>
              </div>

              {saveStatus && (
                <div className={`weighin-save-toast ${saveStatus.ok ? "is-ok" : "is-err"}`}>
                  {saveStatus.msg}
                </div>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
