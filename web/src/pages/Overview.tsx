import { useCallback, useState } from "react";
import { Analysis, DrillQuery, chartClickIndex, chartClickName } from "../api";
import Chart, { axisStyle, barSeries, lineSeries, MATLAB_COLORS } from "../components/Chart";
import DrillPanel, { expandMonthKey } from "../components/DrillPanel";
import TrainingHeatmap from "../components/TrainingHeatmap";
import {
  metricTonsToDisplay,
  useWeightUnit,
  volumeScaleLabel,
} from "../units";
import { useLanguage } from "../language";

type Props = {
  data: Analysis;
};

export default function Overview({ data }: Props) {
  const { unit } = useWeightUnit();
  const { language, t, label, rawLabel } = useLanguage();
  const m = data.monthly;
  const volumeUnit = volumeScaleLabel(unit, language);
  const monthlyVolume = m.volume_tons.map((v) => metricTonsToDisplay(v, unit));
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
      <h2 className="page-title overview-title">{t("Workout Overview", "训练总览")}</h2>

      <TrainingHeatmap
        data={data}
        onOpenDay={(date) => setDrill({ type: "day", key: date })}
      />

      <div className="charts-grid">
        <div className="chart-card clickable-hint">
          <h3>{t("Monthly Training Volume", "月度训练容量")} ({volumeUnit})</h3>
          <Chart
            onEvents={{ click: openMonth }}
            option={{
              xAxis: { type: "category", data: shortLabels, ...axisStyle },
              yAxis: { type: "value", ...axisStyle },
              series: [lineSeries(t("Volume", "容量"), monthlyVolume, true)],
              tooltip: { trigger: "axis" },
            }}
          />
        </div>
        <div className="chart-card clickable-hint">
          <h3>{t("Monthly Cardio Distance (km)", "月度有氧里程（km）")}</h3>
          <Chart
            onEvents={{ click: openMonth }}
            option={{
              xAxis: { type: "category", data: shortLabels, ...axisStyle },
              yAxis: { type: "value", name: "km", ...axisStyle },
              series: [lineSeries(t("Cardio Distance", "有氧里程"), m.cardio_km, true)],
              tooltip: { trigger: "axis" },
            }}
          />
        </div>
        <div className="chart-card full clickable-hint">
          <h3>{t("Strength vs Cardio · Monthly", "力量 vs 有氧 · 月度对比")}</h3>
          <Chart
            height={300}
            onEvents={{ click: openMonth }}
            option={{
              legend: {
                data: [`${t("Training Volume", "训练容量")}(${volumeUnit})`, t("Cardio Distance (km)", "有氧里程(km)"), t("Cardio Calories (kcal/100)", "有氧消耗(kcal/100)")],
                textStyle: { color: "#666666" },
              },
              xAxis: { type: "category", data: shortLabels, ...axisStyle },
              yAxis: [
                { type: "value", name: `${t("Volume", "容量")}(${volumeUnit})`, ...axisStyle },
                { type: "value", name: t("Distance / Calories", "里程/消耗"), ...axisStyle },
              ],
              series: [
                { ...barSeries(`${t("Training Volume", "训练容量")}(${volumeUnit})`, monthlyVolume), yAxisIndex: 0 },
                { ...lineSeries(t("Cardio Distance (km)", "有氧里程(km)"), m.cardio_km), yAxisIndex: 1 },
                {
                  ...lineSeries(
                    t("Cardio Calories (kcal/100)", "有氧消耗(kcal/100)"),
                    m.cardio_kcal.map((k) => k / 100),
                  ),
                  yAxisIndex: 1,
                },
              ],
              tooltip: { trigger: "axis" },
            }}
          />
          <p className="caption">{t("Cardio calories are divided by 100 for a shared scale", "有氧消耗已除以 100 以便同轴展示")}</p>
        </div>
        <div className="chart-card clickable-hint">
          <h3>{t("Training by Body Area", "训练部位分布")}</h3>
          <Chart
            onEvents={{
              click: (p) => {
                const name = chartClickName(p);
                if (name) setDrill({ type: "category", key: rawLabel(name) });
              },
            }}
            option={{
              tooltip: { trigger: "item" },
              series: [{
                type: "pie",
                radius: ["42%", "68%"],
                data: data.categories.labels.map((l, i) => ({
                  name: label(l),
                  value: data.categories.sessions[i],
                })),
                label: { color: "#666666", fontSize: 11 },
              }],
            }}
          />
        </div>
        <div className="chart-card clickable-hint">
          <h3>{t("Top 8 Movements (Training Days)", "Top 8 高频动作（训练天数）")}</h3>
          <Chart
            onEvents={{
              click: (p) => {
                const name = chartClickName(p);
                if (name) setDrill({ type: "movement", key: rawLabel(name) });
              },
            }}
            option={{
              xAxis: { type: "value", ...axisStyle },
              yAxis: {
                type: "category",
                data: data.top_movements.slice(0, 8).map((item) => label(item.name)).reverse(),
                ...axisStyle,
                axisLabel: { width: 80, overflow: "truncate", fontSize: 10 },
              },
              series: [{
                type: "bar",
                data: data.top_movements.slice(0, 8).map((t) => t.days).reverse(),
                itemStyle: { color: MATLAB_COLORS[0] },
              }],
              tooltip: { trigger: "axis" },
              grid: { left: 100, right: 16, top: 16, bottom: 24 },
            }}
          />
        </div>
      </div>

      {drill && <DrillPanel initial={drill} onClose={() => setDrill(null)} />}
    </>
  );
}
