import { NavLink, Outlet } from "react-router-dom";
import { useWeightUnit } from "../units";
import { useLanguage } from "../language";

export default function Layout({ syncing, onSync }: { syncing: boolean; onSync: () => void }) {
  const { unit, setUnit } = useWeightUnit();
  const { t } = useLanguage();
  const nav = [
    { to: "/", label: t("Overview", "总览"), end: true },
    { to: "/fat-loss", label: t("Cardio", "减脂分析") },
    { to: "/muscle", label: t("Strength", "增肌训练") },
    { to: "/rhythm", label: t("Training Rhythm", "训练节奏") },
    { to: "/movements", label: t("Progress", "动作进步") },
    { to: "/calendar", label: t("Calendar", "训练日历") },
  ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>Workout</h1>
        <nav>
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main">
        <div className="main-inner">
          <div className="unit-bar">
            <button
              type="button"
              className={`toolbar-sync${syncing ? " syncing" : ""}`}
              onClick={onSync}
              disabled={syncing}
            >
              <span aria-hidden="true">↻</span>
              {syncing ? t("Syncing", "同步中") : t("Sync", "同步")}
            </button>
            <button
              type="button"
              className={`unit-switch is-${unit}`}
              aria-label={`Current weight unit is ${unit.toUpperCase()}. Click to switch`}
              title={`Switch to ${unit === "lb" ? "KG" : "LB"}`}
              onClick={() => setUnit(unit === "lb" ? "kg" : "lb")}
            >
              <span className="unit-switch-thumb" aria-hidden="true" />
              <span className={unit === "lb" ? "active" : ""}>LB</span>
              <span className={unit === "kg" ? "active" : ""}>KG</span>
            </button>
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
