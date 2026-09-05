import { useCallback, useState } from "react";
import { Analysis, DrillQuery } from "../api";
import DrillPanel from "../components/DrillPanel";
import { formatVolume, useWeightUnit } from "../units";
import { useLanguage } from "../language";

export default function Calendar({ data }: { data: Analysis }) {
  const { unit } = useWeightUnit();
  const { t } = useLanguage();
  const [drill, setDrill] = useState<DrillQuery | null>(null);

  const openDay = useCallback(
    (datestr: string) => {
      setDrill({ type: "day", key: datestr });
    },
    [],
  );

  return (
    <>
      <h2 className="page-title">{t("Training Calendar", "训练日历")}</h2>
      <p className="page-desc">
        {data.n_days} {t("training days", "个训练日")}
      </p>

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
