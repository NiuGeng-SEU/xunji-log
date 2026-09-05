import { useCallback, useState } from "react";
import { Analysis, DrillQuery, chartClickIndex, chartClickName } from "../api";
import Chart, { axisStyle, lineSeries, MATLAB_COLORS } from "../components/Chart";
import DrillPanel, { expandMonthKey } from "../components/DrillPanel";
import {
  formatScaledVolume,
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
  const volumeUnit = volumeScaleLabel(unit, language);
  const monthlyVolume = m.volume_tons.map((v) => metricTonsToDisplay(v, unit));
  const shortLabels = m.labels.map((l) => l.slice(2));
  const cm = data.category_monthly;
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
      <h2 className="page-title">{t("Strength Training", "增肌训练")}</h2>
      <p className="page-desc">
        {t("Total volume", "总容量")} {formatVolume(data.total_volume_kg, unit)} · {data.total_done_sets} {t("completed sets", "组完成")} · {t("Click charts to explore", "图表可下钻")}
      </p>

      <div className="stats-grid">
        <Stat value={formatVolume(data.total_volume_kg, unit)} label={t("Total Volume", "总训练容量")} />
        <Stat value={`${data.total_done_sets}`} label={t("Completed Sets", "完成组数")} />
        <Stat value={formatScaledVolume(m.volume_tons[m.volume_tons.length - 1], unit, language)} label={t("Latest Monthly Volume", "最近月容量")} />
        <Stat value={`×${(m.volume_tons[m.volume_tons.length - 1] / Math.max(m.volume_tons[0], 1)).toFixed(1)}`} label={t("Volume Growth", "容量增长倍数")} />
        <Stat value={`${data.categories.sessions[0]}`} label={t("Back Sessions", "背部动作次数")} />
        <Stat value={`${data.categories.sessions[1]}`} label={t("Chest Sessions", "胸部动作次数")} />
      </div>

      <div className="charts-grid">
        <div className="chart-card full clickable-hint">
          <h3>{t("Monthly Volume Growth", "月度训练容量增长")} ({volumeUnit})</h3>
          <Chart
            height={300}
            onEvents={{ click: openMonth }}
            option={{
              xAxis: { type: "category", data: shortLabels, ...axisStyle },
              yAxis: { type: "value", name: volumeUnit, ...axisStyle },
              series: [lineSeries(t("Volume", "容量"), monthlyVolume, true)],
              tooltip: { trigger: "axis" },
            }}
          />
          <p className="caption">{t("Progressive overload", "渐进超负荷")}：{formatScaledVolume(m.volume_tons[0], unit, language)} → {formatScaledVolume(m.volume_tons[m.volume_tons.length - 1], unit, language)}</p>
        </div>
        <div className="chart-card full clickable-hint">
          <h3>{t("Monthly Volume by Body Area", "各部位月度容量")} ({volumeUnit})</h3>
          <Chart
            height={320}
            onEvents={{
              click: (p) => {
                const seriesName = (p as { seriesName?: string }).seriesName;
                if (seriesName) setDrill({ type: "category", key: rawLabel(seriesName) });
                else openMonth(p);
              },
            }}
            option={{
              legend: { data: cm.series.map((s) => label(s.name)), textStyle: { color: "#666666", fontSize: 10 } },
              xAxis: { type: "category", data: shortLabels, ...axisStyle },
              yAxis: { type: "value", name: volumeUnit, ...axisStyle },
              series: cm.series.map((s) => ({
                name: label(s.name),
                type: "line",
                smooth: true,
                stack: "total",
                areaStyle: { opacity: 0.4 },
                data: s.data.map((v) => metricTonsToDisplay(v, unit)),
              })),
              tooltip: { trigger: "axis" },
            }}
          />
          <p className="caption">{t("Click a line to explore that body area, or a month to view the full month", "点击某条折线可下钻该部位；点击月份可看整月")}</p>
        </div>
        <div className="chart-card clickable-hint">
          <h3>{t("Training Share by Body Area", "部位训练占比")}</h3>
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
                radius: ["40%", "65%"],
                data: data.categories.labels.slice(0, 7).map((l, i) => ({
                  name: label(l),
                  value: data.categories.sessions[i],
                })),
                label: { color: "#666666", fontSize: 11 },
              }],
            }}
          />
        </div>
        <div className="chart-card clickable-hint">
          <h3>{t("Monthly Training Time (hours)", "月度训练时长（小时）")}</h3>
          <Chart
            onEvents={{ click: openMonth }}
            option={{
              xAxis: { type: "category", data: shortLabels, ...axisStyle },
              yAxis: { type: "value", name: t("hours", "小时"), ...axisStyle },
              series: [{ type: "bar", data: m.duration_hours, itemStyle: { color: MATLAB_COLORS[0] } }],
              tooltip: { trigger: "axis" },
            }}
          />
        </div>
      </div>

      <div className="chart-card full">
        <h3>{t("Top 20 Movements by Volume", "Top 20 动作 · 容量排行 · 点击下钻")}</h3>
        <table className="data">
          <thead>
            <tr><th>{t("Movement", "动作")}</th><th>{t("Area", "部位")}</th><th>{t("Days", "训练天数")}</th><th>{t("Sets", "组数")}</th><th>{t("Volume", "容量")}</th></tr>
          </thead>
          <tbody>
            {data.top_movements.map((t) => (
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
