// types/dashboard.ts
export type ChartType = "bar" | "line" | "table";

export type View = {
  id: string;
  x: string;
  y: string;
  chartType: ChartType;
  size: "sm" | "md" | "lg";
  priority: number;
};

export type Recommendation = {
  id: string;
  title: string;
  type: "REORDER" | "RESIZE" | "NEW_CONTENT";
  payload: Partial<View>;
  reason: string;
};
