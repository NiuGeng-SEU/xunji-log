import { useCallback, useState } from "react";
import { Analysis, DrillQuery, chartClickIndex, chartClickName } from "../api";
import Chart, { axisStyle, lineSeries, MATLAB_COLORS } from "../components/Chart";
import DrillPanel, { expandMonthKey } from "../components/DrillPanel";
import { useLanguage } from "../language";

export default function FatLoss({ data }: { data: Analysis }) {
  const { t, label } = useLanguage();
  const c = data.cardio;
  const m = data.monthly;
  const shortLabels = m.labels.map((l) => l.slice(2));
  const [drill, setDrill] = useState<DrillQuery | null>(null);

  const openMonth = useCallback(
    (params: unknown) => {
      const name = chartClickName(params);
      const idx = chartClickIndex(params);
      const key =
        (name && expandMonthKey(name, m.labels)) ||
        (idx != null ? m.labels[idx] : null);
      if (key) setDrill({ type: "month", key });
    },
    [m.labels],
  );

  return (
    <>
      <h2 className="page-title">{t("Cardio Analysis", "减脂分析")}</h2>
      <p className="page-desc">
        {c.n_sessions} {t("cardio sessions", "次有氧训练")} · {c.total_km} km · {c.total_kcal.toLocaleString()} kcal
      </p>

      <div className="stats-grid">
        <Stat value={`${c.n_sessions}`} label={t("Cardio Sessions", "纯有氧训练")} />
        <Stat value={`${c.total_km} km`} label={t("Total Distance", "累计里程")} />
        <Stat value={`${(c.total_kcal / 1000).toFixed(1)}k kcal`} label={t("Total Calories", "累计消耗")} />
        <Stat value={`${c.avg_hr} bpm`} label={t("Average Heart Rate", "平均心率")} />
        <Stat value={`${c.max_hr} bpm`} label={t("Average Max Heart Rate", "平均最大心率")} />
        <Stat value={`${c.n_strength_sessions}`} label={t("Strength Sessions", "力量训练（保肌）")} />
      </div>

      <div className="charts-grid">
        <div className="chart-card clickable-hint">
          <h3>{t("Monthly Cardio Distance (km)", "月度有氧里程（km）")}</h3>
          <Chart
            onEvents={{ click: openMonth }}
            option={{
              xAxis: { type: "category", data: shortLabels, ...axisStyle },
              yAxis: { type: "value", name: "km", ...axisStyle },
              series: [lineSeries(t("Distance", "里程"), m.cardio_km, true)],
              tooltip: { trigger: "axis" },
            }}
          />
          <p className="caption">{t("Cycling peaked in spring 2025 and summer 2026; winter cardio was limited", "2025 春季与 2026 夏季为骑行高峰，冬季几乎无有氧")}</p>
        </div>
        <div className="chart-card clickable-hint">
          <h3>{t("Monthly Cardio Calories (kcal)", "月度有氧消耗（kcal）")}</h3>
          <Chart
            onEvents={{ click: openMonth }}
            option={{
              xAxis: { type: "category", data: shortLabels, ...axisStyle },
              yAxis: { type: "value", name: "kcal", ...axisStyle },
              series: [{ type: "bar", data: m.cardio_kcal, itemStyle: { color: MATLAB_COLORS[4] } }],
              tooltip: { trigger: "axis" },
            }}
          />
        </div>
        <div className="chart-card full clickable-hint">
          <h3>{t("Training Frequency vs Cardio Distance", "减脂策略：训练频率 vs 有氧里程")}</h3>
          <Chart
            height={300}
            onEvents={{ click: openMonth }}
            option={{
              legend: { data: [t("Monthly Sessions", "月训练次数"), t("Cardio Distance (km)", "有氧里程(km)")], textStyle: { color: "#666666" } },
              xAxis: { type: "category", data: shortLabels, ...axisStyle },
              yAxis: [
                { type: "value", name: t("Sessions", "训练次数"), ...axisStyle },
                { type: "value", name: t("Cardio km", "有氧 km"), ...axisStyle },
              ],
              series: [
                { ...lineSeries(t("Monthly Sessions", "月训练次数"), m.sessions), yAxisIndex: 0 },
                { ...lineSeries(t("Cardio Distance (km)", "有氧里程(km)"), m.cardio_km), yAxisIndex: 1 },
              ],
              tooltip: { trigger: "axis" },
            }}
          />
          <p className="caption">{t("Keep strength training during fat loss to preserve muscle", "减脂期力量训练不能停——肌肉是代谢的基础")}</p>
        </div>
      </div>

      <div className="chart-card full">
        <h3>{t("Recent Cardio Sessions (Last 20)", "有氧训练记录（最近 20 次）")}</h3>
        <table className="data">
          <thead>
            <tr>
              <th>{t("Date", "日期")}</th><th>{t("Title", "标题")}</th><th>{t("Distance", "里程")}</th><th>{t("Calories", "消耗")}</th><th>{t("Duration", "时长")}</th><th>{t("Heart Rate", "心率")}</th>
            </tr>
          </thead>
          <tbody>
            {data.cardio_sessions.slice(0, 20).map((s) => (
              <tr
                key={s.date + s.title}
                className="clickable-row"
                onClick={() => setDrill({ type: "day", key: s.date })}
              >
                <td>{s.date}</td>
                <td>{label(s.title) || "—"}</td>
                <td>{s.distance_km} km</td>
                <td>{s.kcal} kcal</td>
                <td>{s.duration_min} {t("min", "分钟")}</td>
                <td>{s.avg_hr ? `${s.avg_hr} bpm` : "—"}</td>
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
