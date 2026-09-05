import { useState } from "react";
import { Analysis, DrillQuery, chartClickIndex, chartClickName } from "../api";
import Chart, { axisStyle, barSeries, lineSeries, MATLAB_COLORS } from "../components/Chart";
import DrillPanel, { expandWeekKey, hourFromLabel } from "../components/DrillPanel";
import { useLanguage } from "../language";

export default function Rhythm({ data }: { data: Analysis }) {
  const { t, label, rawLabel } = useLanguage();
  const w = data.weekly;
  const shortWeeks = w.labels.map((l) => l.slice(2));
  const [drill, setDrill] = useState<DrillQuery | null>(null);

  const timeBuckets = [
    { key: "深夜 23-4时", name: t("Late Night 23–04", "深夜 23-4时"), count: data.hour_of_day.sessions[23] + data.hour_of_day.sessions.slice(0, 5).reduce((a, b) => a + b, 0) },
    { key: "清晨 5-8时", name: t("Early Morning 05–08", "清晨 5-8时"), count: data.hour_of_day.sessions.slice(5, 9).reduce((a, b) => a + b, 0) },
    { key: "上午 9-11时", name: t("Morning 09–11", "上午 9-11时"), count: data.hour_of_day.sessions.slice(9, 12).reduce((a, b) => a + b, 0) },
    { key: "中午 12时", name: t("Noon 12", "中午 12时"), count: data.hour_of_day.sessions[12] },
    { key: "下午 13-17时", name: t("Afternoon 13–17", "下午 13-17时"), count: data.hour_of_day.sessions.slice(13, 18).reduce((a, b) => a + b, 0) },
    { key: "晚上 18-22时", name: t("Evening 18–22", "晚上 18-22时"), count: data.hour_of_day.sessions.slice(18, 23).reduce((a, b) => a + b, 0) },
  ];

  return (
    <>
      <h2 className="page-title">{t("Training Rhythm", "训练节奏")}</h2>
      <p className="page-desc">
        {t("Average", "平均")} {data.avg_sessions_per_week} {t("sessions/week", "次/周")} · {t("longest streak", "最长连续")} {data.max_streak_days} {t("days", "天")} · {t("average gap", "平均间隔")} {data.avg_gap_days} {t("days", "天")}
      </p>

      <div className="stats-grid">
        <Stat value={`${data.avg_sessions_per_week} / ${t("week", "周")}`} label={t("Average Frequency", "平均频率")} />
        <Stat value={`${data.max_streak_days} ${t("days", "天")}`} label={t("Longest Streak", "最长连续")} />
        <Stat value={`${data.avg_gap_days} ${t("days", "天")}`} label={t("Average Gap", "平均间隔")} />
        <Stat value={`${data.hour_of_day.sessions[12]}`} label={t("Starts at Noon", "12时开练")} />
        <Stat value={`${data.dow.sessions[1]}`} label={t("Tuesday Sessions", "周二最多")} />
        <Stat value={`${data.avg_session_duration_min} ${t("min", "分钟")}`} label={t("Average Duration", "平均时长")} />
      </div>

      <div className="charts-grid">
        <div className="chart-card full clickable-hint">
          <h3>{t("Weekly Training Sessions", "每周训练次数")}</h3>
          <Chart
            height={280}
            onEvents={{
              click: (p) => {
                const name = chartClickName(p);
                const idx = chartClickIndex(p);
                const key =
                  (name && expandWeekKey(name, w.labels)) ||
                  (idx != null ? w.labels[idx] : null);
                if (key) setDrill({ type: "week", key });
              },
            }}
            option={{
              xAxis: { type: "category", data: shortWeeks, ...axisStyle, axisLabel: { rotate: 45, fontSize: 9 } },
              yAxis: { type: "value", name: t("Sessions", "次数"), ...axisStyle },
              series: [lineSeries(t("Weekly Sessions", "每周次数"), w.sessions)],
              tooltip: { trigger: "axis" },
              grid: { left: 48, right: 16, top: 32, bottom: 60 },
            }}
          />
          <p className="caption">{t("Zero indicates a week without training; click a week for details", "0 表示该周无训练（空窗期）· 点击某周查看详情")}</p>
        </div>
        <div className="chart-card clickable-hint">
          <h3>{t("Sessions by Day of Week", "星期几分布")}</h3>
          <Chart
            onEvents={{
              click: (p) => {
                const name = chartClickName(p);
                if (name) setDrill({ type: "dow", key: rawLabel(name) });
              },
            }}
            option={{
              xAxis: { type: "category", data: data.dow.labels.map(label), ...axisStyle },
              yAxis: { type: "value", ...axisStyle },
              series: [barSeries(t("Sessions", "次数"), data.dow.sessions)],
              tooltip: { trigger: "axis" },
            }}
          />
        </div>
        <div className="chart-card clickable-hint">
          <h3>{t("Workout Start Time", "开始训练时段")}</h3>
          <Chart
            onEvents={{
              click: (p) => {
                const name = chartClickName(p);
                const bucket = timeBuckets.find((b) => b.name === name);
                if (bucket) setDrill({ type: "hour_bucket", key: bucket.key });
              },
            }}
            option={{
              xAxis: { type: "category", data: timeBuckets.map((b) => b.name), ...axisStyle, axisLabel: { rotate: 20, fontSize: 9 } },
              yAxis: { type: "value", ...axisStyle },
              series: [{ type: "bar", data: timeBuckets.map((b) => b.count), itemStyle: { color: MATLAB_COLORS[1] } }],
              tooltip: { trigger: "axis" },
              grid: { left: 48, right: 16, top: 24, bottom: 56 },
            }}
          />
          <p className="caption">{t("Lunchtime training is a consistent part of the routine", "午休训练是核心习惯")}</p>
        </div>
        <div className="chart-card full clickable-hint">
          <h3>{t("24-Hour Training Distribution", "24 小时训练分布")}</h3>
          <Chart
            height={240}
            onEvents={{
              click: (p) => {
                const name = chartClickName(p);
                const idx = chartClickIndex(p);
                const hour =
                  (name && hourFromLabel(name)) ||
                  (idx != null ? String(idx) : null);
                if (hour != null) setDrill({ type: "hour", key: hour });
              },
            }}
            option={{
              xAxis: { type: "category", data: data.hour_of_day.labels, ...axisStyle },
              yAxis: { type: "value", ...axisStyle },
              series: [{ type: "bar", data: data.hour_of_day.sessions, itemStyle: { color: MATLAB_COLORS[0] } }],
              tooltip: { trigger: "axis" },
            }}
          />
        </div>
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
