import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type WeightUnit = "lb" | "kg";

export const KG_PER_LB = 0.45359237;
export const LB_PER_KG = 1 / KG_PER_LB;

type UnitContextValue = {
  unit: WeightUnit;
  setUnit: (unit: WeightUnit) => void;
};

const UnitContext = createContext<UnitContextValue | null>(null);

function initialUnit(): WeightUnit {
  const saved = window.localStorage.getItem("xunji-weight-unit");
  return saved === "kg" ? "kg" : "lb";
}

export function UnitProvider({ children }: { children: ReactNode }) {
  const [unit, setUnit] = useState<WeightUnit>(initialUnit);

  useEffect(() => {
    window.localStorage.setItem("xunji-weight-unit", unit);
  }, [unit]);

  const value = useMemo(() => ({ unit, setUnit }), [unit]);
  return <UnitContext.Provider value={value}>{children}</UnitContext.Provider>;
}

export function useWeightUnit() {
  const context = useContext(UnitContext);
  if (!context) throw new Error("useWeightUnit must be used inside UnitProvider");
  return context;
}

export function kgToDisplay(valueKg: number, unit: WeightUnit) {
  return unit === "lb" ? valueKg * LB_PER_KG : valueKg;
}

export function metricTonsToDisplay(valueTons: number, unit: WeightUnit) {
  return unit === "lb" ? valueTons * LB_PER_KG : valueTons;
}

export function volumeScaleLabel(unit: WeightUnit, language: "en" | "zh" = "en") {
  if (language === "en") return unit === "lb" ? "k lb" : "t";
  return unit === "lb" ? "千磅" : "吨";
}

export function formatWeight(valueKg: number, unit: WeightUnit) {
  const value = kgToDisplay(valueKg, unit);
  const nearestWhole = Math.round(value);
  const displayValue = unit === "lb" && Math.abs(value - nearestWhole) <= 0.12
    ? nearestWhole
    : value;
  return `${displayValue.toLocaleString("zh-CN", { maximumFractionDigits: 1 })} ${unit}`;
}

export function formatVolume(valueKg: number, unit: WeightUnit) {
  const value = kgToDisplay(valueKg, unit);
  if (unit === "kg" && value >= 1000) return `${(value / 1000).toFixed(1)} t`;
  if (unit === "lb" && value >= 1000) return `${(value / 1000).toFixed(1)}k lb`;
  return `${Math.round(value).toLocaleString("zh-CN")} ${unit}`;
}

export function formatScaledVolume(valueMetricTons: number, unit: WeightUnit, language: "en" | "zh" = "en") {
  const value = metricTonsToDisplay(valueMetricTons, unit);
  return `${value.toLocaleString(language === "en" ? "en-US" : "zh-CN", { maximumFractionDigits: 1 })} ${volumeScaleLabel(unit, language)}`;
}

export function convertInsightUnits(text: string, unit: WeightUnit) {
  if (unit === "kg") return text;

  return text
    .replace(/([\d,]+(?:\.\d+)?)\s*吨/g, (_, raw: string) => {
      const value = Number(raw.replaceAll(",", "")) * LB_PER_KG;
      return `${value.toLocaleString("zh-CN", { maximumFractionDigits: 1 })} 千磅`;
    })
    .replace(/([\d,]+(?:\.\d+)?)\s*kg/g, (_, raw: string) => {
      const value = Number(raw.replaceAll(",", "")) * LB_PER_KG;
      return `${value.toLocaleString("zh-CN", { maximumFractionDigits: 1 })} lb`;
    });
}
