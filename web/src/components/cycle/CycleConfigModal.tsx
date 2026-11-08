import React, { useState } from "react";
import { Analysis } from "../../api";
import { CycleConfig, CycleMode, DaySchedule, MacroGoal, UserProfile } from "../../utils/cycleTypes";
import { useLanguage } from "../../language";
import { useWeightUnit, LB_PER_KG, KG_PER_LB } from "../../units";
import {
  buildDefaultWeeklyPeakTemplate,
  extractPeakPRsFromAnalysis,
  findPRForMovement,
  propagateScheduleFromTemplate,
  roundTo,
  syncWeeklyTemplateFromAnalysis,
} from "../../utils/cycleTemplates";

interface Props {
  config: CycleConfig;
  profile: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (newConfig: CycleConfig, newProfile: UserProfile, newSchedule?: Record<string, DaySchedule>) => void;
  analysis?: Analysis | null;
  initialTab?: "config" | "template";
}

export default function CycleConfigModal({
  config,
  profile,
  isOpen,
  onClose,
  onUpdate,
  analysis = null,
  initialTab = "config",
}: Props) {
  const { t } = useLanguage();
  const { unit } = useWeightUnit();

  const toDisplayVal = (kg: number): number => {
    if (unit === "kg") return kg;
    const lb = kg * LB_PER_KG;
    return Math.abs(lb - Math.round(lb)) < 0.15 ? Math.round(lb) : Math.round(lb * 10) / 10;
  };

  const fromDisplayVal = (val: number): number => {
    if (unit === "kg") return val;
    return Math.round(val * KG_PER_LB * 10) / 10;
  };

  const [activeTab, setActiveTab] = useState<"config" | "template">(initialTab);

  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Tab 1 state
  const [name, setName] = useState(config.cycle_name);
  const [startDate, setStartDate] = useState(config.start_date);
  const [mode, setMode] = useState<CycleMode>(config.mode || "custom");
  const [totalWeeks, setTotalWeeks] = useState(config.total_weeks || 4);
  const [multipliers, setMultipliers] = useState<number[]>(
    config.load_multipliers || [0.90, 0.95, 1.0, 0.5]
  );

  const [goal, setGoal] = useState<MacroGoal>(profile.goal || "cut");
  const [targetWeight, setTargetWeight] = useState(profile.target_weight_kg || 73.0);
  const [weeklyChange, setWeeklyChange] = useState(profile.weekly_weight_change_kg || -0.4);
  const [dailyProtein, setDailyProtein] = useState(profile.daily_protein_g || 160);

  // Tab 2 state: 7-day Weekly Peak Template (0: Sun to 6: Sat)
  const [weeklyTemplate, setWeeklyTemplate] = useState<Record<number, DaySchedule>>(() => {
    return config.weekly_template || buildDefaultWeeklyPeakTemplate(analysis);
  });
  const [autoPropagate, setAutoPropagate] = useState<boolean>(true);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const applyPreset = (presetMode: CycleMode) => {
    setMode(presetMode);
    if (presetMode === "3:1") {
      setTotalWeeks(4);
      setMultipliers([0.75, 0.85, 1.0, 0.5]);
    } else if (presetMode === "4:1") {
      setTotalWeeks(5);
      setMultipliers([0.75, 0.85, 0.95, 1.0, 0.5]);
    } else if (presetMode === "2:1") {
      setTotalWeeks(3);
      setMultipliers([0.8, 1.0, 0.5]);
    }
  };

  const handleWeeksChange = (newWeeks: number) => {
    const clamped = Math.max(1, Math.min(8, newWeeks));
    setTotalWeeks(clamped);
    const updated = [...multipliers];
    while (updated.length < clamped) {
      updated.push(1.0);
    }
    setMultipliers(updated.slice(0, clamped));
  };

  const handleMultiplierChange = (idx: number, val: number) => {
    const updated = [...multipliers];
    updated[idx] = val;
    setMultipliers(updated);
    setMode("custom");
  };

  // Sync latest PRs for EVERY movement in schedule from history
  const handleSyncPRs = () => {
    const { updatedTemplate, syncedCount } = syncWeeklyTemplateFromAnalysis(weeklyTemplate, analysis);
    setWeeklyTemplate(updatedTemplate);
    setSyncMsg(
      t(
        `Synced best historical PRs for all ${syncedCount} movements into the template!`,
        `已从历史记录同步全部 ${syncedCount} 项动作的最高 PR 成绩至模板！`
      )
    );
  };

  // Update a day's cardio distance in weeklyTemplate
  const updateCardioKm = (dayIdx: number, km: number) => {
    setWeeklyTemplate((prev) => {
      const cur = prev[dayIdx];
      if (!cur) return prev;
      return {
        ...prev,
        [dayIdx]: {
          ...cur,
          cardio_km: km,
        },
      };
    });
  };

  // Update a day's primary movement top set weight
  const updatePrimaryWeight = (indices: number[], weightKg: number) => {
    setWeeklyTemplate((prev) => {
      let updated = { ...prev };
      for (const dayIdx of indices) {
        const cur = updated[dayIdx];
        if (!cur || !cur.movements || cur.movements.length === 0) continue;
        const movs = [...cur.movements];
        const primary = { ...movs[0] };
        const sets = primary.sets.map((s, idx) => ({
          ...s,
          // First 2 sets are top sets, subsequent sets are backoff (90%)
          weight_kg: idx < 2 ? weightKg : roundTo(weightKg * 0.9, 2.5),
        }));
        primary.sets = sets;
        movs[0] = primary;
        updated[dayIdx] = {
          ...cur,
          movements: movs,
        };
      }
      return updated;
    });
  };

  // Update a secondary movement weight
  const updateSecondaryWeight = (indices: number[], movIdx: number, weightKg: number) => {
    setWeeklyTemplate((prev) => {
      let updated = { ...prev };
      for (const dayIdx of indices) {
        const cur = updated[dayIdx];
        if (!cur || !cur.movements || !cur.movements[movIdx]) continue;
        const movs = [...cur.movements];
        const mov = { ...movs[movIdx] };
        mov.sets = mov.sets.map((s) => ({ ...s, weight_kg: weightKg }));
        movs[movIdx] = mov;
        updated[dayIdx] = {
          ...cur,
          movements: movs,
        };
      }
      return updated;
    });
  };

  const handleSave = () => {
    const newConfig: CycleConfig = {
      ...config,
      cycle_name: name,
      start_date: startDate,
      total_weeks: totalWeeks,
      mode,
      load_multipliers: multipliers,
      weekly_template: weeklyTemplate,
    };
    const newProfile: UserProfile = {
      ...profile,
      goal,
      target_weight_kg: Number(targetWeight),
      weekly_weight_change_kg: Number(weeklyChange),
      daily_protein_g: Number(dailyProtein),
    };

    let newSchedule: Record<string, DaySchedule> | undefined = undefined;
    if (autoPropagate) {
      newSchedule = propagateScheduleFromTemplate(newConfig, weeklyTemplate);
    }

    onUpdate(newConfig, newProfile, newSchedule);
    onClose();
  };

  const dayNamesEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayNamesZh = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  return (
    <div className="cycle-modal-overlay" onClick={onClose}>
      <div className="cycle-modal-dialog large" onClick={(e) => e.stopPropagation()}>
        <div className="cycle-modal-header">
          <div className="modal-tabs-header">
            <button
              type="button"
              className={`modal-tab-btn${activeTab === "config" ? " active" : ""}`}
              onClick={() => setActiveTab("config")}
            >
              ⚙️ {t("Parameters", "周期参数")}
            </button>
            <button
              type="button"
              className={`modal-tab-btn${activeTab === "template" ? " active" : ""}`}
              onClick={() => setActiveTab("template")}
            >
              📋 {t("Template", "训练模板")}
            </button>
          </div>

          <div className="modal-header-actions">
            {activeTab === "template" && (
              <button
                type="button"
                className="btn-sync-pr-corner"
                onClick={handleSyncPRs}
                title={t("Extract latest highest PR from past records", "从过往记录自动提取最新最好 PR")}
              >
                🔄 {t("Sync Best PR", "同步最佳 PR")}
              </button>
            )}
            <button type="button" className="cycle-modal-close" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="cycle-modal-body">
          {activeTab === "config" ? (
            <>
              {/* Preset Buttons */}
              <div className="form-group">
                <label>{t("Cycle Periodization Template", "周期负荷阶梯预设")}</label>
                <div className="preset-btn-group">
                  <button
                    type="button"
                    className={`preset-btn${mode === "3:1" ? " active" : ""}`}
                    onClick={() => applyPreset("3:1")}
                  >
                    3:1 (4 {t("Weeks", "周")})
                  </button>
                  <button
                    type="button"
                    className={`preset-btn${mode === "4:1" ? " active" : ""}`}
                    onClick={() => applyPreset("4:1")}
                  >
                    4:1 (5 {t("Weeks", "周")})
                  </button>
                  <button
                    type="button"
                    className={`preset-btn${mode === "2:1" ? " active" : ""}`}
                    onClick={() => applyPreset("2:1")}
                  >
                    2:1 (3 {t("Weeks", "周")})
                  </button>
                  <button
                    type="button"
                    className={`preset-btn${mode === "custom" ? " active" : ""}`}
                    onClick={() => setMode("custom")}
                  >
                    {t("Custom", "自由自定义")}
                  </button>
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>{t("Cycle Name", "周期名称")}</label>
                  <input
                    type="text"
                    className="cycle-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>{t("Start Date", "周期起始日期")}</label>
                  <input
                    type="date"
                    className="cycle-input"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Number of weeks & Multipliers */}
              <div className="form-group">
                <div className="flex-between">
                  <label>
                    {t("Total Weeks", "周期总周数")}: <b>{totalWeeks}</b> {t("Weeks", "周")}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    value={totalWeeks}
                    onChange={(e) => handleWeeksChange(Number(e.target.value))}
                    className="cycle-slider"
                  />
                </div>

                <div className="multiplier-grid">
                  {Array.from({ length: totalWeeks }).map((_, idx) => (
                    <div key={idx} className="multiplier-item">
                      <span className="mult-label">W{idx + 1}</span>
                      <input
                        type="number"
                        step="0.05"
                        min="0.3"
                        max="1.5"
                        className="mult-input"
                        value={multipliers[idx] ?? 1.0}
                        onChange={(e) => handleMultiplierChange(idx, Number(e.target.value))}
                      />
                      <span className="mult-pct">{Math.round((multipliers[idx] ?? 1.0) * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <hr className="cycle-modal-divider" />

              {/* Macro Goals */}
              <div className="form-group">
                <label>{t("Macro Goal Stage", "宏观体态阶段目标")}</label>
                <div className="goal-btn-group">
                  <button
                    type="button"
                    className={`goal-btn${goal === "cut" ? " active" : ""}`}
                    onClick={() => setGoal("cut")}
                  >
                    🔥 {t("Mini-Cut (Fat Loss)", "Mini-Cut 减脂")}
                  </button>
                  <button
                    type="button"
                    className={`goal-btn${goal === "bulk" ? " active" : ""}`}
                    onClick={() => setGoal("bulk")}
                  >
                    💪 {t("Lean Bulk (Muscle)", "精益增肌")}
                  </button>
                  <button
                    type="button"
                    className={`goal-btn${goal === "maintain" ? " active" : ""}`}
                    onClick={() => setGoal("maintain")}
                  >
                    ⚖️ {t("Maintenance", "稳态保持")}
                  </button>
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-group">
                  <label>{t("Target Weight (kg)", "目标体重 (kg)")}</label>
                  <input
                    type="number"
                    step="0.1"
                    className="cycle-input"
                    value={targetWeight}
                    onChange={(e) => setTargetWeight(Number(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label>{t("Weekly Delta (kg)", "每周预期速度 (kg)")}</label>
                  <input
                    type="number"
                    step="0.05"
                    className="cycle-input"
                    value={weeklyChange}
                    onChange={(e) => setWeeklyChange(Number(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label>{t("Daily Protein (g)", "每日目标蛋白质 (g)")}</label>
                  <input
                    type="number"
                    step="5"
                    className="cycle-input"
                    value={dailyProtein}
                    onChange={(e) => setDailyProtein(Number(e.target.value))}
                  />
                </div>
              </div>
            </>
          ) : (
            /* Tab 2: Weekly Peak Template (PR baseline) */
            <div className="weekly-template-tab-content">
              {syncMsg && <div className="sync-success-notice">{syncMsg}</div>}

              {/* Weekly Template Cards (Sun, Mon, Tue, Wed, Thu, Fri/Sat) */}
              <div className="template-days-list">
                {[
                  { indices: [0], labelEn: "Sun", labelZh: "周日" },
                  { indices: [1], labelEn: "Mon", labelZh: "周一" },
                  { indices: [2], labelEn: "Tue", labelZh: "周二" },
                  { indices: [3], labelEn: "Wed", labelZh: "周三" },
                  { indices: [4], labelEn: "Thu", labelZh: "周四" },
                  { indices: [5, 6], labelEn: "Fri / Sat", labelZh: "周五 / 周六" },
                ].map((card, cIdx) => {
                  const day = weeklyTemplate[card.indices[0]];
                  if (!day) return null;
                  const isCardio = day.type === "cardio";

                  return (
                    <div key={cIdx} className={`template-day-card ${day.type}`}>
                      <div className="tmpl-card-header">
                        <div className="tmpl-card-dow">
                          <span className="dow-badge">{t(card.labelEn, card.labelZh)}</span>
                        </div>
                        <h5 className="tmpl-day-title">{day.title}</h5>
                      </div>

                      <div className="tmpl-card-body">
                        {isCardio ? (
                          <div className="tmpl-cardio-fields">
                            <div className="tmpl-field-item">
                              <label>{t("Peak Distance", "巅峰单次跑量")}:</label>
                              <div className="input-with-unit">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="1"
                                  className="tmpl-num-input"
                                  value={day.cardio_km || 5.0}
                                  onChange={(e) => updateCardioKm(card.indices[0], Number(e.target.value))}
                                />
                                <span className="unit-txt">km</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="tmpl-movements-fields">
                            {day.movements && day.movements.length > 0 && (
                              <div className="tmpl-mov-row primary">
                                <span className="mov-name-label">
                                  ★ {day.movements[0].name}:
                                </span>
                                <div className="input-with-unit">
                                  <input
                                    type="number"
                                    step={unit === "lb" ? "5" : "2.5"}
                                    min="0"
                                    className="tmpl-num-input"
                                    value={toDisplayVal(day.movements[0].sets[0]?.weight_kg || 0)}
                                    onChange={(e) => updatePrimaryWeight(card.indices, fromDisplayVal(Number(e.target.value)))}
                                  />
                                  <span className="unit-txt">{unit}</span>
                                </div>
                                <span className="sets-summary-txt">
                                  × {day.movements[0].sets[0]?.reps || 5} reps ({day.movements[0].sets.length} sets)
                                </span>
                              </div>
                            )}

                            {/* Secondary Movements Preview / Edit */}
                            {day.movements && day.movements.length > 1 && (
                              <div className="tmpl-secondary-movs-list">
                                {day.movements.slice(1).map((secMov, sIdx) => (
                                  <div key={sIdx} className="tmpl-mov-row secondary">
                                    <span className="mov-name-label">{secMov.name}:</span>
                                    <div className="input-with-unit">
                                      <input
                                        type="number"
                                        step={unit === "lb" ? "5" : "2.5"}
                                        min="0"
                                        className="tmpl-num-input sm"
                                        value={toDisplayVal(secMov.sets[0]?.weight_kg || 0)}
                                        onChange={(e) => updateSecondaryWeight(card.indices, sIdx + 1, fromDisplayVal(Number(e.target.value)))}
                                      />
                                      <span className="unit-txt">{unit}</span>
                                    </div>
                                    <span className="sets-summary-txt">
                                      × {secMov.sets[0]?.reps || 8} reps ({secMov.sets.length} sets)
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Propagation Checkbox */}
              <div className="propagate-toggle-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={autoPropagate}
                    onChange={(e) => setAutoPropagate(e.target.checked)}
                  />
                  <span>
                    <b>{t("Auto-propagate to all weeks' schedules", "保存时自动将模板按每周比例 (90%、95%、100%、50%) 承接生成至全部日程")}</b>
                    <small>
                      {t(
                        "Automatically recalculates every single day's weights and runs for Weeks 1-4 based on the peak PRs above.",
                        "依据上述 Peak PR 巅峰基准，系统将自动换算生成全周期 4 周共 28 天的每日训练与跑量排期。"
                      )}
                    </small>
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="cycle-modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t("Cancel", "取消")}
          </button>
          <button type="button" className="btn-primary" onClick={handleSave}>
            {t("Apply Settings & Propagate", "应用配置并自动承接排期")}
          </button>
        </div>
      </div>
    </div>
  );
}
