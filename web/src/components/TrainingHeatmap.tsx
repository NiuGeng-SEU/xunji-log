import { useMemo, useState } from "react";
import { Analysis } from "../api";
import { formatVolume, useWeightUnit } from "../units";

type HeatmapDay = Analysis["daily"][number];

const EMPTY = "#edf1f5";
const STRENGTH = [0, 83, 155] as const;
const CARDIO = [0, 158, 115] as const;

function utcDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function startOfWeek(value: Date) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() - result.getUTCDay());
  return result;
}

function rgba(color: readonly number[], intensity: number) {
  const alpha = 0.24 + Math.sqrt(intensity) * 0.76;
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha.toFixed(2)})`;
}

function cellBackground(
  day: HeatmapDay | undefined,
  maxVolume: number,
  maxCardio: number,
  showStrength: boolean,
  showCardio: boolean,
) {
  if (!day) return EMPTY;
  const hasStrength = showStrength && day.volume_kg > 0;
  const hasCardio = showCardio && day.cardio_km > 0;
  const blue = rgba(STRENGTH, day.volume_kg / maxVolume);
  const green = rgba(CARDIO, day.cardio_km / maxCardio);

  if (hasStrength && hasCardio) {
    return `linear-gradient(135deg, ${blue} 0 49%, #ffffff 49% 51%, ${green} 51% 100%)`;
  }
  if (hasStrength) return blue;
  if (hasCardio) return green;
  return EMPTY;
}

export default function TrainingHeatmap({
  data,
  onOpenDay,
}: {
  data: Analysis;
  onOpenDay: (date: string) => void;
}) {
  const { unit } = useWeightUnit();
  const years = useMemo(() => {
    const first = Number(data.date_start.slice(0, 4));
    const last = Number(data.date_end.slice(0, 4));
    return Array.from({ length: last - first + 1 }, (_, index) => last - index);
  }, [data.date_end, data.date_start]);
  const [year, setYear] = useState(years[0]);
  const [showStrength, setShowStrength] = useState(true);
  const [showCardio, setShowCardio] = useState(true);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const { weeks, maxVolume, maxCardio } = useMemo(() => {
    const yearDays = data.daily.filter((day) => day.date.startsWith(`${year}-`));
    const days = new Map(yearDays.map((day) => [day.date, day]));
    const firstDay = `${year}-01-01`;
    const lastDay = `${year}-12-31`;
    const first = startOfWeek(utcDate(firstDay));
    const last = utcDate(lastDay);
    const result: Array<Array<{ date: string; day?: HeatmapDay; inYear: boolean }>> = [];

    for (const weekStart = new Date(first); weekStart <= last; weekStart.setUTCDate(weekStart.getUTCDate() + 7)) {
      result.push(Array.from({ length: 7 }, (_, index) => {
        const date = new Date(weekStart);
        date.setUTCDate(date.getUTCDate() + index);
        const key = dateKey(date);
        const inYear = key >= firstDay && key <= lastDay;
        return { date: key, day: inYear ? days.get(key) : undefined, inYear };
      }));
    }

    return {
      weeks: result,
      maxVolume: Math.max(...yearDays.map((day) => day.volume_kg), 1),
      maxCardio: Math.max(...yearDays.map((day) => day.cardio_km), 1),
    };
  }, [data.daily, year]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, month) => {
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
    const start = weeks.findIndex((week) => week.some(({ date }) => date.startsWith(prefix)));
    const nextPrefix = `${year}-${String(month + 2).padStart(2, "0")}-`;
    const next = month === 11
      ? weeks.length
      : weeks.findIndex((week) => week.some(({ date }) => date.startsWith(nextPrefix)));
    return {
      label: new Date(Date.UTC(year, month, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
      start,
      span: Math.max((next < 0 ? weeks.length : next) - start, 1),
    };
  }), [weeks, year]);

  return (
    <section className="chart-card full overview-heatmap">
      <div className="heatmap-layout">
        <div className="heatmap-main">
          <div className="heatmap-heading">
            <h3>Training Heatmap</h3>
            <div className="heatmap-legend" aria-label="Training data filters">
              <button
                type="button"
                className={showStrength ? "active" : ""}
                aria-pressed={showStrength}
                onClick={() => {
                  setShowStrength((visible) => !visible);
                  setTooltip(null);
                }}
              >
                <i className="heatmap-swatch strength" />Strength
              </button>
              <button
                type="button"
                className={showCardio ? "active" : ""}
                aria-pressed={showCardio}
                onClick={() => {
                  setShowCardio((visible) => !visible);
                  setTooltip(null);
                }}
              >
                <i className="heatmap-swatch cardio" />Cardio
              </button>
            </div>
          </div>

          <div className="heatmap-frame">
            <div className="heatmap-scroll">
              <div className="heatmap-content">
                <div className="heatmap-months" style={{ gridTemplateColumns: `repeat(${weeks.length}, var(--heatmap-cell-size))` }}>
                  {months.map((month) => (
                    <span
                      key={month.label}
                      style={{ gridColumn: `${month.start + 1} / span ${month.span}` }}
                    >
                      {month.label}
                    </span>
                  ))}
                </div>
                <div className="heatmap-body">
                  <div className="heatmap-weekdays" aria-hidden="true"><span /><span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span /></div>
                  <div className="heatmap-grid" style={{ gridTemplateColumns: `repeat(${weeks.length}, var(--heatmap-cell-size))` }}>
                    {weeks.flatMap((week) => week.map(({ date, day, inYear }) => {
                      const visible = Boolean(day && (
                        (showStrength && day.volume_kg > 0) ||
                        (showCardio && day.cardio_km > 0)
                      ));
                      const details = day
                        ? [
                            date,
                            showStrength && day.volume_kg > 0 ? `Strength: ${formatVolume(day.volume_kg, unit)}` : "",
                            showCardio && day.cardio_km > 0 ? `Cardio: ${day.cardio_km} km` : "",
                          ].filter(Boolean).join(" · ")
                        : date;
                      return (
                        <button
                          key={date}
                          type="button"
                          className={`heatmap-cell${visible ? " trained" : ""}${inYear ? "" : " outside-year"}`}
                          style={{ background: cellBackground(day, maxVolume, maxCardio, showStrength, showCardio) }}
                          aria-label={details}
                          disabled={!visible}
                          onMouseEnter={(event) => visible && setTooltip({
                            text: details,
                            x: Math.min(event.clientX + 12, window.innerWidth - 280),
                            y: event.clientY + 14,
                          })}
                          onMouseMove={(event) => visible && setTooltip({
                            text: details,
                            x: Math.min(event.clientX + 12, window.innerWidth - 280),
                            y: event.clientY + 14,
                          })}
                          onMouseLeave={() => setTooltip(null)}
                          onFocus={(event) => {
                            if (!visible) return;
                            const rect = event.currentTarget.getBoundingClientRect();
                            setTooltip({ text: details, x: rect.left, y: rect.bottom + 7 });
                          }}
                          onBlur={() => setTooltip(null)}
                          onClick={() => visible && onOpenDay(date)}
                        />
                      );
                    }))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <nav className="heatmap-years" aria-label="Heatmap year">
          {years.map((choice) => (
            <button
              key={choice}
              type="button"
              className={choice === year ? "active" : ""}
              aria-current={choice === year ? "true" : undefined}
              onClick={() => {
                setYear(choice);
                setTooltip(null);
              }}
            >
              {choice}
            </button>
          ))}
        </nav>
      </div>
      {tooltip && (
        <div
          className="heatmap-tooltip"
          role="tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </section>
  );
}
