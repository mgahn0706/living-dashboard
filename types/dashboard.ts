// types/dashboard.ts
export type ChartType = "BAR" | "LINE" | "TABLE";

export type View = {
  id: string;
  x: number[];
  y: number[];
  chartType: ChartType;
  size: "sm" | "md" | "lg";
  priority: number;
  xLabel?: string;
  yLabel?: string;
  title?: string;
};

export type Recommendation = {
  id: string;
  title: string;
  type:
    | "REORDER"
    | "RESIZE"
    | "NEW_CONTENT"
    | "MODIFY_CONTENT"
    | "REMOVE_CONTENT";
  payload: Partial<View>;
  reason: string;
};
