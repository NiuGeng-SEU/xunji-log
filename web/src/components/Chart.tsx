import ReactECharts from "echarts-for-react";

// MATLAB classic/default axes ColorOrder (R2014b–R2024b).
export const MATLAB_COLORS = [
  "#0072BD",
  "#D95319",
  "#EDB120",
  "#7E2F8E",
  "#77AC30",
  "#4DBEEE",
  "#A2142F",
] as const;

type Props = {
  option: object;
  height?: number;
  className?: string;
  onEvents?: Record<string, (params: unknown) => void>;
};

export default function Chart({ option, height = 280, className, onEvents }: Props) {
  return (
    <ReactECharts
      className={className}
      option={{
        color: MATLAB_COLORS,
        backgroundColor: "transparent",
        textStyle: { color: "#666666", fontSize: 11 },
        grid: { left: 48, right: 16, top: 32, bottom: 36 },
        ...option,
      }}
      style={{ height }}
      opts={{ renderer: "canvas" }}
      onEvents={onEvents}
    />
  );
}

export function lineSeries(name: string, data: number[], area = false) {
  return {
    name,
    type: "line",
    smooth: true,
    symbol: "circle",
    symbolSize: 5,
    data,
    ...(area ? { areaStyle: { opacity: 0.15 } } : {}),
  };
}

export function barSeries(name: string, data: number[]) {
  return { name, type: "bar", data, barMaxWidth: 28 };
}

export const axisStyle = {
  axisLine: { lineStyle: { color: "#e2e6ed" } },
  axisLabel: { color: "#666666", fontSize: 10 },
  splitLine: { lineStyle: { color: "#e2e6ed", type: "dashed" as const } },
};
