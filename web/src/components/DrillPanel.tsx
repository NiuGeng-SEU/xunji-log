import { Fragment, useCallback, useEffect, useState } from "react";
import {
  DayDetail,
  DayMovement,
  DrillQuery,
  DrillResult,
  DrillType,
  MovementDrill,
  fetchDrill,
  chartClickIndex,
  chartClickName,
} from "../api";
import Chart, { axisStyle, barSeries, lineSeries, MATLAB_COLORS } from "./Chart";
import {
  convertInsightUnits,
  formatVolume,
  formatWeight,
  kgToDisplay,
  metricTonsToDisplay,
  useWeightUnit,
  volumeScaleLabel,
} from "../units";
import { useLanguage } from "../language";

function InsightList({ items, title }: { items: string[]; title: string }) {
  const { unit } = useWeightUnit();
  const { text } = useLanguage();
  const translated = items.map((item) => text(convertInsightUnits(item, unit))).filter(Boolean);
  if (!translated.length) return null;
  return (
    <div className="chart-card insights-card">
      <h3>{title}</h3>
      <ul className="insight-list">
        {translated.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );
}

function SetTable({ move }: { move: DayMovement }) {
  const { unit } = useWeightUnit();
  const { t } = useLanguage();
  if (move.is_cardio) {
    const cardioSets = move.sets.filter((s) => s.cardio);
    return (
      <table className="data set-table">
        <thead>
          <tr><th>{t("Set", "组")}</th><th>{t("Distance", "距离")}</th><th>{t("Calories", "消耗")}</th><th>{t("Heart Rate", "心率")}</th><th>{t("Duration", "时长")}</th></tr>
        </thead>
        <tbody>
          {cardioSets.map((s, i) => (
            <tr key={i}>
              <td>{s.index ?? i + 1}</td>
              <td>{s.cardio?.distance_km != null ? `${s.cardio.distance_km} km` : "—"}</td>
              <td>{s.cardio?.kcal != null ? `${s.cardio.kcal} kcal` : "—"}</td>
              <td>{s.cardio?.avg_hr != null ? `${t("Avg", "均")} ${s.cardio.avg_hr}` : "—"}</td>
              <td>{s.cardio?.duration_sec ? `${Math.round(s.cardio.duration_sec / 60)} ${t("min", "分")}` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <table className="data set-table">
      <thead>
        <tr><th>{t("Set", "组")}</th><th>{t("Weight", "重量")}</th><th>{t("Reps", "次数")}</th><th>{t("Volume", "容量")}</th><th>RPE</th></tr>
      </thead>
      <tbody>
        {move.sets.map((s, i) => (
          <tr key={i} className={s.done ? "" : "undone"}>
            <td>{s.index ?? i + 1}</td>
            <td>{s.weight_kg != null ? formatWeight(s.weight_kg, unit) : "—"}</td>
            <td>{s.reps ?? "—"}</td>
            <td>{s.volume_kg ? formatVolume(s.volume_kg, unit) : "—"}</td>
            <td>{s.rpe ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MovementSetRows({ sets }: { sets: MovementDrill["history"][0]["sets"] }) {
  const { unit } = useWeightUnit();
  const { t } = useLanguage();
  return (
    <table className="data set-table">
      <thead>
        <tr><th>{t("Set", "组")}</th><th>{t("Weight", "重量")}</th><th>{t("Reps", "次数")}</th><th>{t("Volume", "容量")}</th><th>RPE</th></tr>
      </thead>
      <tbody>
        {sets.map((s, i) => (
          <tr key={i} className={s.done ? "" : "undone"}>
            <td>{s.index ?? i + 1}</td>
            <td>{s.weight_kg != null ? formatWeight(s.weight_kg, unit) : "—"}</td>
            <td>{s.reps ?? "—"}</td>
            <td>{s.volume_kg ? formatVolume(s.volume_kg, unit) : "—"}</td>
            <td>{s.rpe ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DayBody({
  detail,
  onOpenMovement,
  onOpenCategory,
}: {
  detail: DayDetail;
  onOpenMovement?: (name: string) => void;
  onOpenCategory?: (name: string) => void;
}) {
  const { unit } = useWeightUnit();
  const { t, label } = useLanguage();
  const s = detail.summary;
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const open: Record<string, boolean> = {};
    detail.sessions.forEach((sess, si) => {
      sess.movements.forEach((_, mi) => { open[`${si}-${mi}`] = true; });
    });
    return open;
  });

  return (
    <>
      <div className="stats-grid day-stats">
        <div className="stat-card"><div className="value">{s.sessions}</div><div className="label">{t("Sessions", "训练次数")}</div></div>
        <div className="stat-card"><div className="value">{formatVolume(s.volume_kg, unit)}</div><div className="label">{t("Total Volume", "总容量")}</div></div>
        <div className="stat-card"><div className="value">{s.duration_min}</div><div className="label">{t("Duration (min)", "时长(分)")}</div></div>
        <div className="stat-card"><div className="value">{s.n_sets}</div><div className="label">{t("Total Sets", "总组数")}</div></div>
      </div>
      <InsightList items={detail.insights} title={t("Daily Analysis", "当日分析")} />
      {detail.sessions.map((session, si) => (
        <div className="chart-card session-card" key={session.localid ?? si}>
          <div className="session-head">
            <h3>{label(session.title)}</h3>
            <p className="caption">
              {session.start_time && session.end_time ? `${session.start_time} – ${session.end_time}` : "—"}
              {" · "}{session.duration_min} {t("min", "分钟")} · {session.n_movements} {t("movements", "动作")} / {session.n_sets} {t("sets", "组")}
            </p>
          </div>
          {session.movements.map((move, mi) => {
            const key = `${si}-${mi}`;
            const open = !!expanded[key];
            return (
              <div className="move-block" key={key}>
                <button type="button" className="move-toggle" onClick={() => setExpanded((p) => ({ ...p, [key]: !p[key] }))}>
                  <span className="move-cat">{label(move.category)}</span>
                  <span className="move-name">{label(move.name)}</span>
                  <span className="move-meta">{move.done_sets}/{move.sets_count} {t("sets", "组")} · {formatVolume(move.volume_kg, unit)}</span>
                  <span className="move-chevron">{open ? "▾" : "▸"}</span>
                </button>
                {open && (
                  <>
                    <SetTable move={move} />
                    {onOpenMovement && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpenMovement(move.name)}>
                        {t(`View ${label(move.name)} history`, `查看「${move.name}」历史进步`)} →
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

function MovementBody({
  mv,
  onOpenDay,
}: {
  mv: MovementDrill;
  onOpenDay: (date: string) => void;
}) {
  const { unit } = useWeightUnit();
  const { language, t, label } = useLanguage();
  const [openHist, setOpenHist] = useState<Record<string, boolean>>({});
  const prog = mv.progression;
  const monthly = mv.monthly;
  const volumeUnit = volumeScaleLabel(unit, language);
  const weightSeriesName = `${t("Peak Weight", "峰值重量")}(${unit})`;
  const volumeSeriesName = `${t("Volume", "容量")}(${unit})`;
  const monthlyVolumeName = `${t("Monthly Volume", "月容量")}(${volumeUnit})`;
  const monthlyWeightName = `${t("Monthly Peak Weight", "月峰值重量")}(${unit})`;

  return (
    <>
      <div className="stats-grid day-stats">
        <div className="stat-card"><div className="value">{mv.stats.training_days}</div><div className="label">{t("Training Days", "训练天数")}</div></div>
        <div className="stat-card"><div className="value">{mv.stats.total_sets}</div><div className="label">{t("Total Sets", "总组数")}</div></div>
        <div className="stat-card"><div className="value">{formatVolume(mv.stats.total_volume_kg, unit)}</div><div className="label">{t("Total Volume", "累计容量")}</div></div>
        <div className="stat-card">
          <div className="value">{mv.pr ? formatWeight(mv.pr.max_weight_kg, unit) : "—"}</div>
          <div className="label">PR{mv.pr ? ` × ${mv.pr.reps}` : ""}</div>
        </div>
        {mv.stats.early_avg_weight_kg != null && mv.stats.late_avg_weight_kg != null && (
          <div className="stat-card">
            <div className="value">{formatWeight(mv.stats.early_avg_weight_kg, unit)} → {formatWeight(mv.stats.late_avg_weight_kg, unit)}</div>
            <div className="label">{t("Early → Recent Average", "早期→近期均重")}</div>
          </div>
        )}
        <div className="stat-card"><div className="value">{label(mv.category)}</div><div className="label">{t("Body Area", "部位")}</div></div>
      </div>

      <InsightList items={mv.insights} title={t("Progress Analysis", "进步分析")} />

      {prog.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 16 }}>
          <h3>{t("Peak Weight / Volume by Session", "每次训练 · 峰值重量 / 容量")}</h3>
          <Chart
            height={240}
            onEvents={{ click: (p) => { const i = chartClickIndex(p); if (i != null && prog[i]) onOpenDay(prog[i].date); } }}
            option={{
              legend: { data: [weightSeriesName, volumeSeriesName], textStyle: { color: "#666666", fontSize: 10 } },
              tooltip: { trigger: "axis" },
              grid: { left: 48, right: 48, top: 36, bottom: 48 },
              xAxis: { type: "category", data: prog.map((p) => p.date.slice(5)), ...axisStyle, axisLabel: { rotate: 45, fontSize: 8 } },
              yAxis: [{ type: "value", ...axisStyle }, { type: "value", ...axisStyle }],
              series: [
                { ...lineSeries(weightSeriesName, prog.map((p) => kgToDisplay(p.max_weight_kg || 0, unit))), yAxisIndex: 0, symbolSize: 6 },
                { ...lineSeries(volumeSeriesName, prog.map((p) => kgToDisplay(p.volume_kg, unit))), yAxisIndex: 1 },
              ],
            }}
          />
        </div>
      )}

      {monthly.labels.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 16 }}>
          <h3>{t("Monthly Volume / Peak Weight", "月度容量 / 峰值重量")}</h3>
          <Chart
            height={220}
            option={{
              legend: { data: [monthlyVolumeName, monthlyWeightName], textStyle: { color: "#666666", fontSize: 10 } },
              tooltip: { trigger: "axis" },
              grid: { left: 48, right: 48, top: 36, bottom: 36 },
              xAxis: { type: "category", data: monthly.labels.map((l) => l.slice(2)), ...axisStyle },
              yAxis: [{ type: "value", ...axisStyle }, { type: "value", ...axisStyle }],
              series: [
                { ...barSeries(monthlyVolumeName, monthly.volume_tons.map((v) => metricTonsToDisplay(v, unit))), yAxisIndex: 0 },
                { ...lineSeries(monthlyWeightName, monthly.max_weight_kg.map((v) => kgToDisplay(v, unit))), yAxisIndex: 1 },
              ],
            }}
          />
        </div>
      )}

      <div className="chart-card">
        <h3>{t("Workout History · Expand Sets", "历史训练记录 · 展开看每组")}</h3>
        <table className="data">
          <thead>
            <tr><th></th><th>{t("Date", "日期")}</th><th>{t("Workout", "训练")}</th><th>{t("Sets", "组数")}</th><th>{t("Peak", "峰值")}</th><th>{t("Volume", "容量")}</th></tr>
          </thead>
          <tbody>
            {mv.history.map((h) => {
              const open = !!openHist[h.date];
              return (
                <Fragment key={h.date}>
                  <tr className="clickable-row" onClick={() => setOpenHist((p) => ({ ...p, [h.date]: !p[h.date] }))}>
                    <td>{open ? "▾" : "▸"}</td>
                    <td className="linkish" onClick={(e) => { e.stopPropagation(); onOpenDay(h.date); }}>{h.date}</td>
                    <td>{label(h.session_title) || "—"}</td>
                    <td>{h.done_sets}</td>
                    <td>{h.max_weight_kg != null ? formatWeight(h.max_weight_kg, unit) : "—"}</td>
                    <td>{formatVolume(h.volume_kg, unit)}</td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={6} style={{ padding: "8px 12px 16px" }}>
                        <MovementSetRows sets={h.sets} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CategoryBody({
  data,
  onOpenMovement,
  onOpenDay,
}: {
  data: DrillResult;
  onOpenMovement: (name: string) => void;
  onOpenDay: (date: string) => void;
}) {
  const { unit } = useWeightUnit();
  const { language, t, label } = useLanguage();
  const s = data.summary!;
  const cat = data.category;
  const volumeUnit = volumeScaleLabel(unit, language);

  return (
    <>
      <InsightList items={data.insights || []} title={t("Body Area Analysis", "部位分析")} />
      {data.monthly && data.monthly.labels.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 16 }}>
          <h3>{label(data.key)} · {t("Monthly Volume", "月度容量")} ({volumeUnit})</h3>
          <Chart
            height={220}
            option={{
              xAxis: { type: "category", data: data.monthly.labels.map((l) => l.slice(2)), ...axisStyle },
              yAxis: { type: "value", ...axisStyle },
              series: [lineSeries(t("Volume", "容量"), data.monthly.volume_tons.map((v) => metricTonsToDisplay(v, unit)), true)],
              tooltip: { trigger: "axis" },
            }}
          />
        </div>
      )}
      {cat && cat.movements.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 16 }}>
          <h3>{t("Movements in This Area", "该部位动作排行")}</h3>
          <Chart
            height={Math.min(320, cat.movements.length * 32 + 40)}
            onEvents={{ click: (p) => { const n = chartClickName(p); if (n) onOpenMovement(data.category?.movements.find((m) => label(m.name) === n)?.name || n); } }}
            option={{
              grid: { left: 100, right: 24, top: 16, bottom: 28 },
              xAxis: { type: "value", ...axisStyle },
              yAxis: { type: "category", data: [...cat.movements].reverse().map((m) => label(m.name)), axisLabel: { width: 90, overflow: "truncate", fontSize: 10, color: "#666666" } },
              series: [{ type: "bar", data: [...cat.movements].reverse().map((m) => kgToDisplay(m.volume_kg, unit)), itemStyle: { color: MATLAB_COLORS[0] } }],
              tooltip: { trigger: "axis" },
            }}
          />
          <table className="data" style={{ marginTop: 12 }}>
            <thead><tr><th>{t("Movement", "动作")}</th><th>{t("Days", "天数")}</th><th>{t("Sets", "组数")}</th><th>{t("Volume", "容量")}</th></tr></thead>
            <tbody>
              {cat.movements.map((m) => (
                <tr key={m.name} className="clickable-row" onClick={() => onOpenMovement(m.name)}>
                  <td>{label(m.name)}</td><td>{m.days}</td><td>{m.sets}</td><td>{formatVolume(m.volume_kg, unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!!data.daily?.length && (
        <div className="chart-card">
          <h3>{t("Training Days for This Area", "含该部位的训练日")}</h3>
          <table className="data">
            <thead><tr><th>{t("Date", "日期")}</th><th>{t("Sessions", "次数")}</th><th>{t("Volume", "容量")}</th></tr></thead>
            <tbody>
              {data.daily.slice(0, 30).map((d) => (
                <tr key={d.date} className="clickable-row" onClick={() => onOpenDay(d.date)}>
                  <td>{d.date}</td><td>{d.sessions}</td><td>{formatVolume(d.volume_kg, unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function PeriodBody({
  data,
  onOpenDay,
  onOpenMovement,
}: {
  data: DrillResult;
  onOpenDay: (date: string) => void;
  onOpenMovement: (name: string) => void;
}) {
  const { unit } = useWeightUnit();
  const { t, label } = useLanguage();
  const s = data.summary!;
  const series = data.series;
  const volumeSeriesName = `${t("Volume", "容量")}(${unit})`;

  return (
    <>
      <div className="stats-grid day-stats">
        <div className="stat-card"><div className="value">{s.sessions}</div><div className="label">{t("Sessions", "训练次数")}</div></div>
        <div className="stat-card"><div className="value">{s.days}</div><div className="label">{t("Training Days", "训练天数")}</div></div>
        <div className="stat-card"><div className="value">{formatVolume(s.volume_kg, unit)}</div><div className="label">{t("Total Volume", "总容量")}</div></div>
        <div className="stat-card"><div className="value">{s.cardio_km || "—"}</div><div className="label">{t("Cardio (km)", "有氧(km)")}</div></div>
      </div>
      <InsightList items={data.insights || []} title={data.type === "month" ? t("Monthly Analysis", "月度分析") : t("Weekly Analysis", "周度分析")} />
      {series && series.dates.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 16 }}>
          <h3>{t("Daily Volume / Sessions", "日容量 / 训练次数")}</h3>
          <Chart
            height={220}
            onEvents={{ click: (p) => { const i = chartClickIndex(p); if (i != null && series.dates[i]) onOpenDay(series.dates[i]); } }}
            option={{
              legend: { data: [volumeSeriesName, t("Sessions", "次数")], textStyle: { color: "#666666", fontSize: 10 } },
              tooltip: { trigger: "axis" },
              grid: { left: 48, right: 48, top: 36, bottom: 48 },
              xAxis: { type: "category", data: series.dates.map((d) => d.slice(5)), ...axisStyle, axisLabel: { rotate: 45, fontSize: 9 } },
              yAxis: [{ type: "value", ...axisStyle }, { type: "value", ...axisStyle }],
              series: [
                { ...lineSeries(volumeSeriesName, (series.volume_kg || []).map((v) => kgToDisplay(v, unit)), true), yAxisIndex: 0 },
                { ...barSeries(t("Sessions", "次数"), series.sessions || []), yAxisIndex: 1 },
              ],
            }}
          />
        </div>
      )}
      {s.top_movements.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 16 }}>
          <h3>{t("Top Movements in This Period", "本段 Top 动作")}</h3>
          <Chart
            height={200}
            onEvents={{ click: (p) => { const n = chartClickName(p); if (n) onOpenMovement(s.top_movements.find((m) => label(m.name) === n)?.name || n); } }}
            option={{
              grid: { left: 100, right: 24, top: 16, bottom: 28 },
              xAxis: { type: "value", ...axisStyle },
              yAxis: { type: "category", data: [...s.top_movements].reverse().map((m) => label(m.name)), axisLabel: { width: 90, overflow: "truncate", fontSize: 10, color: "#666666" } },
              series: [{ type: "bar", data: [...s.top_movements].reverse().map((m) => kgToDisplay(m.volume_kg, unit)), itemStyle: { color: MATLAB_COLORS[0] } }],
              tooltip: { trigger: "axis" },
            }}
          />
        </div>
      )}
    </>
  );
}

function RhythmBody({
  data,
  onOpenDay,
  onOpenMovement,
}: {
  data: DrillResult;
  onOpenDay: (date: string) => void;
  onOpenMovement: (name: string) => void;
}) {
  const { unit } = useWeightUnit();
  const { t, label } = useLanguage();
  const s = data.summary!;

  return (
    <>
      <div className="stats-grid day-stats">
        <div className="stat-card"><div className="value">{s.sessions}</div><div className="label">{t("Sessions", "训练次数")}</div></div>
        <div className="stat-card"><div className="value">{s.days}</div><div className="label">{t("Training Days", "训练天数")}</div></div>
        <div className="stat-card"><div className="value">{Math.round(s.duration_min / Math.max(s.sessions, 1))}</div><div className="label">{t("Avg Duration (min)", "均时(分)")}</div></div>
        <div className="stat-card"><div className="value">{formatVolume(s.volume_kg, unit)}</div><div className="label">{t("Total Volume", "总容量")}</div></div>
      </div>
      <InsightList items={data.insights || []} title={t("Rhythm Analysis", "节奏分析")} />
      {s.top_movements.length > 0 && (
        <div className="chart-card" style={{ marginBottom: 16 }}>
          <h3>{t("Common Movements in This Time Slot", "该时段常练动作")}</h3>
          <table className="data">
            <thead><tr><th>{t("Movement", "动作")}</th><th>{t("Volume", "容量")}</th><th>{t("Days", "天数")}</th></tr></thead>
            <tbody>
              {s.top_movements.map((m) => (
                <tr key={m.name} className="clickable-row" onClick={() => onOpenMovement(m.name)}>
                  <td>{label(m.name)}</td><td>{formatVolume(m.volume_kg, unit)}</td><td>{m.days ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!!data.sessions_preview?.length && (
        <div className="chart-card">
          <h3>{t("Recent Workouts", "最近训练")}</h3>
          {data.sessions_preview.map((sess, i) => (
            <div key={`${sess.datestr}-${i}`} className="session-preview" onClick={() => onOpenDay(sess.datestr)}>
              <div className="session-preview-title"><strong>{sess.datestr}</strong> · {label(sess.title)}</div>
              <div className="caption">{sess.start_time || "—"} · {sess.duration_min} {t("min", "分")} · {sess.movement_names.map(label).join(" · ")}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function DrillPanel({
  initial,
  onClose,
}: {
  initial: DrillQuery;
  onClose: () => void;
}) {
  const { t, label } = useLanguage();
  const [stack, setStack] = useState<DrillQuery[]>([initial]);
  const current = stack[stack.length - 1];
  const [data, setData] = useState<DrillResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { setStack([initial]); }, [initial.type, initial.key]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setData(null);
    fetchDrill(current.type, current.key)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => {
        if (!cancelled) {
          const raw = e instanceof Error ? e.message : "Failed to load";
          const isHtml = raw.includes("<html") || raw.includes("<!DOCTYPE") || raw.includes("404");
          setError(isHtml ? t("No workout details available", "暂无该项训练详情") : raw);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [current.type, current.key]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (stack.length > 1) setStack((s) => s.slice(0, -1));
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, stack.length]);

  const push = useCallback((q: DrillQuery) => setStack((s) => [...s, q]), []);
  const back = () => { if (stack.length > 1) setStack((s) => s.slice(0, -1)); else onClose(); };

  const view = data?.view || data?.type;

  const getHeaderTitle = () => {
    if (!data) return `${current.type}: ${label(current.key)}`;
    const currentView = data.view || data.type || current.type;
    if (currentView === "day") {
      return `${data.key} Workout Details`;
    }
    if (currentView === "month") {
      return `${data.key} Monthly Details`;
    }
    if (currentView === "week") {
      return `${data.key} Weekly Details`;
    }
    if (currentView === "movement") {
      return `Movement Progress: ${label(data.key)}`;
    }
    if (currentView === "category") {
      return `${label(data.key)} Category Analysis`;
    }
    if (currentView === "dow") {
      return `${label(data.key)} Day of Week Analysis`;
    }
    if (currentView === "hour" || currentView === "hour_bucket") {
      return `${label(data.key)} Training Pattern`;
    }
    if (data.title) {
      let tStr = data.title;
      tStr = tStr.replace("训练日详情", "Workout Details");
      tStr = tStr.replace("月度详情", "Monthly Details");
      tStr = tStr.replace("周度详情", "Weekly Details");
      tStr = tStr.replace("周训练详情", "Weekly Details");
      tStr = tStr.replace("动作进步：", "Movement Progress: ");
      tStr = tStr.replace("动作进步:", "Movement Progress: ");
      tStr = tStr.replace("动作：", "Movement: ");
      tStr = tStr.replace("动作:", "Movement: ");
      tStr = tStr.replace("部位：", "Category: ");
      tStr = tStr.replace("部位:", "Category: ");
      tStr = tStr.replace("部位分析", "Category Analysis");
      tStr = tStr.replace("星期分布：", "Day of Week: ");
      tStr = tStr.replace("时段：", "Time: ");
      tStr = tStr.replace("训练特征", "Training Pattern");
      return label(tStr);
    }
    return `${current.type}: ${label(current.key)}`;
  };

  return (
    <div className="day-drawer-backdrop" onClick={onClose}>
      <aside className="day-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="day-drawer-header">
          <div>
            <h2>{getHeaderTitle()}</h2>
            <p>{stack.length > 1 ? t(`Level ${stack.length} · Esc to go back`, `下钻层级 ${stack.length} · Esc 返回上一级`) : t("Esc to close", "Esc 关闭")}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {stack.length > 1 && <button className="btn btn-ghost" type="button" onClick={back}>← {t("Back", "返回")}</button>}
            <button className="btn btn-ghost" type="button" onClick={onClose}>{t("Close", "关闭")}</button>
          </div>
        </header>

        {loading && <div className="day-drawer-status">{t("Loading analysis…", "加载分析中…")}</div>}
        {error && <div className="day-drawer-status error">{error}</div>}

        {data && (
          <div className="day-drawer-body">
            {view === "day" && data.day && (
              <DayBody
                detail={data.day}
                onOpenMovement={(name) => name && push({ type: "movement", key: name })}
                onOpenCategory={(name) => name && push({ type: "category", key: name })}
              />
            )}
            {view === "movement" && data.movement && (
              <MovementBody mv={data.movement} onOpenDay={(date) => push({ type: "day", key: date })} />
            )}
            {view === "category" && data.summary && (
              <CategoryBody
                data={data}
                onOpenMovement={(name) => push({ type: "movement", key: name })}
                onOpenDay={(date) => push({ type: "day", key: date })}
              />
            )}
            {view === "period" && data.summary && (
              <PeriodBody
                data={data}
                onOpenDay={(date) => push({ type: "day", key: date })}
                onOpenMovement={(name) => push({ type: "movement", key: name })}
              />
            )}
            {view === "rhythm" && data.summary && (
              <RhythmBody
                data={data}
                onOpenDay={(date) => push({ type: "day", key: date })}
                onOpenMovement={(name) => push({ type: "movement", key: name })}
              />
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

export function expandMonthKey(shortOrFull: string, labels: string[]): string | null {
  if (/^\d{4}-\d{2}$/.test(shortOrFull)) return shortOrFull;
  return labels.find((l) => l.slice(2) === shortOrFull || l.endsWith(shortOrFull)) || null;
}

export function expandWeekKey(shortOrFull: string, labels: string[]): string | null {
  if (/^\d{4}-W\d{2}$/.test(shortOrFull)) return shortOrFull;
  return labels.find((l) => l.slice(2) === shortOrFull || l.endsWith(shortOrFull)) || null;
}

export function hourFromLabel(label: string): string | null {
  const m = label.match(/(\d{1,2})/);
  return m ? m[1] : null;
}

export type { DrillType };
