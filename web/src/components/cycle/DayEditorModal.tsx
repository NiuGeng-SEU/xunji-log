import React, { useState } from "react";
import { DaySchedule, MovementPlan, SetPlan, WorkoutType } from "../../utils/cycleTypes";
import { Analysis } from "../../api";
import { useWeightUnit, formatWeight } from "../../units";
import { useLanguage } from "../../language";
import { cleanDayTitle } from "../../utils/cycleTemplates";
import MovementHistoryDiff from "./MovementHistoryDiff";

interface Props {
  date: string;
  initialSchedule?: DaySchedule;
  analysis: Analysis | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (date: string, schedule: DaySchedule) => void;
  onDelete: (date: string) => void;
}

export default function DayEditorModal({
  date,
  initialSchedule,
  analysis,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const { t } = useLanguage();
  const { unit } = useWeightUnit();

  const [title, setTitle] = useState(cleanDayTitle(initialSchedule?.title));
  const [type, setType] = useState<WorkoutType>(initialSchedule?.type || "strength");
  const [notes, setNotes] = useState(initialSchedule?.notes || "");
  const [cardioKm, setCardioKm] = useState<number>(initialSchedule?.cardio_km || 0);
  const [targetHrMax, setTargetHrMax] = useState<number>(initialSchedule?.target_hr_max || 141);

  const [movements, setMovements] = useState<MovementPlan[]>(
    initialSchedule?.movements && initialSchedule.movements.length > 0
      ? JSON.parse(JSON.stringify(initialSchedule.movements))
      : [
          {
            name: "杠铃卧推",
            sets: [
              { weight_kg: 95, reps: 5, rpe: 7.5 },
              { weight_kg: 95, reps: 5, rpe: 7.5 },
            ],
          },
        ]
  );

  const [activeMovIdx, setActiveMovIdx] = useState(0);

  if (!isOpen) return null;

  // Available movement suggestions from analysis
  const movementSuggestions = Array.from(
    new Set([
      "杠铃卧推",
      "深蹲",
      "硬拉",
      "杠铃划船",
      "上斜杠铃卧推",
      "站姿杠铃推举",
      "引体向上",
      "侧平举",
      "二头弯举",
      "双杠臂屈伸",
      ...(analysis?.top_movements?.map((m) => m.name) || []),
    ])
  );

  const handleAddMovement = () => {
    setMovements([
      ...movements,
      {
        name: "深蹲",
        sets: [
          { weight_kg: 100, reps: 5, rpe: 7.5 },
          { weight_kg: 100, reps: 5, rpe: 7.5 },
        ],
      },
    ]);
    setActiveMovIdx(movements.length);
  };

  const handleRemoveMovement = (index: number) => {
    const updated = movements.filter((_, i) => i !== index);
    setMovements(updated);
    if (activeMovIdx >= updated.length) {
      setActiveMovIdx(Math.max(0, updated.length - 1));
    }
  };

  const handleUpdateMovementName = (index: number, name: string) => {
    const updated = [...movements];
    updated[index].name = name;
    setMovements(updated);
  };

  const handleAddSet = (movIndex: number) => {
    const updated = [...movements];
    const prevSet = updated[movIndex].sets[updated[movIndex].sets.length - 1];
    updated[movIndex].sets.push({
      weight_kg: prevSet ? prevSet.weight_kg : 80,
      reps: prevSet ? prevSet.reps : 5,
      rpe: prevSet?.rpe || 7.5,
    });
    setMovements(updated);
  };

  const handleRemoveSet = (movIndex: number, setIndex: number) => {
    const updated = [...movements];
    updated[movIndex].sets = updated[movIndex].sets.filter((_, i) => i !== setIndex);
    setMovements(updated);
  };

  const handleUpdateSet = (movIndex: number, setIndex: number, field: keyof SetPlan, val: any) => {
    const updated = [...movements];
    (updated[movIndex].sets[setIndex] as any)[field] = val;
    setMovements(updated);
  };

  const handleSave = () => {
    const schedule: DaySchedule = {
      title: title.trim() || (type === "cardio" ? "有氧耐力训练" : type === "rest" ? "主动恢复" : "力量力量训练"),
      type,
      notes: notes.trim() || undefined,
      cardio_km: type === "cardio" || type === "hybrid" ? Number(cardioKm) : undefined,
      target_hr_max: type === "cardio" || type === "hybrid" ? Number(targetHrMax) : undefined,
      movements: type === "strength" || type === "hybrid" ? movements : undefined,
    };
    onSave(date, schedule);
    onClose();
  };

  const activeMovement = movements[activeMovIdx];
  const activeTopSet = activeMovement?.sets[0];

  return (
    <div className="cycle-modal-overlay" onClick={onClose}>
      <div className="cycle-modal-dialog large" onClick={(e) => e.stopPropagation()}>
        <div className="cycle-modal-header">
          <div>
            <h3>📅 {t("Design Training Schedule", "制定训练排期")} · {date}</h3>
            <p className="modal-sub-meta">{t("Customize movements, sets, and cross-reference historic PRs.", "配置当天训练动作、组数与重量，自动对比历史纪录。")}</p>
          </div>
          <button type="button" className="cycle-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="cycle-modal-body">
          {/* Top Row: Type & Title */}
          <div className="form-row-3">
            <div className="form-group">
              <label>{t("Workout Type", "训练类型")}</label>
              <select
                className="cycle-input"
                value={type}
                onChange={(e) => setType(e.target.value as WorkoutType)}
              >
                <option value="strength">💪 {t("Strength (力量训练)", "力量训练")}</option>
                <option value="cardio">🏃 {t("Cardio (有氧跑步)", "有氧跑步")}</option>
                <option value="hybrid">⚡ {t("Hybrid (力量+有氧混合)", "力量+有氧混合")}</option>
                <option value="rest">🧘 {t("Rest / Recovery (休息恢复)", "休息恢复")}</option>
              </select>
            </div>
            <div className="form-group flex-2">
              <label>{t("Session Title / Focus", "训练标题 / 阶段焦点")}</label>
              <input
                type="text"
                className="cycle-input"
                placeholder={t("e.g. Squat Baseline & Rows", "例如：深蹲主项 · 下肢力量基准")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>

          {/* Cardio Parameters */}
          {(type === "cardio" || type === "hybrid") && (
            <div className="form-row-2 cardio-panel-box">
              <div className="form-group">
                <label>🏃 {t("Planned Distance", "计划跑步距离")} (km)</label>
                <input
                  type="number"
                  step="0.5"
                  className="cycle-input"
                  value={cardioKm}
                  onChange={(e) => setCardioKm(Number(e.target.value))}
                />
              </div>
              <div className="form-group">
                <label>❤️ {t("Target Max Heart Rate", "目标心率上限")} (bpm)</label>
                <input
                  type="number"
                  step="1"
                  className="cycle-input"
                  value={targetHrMax}
                  onChange={(e) => setTargetHrMax(Number(e.target.value))}
                />
              </div>
            </div>
          )}

          {/* Strength Builder */}
          {(type === "strength" || type === "hybrid") && (
            <div className="strength-builder-section">
              <div className="strength-builder-columns">
                {/* Left column: Movements list */}
                <div className="movements-list-column">
                  <div className="flex-between mb-2">
                    <span className="font-semibold">{t("Movements Plan", "动作编排")} ({movements.length})</span>
                    <button
                      type="button"
                      className="btn-add-item-sm"
                      onClick={handleAddMovement}
                    >
                      + {t("Add Movement", "添加动作")}
                    </button>
                  </div>

                  <div className="movement-cards-scroll">
                    {movements.map((mov, mIdx) => (
                      <div
                        key={mIdx}
                        className={`movement-builder-card${mIdx === activeMovIdx ? " active" : ""}`}
                        onClick={() => setActiveMovIdx(mIdx)}
                      >
                        <div className="flex-between">
                          <input
                            type="text"
                            list="movement-suggestions-list"
                            className="mov-name-input"
                            value={mov.name}
                            onChange={(e) => handleUpdateMovementName(mIdx, e.target.value)}
                            placeholder={t("Movement Name", "动作名称")}
                          />
                          <button
                            type="button"
                            className="btn-del-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveMovement(mIdx);
                            }}
                            title={t("Delete movement", "删除动作")}
                          >
                            ✕
                          </button>
                        </div>

                        {/* Sets list for this movement */}
                        <div className="sets-table-wrapper">
                          <table className="sets-mini-table">
                            <thead>
                              <tr>
                                <th>{t("Set", "组")}</th>
                                <th>{t("Weight", "重量")}({unit.toUpperCase()})</th>
                                <th>{t("Reps", "次数")}</th>
                                <th>RPE</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {mov.sets.map((st, sIdx) => {
                                const displayW = unit === "lb" ? Math.round(st.weight_kg * 2.20462 * 10) / 10 : st.weight_kg;
                                return (
                                  <tr key={sIdx}>
                                    <td className="set-num-cell">#{sIdx + 1}</td>
                                    <td>
                                      <input
                                        type="number"
                                        step={unit === "lb" ? 2.5 : 1}
                                        className="set-input-num"
                                        value={displayW}
                                        onChange={(e) => {
                                          const val = Number(e.target.value);
                                          const kg = unit === "lb" ? val / 2.20462 : val;
                                          handleUpdateSet(mIdx, sIdx, "weight_kg", Math.round(kg * 10) / 10);
                                        }}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        type="number"
                                        step="1"
                                        className="set-input-num"
                                        value={st.reps}
                                        onChange={(e) => handleUpdateSet(mIdx, sIdx, "reps", Number(e.target.value))}
                                      />
                                    </td>
                                    <td>
                                      <input
                                        type="number"
                                        step="0.5"
                                        className="set-input-num"
                                        value={st.rpe || 7.5}
                                        onChange={(e) => handleUpdateSet(mIdx, sIdx, "rpe", Number(e.target.value))}
                                      />
                                    </td>
                                    <td>
                                      {mov.sets.length > 1 && (
                                        <button
                                          type="button"
                                          className="btn-del-set"
                                          onClick={() => handleRemoveSet(mIdx, sIdx)}
                                        >
                                          -
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          <button
                            type="button"
                            className="btn-add-set"
                            onClick={() => handleAddSet(mIdx)}
                          >
                            + {t("Add Set", "添加一组")}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <datalist id="movement-suggestions-list">
                    {movementSuggestions.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>

                {/* Right column: Real-time History & Last Time Comparison */}
                <div className="history-column">
                  <MovementHistoryDiff
                    movementName={activeMovement?.name || ""}
                    plannedWeightKg={activeTopSet?.weight_kg || 0}
                    plannedReps={activeTopSet?.reps || 5}
                    analysis={analysis}
                    onApplyPresetWeight={(wKg) => {
                      if (activeMovement && activeMovement.sets.length > 0) {
                        handleUpdateSet(activeMovIdx, 0, "weight_kg", wKg);
                      }
                    }}
                  />

                  {/* Notes / Cues box */}
                  <div className="day-notes-box mt-3">
                    <label>{t("Coaching Notes & Focus", "教练动作提示 / 心理专注重点")}</label>
                    <textarea
                      className="cycle-textarea"
                      rows={3}
                      placeholder={t("e.g. Focus on chest tuck and bar path control", "例如：沉肩锁背，注意离心速度，顶峰稍作停顿")}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {type === "rest" && (
            <div className="rest-notice-box">
              <h4>🧘 {t("Active Recovery / Rest Day", "主动恢复 / 全身减压日")}</h4>
              <p>{t("Recovery promotes supercompensation. Spend time foam rolling, stretching, or walking.", "超量恢复在休息期完成。建议进行筋膜放松、轻度散步或热水浴，促进肌肉肌糖原与结缔组织修复。")}</p>
            </div>
          )}
        </div>

        <div className="cycle-modal-footer">
          {initialSchedule && (
            <button
              type="button"
              className="btn-danger-ghost"
              onClick={() => {
                onDelete(date);
                onClose();
              }}
            >
              🗑️ {t("Clear Day Schedule", "清空当日计划")}
            </button>
          )}
          <div className="ml-auto flex-gap">
            <button type="button" className="btn-secondary" onClick={onClose}>
              {t("Cancel", "取消")}
            </button>
            <button type="button" className="btn-primary" onClick={handleSave}>
              {t("Save Schedule", "保存当日排期")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
