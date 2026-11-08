import React, { useState } from "react";
import { CyclePlan, DaySchedule } from "../../utils/cycleTypes";
import { Analysis } from "../../api";
import { useWeightUnit, formatWeight } from "../../units";
import { useLanguage } from "../../language";
import { computePlannedDailyLoad } from "../../utils/banister";
import { getCycleTemplateForDate, cleanDayTitle } from "../../utils/cycleTemplates";
import DayEditorModal from "./DayEditorModal";

interface Props {
  plan: CyclePlan;
  currentWeekIdx: number;
  analysis: Analysis | null;
  onUpdateDaySchedule: (date: string, schedule: DaySchedule) => void;
  onDeleteDaySchedule: (date: string) => void;
}

export default function DailySchedulePlanner({
  plan,
  currentWeekIdx,
  analysis,
  onUpdateDaySchedule,
  onDeleteDaySchedule,
}: Props) {
  const { t } = useLanguage();
  const { unit } = useWeightUnit();

  const [editingDate, setEditingDate] = useState<string | null>(null);

  const { cycle_config, schedule } = plan;

  // Safely parse start_date without UTC timezone drift
  const [startY, startM, startD] = cycle_config.start_date.split("-").map(Number);
  const cycleStart = new Date(startY, startM - 1, startD);

  // Align cycle week start to Sunday
  const sundayStart = new Date(cycleStart);
  sundayStart.setDate(sundayStart.getDate() - sundayStart.getDay());

  // Compute the 7 dates for the selected week index (Sunday through Saturday)
  const weekDates: string[] = [];
  const weekStart = new Date(sundayStart);
  weekStart.setDate(weekStart.getDate() + currentWeekIdx * 7);

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    weekDates.push(dStr);
  }

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const dayNamesEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayNamesZh = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  return (
    <div className="daily-schedule-planner-card">
      <div className="planner-header">
        <div>
          <h3 className="card-section-title">
            📅 {t("Weekly Structured Schedule & Movements", "结构化周训练排期与动作库")}
          </h3>
        </div>

        <div className="week-indicator-tag">
          {t("Viewing Week", "当前浏览第")} <b>{currentWeekIdx + 1}</b> {t("of", "周 / 共")} {cycle_config.total_weeks} {t("Weeks", "周")}
        </div>
      </div>

      {/* 7-Day Grid */}
      <div className="week-schedule-grid">
        {weekDates.map((dateStr) => {
          const dayPlan = schedule[dateStr];
          const isToday = dateStr === todayStr;
          const dayLoad = computePlannedDailyLoad(dayPlan);
          const hasWorkout = Boolean(dayPlan && dayPlan.type !== "rest");

          const [dY, dM, dD] = dateStr.split("-").map(Number);
          const dow = new Date(dY, dM - 1, dD).getDay();

          return (
            <div
              key={dateStr}
              className={`day-schedule-card${isToday ? " is-today" : ""}${!hasWorkout ? " is-rest" : ""}`}
              onClick={() => setEditingDate(dateStr)}
            >
              <div className="day-card-header">
                <div className="day-name-badge">
                  <span className="dow-name">{t(dayNamesEn[dow], dayNamesZh[dow])}</span>
                  <span className="date-sub">{dateStr.slice(5)}</span>
                </div>
                {isToday && <span className="today-pill">{t("Today", "今日")}</span>}
                {dayLoad > 0 && (
                  <span className="load-pill" title={t("Estimated TRIMP Load", "预估训练冲激负荷")}>
                    ⚡ {dayLoad}
                  </span>
                )}
                <div className="day-card-quick-toggle" onClick={(e) => e.stopPropagation()}>
                  {hasWorkout ? (
                    <button
                      type="button"
                      className="btn-card-toggle rest"
                      title={t("Remove workout / set as rest", "移除训练 / 设为休息")}
                      onClick={() => {
                        onUpdateDaySchedule(dateStr, {
                          title: t("Rest Day (Removed)", "休息调整日（已移除训练）"),
                          type: "rest",
                          notes: t("Workout removed from schedule.", "已从排期中移除训练，设为完全休息。"),
                        });
                      }}
                    >
                      ✕ {t("Rest", "休")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-card-toggle restore"
                      title={t("Restore workout based on cycle template", "按周期模板恢复训练")}
                      onClick={() => {
                        const template = getCycleTemplateForDate(dateStr, plan);
                        onUpdateDaySchedule(dateStr, template);
                      }}
                    >
                      ↻ {t("Restore", "练")}
                    </button>
                  )}
                </div>
              </div>

              {dayPlan ? (
                <div className="day-card-body">
                  <div className="day-type-row">
                    <span className={`workout-type-pill ${dayPlan.type}`}>
                      {dayPlan.type === "strength"
                        ? `💪 ${t("Strength", "力量")}`
                        : dayPlan.type === "cardio"
                        ? `🏃 ${t("Cardio", "有氧")}`
                        : dayPlan.type === "hybrid"
                        ? `⚡ ${t("Hybrid", "混合")}`
                        : `🧘 ${t("Rest", "休息")}`}
                    </span>
                  </div>

                  <h5 className="day-card-title">{cleanDayTitle(dayPlan.title)}</h5>

                  {/* Movements Preview */}
                  {dayPlan.movements && dayPlan.movements.length > 0 && (
                    <div className="movements-preview-list">
                      {dayPlan.movements.slice(0, 3).map((m, mIdx) => {
                        const topSet = m.sets[0];
                        const setWeight = topSet ? formatWeight(topSet.weight_kg, unit) : "";
                        return (
                          <div key={mIdx} className="mov-preview-item">
                            <span className="mov-name-txt">{m.name}</span>
                            {topSet && (
                              <span className="mov-sets-txt">
                                {m.sets.length}× ({setWeight})
                              </span>
                            )}
                          </div>
                        );
                      })}
                      {dayPlan.movements.length > 3 && (
                        <div className="more-movs-tag">+{dayPlan.movements.length - 3} {t("more", "个更多动作")}</div>
                      )}
                    </div>
                  )}

                  {/* Cardio Preview */}
                  {dayPlan.cardio_km && dayPlan.cardio_km > 0 && (
                    <div className="cardio-preview-row">
                      <span>🏃 <b>{dayPlan.cardio_km} km</b></span>
                      {dayPlan.target_hr_max && (
                        <span>HR &lt; <b>{dayPlan.target_hr_max}</b> bpm</span>
                      )}
                    </div>
                  )}

                  {dayPlan.notes && (
                    <p className="day-card-notes-preview">{dayPlan.notes}</p>
                  )}
                </div>
              ) : (
                <div className="day-card-empty">
                  <span className="empty-icon">+</span>
                  <span className="empty-text">{t("Tap to schedule", "点击安排训练")}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Day Editor Modal */}
      {editingDate && (
        <DayEditorModal
          date={editingDate}
          initialSchedule={schedule[editingDate]}
          analysis={analysis}
          isOpen={Boolean(editingDate)}
          onClose={() => setEditingDate(null)}
          onSave={onUpdateDaySchedule}
          onDelete={onDeleteDaySchedule}
        />
      )}
    </div>
  );
}
