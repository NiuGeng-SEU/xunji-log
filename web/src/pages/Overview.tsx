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
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const todayMonthKey = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  })();
  const monthKeys = (() => {
    if (selectedYear) {
      return Array.from({ length: 12 }, (_, month) => `${selectedYear}-${String(month + 1).padStart(2, "0")}`);
    }
    const now = new Date();
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    });
  })();
  const monthIndex = new Map(m.labels.map((month, index) => [month, index]));
  const monthlyVolume = monthKeys.map((month) => {
    const index = monthIndex.get(month);
    return metricTonsToDisplay(index == null ? 0 : m.volume_tons[index], unit);
  });
  const monthlyCardio = monthKeys.map((month) => {
    if (selectedYear && month > todayMonthKey) {
      return null;
    }
    const index = monthIndex.get(month);
    return index == null ? 0 : m.cardio_km[index];
  });
  const shortLabels = monthKeys.map((month) => month.slice(2));
  const topMovements = data.top_movements
    .filter(({ name }) => {
      const normalized = name.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
      return !normalized.includes("walking")
        && !normalized.includes("running")
        && !normalized.includes("traditionalstrength")
        && !normalized.includes("applehealth")
        && !normalized.includes("elliptical");
    })
    .slice(0, 8);
  const [drill, setDrill] = useState<DrillQuery | null>(null);

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
      <h2 className="page-title overview-title">{t("Overview", "总览")}</h2>

      <TrainingHeatmap
        data={data}
        onOpenDay={(date) => setDrill({ type: "day", key: date })}
        selectedYear={selectedYear}
        onSelectYear={setSelectedYear}
      />

      <div className="charts-grid">
        <div className="chart-card full clickable-hint">
          <h3>{t("Strength vs Cardio · Monthly", "力量 vs 有氧 · 月度对比")}</h3>
          <Chart
            height={300}
            onEvents={{ click: openMonth }}
            option={{
              legend: {
                data: [`${t("Training Volume", "训练容量")} (${volumeUnit})`, t("Cardio Distance (km)", "有氧里程(km)")],
                textStyle: { color: "#666666" },
              },
              xAxis: { type: "category", data: shortLabels, ...axisStyle },
              yAxis: [
                { type: "value", name: `${t("Volume", "容量")} (${volumeUnit})`, ...axisStyle },
                { type: "value", name: t("Distance (km)", "里程 (km)"), ...axisStyle },
              ],
              series: [
                { ...barSeries(`${t("Training Volume", "训练容量")} (${volumeUnit})`, monthlyVolume), yAxisIndex: 0 },
                { ...lineSeries(t("Cardio Distance (km)", "有氧里程(km)"), monthlyCardio), yAxisIndex: 1 },
              ],
              tooltip: { trigger: "axis" },
              grid: { left: 24, right: 32, top: 52, bottom: 28, containLabel: true },
            }}
          />
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
                data: topMovements.map((item) => label(item.name)).reverse(),
                ...axisStyle,
                axisLabel: { width: 80, overflow: "truncate", fontSize: 10 },
              },
              series: [{
                type: "bar",
                data: topMovements.map((movement) => movement.days).reverse(),
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
