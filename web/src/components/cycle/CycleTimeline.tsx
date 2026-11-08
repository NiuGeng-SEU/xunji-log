import React from "react";
import { CyclePlan } from "../../utils/cycleTypes";
import { useLanguage } from "../../language";
import { useAuth } from "../../utils/auth";

interface Props {
  plan: CyclePlan;
  currentWeekIdx: number;
  onSelectWeek: (weekIdx: number) => void;
  onOpenSettings: (tab?: "config" | "template") => void;
  onOpenLogin: () => void;
  onSave: () => void;
  isSaving: boolean;
}

export default function CycleTimeline({
  plan,
  currentWeekIdx,
  onSelectWeek,
  onOpenSettings,
  onOpenLogin,
  onSave,
  isSaving,
}: Props) {
  const { t } = useLanguage();
  const { isAdmin, logout } = useAuth();
  const { cycle_config, user_profile } = plan;

  const totalWeeks = cycle_config.total_weeks || 4;
  const multipliers = cycle_config.load_multipliers || [0.75, 0.85, 1.0, 0.5];

  // Calculate days elapsed and end date from start_date
  const [startY, startM, startD] = cycle_config.start_date.split("-").map(Number);
  const startDate = new Date(startY, startM - 1, startD);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
  const activeCycleWeek = Math.max(0, Math.min(totalWeeks - 1, Math.floor(diffDays / 7)));

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + totalWeeks * 7 - 1);
  const endY = endDate.getFullYear();
  const endM = String(endDate.getMonth() + 1).padStart(2, "0");
  const endD = String(endDate.getDate()).padStart(2, "0");
  const endDateStr = `${endY}-${endM}-${endD}`;

  return (
    <div className="cycle-timeline-card">
      <div className="cycle-header-top">
        <div className="cycle-title-group">
          <div className="cycle-badge-row">
            <span className="cycle-goal-badge">
              {user_profile.goal === "cut"
                ? t("Mini-Cut (Fat Loss)", "Mini-Cut 减脂期")
                : user_profile.goal === "bulk"
                ? t("Lean Bulk (Muscle)", "精益增肌期")
                : t("Maintenance", "稳态保持期")}
            </span>
            {user_profile.target_weight_kg && (
              <span className="cycle-target-badge">
                {t("Target", "目标")}: {user_profile.target_weight_kg} kg
              </span>
            )}
          </div>
          <p className="cycle-sub-desc">
            {cycle_config.start_date} ~ {endDateStr} · {t("Total", "共")} {totalWeeks} {t("Weeks", "周")} · {t("Active Week", "当前第")} {activeCycleWeek + 1} {t("Week", "周")}
          </p>
        </div>

        <div className="cycle-actions-group">
          {isAdmin ? (
            <div className="admin-controls-cluster">
              <span className="admin-status-badge is-active" title="Admin unlocked">
                🔓 {t("Admin Edit Mode", "站长编辑模式")}
              </span>
              <button
                type="button"
                className="btn-cycle-save"
                onClick={onSave}
                disabled={isSaving}
              >
                {isSaving ? t("Saving…", "同步中…") : `☁️ ${t("Save & Sync", "保存并同步")}`}
              </button>
              <button
                type="button"
                className="cycle-mode-badge is-clickable"
                onClick={() => onOpenSettings("config")}
                title={t("Configure Cycle & Weekly Training Template", "配置周期与每周训练模板")}
              >
                ⚙️ {cycle_config.mode === "custom" ? "Custom Cycle" : `${cycle_config.mode.toUpperCase()} Cycle`}
              </button>
              <button
                type="button"
                className="btn-cycle-ghost"
                onClick={logout}
                title={t("Lock Edit Mode", "锁定只读")}
              >
                🔒
              </button>
            </div>
          ) : (
            <div className="visitor-controls-cluster">
              <span className="admin-status-badge is-readonly" title="Public read-only">
                {t("Public View Only", "公开只读")}
              </span>
              <button
                type="button"
                className="cycle-mode-badge is-clickable"
                onClick={() => onOpenSettings("config")}
                title={t("View Cycle & Weekly Training Template", "查看周期与每周训练模板")}
              >
                ⚙️ {cycle_config.mode === "custom" ? "Custom Cycle" : `${cycle_config.mode.toUpperCase()} Cycle`}
              </button>
              <button
                type="button"
                className="btn-cycle-login"
                onClick={onOpenLogin}
              >
                🔒 {t("Owner Unlock", "站长解锁")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Week Stepper / Multiplier Progression Bar */}
      <div className="cycle-stepper">
        {Array.from({ length: totalWeeks }).map((_, idx) => {
          const mult = multipliers[idx] !== undefined ? multipliers[idx] : 1.0;
          const pct = Math.round(mult * 100);
          const isSelected = idx === currentWeekIdx;
          const isCurrentRealWeek = idx === activeCycleWeek;
          const isPeak = mult >= 1.0;
          const isDeload = mult <= 0.6;

          let phaseLabel = t("Progression", "加压推进");
          if (idx === 0) phaseLabel = t("Accumulation", "积累基准");
          if (isPeak) phaseLabel = t("Peak PR", "巅峰冲刺");
          if (isDeload) phaseLabel = t("Deload", "超量减载");

          return (
            <button
              key={idx}
              type="button"
              className={`cycle-step-item${isSelected ? " selected" : ""}${isCurrentRealWeek ? " current-week" : ""}${isPeak ? " peak" : ""}${isDeload ? " deload" : ""}`}
              onClick={() => onSelectWeek(idx)}
            >
              <div className="step-header">
                <span className="step-week-num">W{idx + 1}</span>
                {isCurrentRealWeek && <span className="step-today-tag">{t("Now", "当下")}</span>}
                <span className="step-pct-tag">{pct}%</span>
              </div>
              <div className="step-phase-name">{phaseLabel}</div>
              <div className="step-bar-track">
                <div
                  className="step-bar-fill"
                  style={{ width: `${Math.min(100, Math.max(15, pct))}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
