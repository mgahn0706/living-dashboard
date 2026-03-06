// types/dashboard.ts
export type ChartType =
  | "BAR"
  | "LINE"
  | "TABLE"
  | "SCATTER"
  | "PIE"
  | "KPI"
  | "FUNNEL"
  | "HORIZONTAL_BAR"
  | "STACKED_BAR"
  | "GROUPED_BAR"
  | "DONUT"
  | "MAP";

export type View = ChartView | TableView;

export type ViewFilter = {
  top?: number;
  includeXValues?: Array<string | number>;
  includeColumns?: string[];
  includeByColumn?: Array<{
    column: string;
    includeValues: Array<string | number | boolean>;
  }>;
};

type ChartPayload = {
  chartType: Exclude<ChartType, "TABLE">;
} & Partial<Omit<ChartView, "chartType">> & {
    filter?: ViewFilter | null;
  };

type TablePayload = {
  chartType: "TABLE";
} & Partial<Omit<TableView, "chartType">> & {
    filter?: ViewFilter | null;
  };

export type ChartView = {
  id: string;
  xColumn: string;
  yColumn: string;
  chartType: Exclude<ChartType, "TABLE">;
  size: "sm" | "md" | "lg" | "xl";
  priority: number;
  xLabel?: string;
  yLabel?: string;
  title: string;
  filter?: ViewFilter;
  groupByColumn?: string;
  aggregation?: "sum" | "avg" | "count";
  colorByColumn?: string;
  sortDescending?: boolean;
};

export type TableView = {
  id: string;
  chartType: "TABLE";
  columns: string[];
  size: "sm" | "md" | "lg" | "xl";
  priority: number;
  title: string;
  filter?: ViewFilter;
};

export type Recommendation = {
  id: string;
  title: string;
  targetViewId?: string;
  type:
    | "REORDER"
    | "RESIZE"
    | "NEW_CONTENT"
    | "MODIFY_CONTENT"
    | "MODIFY_FILTER"
    | "REMOVE_CONTENT";
  payload: ChartPayload | TablePayload;
  reason: string;
};
