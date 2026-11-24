/**
 * Spark225 reporting chart theme.
 * Series palette: #E37439, #0E1E2A, #F5C245, #4E5964, #2E9E5B, #D64545, #9AA3AD
 */
import type { CSSProperties } from "react";

export const SPARK_SERIES = [
  "#E37439",
  "#0E1E2A",
  "#F5C245",
  "#4E5964",
  "#2E9E5B",
  "#D64545",
  "#9AA3AD",
];

export const SPARK_COLORS = {
  primary: "#E37439",
  navy: "#0E1E2A",
  amber: "#F5C245",
  slate: "#4E5964",
  green: "#2E9E5B",
  red: "#D64545",
  gray: "#9AA3AD",
  border: "#DBDBDB",
  muted: "#9AA3AD",
};

export function colorFor(index: number): string {
  return SPARK_SERIES[index % SPARK_SERIES.length];
}

export const tooltipStyle: CSSProperties = {
  borderRadius: "12px",
  border: "1px solid #DBDBDB",
  boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.08)",
  fontSize: "12px",
  fontFamily: "Manrope, sans-serif",
};

export const axisProps = {
  axisLine: false,
  tickLine: false,
  tick: { fontSize: 11, fill: "#4E5964", fontFamily: "Manrope, sans-serif" },
};
