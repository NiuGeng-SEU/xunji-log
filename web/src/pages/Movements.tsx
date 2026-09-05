import { useState } from "react";
import { Analysis, DrillQuery, chartClickName } from "../api";
import Chart, { axisStyle, lineSeries } from "../components/Chart";
import DrillPanel from "../components/DrillPanel";
import { formatWeight, metricTonsToDisplay, useWeightUnit, volumeScaleLabel } from "../units";
import { useLanguage } from "../language";

export default function Movements({ data }: { data: Analysis }) {
  const { unit } = useWeightUnit();
  const { language, t, label, rawLabel } = useLanguage();
  const mt = data.movement_trends;
  const volumeUnit = volumeScaleLabel(unit, language);
  const shortLabels = mt.labels.map((l) => l.slice(2));
  const [drill, setDrill] = useState<DrillQuery | null>(null);

  return (
    <>
      <h2 className="page-title">{t("Movement Progress", "动作进步")}</h2>
      <p className="page-desc">{t("Monthly volume trends for the top 8 movements · Personal records (PR)", "Top 8 动作月度容量趋势 · 个人记录（PR）")}</p>

      <div className="charts-grid">
        <div className="chart-card full clickable-hint">
          <h3>{t("Top 8 Movements · Monthly Volume", "Top 8 动作 · 月度容量")} ({volumeUnit})</h3>
          <Chart
            height={360}
            onEvents={{
              click: (p) => {
                const seriesName = (p as { seriesName?: string }).seriesName;
                const name = seriesName || chartClickName(p);
                const rawName = name ? rawLabel(name) : "";
                if (rawName && mt.series.some((s) => s.name === rawName)) {
                  setDrill({ type: "movement", key: rawName });
                }
              },
            }}
            option={{
              legend: {
                data: mt.series.map((s) => label(s.name)),
                textStyle: { color: "#666666", fontSize: 10 },
                type: "scroll",
              },
              xAxis: { type: "category", data: shortLabels, ...axisStyle },
              yAxis: { type: "value", name: volumeUnit, ...axisStyle },
              series: mt.series.map((s) => lineSeries(label(s.name), s.data.map((v) => metricTonsToDisplay(v, unit)))),
              tooltip: { trigger: "axis" },
            }}
          />
        </div>
      </div>

      <div className="chart-card full">
        <h3>{t("Personal Records (PR) · Top 30", "个人记录（PR）· Top 30")}</h3>
        <table className="data">
          <thead>
            <tr><th>{t("Movement", "动作")}</th><th>{t("Area", "部位")}</th><th>{t("Max Weight", "最大重量")}</th><th>{t("Reps", "次数")}</th><th>{t("Date", "日期")}</th></tr>
          </thead>
          <tbody>
            {data.movement_prs.map((p) => (
              <tr
                key={p.name}
                className="clickable-row"
                onClick={() => setDrill({ type: "movement", key: p.name })}
              >
                <td>{label(p.name)}</td>
                <td>{label(p.category)}</td>
                <td><strong>{formatWeight(p.max_weight_kg, unit)}</strong></td>
                <td>{p.reps}</td>
                <td
                  className="linkish"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDrill({ type: "day", key: p.date });
                  }}
                  title={t("View this workout", "查看该日训练")}
                >
                  {p.date}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drill && <DrillPanel initial={drill} onClose={() => setDrill(null)} />}
    </>
  );
}
