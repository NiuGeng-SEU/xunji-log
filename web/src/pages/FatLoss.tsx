import { useCallback, useEffect, useMemo, useState } from "react";
import { Analysis, DrillQuery, chartClickIndex, chartClickName } from "../api";
import Chart, { axisStyle, lineSeries, MATLAB_COLORS } from "../components/Chart";
import DrillPanel, { expandMonthKey } from "../components/DrillPanel";
import { useLanguage } from "../language";
import type { Activity } from "../components/cardio/types";
import { getAvailableYears } from "../components/cardio/utils";
import { ActivityLog } from "../components/cardio/ActivityLog";
import { PersonalBest } from "../components/cardio/PersonalBest";

export default function FatLoss({ data }: { data: Analysis }) {
  const { t, label } = useLanguage();
  const m = data.monthly;
  const [drill, setDrill] = useState<DrillQuery | null>(null);
  const [chartYear, setChartYear] = useState<number | "all" | null>(null);

  // Running Suite States (calculated directly from data/cache/ via data.cardio_sessions)
  const runningActivities: Activity[] = useMemo(() => {
    return (data.cardio_sessions || []).map((s, idx) => {
      const meters = Math.round((s.distance_km || 0) * 1000);
      const durationSecs = Math.round((s.duration_min || 0) * 60);
      const hours = Math.floor(durationSecs / 3600);
      const mins = Math.floor((durationSecs % 3600) / 60);
      const secs = durationSecs % 60;
      const moving_time = `${hours}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      const average_speed = durationSecs > 0 && meters > 0 ? meters / durationSecs : 0;

      const isRun = s.title.includes("跑");
      const isHike = s.title.includes("远足") || s.title.includes("徒步");
      const isWalk = s.title.includes("步行") || s.title.includes("走");
      const type = isRun ? "Run" : isHike ? "Hike" : isWalk ? "Walk" : "Workout";
      const name = isRun ? "Running" : isHike ? "Hiking" : isWalk ? "Walking" : "Cardio";

      return {
        run_id: `${s.date}-${idx}`,
        name,
        distance: meters,
        moving_time,
        type,
        start_date: `${s.date} 12:00:00`,
        start_date_local: `${s.date} 12:00:00`,
        average_heartrate: s.avg_hr && s.avg_hr > 0 ? s.avg_hr : undefined,
        average_speed: average_speed > 0 ? average_speed : undefined,
        location_country: "",
        summary_polyline: "",
      };
    });
  }, [data.cardio_sessions]);

  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const runningYears = useMemo(() => getAvailableYears(runningActivities), [runningActivities]);

  // Group cardio sessions by date
  const cardioByDate = useMemo(() => {
    const map = new Map<string, { totalKm: number; durationMin: number; kcal: number; title: string; count: number }>();
    for (const s of data.cardio_sessions) {
      const prev = map.get(s.date) || { totalKm: 0, durationMin: 0, kcal: 0, title: s.title, count: 0 };
      prev.totalKm += s.distance_km;
      prev.durationMin += s.duration_min;
      prev.kcal += s.kcal;
      prev.count += 1;
      map.set(s.date, prev);
    }
    return map;
  }, [data.cardio_sessions]);

  const cardioDatesSet = useMemo(() => new Set(cardioByDate.keys()), [cardioByDate]);
  const sortedCardioDates = useMemo(() => Array.from(cardioDatesSet).sort(), [cardioDatesSet]);

  // Anchor date: latest cardio activity date
  const anchorDateStr = sortedCardioDates[sortedCardioDates.length - 1] || "2026-09-04";
  const anchorDate = useMemo(() => new Date(`${anchorDateStr}T12:00:00Z`), [anchorDateStr]);
  const anchorYear = anchorDate.getUTCFullYear();
  const anchorMonthStr = `${anchorYear}-${String(anchorDate.getUTCMonth() + 1).padStart(2, "0")}`;

  // 1. Yearly Goal (Target: 2000 km)
  const yearlyTarget = 2000;
  const thisYearSessions = useMemo(() => data.cardio_sessions.filter((s) => s.date.startsWith(String(anchorYear))), [data.cardio_sessions, anchorYear]);
  const yearlyDistance = useMemo(() => Math.round(thisYearSessions.reduce((acc, s) => acc + s.distance_km, 0)), [thisYearSessions]);
  const yearlyActivities = thisYearSessions.length;
  const yearlyHours = useMemo(() => thisYearSessions.reduce((acc, s) => acc + (s.duration_min || 0), 0) / 60, [thisYearSessions]);

  const lastYearSessions = useMemo(() => data.cardio_sessions.filter((s) => s.date.startsWith(String(anchorYear - 1))), [data.cardio_sessions, anchorYear]);
  const lastYearDistance = useMemo(() => Math.round(lastYearSessions.reduce((acc, s) => acc + s.distance_km, 0)), [lastYearSessions]);
  const yearlyDiff = yearlyDistance - lastYearDistance;

  // 2. Monthly Goal (Target: 150 km)
  const monthlyTarget = 150;
  const thisMonthSessions = useMemo(() => data.cardio_sessions.filter((s) => s.date.startsWith(anchorMonthStr)), [data.cardio_sessions, anchorMonthStr]);
  const monthlyDistance = useMemo(() => {
    const raw = thisMonthSessions.reduce((acc, s) => acc + s.distance_km, 0);
    return Math.round(raw * 10) / 10;
  }, [thisMonthSessions]);
  const monthlyActivities = thisMonthSessions.length;
  const monthlyHours = useMemo(() => thisMonthSessions.reduce((acc, s) => acc + (s.duration_min || 0), 0) / 60, [thisMonthSessions]);

  const prevMonthDate = new Date(anchorYear, anchorDate.getUTCMonth() - 1, 1);
  const prevMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const lastMonthSessions = useMemo(() => data.cardio_sessions.filter((s) => s.date.startsWith(prevMonthStr)), [data.cardio_sessions, prevMonthStr]);
  const lastMonthDistance = useMemo(() => Math.round(lastMonthSessions.reduce((acc, s) => acc + s.distance_km, 0)), [lastMonthSessions]);
  const monthlyDiff = Math.round(monthlyDistance - lastMonthDistance);

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

  // 3. Weekly Goal (Target: 35 km, Sunday start, present week)
  const weeklyTarget = 35;
  const sunDate = useMemo(() => new Date(todayYear, todayMonth, todayDate - todayDay), [todayYear, todayMonth, todayDate, todayDay]);
  const satDate = useMemo(() => new Date(todayYear, todayMonth, todayDate - todayDay + 6), [todayYear, todayMonth, todayDate, todayDay]);
  const sunStr = useMemo(() => `${sunDate.getFullYear()}-${String(sunDate.getMonth() + 1).padStart(2, "0")}-${String(sunDate.getDate()).padStart(2, "0")}`, [sunDate]);
  const satStr = useMemo(() => `${satDate.getFullYear()}-${String(satDate.getMonth() + 1).padStart(2, "0")}-${String(satDate.getDate()).padStart(2, "0")}`, [satDate]);

  const prevSunDate = useMemo(() => new Date(todayYear, todayMonth, todayDate - todayDay - 7), [todayYear, todayMonth, todayDate, todayDay]);
  const prevSatDate = useMemo(() => new Date(todayYear, todayMonth, todayDate - todayDay - 1), [todayYear, todayMonth, todayDate, todayDay]);
  const prevSunStr = useMemo(() => `${prevSunDate.getFullYear()}-${String(prevSunDate.getMonth() + 1).padStart(2, "0")}-${String(prevSunDate.getDate()).padStart(2, "0")}`, [prevSunDate]);
  const prevSatStr = useMemo(() => `${prevSatDate.getFullYear()}-${String(prevSatDate.getMonth() + 1).padStart(2, "0")}-${String(prevSatDate.getDate()).padStart(2, "0")}`, [prevSatDate]);

  const thisWeekSessions = useMemo(() => data.cardio_sessions.filter((s) => s.date >= sunStr && s.date <= satStr), [data.cardio_sessions, sunStr, satStr]);
  const weeklyDistance = useMemo(() => {
    const raw = thisWeekSessions.reduce((acc, s) => acc + s.distance_km, 0);
    return Math.round(raw * 10) / 10;
  }, [thisWeekSessions]);
  const weeklyActivities = thisWeekSessions.length;
  const weeklyHours = useMemo(() => thisWeekSessions.reduce((acc, s) => acc + (s.duration_min || 0), 0) / 60, [thisWeekSessions]);

  const lastWeekSessions = useMemo(() => data.cardio_sessions.filter((s) => s.date >= prevSunStr && s.date <= prevSatStr), [data.cardio_sessions, prevSunStr, prevSatStr]);
  const lastWeekDistance = useMemo(() => Math.round(lastWeekSessions.reduce((acc, s) => acc + s.distance_km, 0)), [lastWeekSessions]);
  const weeklyDiff = Math.round(weeklyDistance - lastWeekDistance);

  // 4. Streak Calculation
  const { currentDayStreak, maxDayStreak, currentWeekStreak, maxWeekStreak } = useMemo(() => {
    const toStr = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    // 1. Current day streak from today (or yesterday as grace period)
    let curDay = 0;
    const todayD = new Date(todayYear, todayMonth, todayDate);
    if (cardioDatesSet.has(toStr(todayD))) {
      const checkD = new Date(todayD);
      while (cardioDatesSet.has(toStr(checkD))) {
        curDay++;
        checkD.setDate(checkD.getDate() - 1);
      }
    } else {
      const yesterday = new Date(todayYear, todayMonth, todayDate - 1);
      if (cardioDatesSet.has(toStr(yesterday))) {
        const checkD = new Date(yesterday);
        while (cardioDatesSet.has(toStr(checkD))) {
          curDay++;
          checkD.setDate(checkD.getDate() - 1);
        }
      }
    }

    // Max day streak across history
    let maxDay = 0;
    let curDRun = 0;
    let prevD: Date | null = null;
    for (const ds of sortedCardioDates) {
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
    const cardioWeeks = new Set<string>();
    for (const ds of sortedCardioDates) {
      const parts = ds.split("-").map(Number);
      const dt = new Date(parts[0], parts[1] - 1, parts[2]);
      const sun = new Date(parts[0], parts[1] - 1, parts[2] - dt.getDay());
      cardioWeeks.add(toStr(sun));
    }

    // Check if user trained this week (Sunday to today)
    const thisSun = new Date(todayYear, todayMonth, todayDate - todayDay);
    const thisSunStr = toStr(thisSun);
    let curWeek = 0;

    if (cardioWeeks.has(thisSunStr)) {
      // User trained this week! Counts toward streak
      const checkSun = new Date(thisSun);
      while (cardioWeeks.has(toStr(checkSun))) {
        curWeek++;
        checkSun.setDate(checkSun.getDate() - 7);
      }
    } else {
      // Current week is ongoing; check consecutive weeks ending last week
      const lastSun = new Date(todayYear, todayMonth, todayDate - todayDay - 7);
      if (cardioWeeks.has(toStr(lastSun))) {
        const checkSun = new Date(lastSun);
        while (cardioWeeks.has(toStr(checkSun))) {
          curWeek++;
          checkSun.setDate(checkSun.getDate() - 7);
        }
      }
    }

    const sortedWeeks = Array.from(cardioWeeks).sort();
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
      maxDayStreak: maxDay,
      currentWeekStreak: curWeek,
      maxWeekStreak: maxWeek,
    };
  }, [cardioDatesSet, sortedCardioDates, todayYear, todayMonth, todayDate, todayDay]);

  // Weekday dots for present week
  const currentWeekDays = useMemo(() => {
    const weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"];

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(todayYear, todayMonth, todayDate - todayDay + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dayNum = d.getDate();
      const isTrained = cardioDatesSet.has(dateStr);
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
  }, [todayYear, todayMonth, todayDate, todayDay, todayStr, cardioDatesSet]);

  const thisWeekActiveDays = useMemo(
    () => currentWeekDays.filter((d) => d.isTrained).length,
    [currentWeekDays]
  );

  // Lifetime metrics
  const totalKm = data.cardio.total_km;
  const totalYears = useMemo(() => {
    if (!sortedCardioDates.length) return 1;
    const firstYear = Number(sortedCardioDates[0].slice(0, 4));
    const lastYear = Number(sortedCardioDates[sortedCardioDates.length - 1].slice(0, 4));
    return Math.max(1, lastYear - firstYear + 1);
  }, [sortedCardioDates]);
  const totalHours = useMemo(() => data.cardio_sessions.reduce((acc, s) => acc + (s.duration_min || 0), 0) / 60, [data.cardio_sessions]);
  const latestActivity = data.cardio_sessions[0];

  // Monthly Average Heart Rate
  const monthlyAvgHr = useMemo(() => {
    const map = new Map<string, { totalHr: number; count: number }>();
    for (const s of data.cardio_sessions) {
      if (s.avg_hr && s.avg_hr > 0) {
        const month = s.date.slice(0, 7);
        const cur = map.get(month) || { totalHr: 0, count: 0 };
        cur.totalHr += s.avg_hr;
        cur.count += 1;
        map.set(month, cur);
      }
    }
    return m.labels.map((month) => {
      const item = map.get(month);
      return item && item.count > 0 ? Math.round(item.totalHr / item.count) : null;
    });
  }, [data.cardio_sessions, m.labels]);

  const chartYears = useMemo(() => {
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
    if (chartYear === "all") {
      return m.labels;
    }
    if (typeof chartYear === "number") {
      return Array.from({ length: 12 }, (_, month) => `${chartYear}-${String(month + 1).padStart(2, "0")}`);
    }
    // null -> Past Year (last 12 months)
    const now = new Date();
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    });
  }, [chartYear, m.labels]);

  const shortLabels = useMemo(() => monthKeys.map((month) => month.slice(2)), [monthKeys]);

  const monthIndex = useMemo(
    () => new Map(m.labels.map((month, index) => [month, index])),
    [m.labels]
  );

  const filteredCardioKm = useMemo(() => {
    return monthKeys.map((month) => {
      if (typeof chartYear === "number" && month > todayMonthKey) {
        return null;
      }
      const index = monthIndex.get(month);
      return index == null ? 0 : m.cardio_km[index] ?? 0;
    });
  }, [monthKeys, chartYear, todayMonthKey, monthIndex, m.cardio_km]);

  const filteredCardioKcal = useMemo(() => {
    return monthKeys.map((month) => {
      if (typeof chartYear === "number" && month > todayMonthKey) {
        return null;
      }
      const index = monthIndex.get(month);
      return index == null ? 0 : m.cardio_kcal[index] ?? 0;
    });
  }, [monthKeys, chartYear, todayMonthKey, monthIndex, m.cardio_kcal]);

  const filteredAvgHr = useMemo(() => {
    return monthKeys.map((month) => {
      if (typeof chartYear === "number" && month > todayMonthKey) {
        return null;
      }
      const index = monthIndex.get(month);
      return index == null ? null : monthlyAvgHr[index] ?? null;
    });
  }, [monthKeys, chartYear, todayMonthKey, monthIndex, monthlyAvgHr]);

  const renderChartYearSelector = () => (
    <nav className="chart-years-nav" aria-label={t("Year filter", "年份筛选")}>
      <button
        type="button"
        className={chartYear === "all" ? "active" : ""}
        onClick={() => setChartYear("all")}
      >
        {t("All", "全部")}
      </button>
      {chartYears.map((choice) => (
        <button
          key={choice}
          type="button"
          className={chartYear === choice ? "active" : ""}
          onClick={() => setChartYear(choice)}
        >
          {choice}
        </button>
      ))}
      <button
        type="button"
        className={chartYear === null ? "active" : ""}
        onClick={() => setChartYear(null)}
      >
        {t("Past Year", "近一年")}
      </button>
    </nav>
  );

  const renderDiff = (diff: number, periodLabel: string) => {
    if (diff === 0) return <p className="goal-diff neutral">— vs {periodLabel}</p>;
    const isPositive = diff > 0;
    return (
      <p className={`goal-diff ${isPositive ? "positive" : "negative"}`}>
        {isPositive ? "↗ +" : "↘ "}{Math.abs(diff)} km vs {periodLabel}
      </p>
    );
  };

  const formatActivityDate = (dateStr: string) => {
    const d = new Date(`${dateStr}T12:00:00Z`);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  };

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

  return (
    <>
      <h2 className="page-title">{t("Cardio Training", "有氧训练")}</h2>

      {/* Cardio Goal & Streak Dashboard */}
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
              {yearlyDistance}
              <span className="target">/ {yearlyTarget} km</span>
            </p>
            <div className="goal-progress">
              <div
                className="goal-progress-fill"
                style={{ width: `${Math.min(100, Math.round((yearlyDistance / yearlyTarget) * 100))}%` }}
              />
            </div>
            <div className="goal-meta-row">
              <span className="goal-meta">
                <ActivityBoltIcon />
                <span>{yearlyActivities} {t("activities", "次训练")}</span>
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
              {monthlyDistance}
              <span className="target">/ {monthlyTarget} km</span>
            </p>
            <div className="goal-progress">
              <div
                className="goal-progress-fill"
                style={{ width: `${Math.min(100, Math.round((monthlyDistance / monthlyTarget) * 100))}%` }}
              />
            </div>
            <div className="goal-meta-row">
              <span className="goal-meta">
                <ActivityBoltIcon />
                <span>{monthlyActivities} {t("activities", "次训练")}</span>
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
              {weeklyDistance}
              <span className="target">/ {weeklyTarget} km</span>
            </p>
            <div className="goal-progress">
              <div
                className="goal-progress-fill"
                style={{ width: `${Math.min(100, Math.round((weeklyDistance / weeklyTarget) * 100))}%` }}
              />
            </div>
            <div className="goal-meta-row">
              <span className="goal-meta">
                <ActivityBoltIcon />
                <span>{weeklyActivities} {t("activities", "次训练")}</span>
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

        {/* 5. Summary Card (Year, Distance, Latest Activity) */}
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
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>{t("Distance", "总里程")}</span>
              </p>
              <p className="summary-metric-val">{Math.round(totalKm)}km</p>
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
                <span className="summary-latest-title">🏃 {label(latestActivity.title) || t("Cardio", "有氧训练")}</span>
                <span className="summary-latest-meta">
                  {" "}· {latestActivity.distance_km} km · {formatActivityDate(latestActivity.date)}
                </span>
              </div>
            ) : (
              <div className="summary-latest-meta">—</div>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Cardio Trends Section Header with Year Filter */}
      <div className="cardio-charts-section-head">
        <h3 className="cardio-charts-section-title">
          {t("Monthly Cardio Trends", "月度有氧趋势")}
        </h3>
        {renderChartYearSelector()}
      </div>

      <div className="charts-grid">
        {/* Monthly Cardio Distance & Avg Heart Rate Chart */}
        <div className="chart-card clickable-hint">
          <div className="chart-card-header single-line">
            <h3>{t("Monthly Cardio Distance & Heart Rate", "月度有氧里程与心率")}</h3>
          </div>
          <Chart
            onEvents={{ click: openMonth }}
            height={280}
            option={{
              grid: { left: 45, right: 48, top: 38, bottom: 28 },
              legend: {
                data: [t("Distance (km)", "里程 (km)"), t("Avg Heart Rate (bpm)", "平均心率 (bpm)")],
                textStyle: { color: "#64748b" },
              },
              xAxis: { type: "category", data: shortLabels, ...axisStyle },
              yAxis: [
                { type: "value", name: "km", ...axisStyle },
                { type: "value", name: "bpm", min: 80, max: 180, ...axisStyle },
              ],
              series: [
                { ...lineSeries(t("Distance (km)", "里程 (km)"), filteredCardioKm, true), yAxisIndex: 0 },
                {
                  name: t("Avg Heart Rate (bpm)", "平均心率 (bpm)"),
                  type: "line",
                  data: filteredAvgHr,
                  yAxisIndex: 1,
                  smooth: true,
                  itemStyle: { color: "#ef4444" },
                  lineStyle: { width: 2.5 },
                },
              ],
              tooltip: { trigger: "axis" },
            }}
          />
        </div>

        <div className="chart-card clickable-hint">
          <div className="chart-card-header single-line">
            <h3>{t("Monthly Cardio Calories", "月度有氧消耗")}</h3>
          </div>
          <Chart
            onEvents={{ click: openMonth }}
            height={280}
            option={{
              grid: { left: 45, right: 48, top: 38, bottom: 28 },
              legend: {
                data: [t("Calories (kcal)", "有氧消耗 (kcal)")],
                textStyle: { color: "#64748b" },
              },
              xAxis: { type: "category", data: shortLabels, ...axisStyle },
              yAxis: { type: "value", name: "kcal", ...axisStyle },
              series: [
                {
                  name: t("Calories (kcal)", "有氧消耗 (kcal)"),
                  type: "bar",
                  data: filteredCardioKcal,
                  itemStyle: { color: MATLAB_COLORS[4] },
                },
              ],
              tooltip: { trigger: "axis" },
            }}
          />
        </div>
      </div>

      {/* Personal Best Records */}
      <PersonalBest
        activities={runningActivities}
        onSelectActivity={setSelectedActivity}
      />

      {/* Cardio Log Activity Table */}
      <div className="run-log-card-wrapper">
        <ActivityLog
          activities={runningActivities}
          years={runningYears}
          year={selectedYear}
          setYear={setSelectedYear}
          selectedActivity={selectedActivity}
          onSelectActivity={setSelectedActivity}
        />
      </div>

      {drill && <DrillPanel initial={drill} onClose={() => setDrill(null)} />}
    </>
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
