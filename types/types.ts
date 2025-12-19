// types/types.ts

export type ChartId = string;
export type InteractionPattern = "EXPLORATION" | "FOCUS" | "COMPARISON";
export type ChartType = "area" | "bar" | "line"; // <--- NEW

export interface DataPoint {
  name: string;
  value: number;
}

export interface ChartSeries {
  id: ChartId;
  title: string;
  data: DataPoint[];
  color: string;
  chartType?: ChartType;
}

export interface InteractionState {
  scores: Record<ChartId, number>;
  pattern: InteractionPattern;
  pendingPattern: InteractionPattern;
  activeCharts: ChartSeries[];
  rankedIds: ChartId[];
  pendingRankedIds: ChartId[];
  hoveredId: ChartId | null;
  hasPendingUpdate: boolean;
}

export interface InteractiveChartData {
  date: string;
  desktop: number;
  mobile: number;
  mw: number;
}
