import { useCallback, useMemo, useState } from "react";
import { Analysis, DrillQuery } from "../api";
import Chart, { MATLAB_COLORS } from "../components/Chart";
import DrillPanel from "../components/DrillPanel";
import { formatVolume, kgToDisplay, useWeightUnit } from "../units";
import { useLanguage } from "../language";

export default function Calendar({ data }: { data: Analysis }) {
  const { unit } = useWeightUnit();
  const { t } = useLanguage();
  const [metric, setMetric] = useState<"sessions" | "volume_kg" | "cardio_km">("sessions");
  const [drill, setDrill] = useState<DrillQuery | null>(null);

  const trainedDates = useMemo(
    () => new Set(data.daily.map((d) => d.date)),
    [data.daily],
  );

  const calendarData = useMemo(() => {
    const map = new Map(data.daily.map((d) => [d.date, d]));
    const start = new Date(data.date_start);
    const end = new Date(data.date_end);
    const cells: { date: string; value: number; label: string }[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      const ds = cur.toISOString().slice(0, 10);
      const d = map.get(ds);
      const value = d
        ? metric === "sessions"
          ? d.sessions
          : metric === "volume_kg"
            ? kgToDisplay(d.volume_kg, unit)
            : d.cardio_km
        : 0;
      cells.push({ date: ds, value, label: ds.slice(5) });
      cur.setDate(cur.getDate() + 1);
    }
    return cells;
  }, [data, metric, unit]);

  const openDay = useCallback(
    (datestr: string) => {
      if (!trainedDates.has(datestr)) return;
      setDrill({ type: "day", key: datestr });
    },
    [trainedDates],
  );

  const onHeatmapClick = useCallback(
    (params: unknown) => {
      const p = params as { data?: [string, number] };
      const datestr = p?.data?.[0];
      if (datestr) openDay(datestr);
    },
    [openDay],
  );

  const metricLabel = { sessions: t("Sessions", "训练次数"), volume_kg: `${t("Volume", "容量")}(${unit})`, cardio_km: t("Cardio (km)", "有氧(km)") }[metric];

  return (
    <>
      <h2 className="page-title">{t("Training Calendar", "训练日历")}</h2>
      <p className="page-desc">
        {data.n_days} {t("training days · Click the heatmap or table to view daily details", "个训练日 · 点击热力图或下方表格，下钻查看当日训练内容与分析")}
      </p>

      <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {(["sessions", "volume_kg", "cardio_km"] as const).map((m) => (
          <button
            key={m}
            className="btn"
            style={{
              background: metric === m ? "var(--accent)" : "var(--surface2)",
              color: metric === m ? "#fff" : "var(--muted)",
              marginBottom: 0,
            }}
            onClick={() => setMetric(m)}
          >
            {{ sessions: t("Sessions", "训练次数"), volume_kg: t("Training Volume", "训练容量"), cardio_km: t("Cardio Distance", "有氧里程") }[m]}
          </button>
        ))}
      </div>

      <div className="chart-card full">
        <h3>{t("Training Heatmap", "训练热力图")} · {metricLabel}</h3>
        <p className="caption" style={{ marginBottom: 8 }}>
          {t("Click any date with a workout to view details", "有训练记录的日期可点击下钻")}
        </p>
        <Chart
          height={Math.max(200, Math.ceil(calendarData.length / 53) * 18 + 80)}
          onEvents={{ click: onHeatmapClick }}
          option={{
            tooltip: {
              formatter: (p: { data: [string, number] }) => {
                const has = trainedDates.has(p.data[0]);
                return `${p.data[0]}<br/>${metricLabel}: ${p.data[1]}${
                  has ? `<br/><span style='color:${MATLAB_COLORS[0]}'>${t("Click for details", "点击查看详情")}</span>` : ""
                }`;
              },
            },
            visualMap: {
              min: 0,
              max: Math.max(...calendarData.map((c) => c.value), 1),
              calculable: true,
              orient: "horizontal",
              left: "center",
              bottom: 0,
              inRange: { color: ["#f3f2f1", MATLAB_COLORS[0]] },
              textStyle: { color: "#666666" },
            },
            calendar: {
              top: 40,
              left: 60,
              right: 20,
              cellSize: ["auto", 14],
              range: [data.date_start, data.date_end],
              itemStyle: { borderWidth: 2, borderColor: "#ffffff" },
              dayLabel: { color: "#666666", fontSize: 10 },
              monthLabel: { color: "#666666", fontSize: 11 },
              yearLabel: { show: false },
            },
            series: [{
              type: "heatmap",
              coordinateSystem: "calendar",
              data: calendarData.map((c) => [c.date, c.value]),
              cursor: "pointer",
            }],
          }}
        />
      </div>

      <div className="chart-card full">
        <h3>{t("Recent Training Days", "最近训练日明细")}</h3>
        <table className="data">
          <thead>
            <tr>
              <th>{t("Date", "日期")}</th>
              <th>{t("Sessions", "次数")}</th>
              <th>{t("Volume", "容量")}</th>
              <th>{t("Duration (min)", "时长(分)")}</th>
              <th>{t("Cardio (km)", "有氧(km)")}</th>
              <th>{t("Calories (kcal)", "消耗(kcal)")}</th>
            </tr>
          </thead>
          <tbody>
            {[...data.daily].reverse().slice(0, 30).map((d) => (
              <tr
                key={d.date}
                className={`clickable-row${drill?.key === d.date ? " selected" : ""}`}
                onClick={() => openDay(d.date)}
                title={t("View daily workout details", "查看当日训练详情")}
              >
                <td>{d.date}</td>
                <td>{d.sessions}</td>
                <td>{formatVolume(d.volume_kg, unit)}</td>
                <td>{d.duration_min}</td>
                <td>{d.cardio_km || "—"}</td>
                <td>{d.cardio_kcal || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drill && <DrillPanel initial={drill} onClose={() => setDrill(null)} />}
    </>
  );
}
