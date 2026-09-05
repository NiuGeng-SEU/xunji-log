import { NavLink, Outlet } from "react-router-dom";
import { useWeightUnit } from "../units";
import { useLanguage } from "../language";

export default function Layout() {
  const { unit, setUnit } = useWeightUnit();
  const { language, setLanguage, t } = useLanguage();
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
        <p className="sub">{t("Cardio · Strength · Analytics", "有氧 · 力量 · 数据分析")}</p>
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
        <div className="unit-bar">
          <span>{t("Language", "语言")}</span>
          <button
            type="button"
            className={`unit-switch is-${language === "en" ? "lb" : "kg"}`}
            aria-label={t("Current language is English. Click to switch to Chinese", "当前语言为中文，点击切换为英文")}
            title={t("Switch to Chinese", "切换为英文")}
            onClick={() => setLanguage(language === "en" ? "zh" : "en")}
          >
            <span className="unit-switch-thumb" aria-hidden="true" />
            <span className={language === "en" ? "active" : ""}>EN</span>
            <span className={language === "zh" ? "active" : ""}>中</span>
          </button>
          <span>{t("Weight", "重量单位")}</span>
          <button
            type="button"
            className={`unit-switch is-${unit}`}
            aria-label={t(`Current weight unit is ${unit.toUpperCase()}. Click to switch`, `当前重量单位为 ${unit.toUpperCase()}，点击切换`)}
            title={t(`Switch to ${unit === "lb" ? "KG" : "LB"}`, `切换为 ${unit === "lb" ? "KG" : "LB"}`)}
            onClick={() => setUnit(unit === "lb" ? "kg" : "lb")}
          >
            <span className="unit-switch-thumb" aria-hidden="true" />
            <span className={unit === "lb" ? "active" : ""}>LB</span>
            <span className={unit === "kg" ? "active" : ""}>KG</span>
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
