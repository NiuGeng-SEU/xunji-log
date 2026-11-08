import React, { useMemo } from "react";
import Chart, { axisStyle } from "../Chart";
import { BanisterSimulationResult } from "../../utils/banister";
import { useLanguage } from "../../language";

interface Props {
  data: BanisterSimulationResult;
}

export default function ForwardSimulationChart({ data }: Props) {
  const { t, language } = useLanguage();
  const { points, todayIndex, todayDate, alerts } = data;

  const dates = useMemo(() => points.map((p) => p.date), [points]);
  const ctlSeries = useMemo(() => points.map((p) => p.ctl), [points]);
  const atlSeries = useMemo(() => points.map((p) => p.atl), [points]);
  const tsbSeries = useMemo(() => points.map((p) => p.tsb), [points]);
  const loadSeries = useMemo(() => points.map((p) => p.load), [points]);

  const currentPoint = points[todayIndex] || points[points.length - 1];

  let formStatus = { en: "Neutral", zh: "平衡适中", color: "#10b981" };
  if (currentPoint) {
    if (currentPoint.tsb > 10) {
      formStatus = { en: "Very Fresh / Tapered", zh: "极佳恢复 / 适合参赛", color: "#10b981" };
    } else if (currentPoint.tsb >= -10 && currentPoint.tsb <= 10) {
      formStatus = { en: "Maintenance / Neutral", zh: "稳态平衡", color: "#10b981" };
    } else if (currentPoint.tsb < -10 && currentPoint.tsb >= -25) {
      formStatus = { en: "Optimal Overload Zone", zh: "最佳超量积累区", color: "#059669" };
    } else if (currentPoint.tsb < -25 && currentPoint.tsb >= -30) {
      formStatus = { en: "Heavy Fatigue", zh: "重度疲劳累积", color: "#f59e0b" };
    } else {
      formStatus = { en: "High Risk / Overreaching", zh: "高危过劳预警", color: "#ef4444" };
    }
  }

  const option = useMemo(() => {
    return {
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(255, 255, 255, 0.96)",
        borderColor: "#cbd5e1",
        textStyle: { color: "#1e293b", fontSize: 12 },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return "";
          const pIdx = params[0].dataIndex;
          const pt = points[pIdx];
          if (!pt) return "";

          const isFuture = pt.isFuture;
          const tag = isFuture ? `<span style="color:#2563eb;font-weight:600">[${t("Prediction", "未来预测")}]</span>` : `<span>[${t("Historical", "历史实测")}]</span>`;
          const titleStr = pt.title ? `<div style="font-size:11px;color:#64748b;margin-bottom:4px;">${pt.title}</div>` : "";

          let html = `<div style="font-weight:600;margin-bottom:4px;">${pt.date} ${tag}</div>${titleStr}`;
          html += `<div style="color:#00539b">● ${t("CTL (Fitness)", "体能 CTL (42d)")}: <b>${pt.ctl}</b></div>`;
          html += `<div style="color:#ef4444">● ${t("ATL (Fatigue)", "疲劳 ATL (7d)")}: <b>${pt.atl}</b></div>`;
          html += `<div style="color:#059669">● ${t("TSB (Form)", "竞技状态 Form")}: <b>${pt.tsb}</b></div>`;
          html += `<div style="color:#64748b">● ${t("Daily Load (TRIMP)", "当日负荷冲激量")}: <b>${pt.load}</b></div>`;
          return html;
        },
      },
      legend: {
        data: [
          t("CTL Fitness (42d)", "CTL 体能 (42天)"),
          t("ATL Fatigue (7d)", "ATL 疲劳 (7天)"),
          t("TSB Form (CTL - ATL)", "TSB 竞技状态 (体能-疲劳)"),
          t("Daily Load (TRIMP)", "单日负荷 (冲激量)"),
        ],
        top: 0,
        textStyle: { color: "#64748b", fontSize: 11 },
      },
      grid: {
        left: 45,
        right: 85,
        top: 36,
        bottom: 30,
      },
      xAxis: {
        type: "category",
        data: dates,
        ...axisStyle,
        axisLabel: {
          color: "#94a3b8",
          fontSize: 11,
          formatter: (val: string) => val.slice(5),
        },
      },
      yAxis: [
        {
          type: "value",
          name: t("Model Units", "模型指数"),
          nameTextStyle: { color: "#94a3b8", fontSize: 10 },
          ...axisStyle,
          splitLine: { lineStyle: { color: "#f1f5f9" } },
        },
        {
          type: "value",
          name: t("TRIMP", "负荷"),
          nameTextStyle: { color: "#94a3b8", fontSize: 10 },
          max: 200,
          show: false,
          ...axisStyle,
        },
      ],
      series: [
        {
          name: t("CTL Fitness (42d)", "CTL 体能 (42天)"),
          type: "line",
          data: ctlSeries,
          showSymbol: false,
          smooth: 0.25,
          lineStyle: { width: 2.5, color: "#00539b" },
          itemStyle: { color: "#00539b" },
          markLine: {
            silent: true,
            symbol: "none",
            data: [
              {
                xAxis: todayDate,
                lineStyle: { color: "#0ea5e9", width: 2, type: "dashed" },
                label: {
                  formatter: `${t("Today", "今日")} (${todayDate.slice(5)})`,
                  position: "insideEndTop",
                  color: "#0284c7",
                  fontSize: 11,
                  fontWeight: "bold",
                },
              },
            ],
          },
        },
        {
          name: t("ATL Fatigue (7d)", "ATL 疲劳 (7天)"),
          type: "line",
          data: atlSeries,
          showSymbol: false,
          smooth: 0.25,
          lineStyle: { width: 2, color: "#ef4444" },
          itemStyle: { color: "#ef4444" },
        },
        {
          name: t("TSB Form (CTL - ATL)", "TSB 竞技状态 (体能-疲劳)"),
          type: "line",
          data: tsbSeries,
          showSymbol: false,
          smooth: 0.25,
          lineStyle: { width: 2.2, color: "#059669" },
          itemStyle: { color: "#059669" },
          markArea: {
            silent: true,
            data: [
              // Optimal progressive overload zone (-25 to -10)
              [
                {
                  yAxis: -25,
                  itemStyle: { color: "rgba(0, 158, 115, 0.08)" },
                  label: {
                    show: true,
                    position: "right",
                    formatter: t("Optimal Zone", "最佳积累区"),
                    color: "#059669",
                    fontSize: 10,
                  },
                },
                { yAxis: -10 },
              ],
              // High injury risk (< -30)
              [
                {
                  yAxis: -60,
                  itemStyle: { color: "rgba(239, 68, 68, 0.08)" },
                  label: {
                    show: true,
                    position: "right",
                    formatter: t("Danger Zone", "高危预警区"),
                    color: "#dc2626",
                    fontSize: 10,
                  },
                },
                { yAxis: -30 },
              ],
            ],
          },
        },
        {
          name: t("Daily Load (TRIMP)", "单日负荷 (冲激量)"),
          type: "bar",
          yAxisIndex: 1,
          data: loadSeries,
          barMaxWidth: 6,
          itemStyle: {
            color: (params: any) => {
              const pt = points[params.dataIndex];
              return pt?.isFuture ? "rgba(37, 99, 235, 0.45)" : "rgba(148, 163, 184, 0.35)";
            },
            borderRadius: [2, 2, 0, 0],
          },
        },
      ],
    };
  }, [dates, ctlSeries, atlSeries, tsbSeries, loadSeries, points, todayDate, t]);

  return (
    <div className="simulation-card">
      <div className="simulation-header">
        <div className="simulation-title-wrap">
          <h3 className="card-section-title">
            📈 {t("Fitness", "体能")}
          </h3>
          <div className="simulation-subtitle-desc">
            <span><b>CTL (42d)</b>: {t("Fitness", "长期体能")}</span>
            <span className="dot-sep">·</span>
            <span><b>ATL (7d)</b>: {t("Fatigue", "近期疲劳")}</span>
            <span className="dot-sep">·</span>
            <span><b>TSB</b>: {t("Form (CTL − ATL)", "竞技状态 (CTL − ATL)")}</span>
          </div>
        </div>

        {/* Real-time Current Values */}
        {currentPoint && (
          <div className="current-metrics-cluster">
            <div className="metric-badge">
              <span className="lbl">{t("Current Fitness (CTL)", "当前体能 CTL")}</span>
              <div className="val-row">
                <span className="val blue">{currentPoint.ctl}</span>
              </div>
            </div>
            <div className="metric-badge">
              <span className="lbl">{t("Current Fatigue (ATL)", "当前疲劳 ATL")}</span>
              <div className="val-row">
                <span className="val red">{currentPoint.atl}</span>
              </div>
            </div>
            <div className="metric-badge">
              <span className="lbl">{t("Form Status (TSB)", "竞技状态 Form")}</span>
              <div className="val-row">
                <span className="val" style={{ color: formStatus.color }}>
                  {currentPoint.tsb > 0 ? `+${currentPoint.tsb}` : currentPoint.tsb}
                </span>
                <span className="status-sub" style={{ color: formStatus.color }}>
                  {language === "zh" ? formStatus.zh : formStatus.en}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Danger alerts if future training exceeds limits */}
      {alerts.length > 0 && (
        <div className="simulation-alerts-box">
          <div className="alert-title">⚠️ {t("Future Fatigue & Injury Warnings Detected", "监测到未来过度疲劳与伤病风险预警")}</div>
          <ul className="alert-list">
            {alerts.slice(0, 3).map((a, i) => (
              <li key={i}>
                <b>{a.date}</b>: {t(a.message_en, a.message_zh)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="simulation-chart-wrapper">
        <Chart option={option} height={320} />
      </div>
    </div>
  );
}
