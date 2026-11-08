import React, { useEffect, useMemo, useState } from "react";
import { Analysis } from "../api";
import { CycleConfig, CyclePlan, DaySchedule, UserProfile } from "../utils/cycleTypes";
import { computeBodyComposition } from "../utils/bodyComposition";
import { simulateBanister } from "../utils/banister";
import { useAuth } from "../utils/auth";
import { useLanguage } from "../language";
import CycleTimeline from "../components/cycle/CycleTimeline";
import CycleConfigModal from "../components/cycle/CycleConfigModal";
import ForwardSimulationChart from "../components/cycle/ForwardSimulationChart";
import BodyCompositionCard from "../components/cycle/BodyCompositionCard";
import DailySchedulePlanner from "../components/cycle/DailySchedulePlanner";
import AdminLoginModal from "../components/cycle/AdminLoginModal";

interface Props {
  data: Analysis;
}

export default function Cycle({ data }: Props) {
  const { t } = useLanguage();
  const { isAdmin, plan, loadingPlan, updatePlan, savePlan, exportPlanJson } = useAuth();

  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const [currentWeekIdx, setCurrentWeekIdx] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"config" | "template">("config");
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // Set active week index once plan loads
  useEffect(() => {
    if (plan?.cycle_config?.start_date) {
      const [startY, startM, startD] = plan.cycle_config.start_date.split("-").map(Number);
      const startDate = new Date(startY, startM - 1, startD);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
      const totalWeeks = plan.cycle_config.total_weeks || 4;
      const calculatedWeek = Math.max(0, Math.min(totalWeeks - 1, Math.floor(diffDays / 7)));
      setCurrentWeekIdx(calculatedWeek);
    }
  }, [plan?.cycle_config?.start_date, plan?.cycle_config?.total_weeks]);

  // Handle updates
  const handleUpdateConfigAndProfile = (
    newConfig: CycleConfig,
    newProfile: UserProfile,
    newSchedule?: Record<string, DaySchedule>
  ) => {
    if (!plan) return;
    const updated: CyclePlan = {
      ...plan,
      cycle_config: newConfig,
      user_profile: newProfile,
      schedule: newSchedule || plan.schedule,
    };
    updatePlan(updated);
  };

  const handleUpdateProfile = async (newProfile: UserProfile): Promise<boolean> => {
    if (!plan) return false;
    const updated: CyclePlan = {
      ...plan,
      user_profile: newProfile,
    };
    updatePlan(updated);
    try {
      const res = await savePlan(updated);
      return res.ok;
    } catch (e) {
      console.warn("Auto save plan failed", e);
      return false;
    }
  };

  const handleUpdateDaySchedule = (dateStr: string, daySchedule: DaySchedule) => {
    if (!plan) return;
    const updatedSchedule = {
      ...plan.schedule,
      [dateStr]: daySchedule,
    };
    const updated: CyclePlan = {
      ...plan,
      schedule: updatedSchedule,
    };
    updatePlan(updated);
  };

  const handleDeleteDaySchedule = (dateStr: string) => {
    if (!plan) return;
    const updatedSchedule = { ...plan.schedule };
    delete updatedSchedule[dateStr];
    const updated: CyclePlan = {
      ...plan,
      schedule: updatedSchedule,
    };
    updatePlan(updated);
  };


  const handleSaveAndSync = async () => {
    if (!plan) return;
    setIsSaving(true);
    setSaveMsg(null);
    try {
      const res = await savePlan(plan);
      setSaveMsg({ text: res.message, ok: res.ok });
    } catch (e) {
      setSaveMsg({ text: e instanceof Error ? e.message : "Save failed", ok: false });
    } finally {
      setIsSaving(false);
    }
  };

  // Computations
  const composition = useMemo(() => {
    if (!plan) return null;
    return computeBodyComposition(plan.user_profile, data);
  }, [plan, data]);

  const banisterResult = useMemo(() => {
    if (!plan) return null;
    return simulateBanister(data, plan.schedule, 28);
  }, [data, plan]);

  if (loadingPlan || !plan || !composition || !banisterResult) {
    return <div className="loading">{t("Loading cycle periodization blueprint…", "正在加载周期训练规划与体能仿真沙盘…")}</div>;
  }

  return (
    <div className="cycle-page-container">
      {/* Toast Save Message */}
      {saveMsg && (
        <div className={`cycle-save-toast ${saveMsg.ok ? "is-success" : "is-error"}`}>
          <span>{saveMsg.text}</span>
          <button type="button" className="toast-dismiss" onClick={() => setSaveMsg(null)}>
            ✕
          </button>
        </div>
      )}

      {/* 1. Cycle Timeline & Phase Progression */}
      <CycleTimeline
        plan={plan}
        currentWeekIdx={currentWeekIdx}
        onSelectWeek={setCurrentWeekIdx}
        onOpenSettings={(tab?: "config" | "template") => {
          setSettingsTab(tab || "config");
          setIsSettingsOpen(true);
        }}
        onOpenLogin={() => setIsLoginOpen(true)}
        onSave={handleSaveAndSync}
        isSaving={isSaving}
      />

      {/* 2. Daily Structured Schedule Planner & Movement Comparison */}
      <DailySchedulePlanner
        plan={plan}
        currentWeekIdx={currentWeekIdx}
        analysis={data}
        onUpdateDaySchedule={handleUpdateDaySchedule}
        onDeleteDaySchedule={handleDeleteDaySchedule}
      />

      {/* 4. Forward Banister CTL/ATL/TSB Simulator Chart */}
      <ForwardSimulationChart data={banisterResult} />

      {/* 5. Body Composition, FFMI, & Population Benchmarks */}
      <BodyCompositionCard
        profile={plan.user_profile}
        cycleConfig={plan.cycle_config}
        composition={composition}
        onUpdateProfile={handleUpdateProfile}
        onOpenLogin={() => setIsLoginOpen(true)}
      />

      {/* Footer Backup & Actions */}
      <div className="cycle-page-footer">
        <div className="footer-left">
          <span>💡 {t("Tip: All simulation changes immediately update the forward fatigue curves above.", "提示：排期修改、减载或动作调整将即时更新上方前瞻体能仿真曲线。")}</span>
        </div>
        <div className="footer-right">
          <button
            type="button"
            className="btn-backup-export"
            onClick={() => exportPlanJson(plan)}
          >
            📥 {t("Download cycle_plan.json Backup", "导出计划 JSON 备份")}
          </button>
        </div>
      </div>

      {/* Modals */}
      <CycleConfigModal
        config={plan.cycle_config}
        profile={plan.user_profile}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onUpdate={handleUpdateConfigAndProfile}
        analysis={data}
        initialTab={settingsTab}
      />

      <AdminLoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
      />
    </div>
  );
}
