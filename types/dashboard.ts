// types/dashboard.ts
export type ChartType = "BAR" | "LINE" | "TABLE" | "SCATTER";

export type View = ChartView | TableView;

type ChartPayload = {
  chartType: "BAR" | "LINE" | "SCATTER";
} & Partial<Omit<ChartView, "chartType">>;

type TablePayload = {
  chartType: "TABLE";
} & Partial<Omit<TableView, "chartType">>;

export type ChartView = {
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

export type TableView = {
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
  targetViewId: string;
  type:
    | "REORDER"
    | "RESIZE"
    | "NEW_CONTENT"
    | "MODIFY_CONTENT"
    | "REMOVE_CONTENT";
  payload: ChartPayload | TablePayload;
  reason: string;
};
