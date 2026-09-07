import { NavLink, Outlet } from "react-router-dom";
import { useWeightUnit } from "../units";
import { useLanguage } from "../language";

export default function Layout({ syncing, onSync }: { syncing: boolean; onSync: () => void }) {
  const { unit, setUnit } = useWeightUnit();
  const { t } = useLanguage();

  const nav = [
    { to: "/", label: t("Overview", "总览"), end: true },
    { to: "/muscle", label: t("Strength", "力量训练"), end: false },
    { to: "/fat-loss", label: t("Cardio", "有氧训练"), end: false },
  ];

  return (
    <div className="layout">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-left">
            <NavLink to="/" className="topbar-brand" title="Overview">
              Workout
            </NavLink>
          </div>

          <div className="topbar-right">
            <nav className="topbar-nav" aria-label="Main Navigation">
              {nav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) => `topbar-nav-link${isActive ? " active" : ""}`}
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>

            <div className="topbar-actions">
              <button
                type="button"
                className={`toolbar-sync${syncing ? " syncing" : ""}`}
                onClick={onSync}
                disabled={syncing}
                title="Sync workout data"
              >
                <svg
                  className="sync-icon-svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3" />
                </svg>
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
          </div>
        </div>
      </header>

      <main className="main">
        <div className="main-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
