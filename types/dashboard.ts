// types/dashboard.ts
export type ChartType = "BAR" | "LINE" | "TABLE" | "SCATTER";

export type View = ChartView | TableView;

type ChartView = {
  id: string;
  xColumn: string;
  yColumn: string;
  chartType: "BAR" | "LINE" | "SCATTER";
  size: "sm" | "md" | "lg";
  priority: number;
  xLabel?: string;
  yLabel?: string;
  title: string;
};

type TableView = {
  id: string;
  chartType: "TABLE";
  columns: string[];
  size: "sm" | "md" | "lg";
  priority: number;
  title: string;
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
