import { useCallback, useMemo, useState } from "react";
import { Analysis, DrillQuery, chartClickIndex, chartClickName } from "../api";
import Chart, { axisStyle, MATLAB_COLORS } from "../components/Chart";
import DrillPanel, { expandMonthKey } from "../components/DrillPanel";
import MaxPrCard from "../components/MaxPrCard";
import {
  formatVolume,
  metricTonsToDisplay,
  useWeightUnit,
  volumeScaleLabel,
} from "../units";
import { useLanguage } from "../language";

export default function Muscle({ data }: { data: Analysis }) {
  const { unit } = useWeightUnit();
  const { language, t, label, rawLabel } = useLanguage();
  const m = data.monthly;
  const cm = data.category_monthly;
  const volumeUnit = volumeScaleLabel(unit, language);
  const [selectedYear, setSelectedYear] = useState<number | "all" | null>(null);

  const years = useMemo(() => {
    const fromDates = [Number(data.date_start.slice(0, 4)), Number(data.date_end.slice(0, 4))];
    const fromMonthly = m.labels.map((l) => Number(l.slice(0, 4)));
    const allYears = [...fromDates, ...fromMonthly].filter((y) => !isNaN(y) && y > 2000);
    const minYear = Math.min(...allYears);
    const maxYear = Math.max(...allYears);
    return Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
  }, [data.date_start, data.date_end, m.labels]);

  const todayMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const monthKeys = useMemo(() => {
    if (selectedYear === "all") {
      return m.labels;
    }
    if (typeof selectedYear === "number") {
      return Array.from({ length: 12 }, (_, month) => `${selectedYear}-${String(month + 1).padStart(2, "0")}`);
    }
    const now = new Date();
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    });
  }, [selectedYear, m.labels]);

  const shortLabels = useMemo(() => monthKeys.map((month) => month.slice(2)), [monthKeys]);

  const monthIndex = useMemo(
    () => new Map(m.labels.map((month, index) => [month, index])),
    [m.labels]
  );
  const topMovements = data.top_movements.filter(({ name }) => {
    const normalized = name.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
    return !normalized.includes("walking")
      && !normalized.includes("running")
      && !normalized.includes("traditionalstrength")
      && !normalized.includes("applehealth")
      && !normalized.includes("elliptical");
  });
  const [drill, setDrill] = useState<DrillQuery | null>(null);

  const summary = data.strength_summary;

  // Goals
  const yearlyTarget = summary?.goals?.yearly_target ?? 156;
  const yearlyWorkouts = summary?.goals?.this_year?.workouts ?? 0;
  const yearlyHours = summary?.goals?.this_year?.duration_hours ?? 0;
  const yearlyDiff = summary?.goals?.this_year?.diff_last_year ?? 0;

  const monthlyTarget = summary?.goals?.monthly_target ?? 13;
  const monthlyWorkouts = summary?.goals?.this_month?.workouts ?? 0;
  const monthlyHours = summary?.goals?.this_month?.duration_hours ?? 0;
  const monthlyDiff = summary?.goals?.this_month?.diff_last_month ?? 0;

  // Present day & present week (Sunday start)
  const now = useMemo(() => new Date(), []);
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDate = now.getDate();
  const todayDay = now.getDay(); // 0 for Sunday, 1 for Monday, ..., 6 for Saturday
  const todayStr = useMemo(
    () => `${todayYear}-${String(todayMonth + 1).padStart(2, "0")}-${String(todayDate).padStart(2, "0")}`,
    [todayYear, todayMonth, todayDate],
  );

  // Weekly Goal (Target: 3 workouts, Sunday start, present week)
  const weeklyTarget = summary?.goals?.weekly_target ?? 3;
  const { currentWeekWorkouts, currentWeekHours, currentWeekDiff } = useMemo(() => {
    const workoutDates = summary?.workout_dates || [];
    const workoutDetails = summary?.workout_details || {};
    const sun = new Date(todayYear, todayMonth, todayDate - todayDay);
    const sat = new Date(todayYear, todayMonth, todayDate - todayDay + 6);
    const prevSun = new Date(todayYear, todayMonth, todayDate - todayDay - 7);
    const prevSat = new Date(todayYear, todayMonth, todayDate - todayDay - 1);

    const toStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const sunStr = toStr(sun);
    const satStr = toStr(sat);
    const prevSunStr = toStr(prevSun);
    const prevSatStr = toStr(prevSat);

    const thisW = workoutDates.filter((d) => d >= sunStr && d <= satStr);
    const lastW = workoutDates.filter((d) => d >= prevSunStr && d <= prevSatStr);
    const hours = thisW.reduce((acc, d) => acc + (workoutDetails[d]?.duration_min || 0), 0) / 60;

    return {
      currentWeekWorkouts: thisW.length,
      currentWeekHours: hours,
      currentWeekDiff: thisW.length - lastW.length,
    };
  }, [summary?.workout_dates, summary?.workout_details, todayYear, todayMonth, todayDate, todayDay]);

  const weeklyWorkouts = currentWeekWorkouts;
  const weeklyHours = currentWeekHours;
  const weeklyDiff = currentWeekDiff;

  // Streaks calculation (accounts for present week & day)
  const sortedWorkoutDates = useMemo(() => (summary?.workout_dates || []).slice().sort(), [summary?.workout_dates]);
  const workoutDatesSet = useMemo(() => new Set(sortedWorkoutDates), [sortedWorkoutDates]);

  const { currentDayStreak, maxDayStreak, currentWeekStreak, maxWeekStreak } = useMemo(() => {
    const toStr = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    // 1. Current day streak from today (or yesterday as grace period)
    let curDay = 0;
    const todayD = new Date(todayYear, todayMonth, todayDate);
    if (workoutDatesSet.has(toStr(todayD))) {
      const checkD = new Date(todayD);
      while (workoutDatesSet.has(toStr(checkD))) {
        curDay++;
        checkD.setDate(checkD.getDate() - 1);
      }
    } else {
      const yesterday = new Date(todayYear, todayMonth, todayDate - 1);
      if (workoutDatesSet.has(toStr(yesterday))) {
        const checkD = new Date(yesterday);
        while (workoutDatesSet.has(toStr(checkD))) {
          curDay++;
          checkD.setDate(checkD.getDate() - 1);
        }
      }
    }

    // Max day streak across history
    let maxDay = 0;
    let curDRun = 0;
    let prevD: Date | null = null;
    for (const ds of sortedWorkoutDates) {
      const dt = new Date(`${ds}T12:00:00Z`);
      if (prevD && dt.getTime() - prevD.getTime() === 86400000) {
        curDRun++;
      } else {
        curDRun = 1;
      }
      maxDay = Math.max(maxDay, curDRun);
      prevD = dt;
    }

    // 2. Week streak (week starts Sunday)
    const workoutWeeks = new Set<string>();
    for (const ds of sortedWorkoutDates) {
      const parts = ds.split("-").map(Number);
      const dt = new Date(parts[0], parts[1] - 1, parts[2]);
      const sun = new Date(parts[0], parts[1] - 1, parts[2] - dt.getDay());
      workoutWeeks.add(toStr(sun));
    }

    const thisSun = new Date(todayYear, todayMonth, todayDate - todayDay);
    const thisSunStr = toStr(thisSun);
    let curWeek = 0;

    if (workoutWeeks.has(thisSunStr)) {
      // Trained this week! Counts toward streak
      const checkSun = new Date(thisSun);
      while (workoutWeeks.has(toStr(checkSun))) {
        curWeek++;
        checkSun.setDate(checkSun.getDate() - 7);
      }
    } else {
      // Current week is ongoing; check consecutive weeks ending last week
      const lastSun = new Date(todayYear, todayMonth, todayDate - todayDay - 7);
      if (workoutWeeks.has(toStr(lastSun))) {
        const checkSun = new Date(lastSun);
        while (workoutWeeks.has(toStr(checkSun))) {
          curWeek++;
          checkSun.setDate(checkSun.getDate() - 7);
        }
      }
    }

    const sortedWeeks = Array.from(workoutWeeks).sort();
    let maxWeek = 0;
    let curWRun = 0;
    let prevW: Date | null = null;
    for (const ws of sortedWeeks) {
      const dt = new Date(`${ws}T12:00:00Z`);
      if (prevW && Math.round((dt.getTime() - prevW.getTime()) / (7 * 86400000)) === 1) {
        curWRun++;
      } else {
        curWRun = 1;
      }
      maxWeek = Math.max(maxWeek, curWRun);
      prevW = dt;
    }

    return {
      currentDayStreak: curDay,
      maxDayStreak: Math.max(maxDay, summary?.streaks?.max_days ?? 0),
      currentWeekStreak: curWeek,
      maxWeekStreak: Math.max(maxWeek, summary?.streaks?.max_weeks ?? 0),
    };
  }, [workoutDatesSet, sortedWorkoutDates, todayYear, todayMonth, todayDate, todayDay, summary?.streaks]);

  // Lifetime
  const totalWorkouts = summary?.total_workouts ?? data.cardio?.n_strength_sessions ?? 0;
  const totalHours = summary?.total_duration_hours ?? 0;
  const totalYears = summary?.calendar_years ?? 1;
  const latestActivity = summary?.latest_activity;

  // Weekday dots for present week
  const currentWeekDays = useMemo(() => {
    const weekdayLabels = language === "zh"
      ? ["日", "一", "二", "三", "四", "五", "六"]
      : ["S", "M", "T", "W", "T", "F", "S"];

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(todayYear, todayMonth, todayDate - todayDay + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dayNum = d.getDate();
      const isTrained = workoutDatesSet.has(dateStr);
      const isToday = dateStr === todayStr;
      const isPast = dateStr < todayStr;
      return {
        date: dateStr,
        label: weekdayLabels[i],
        dayNum,
        isTrained,
        isToday,
        isPast,
      };
    });
  }, [workoutDatesSet, language, todayYear, todayMonth, todayDate, todayDay, todayStr]);

  const thisWeekActiveDays = useMemo(
    () => currentWeekDays.filter((d) => d.isTrained).length,
    [currentWeekDays]
  );

  const openMonth = useCallback(
    (params: unknown) => {
      const name = chartClickName(params);
      const idx = chartClickIndex(params);
      const key =
        (name && expandMonthKey(name, monthKeys)) ||
        (idx != null ? monthKeys[idx] : null);
      if (key) setDrill({ type: "month", key });
    },
    [monthKeys],
  );

  const filteredCategorySeries = useMemo(() => {
    return cm.series.map((s) => ({
      name: label(s.name),
      rawName: s.name,
      type: "line" as const,
      smooth: true,
      stack: "total",
      areaStyle: { opacity: 0.4 },
      data: monthKeys.map((month) => {
        if (typeof selectedYear === "number" && month > todayMonthKey) {
          return null;
        }
        const index = monthIndex.get(month);
        const valTons = index == null ? 0 : s.data[index] ?? 0;
        return metricTonsToDisplay(valTons, unit);
      }),
    }));
  }, [cm.series, monthKeys, selectedYear, todayMonthKey, monthIndex, unit, label]);

  const filteredMonthlyHours = useMemo(() => {
    return monthKeys.map((month) => {
      if (typeof selectedYear === "number" && month > todayMonthKey) {
        return null;
      }
      const index = monthIndex.get(month);
      return index == null ? 0 : m.duration_hours[index] ?? 0;
    });
  }, [monthKeys, selectedYear, todayMonthKey, monthIndex, m.duration_hours]);

  const filteredCategoryShare = useMemo(() => {
    const items = cm.series.map((s) => {
      const totalTons = monthKeys.reduce((acc, month) => {
        const index = monthIndex.get(month);
        return acc + (index == null ? 0 : s.data[index] ?? 0);
      }, 0);
      return {
        name: label(s.name),
        rawName: s.name,
        value: metricTonsToDisplay(totalTons, unit),
      };
    }).filter((item) => item.value > 0);

    if (items.length > 0) return items;
    return data.categories.labels.slice(0, 7).map((l, i) => ({
      name: label(l),
      rawName: l,
      value: data.categories.sessions[i],
    }));
  }, [cm.series, monthKeys, monthIndex, unit, label, data.categories]);

  const renderYearSelector = () => (
    <nav className="chart-years-nav" aria-label={t("Year filter", "年份筛选")}>
      <button
        type="button"
        className={selectedYear === "all" ? "active" : ""}
        aria-current={selectedYear === "all" ? "true" : undefined}
        onClick={() => setSelectedYear("all")}
      >
        {t("All", "全部")}
      </button>
      {years.map((choice) => (
        <button
          key={choice}
          type="button"
          className={selectedYear === choice ? "active" : ""}
          aria-current={selectedYear === choice ? "true" : undefined}
          onClick={() => setSelectedYear(choice)}
        >
          {choice}
        </button>
      ))}
      <button
        type="button"
        className={selectedYear === null ? "active" : ""}
        aria-current={selectedYear === null ? "true" : undefined}
        onClick={() => setSelectedYear(null)}
      >
        {t("Past Year", "近一年")}
      </button>
    </nav>
  );

  const renderDiff = (diff: number, periodLabel: string) => {
    if (diff === 0) return <p className="goal-diff neutral">— {t("vs", "对比")} {periodLabel}</p>;
    const isPositive = diff > 0;
    return (
      <p className={`goal-diff ${isPositive ? "positive" : "negative"}`}>
        {isPositive ? "↗ +" : "↘ "}{Math.abs(diff)} {t("vs", "对比")} {periodLabel}
      </p>
    );
  };

  const formatActivityDate = (dateStr: string) => {
    const d = new Date(`${dateStr}T12:00:00Z`);
    return language === "zh"
      ? `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  };

  return (
    <>
      <h2 className="page-title">{t("Strength Training", "增肌训练")}</h2>

      <div className="strength-dashboard">
        {/* 1. Yearly Goal */}
        <div className="strength-card yearly-goal">
          <div>
            <p className="goal-header yearly">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 20V10M12 20V4M6 20v-6" />
              </svg>
              <span>{t("Yearly Goal", "年度目标")}</span>
            </p>
            <p className="goal-value">
              {yearlyWorkouts}
              <span className="target">/ {yearlyTarget} {t("workouts", "次")}</span>
            </p>
            <div className="goal-progress">
              <div
                className="goal-progress-fill"
                style={{ width: `${Math.min(100, Math.round((yearlyWorkouts / Math.max(1, yearlyTarget)) * 100))}%` }}
              />
            </div>
            <div className="goal-meta-row">
              <span className="goal-meta">
                <ActivityBoltIcon />
                <span>{yearlyWorkouts} {t("activities", "次训练")}</span>
              </span>
              <span className="goal-hours">{yearlyHours.toFixed(1)}h</span>
            </div>
            {renderDiff(yearlyDiff, t("last year", "去年"))}
          </div>
        </div>

        {/* 2. Monthly Goal */}
        <div className="strength-card">
          <div>
            <p className="goal-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{t("Monthly Goal", "月度目标")}</span>
            </p>
            <p className="goal-value">
              {monthlyWorkouts}
              <span className="target">/ {monthlyTarget} {t("workouts", "次")}</span>
            </p>
            <div className="goal-progress">
              <div
                className="goal-progress-fill"
                style={{ width: `${Math.min(100, Math.round((monthlyWorkouts / Math.max(1, monthlyTarget)) * 100))}%` }}
              />
            </div>
            <div className="goal-meta-row">
              <span className="goal-meta">
                <ActivityBoltIcon />
                <span>{monthlyWorkouts} {t("activities", "次训练")}</span>
              </span>
              <span className="goal-hours">{monthlyHours.toFixed(1)}h</span>
            </div>
            {renderDiff(monthlyDiff, t("last month", "上月"))}
          </div>
        </div>

        {/* 3. Weekly Goal */}
        <div className="strength-card">
          <div>
            <p className="goal-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>{t("Weekly Goal", "周目标")}</span>
            </p>
            <p className="goal-value">
              {weeklyWorkouts}
              <span className="target">/ {weeklyTarget} {t("workouts", "次")}</span>
            </p>
            <div className="goal-progress">
              <div
                className="goal-progress-fill"
                style={{ width: `${Math.min(100, Math.round((weeklyWorkouts / Math.max(1, weeklyTarget)) * 100))}%` }}
              />
            </div>
            <div className="goal-meta-row">
              <span className="goal-meta">
                <ActivityBoltIcon />
                <span>{weeklyWorkouts} {t("activities", "次训练")}</span>
              </span>
              <span className="goal-hours">{weeklyHours.toFixed(1)}h</span>
            </div>
            {renderDiff(weeklyDiff, t("last week", "上周"))}
          </div>
        </div>

        {/* 4. Streak Card */}
        <div className="strength-card streak-card">
          <div>
            <p className="goal-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2c1.5 3 4 5 4 8a6 6 0 1 1-12 0c0-3 2.5-5 4-8 1 2 2 3 4 0z" />
              </svg>
              <span>{t("Streak", "连续训练")}</span>
            </p>
            <div className="streak-top">
              <span className="streak-num">{currentDayStreak}</span>
              <span className="streak-unit">{t("days", "天")}</span>
            </div>
            <div className="streak-middle">
              <div className="streak-flame-badge">
                <div className="streak-flame-relative">
                  <svg className="streak-flame-svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 23c-3.866 0-7-3.134-7-7 0-2.468 1.5-5.093 3.03-6.97.44-.54 1.47-.36 1.64.3.17.66.54 1.44 1.13 2.07.26-.94.76-2.06 1.57-3.04.81-.98 1.49-2.09 1.78-3.36.12-.53.71-.78 1.15-.46C17.09 6.46 19 9.58 19 13.5c0 5.247-3.134 9.5-7 9.5z" />
                  </svg>
                  <span className="streak-flame-number">{currentWeekStreak}</span>
                </div>
                <span className="streak-flame-text">{t("weeks", "周")}</span>
              </div>
              <div className="streak-days-row">
                {currentWeekDays.map((item) => (
                  <div
                    key={item.date}
                    className={`streak-day-item${item.isTrained ? " cursor-pointer" : ""}`}
                    onClick={() => item.isTrained && setDrill({ type: "day", key: item.date })}
                  >
                    <span className="streak-day-name">{item.label}</span>
                    <div
                      className={`streak-day-circle${item.isTrained ? " trained" : ""}${item.isToday && !item.isTrained ? " today" : ""}${item.isPast && !item.isTrained ? " past" : ""}`}
                      title={`${item.date}${item.isTrained ? ` (${t("Trained", "已训练")})` : ""}`}
                    >
                      {item.dayNum}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="streak-footer">
            <SparkleIcon />
            <span>{t("Longest", "最长")}: {maxDayStreak} {t("days", "天")} / {maxWeekStreak} {t("weeks", "周")}</span>
          </div>
        </div>

        {/* 5. Summary Card (Year, Time, Latest Activity) */}
        <div className="strength-card profile-summary-card">
          <div className="summary-metrics-row">
            <div className="summary-metric-col">
              <p className="summary-metric-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{t("Year", "年份")}</span>
              </p>
              <p className="summary-metric-val">{totalYears}</p>
            </div>
            <div className="summary-metric-col border-l">
              <p className="summary-metric-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{t("Time", "时间")}</span>
              </p>
              <p className="summary-metric-val">{totalHours.toFixed(1)}h</p>
            </div>
          </div>

          <div className="summary-divider" />

          <div className="summary-latest">
            <p className="summary-latest-label">{t("Latest Activity", "最近活动")}</p>
            {latestActivity ? (
              <div
                className="summary-latest-content"
                onClick={() => setDrill({ type: "day", key: latestActivity.date })}
                role="button"
                tabIndex={0}
              >
                <span className="summary-latest-title">🏋️ {label(latestActivity.title) || t("Strength Workout", "力量训练")}</span>
                <span className="summary-latest-meta">
                  {" "}· {latestActivity.volume_kg > 0 ? formatVolume(latestActivity.volume_kg, unit) : `${latestActivity.duration_min} min`} · {formatActivityDate(latestActivity.date)}
                </span>
              </div>
            ) : (
              <div className="summary-latest-meta">—</div>
            )}
          </div>
        </div>
      </div>

      {/* Compound & Major Movements Max & PR Card */}
      <MaxPrCard prs={data.compound_prs || summary?.compound_prs} />

      <div className="charts-grid">
        <div className="chart-card clickable-hint">
          <div className="chart-card-header">
            <h3>{t("Training Share by Body Area", "部位训练占比")}</h3>
            <span className="chart-period-badge">
              {selectedYear === "all" ? t("All-Time", "全部") : selectedYear ? `${selectedYear}` : t("Past Year", "近一年")}
            </span>
          </div>
          <Chart
            onEvents={{
              click: (p) => {
                const name = chartClickName(p);
                const matched = filteredCategoryShare.find((item) => item.name === name);
                if (matched) setDrill({ type: "category", key: matched.rawName });
                else if (name) setDrill({ type: "category", key: rawLabel(name) });
              },
            }}
            option={{
              tooltip: { trigger: "item" },
              series: [{
                type: "pie",
                radius: ["40%", "65%"],
                data: filteredCategoryShare.map((item) => ({
                  name: item.name,
                  value: item.value,
                })),
                label: { color: "#666666", fontSize: 11 },
              }],
            }}
          />
        </div>
        <div className="chart-card clickable-hint">
          <div className="chart-card-header">
            <h3>{t("Monthly Training Time (hours)", "月度训练时长（小时）")}</h3>
            {renderYearSelector()}
          </div>
          <Chart
            onEvents={{ click: openMonth }}
            option={{
              xAxis: { type: "category", data: shortLabels, ...axisStyle },
              yAxis: { type: "value", name: t("hours", "小时"), ...axisStyle },
              series: [{ type: "bar", data: filteredMonthlyHours, itemStyle: { color: MATLAB_COLORS[0] } }],
              tooltip: { trigger: "axis" },
            }}
          />
        </div>
      </div>

      <div className="chart-card full">
        <h3>{t("Top 20 Movements by Volume", "Top 20 动作 · 容量排行")}</h3>
        <table className="data">
          <thead>
            <tr><th>{t("Movement", "动作")}</th><th>{t("Area", "部位")}</th><th>{t("Days", "训练天数")}</th><th>{t("Sets", "组数")}</th><th>{t("Volume", "容量")}</th></tr>
          </thead>
          <tbody>
            {topMovements.map((t) => (
              <tr
                key={t.name}
                className="clickable-row"
                onClick={() => setDrill({ type: "movement", key: t.name })}
              >
                <td>{label(t.name)}</td>
                <td>{label(t.category)}</td>
                <td>{t.days}</td>
                <td>{t.sets}</td>
                <td>{formatVolume(t.volume_kg, unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drill && <DrillPanel initial={drill} onClose={() => setDrill(null)} />}
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat-card">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg className="sparkle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

function ActivityBoltIcon() {
  return (
    <svg className="bolt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}
