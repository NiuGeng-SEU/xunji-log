import { NavLink, Outlet } from "react-router-dom";
import { useWeightUnit } from "../units";
import { useLanguage } from "../language";

export default function Layout() {
  const { unit, setUnit } = useWeightUnit();
  const { t } = useLanguage();

  const nav = [
    { to: "/", label: t("Overview", "总览"), end: true },
    { to: "/strength", label: t("Strength", "力量训练"), end: false },
    { to: "/cardio", label: t("Cardio", "有氧训练"), end: false },
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
