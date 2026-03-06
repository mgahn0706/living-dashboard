"use client";

import * as React from "react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Table as ShadTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  CartesianGrid,
  XAxis,
  YAxis,
  ScatterChart,
  Scatter,
  Cell,
  FunnelChart,
  Funnel,
  LabelList,
  Legend,
  Tooltip,
} from "recharts";

import type { ChartView, View, ViewFilter } from "@/types/dashboard";
import MapRenderer from "./MapRenderer";
import { useDataset } from "@/context/DatasetContext";
import { useSelection, type RangeFilter, type LassoFilter } from "@/context/SelectionContext";
import { useTimeFilter } from "@/context/TimeFilterContext";
import { formatCompactNumber } from "@/lib/utils";

/* =======================================================
   Types
======================================================= */

type GenericPoint = {
  x: number | string;
  y: number;
  highlighted: boolean;
  xRaw: any;
  xType: "number" | "date" | "category";
};

export type ChartRendererFilter = ViewFilter;

/* =======================================================
   Utils
======================================================= */

function getValueByPath(row: any, path: string) {
  return path.split(".").reduce((acc, key) => {
    if (acc == null) return undefined;
    if (typeof acc !== "object") return undefined;

    if (key in acc) return acc[key];

    // Tolerate minor key mismatches from LLM (case/whitespace differences).
    const desired = key.trim().toLowerCase();
    const matchedKey = Object.keys(acc).find(
      (k) => k.trim().toLowerCase() === desired
    );
    return matchedKey ? acc[matchedKey] : undefined;
  }, row);
}

function detectAndParse(value: any) {
  if (value == null) return null;

  const n = Number(value);
  if (!Number.isNaN(n) && value !== "") return n;

  if (typeof value === "string") {
    const d = Date.parse(value);
    if (!Number.isNaN(d)) return new Date(d);
  }

  return value;
}

function parseXValue(
  value: any,
  hint?: "string" | "number" | "date" | "category" | "unknown"
): {
  x: number | string | null;
  xRaw: any;
  xType: "number" | "date" | "category";
} {
  if (value == null) {
    return { x: null, xRaw: value, xType: "category" };
  }

  if (value instanceof Date) {
    return { x: value.getTime(), xRaw: value, xType: "date" };
  }

  const n = Number(value);
  if (!Number.isNaN(n) && value !== "") {
    if (hint === "date") {
      const ms =
        Math.abs(n) < 3e10
          ? n * 1000
          : n;
      return { x: ms, xRaw: value, xType: "date" };
    }

    return { x: n, xRaw: value, xType: "number" };
  }

  if (typeof value === "string") {
    if (hint === "date") {
      const d = Date.parse(value);
      if (!Number.isNaN(d)) {
        return { x: d, xRaw: value, xType: "date" };
      }
    }

    const d = Date.parse(value);
    if (!Number.isNaN(d)) {
      return { x: d, xRaw: value, xType: "date" };
    }
  }

  return { x: value, xRaw: value, xType: "category" };
}

function inferXTypeFromColumn(
  values: any[],
  hint?: "string" | "number" | "date" | "category" | "unknown"
): "number" | "date" | "category" {
  if (hint === "date") return "date";

  const filtered = values.filter((v) => v !== null && v !== undefined && v !== "");
  if (filtered.length === 0) return "category";

  let numberCount = 0;
  let dateStringCount = 0;

  for (const v of filtered) {
    if (v instanceof Date) {
      dateStringCount++;
      continue;
    }
    if (typeof v === "string") {
      const d = Date.parse(v);
      if (!Number.isNaN(d)) {
        dateStringCount++;
        continue;
      }
    }
    const n = Number(v);
    if (!Number.isNaN(n) && v !== "") {
      numberCount++;
    }
  }

  const ratio = filtered.length * 0.6;
  if (dateStringCount >= ratio) return "date";

  if (numberCount >= ratio) {
    return "number";
  }

  return "category";
}

function formatDateTick(value: number | string) {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, {
    year: "2-digit",
    month: "short",
    day: "numeric",
  });
}

/** Ray-casting point-in-polygon test */
function pointInPolygon(
  px: number,
  py: number,
  polygon: Array<{ x: number; y: number }>
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function rowMatchesSelection(
  row: any,
  selection: any,
  rangeFilter?: RangeFilter | null,
  lassoFilter?: LassoFilter | null
) {
  const hasDiscrete = selection && Object.keys(selection).length > 0;
  const hasRange = !!rangeFilter;
  const hasLasso = !!lassoFilter;

  if (!hasDiscrete && !hasRange && !hasLasso) return true;

  // Check discrete selection
  if (hasDiscrete) {
    const discreteMatch = Object.entries(selection).every(([col, values]: any) => {
      if (!values || values.size === 0) return true;
      const val = getValueByPath(row, col);
      return values.has(val);
    });
    if (!discreteMatch) return false;
  }

  // Check range filter
  if (hasRange) {
    const xVal = Number(getValueByPath(row, rangeFilter.xColumn));
    const yVal = Number(getValueByPath(row, rangeFilter.yColumn));
    if (Number.isNaN(xVal) || Number.isNaN(yVal)) return false;
    if (
      xVal < rangeFilter.xMin ||
      xVal > rangeFilter.xMax ||
      yVal < rangeFilter.yMin ||
      yVal > rangeFilter.yMax
    ) {
      return false;
    }
  }

  // Check lasso filter
  if (hasLasso) {
    const xVal = Number(getValueByPath(row, lassoFilter.xColumn));
    const yVal = Number(getValueByPath(row, lassoFilter.yColumn));
    if (Number.isNaN(xVal) || Number.isNaN(yVal)) return false;
    if (!pointInPolygon(xVal, yVal, lassoFilter.polygon)) return false;
  }

  return true;
}

function valueMatches(target: any, candidate: any) {
  if (target === candidate) return true;
  if (target instanceof Date && candidate instanceof Date) {
    return target.getTime() === candidate.getTime();
  }
  if (typeof target === "string" || typeof candidate === "string") {
    const t = String(target ?? "")
      .trim()
      .toLowerCase();
    const c = String(candidate ?? "")
      .trim()
      .toLowerCase();
    if (t === c) return true;
  }

  const targetNum = Number(target);
  const candidateNum = Number(candidate);
  if (!Number.isNaN(targetNum) && !Number.isNaN(candidateNum)) {
    return targetNum === candidateNum;
  }

  if (typeof target === "boolean" || typeof candidate === "boolean") {
    const t = String(target).trim().toLowerCase();
    const c = String(candidate).trim().toLowerCase();
    return t === c;
  }

  return false;
}

function rowMatchesAttributeFilter(
  row: any,
  filters?: Array<{
    column: string;
    includeValues: Array<string | number | boolean>;
  }>
) {
  if (!Array.isArray(filters) || filters.length === 0) return true;

  return filters.every((f) => {
    if (!f?.column || !Array.isArray(f.includeValues) || f.includeValues.length === 0) {
      return true;
    }
    const rowValue = getValueByPath(row, f.column);
    return f.includeValues.some((v) => valueMatches(rowValue, v));
  });
}

function applyChartViewFilter(
  data: GenericPoint[],
  filter?: ChartRendererFilter
) {
  if (!filter) return data;

  let filtered = data;

  if (Array.isArray(filter.includeXValues) && filter.includeXValues.length > 0) {
    filtered = filtered.filter((point) =>
      filter.includeXValues!.some(
        (candidate) =>
          valueMatches(point.xRaw, candidate) || valueMatches(point.x, candidate)
      )
    );
  }

  if (typeof filter.top === "number" && filter.top > 0) {
    const topRefs = new Set(
      [...filtered]
        .sort((a, b) => b.y - a.y)
        .slice(0, filter.top)
    );
    filtered = filtered.filter((point) => topRefs.has(point));
  }

  return filtered;
}

function applyTableViewFilter(
  rows: any[],
  view: Extract<View, { chartType: "TABLE" }>,
  filter?: ChartRendererFilter
) {
  let filteredRows = rows;
  let columns = view.columns;

  filteredRows = filteredRows.filter((row) =>
    rowMatchesAttributeFilter(row, filter?.includeByColumn)
  );

  if (Array.isArray(filter?.includeColumns) && filter.includeColumns.length > 0) {
    const valid = new Set(view.columns);
    const selectedColumns = filter.includeColumns.filter((col) => valid.has(col));
    if (selectedColumns.length > 0) {
      columns = selectedColumns;
    }
  }

  if (Array.isArray(filter?.includeXValues) && filter.includeXValues.length > 0) {
    const keyColumn = columns[0];
    if (keyColumn) {
      filteredRows = filteredRows.filter((row) =>
        filter.includeXValues!.some((candidate) =>
          valueMatches(getValueByPath(row, keyColumn), candidate)
        )
      );
    }
  }

  if (typeof filter?.top === "number" && filter.top > 0) {
    filteredRows = filteredRows.slice(0, filter.top);
  }

  return { rows: filteredRows, columns };
}

/* ---- Aggregation-aware single-series builder ---- */

const AGGREGATING_TYPES = new Set([
  "LINE", "BAR", "PIE", "HORIZONTAL_BAR", "FUNNEL", "KPI", "DONUT",
]);

function buildSeries(
  rawData: any[],
  view: ChartView,
  selection: any,
  attributeTypes: Record<string, "string" | "number" | "date" | "unknown">,
  filter?: ChartRendererFilter,
  rangeFilter?: RangeFilter | null,
  lassoFilter?: LassoFilter | null
): { data: GenericPoint[]; xType: "number" | "date" | "category" } {
  if (!Array.isArray(rawData)) {
    return { data: [], xType: "category" };
  }

  const filteredRawData = rawData.filter((row) =>
    rowMatchesAttributeFilter(row, filter?.includeByColumn)
  );

  const xTypeHint = attributeTypes?.[view.xColumn];
  const inferredXType = inferXTypeFromColumn(
    filteredRawData.map((row) => getValueByPath(row, view.xColumn)),
    xTypeHint
  );

  const mapped = filteredRawData
    .map((row) => {
      const xRaw = getValueByPath(row, view.xColumn);
      const yRaw = getValueByPath(row, view.yColumn);

      const xParsed = parseXValue(xRaw, inferredXType);
      const yParsed = detectAndParse(yRaw);

      if (view.chartType === "SCATTER") {
        if (xParsed.xType !== "number" || typeof yParsed !== "number")
          return null;
      }

      if (typeof yParsed !== "number" && view.chartType !== "SCATTER") {
        return null;
      }

      return {
        x: xParsed.x as number | string,
        y: typeof yParsed === "number" ? yParsed : 0,
        highlighted: rowMatchesSelection(row, selection, rangeFilter, lassoFilter),
        xRaw: xParsed.xRaw,
        xType: xParsed.xType,
      };
    })
    .filter(Boolean) as GenericPoint[];

  const xType = inferredXType;
  const agg = view.aggregation || "sum";

  if (AGGREGATING_TYPES.has(view.chartType)) {
    const grouped = new Map<
      any,
      GenericPoint & { _sum: number; _count: number }
    >();

    for (const point of mapped) {
      if (!grouped.has(point.x)) {
        grouped.set(point.x, { ...point, _sum: point.y, _count: 1 });
      } else {
        const existing = grouped.get(point.x)!;
        existing._sum += point.y;
        existing._count += 1;
        existing.highlighted = existing.highlighted || point.highlighted;
      }
    }

    const aggregated: GenericPoint[] = Array.from(grouped.values()).map(
      (g) => {
        let y: number;
        if (agg === "avg") y = g._count > 0 ? g._sum / g._count : 0;
        else if (agg === "count") y = g._count;
        else y = g._sum;
        return {
          x: g.x,
          y,
          highlighted: g.highlighted,
          xRaw: g.xRaw,
          xType: g.xType,
        };
      }
    );

    if (xType === "date" || xType === "number") {
      aggregated.sort((a, b) => Number(a.x) - Number(b.x));
    }

    if (view.sortDescending) {
      aggregated.sort((a, b) => b.y - a.y);
    }

    return { data: aggregated, xType };
  }

  return { data: mapped, xType };
}

/* ---- Grouped series builder for STACKED_BAR / GROUPED_BAR ---- */

type GroupedSeriesResult = {
  rows: Array<Record<string, any>>;
  groups: string[];
  xLabels: string[];
};

function buildGroupedSeries(
  rawData: any[],
  view: ChartView,
  attributeTypes: Record<string, "string" | "number" | "date" | "unknown">,
  filter?: ChartRendererFilter,
  selection?: any,
  rangeFilter?: RangeFilter | null,
  lassoFilter?: LassoFilter | null
): GroupedSeriesResult & { highlightedXValues: Set<string> } {
  if (!Array.isArray(rawData) || !view.groupByColumn) {
    return { rows: [], groups: [], xLabels: [], highlightedXValues: new Set() };
  }

  const filtered = rawData.filter((row) =>
    rowMatchesAttributeFilter(row, filter?.includeByColumn)
  );

  const groupCol = view.groupByColumn;
  const agg = view.aggregation || "sum";

  // Collect unique groups
  const groupSet = new Set<string>();
  filtered.forEach((row) => {
    const g = getValueByPath(row, groupCol);
    if (g != null && g !== "") groupSet.add(String(g));
  });
  const groups = Array.from(groupSet).sort();

  // Track which x values have at least one highlighted row
  const highlightedXValues = new Set<string>();

  // Build grouped map: Map<xKey, Map<groupKey, { sum, count }>>
  const grouped = new Map<
    string,
    Map<string, { sum: number; count: number }>
  >();

  filtered.forEach((row) => {
    const xRaw = getValueByPath(row, view.xColumn);
    const yRaw = getValueByPath(row, view.yColumn);
    const gRaw = getValueByPath(row, groupCol);

    if (xRaw == null || gRaw == null) return;

    const xKey = String(xRaw);
    const gKey = String(gRaw);
    const yVal =
      agg === "count" ? 1 : Number(typeof yRaw === "number" ? yRaw : yRaw);
    if (Number.isNaN(yVal) && agg !== "count") return;

    // Track highlighting
    if (rowMatchesSelection(row, selection, rangeFilter, lassoFilter)) {
      highlightedXValues.add(xKey);
    }

    if (!grouped.has(xKey)) grouped.set(xKey, new Map());
    const xMap = grouped.get(xKey)!;
    if (!xMap.has(gKey)) xMap.set(gKey, { sum: 0, count: 0 });
    const entry = xMap.get(gKey)!;
    entry.sum += agg === "count" ? 1 : yVal;
    entry.count += 1;
  });

  const xLabels = Array.from(grouped.keys());
  const rows = xLabels.map((xKey) => {
    const gMap = grouped.get(xKey)!;
    const row: Record<string, any> = { x: xKey };
    groups.forEach((g) => {
      const entry = gMap.get(g);
      if (!entry) {
        row[g] = 0;
      } else if (agg === "avg") {
        row[g] = entry.count > 0 ? entry.sum / entry.count : 0;
      } else if (agg === "count") {
        row[g] = entry.count;
      } else {
        row[g] = entry.sum;
      }
    });
    return row;
  });

  return { rows, groups, xLabels, highlightedXValues };
}

/* ---- KPI value computation ---- */

function computeKPIValue(
  rawData: any[],
  view: ChartView,
  filter?: ChartRendererFilter,
  selection?: any,
  rangeFilter?: RangeFilter | null,
  lassoFilter?: LassoFilter | null
): { total: number; filtered: number; hasFilter: boolean } {
  if (!Array.isArray(rawData)) return { total: 0, filtered: 0, hasFilter: false };

  let data = rawData;
  if (filter?.includeByColumn) {
    data = data.filter((row) =>
      rowMatchesAttributeFilter(row, filter.includeByColumn)
    );
  }

  const agg = view.aggregation || "sum";

  const computeAgg = (rows: any[]) => {
    if (agg === "count") return rows.length;
    const values = rows
      .map((row) => {
        const val = getValueByPath(row, view.yColumn);
        return typeof val === "number" ? val : Number(val);
      })
      .filter((v) => !Number.isNaN(v));
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    if (agg === "avg") return sum / values.length;
    return sum;
  };

  const total = computeAgg(data);

  const hasDiscrete = selection && Object.keys(selection).length > 0;
  const hasRange = !!rangeFilter;
  const hasLasso = !!lassoFilter;
  const hasFilter = hasDiscrete || hasRange || hasLasso;

  if (!hasFilter) {
    return { total, filtered: total, hasFilter: false };
  }

  const selectedData = data.filter((row) =>
    rowMatchesSelection(row, selection, rangeFilter, lassoFilter)
  );
  const filtered = computeAgg(selectedData);

  return { total, filtered, hasFilter };
}

/* ---- Scatter with color-by column ---- */

type ColoredPoint = GenericPoint & { group: string };

function buildColoredScatterSeries(
  rawData: any[],
  view: ChartView,
  selection: any,
  attributeTypes: Record<string, "string" | "number" | "date" | "unknown">,
  filter?: ChartRendererFilter,
  rangeFilter?: RangeFilter | null,
  lassoFilter?: LassoFilter | null
): { data: ColoredPoint[]; groups: string[] } {
  if (!Array.isArray(rawData) || !view.colorByColumn) {
    return { data: [], groups: [] };
  }

  const filtered = rawData.filter((row) =>
    rowMatchesAttributeFilter(row, filter?.includeByColumn)
  );

  const groupSet = new Set<string>();
  const points: ColoredPoint[] = [];

  filtered.forEach((row) => {
    const xRaw = getValueByPath(row, view.xColumn);
    const yRaw = getValueByPath(row, view.yColumn);
    const gRaw = getValueByPath(row, view.colorByColumn!);

    const x = Number(xRaw);
    const y = Number(yRaw);
    if (Number.isNaN(x) || Number.isNaN(y)) return;

    const group = String(gRaw ?? "Other");
    groupSet.add(group);

    points.push({
      x,
      y,
      highlighted: rowMatchesSelection(row, selection, rangeFilter, lassoFilter),
      xRaw,
      xType: "number",
      group,
    });
  });

  return { data: points, groups: Array.from(groupSet).sort() };
}

/* =======================================================
   Time-filtered data hook
======================================================= */

function useTimeFilteredData(): any[] {
  const { rawData } = useDataset();
  const { timeFilter } = useTimeFilter();

  return React.useMemo(() => {
    if (!Array.isArray(rawData)) return [];
    if (!timeFilter) return rawData;

    const { column, min, max } = timeFilter;
    return rawData.filter((row: any) => {
      const val = getValueByPath(row, column);
      if (val == null || val === "") return false;
      const ts = Date.parse(String(val));
      if (Number.isNaN(ts)) return false;
      return ts >= min && ts <= max;
    });
  }, [rawData, timeFilter]);
}

/* =======================================================
   Color palette
======================================================= */

// Palette excluding green (#66c2a5) and orange (#fc8d62) — for categories unrelated to Win/Lost
const GENERAL_PALETTE = [
  "#8da0cb",
  "#e78ac3",
  "#a6d854",
  "#ffd92f",
  "#e5c494",
  "#b3b3b3",
  "#a6cee3",
  "#b2df8a",
  "#fb9a99",
  "#cab2d6",
];

// Reserved category colors — consistent color assignments for known categories
const RESERVED_CATEGORY_COLORS: Record<string, string> = {
  // Win/Lost → green / orange
  won: "#66c2a5",
  win: "#66c2a5",
  lost: "#fc8d62",
  lose: "#fc8d62",
  // Deal stages → sequential green/teal (matching funnel palette)
  prospecting: "#00796b",
  qualification: "#26a69a",
  proposal: "#4db6ac",
  negotiation: "#80cbc4",
  "final review": "#b2dfdb",
};

/** Build a color map for a list of category names, reserving Win/Lost colors */
function buildCategoryColorMap(categories: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  let generalIdx = 0;
  for (const cat of categories) {
    const reserved = RESERVED_CATEGORY_COLORS[cat.toLowerCase()];
    if (reserved) {
      map[cat] = reserved;
    } else {
      map[cat] = GENERAL_PALETTE[generalIdx % GENERAL_PALETTE.length];
      generalIdx++;
    }
  }
  return map;
}

// Sequential teal for funnel
const FUNNEL_PALETTE = [
  "#00796b",
  "#26a69a",
  "#4db6ac",
  "#80cbc4",
  "#b2dfdb",
  "#e0f2f1",
];

/* =======================================================
   Label helpers
======================================================= */

function shouldRotateLabels(data: GenericPoint[]): boolean {
  if (data.length > 6) return true;
  const avgLen = data.reduce((sum, d) => sum + String(d.xRaw ?? d.x).length, 0) / (data.length || 1);
  return avgLen > 8;
}

/* =======================================================
   Format helpers
======================================================= */

function formatKPIValue(value: number, yLabel?: string) {
  if (yLabel === "%") {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (yLabel === "$") {
    return `$${formatCompactNumber(value)}`;
  }
  return formatCompactNumber(value);
}

/* =======================================================
   Scatter Brush Constants
======================================================= */

const SCATTER_MARGIN = { top: 10, right: 20, bottom: 30, left: 60 };

/* =======================================================
   Main Renderer
======================================================= */

export default React.memo(function ChartRenderer({
  view,
  height = "100%",
  filter,
}: {
  view: View;
  height?: number | "100%";
  filter?: ChartRendererFilter;
}) {
  const { attributeTypes } = useDataset();
  const rawData = useTimeFilteredData();
  const { selection, rangeFilter, lassoFilter, replaceSelection, addToSelection, clearSelection, hasSelection } = useSelection();

  const primaryColor = "#8da0cb"; // Set2 blue — single-series charts
  const faded = "#cbd5e1";

  /* ---- All hooks must be called unconditionally (React rules) ---- */
  const isChartView = view.chartType !== "TABLE";
  const chartView = isChartView ? (view as ChartView) : null;

  // Heavy computation: build base data WITHOUT selection dependency (stable across clicks)
  const { data: baseData, xType } = React.useMemo(() => {
    if (!chartView) return { data: [] as GenericPoint[], xType: "category" as const };
    return buildSeries(rawData, chartView, {}, attributeTypes, filter, null, null);
  }, [rawData, chartView, attributeTypes, filter]);

  // Lightweight: compute which x values are highlighted by current selection
  const highlightedXKeys = React.useMemo(() => {
    if (!hasSelection || !chartView) return null;
    const keys = new Set<any>();
    const rawFiltered = rawData.filter((row: any) =>
      rowMatchesAttributeFilter(row, filter?.includeByColumn)
    );
    for (const row of rawFiltered) {
      if (rowMatchesSelection(row, selection, rangeFilter, lassoFilter)) {
        const xRaw = getValueByPath(row, chartView.xColumn);
        keys.add(xRaw);
      }
    }
    return keys;
  }, [rawData, chartView, selection, rangeFilter, lassoFilter, hasSelection, filter]);

  const isPointHighlighted = React.useCallback(
    (point: { x: any; xRaw?: any }) => {
      if (!highlightedXKeys) return true;
      return highlightedXKeys.has(point.xRaw) || highlightedXKeys.has(point.x);
    },
    [highlightedXKeys]
  );

  const visibleData = React.useMemo(
    () => applyChartViewFilter(baseData, filter),
    [baseData, filter]
  );

  const rotateXLabels = React.useMemo(
    () => xType === "category" && shouldRotateLabels(visibleData),
    [visibleData, xType]
  );

  const pieData = React.useMemo(() => {
    const total = visibleData.reduce((sum, d) => sum + (Number(d.y) || 0), 0);
    return visibleData.map((d) => ({
      ...d,
      name: String(d.xRaw ?? d.x),
      ratio: total > 0 ? d.y / total : 0,
    }));
  }, [visibleData]);

  const pieColorMap = React.useMemo(
    () => buildCategoryColorMap(pieData.map((d) => d.name)),
    [pieData]
  );

  const chartConfig = React.useMemo(
    () =>
      ({
        y: { label: chartView?.yLabel ?? chartView?.yColumn ?? "" },
      } satisfies ChartConfig),
    [chartView?.yLabel, chartView?.yColumn]
  );

  /* ---- Dispatchers (after all hooks) ---- */

  if (view.chartType === "TABLE") {
    return (
      <TableRenderer
        view={view}
        height={height}
        filter={filter}
        replaceSelection={replaceSelection}
        addToSelection={addToSelection}
      />
    );
  }

  /* ---- KPI ---- */
  if (view.chartType === "KPI") {
    return (
      <KPIRenderer view={view as ChartView} height={height} filter={filter} />
    );
  }

  /* ---- MAP ---- */
  if (view.chartType === "MAP") {
    return (
      <MapRenderer view={view as ChartView} height={height} filter={filter} />
    );
  }

  /* ---- STACKED_BAR / GROUPED_BAR ---- */
  if (
    (view.chartType === "STACKED_BAR" || view.chartType === "GROUPED_BAR") &&
    (view as ChartView).groupByColumn
  ) {
    return (
      <GroupedBarRenderer
        view={view as ChartView}
        height={height}
        filter={filter}
        stacked={view.chartType === "STACKED_BAR"}
      />
    );
  }

  /* ---- SCATTER with colorByColumn ---- */
  if (view.chartType === "SCATTER" && (view as ChartView).colorByColumn) {
    return (
      <ColoredScatterRenderer view={view as ChartView} height={height} filter={filter} />
    );
  }

  /* ---- HORIZONTAL_BAR with drill-down ---- */
  if (view.chartType === "HORIZONTAL_BAR" && (view as ChartView).groupByColumn) {
    return (
      <HorizontalBarDrillDown view={view as ChartView} height={height} filter={filter} />
    );
  }

  /* ---- Plain SCATTER with brushing ---- */
  if (view.chartType === "SCATTER") {
    return (
      <ScatterWithBrush view={view as ChartView} height={height} filter={filter} />
    );
  }

  /* ---- Standard single-series charts (LINE, BAR, PIE, FUNNEL, HORIZONTAL_BAR, DONUT) ---- */

  if (!visibleData.length) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
        No compatible data
      </div>
    );
  }

  const isNumericX = xType === "number" || xType === "date";

  /* ---- FUNNEL ---- */
  if (view.chartType === "FUNNEL") {
    const funnelData = visibleData
      .sort((a, b) => b.y - a.y)
      .map((d, i) => ({
        name: String(d.xRaw ?? d.x),
        value: d.y,
        fill: FUNNEL_PALETTE[i % FUNNEL_PALETTE.length],
        highlighted: isPointHighlighted(d),
        xRaw: d.xRaw ?? d.x,
      }));

    return (
      <div className="h-full w-full outline-none" style={{ height }} onDoubleClick={() => clearSelection()} onClick={(e) => e.stopPropagation()}>
        <ChartContainer config={chartConfig} className="h-full w-full p-0 aspect-auto">
<FunnelChart margin={{ top: 5, right: 140, bottom: 5, left: 5 }}>
              <Tooltip
                trigger="hover"
                formatter={(value: any) => [
                  formatCompactNumber(Number(value)),
                  "Count",
                ]}
              />
              <Funnel
                dataKey="value"
                data={funnelData}
                isAnimationActive={false}
                onClick={(data: any) => {
                  const clickedX = data?.payload?.xRaw ?? data?.xRaw ?? data?.payload?.x ?? data?.x ?? data?.name;
                  if (clickedX !== undefined) {
                    replaceSelection(view.xColumn, clickedX);
                  }
                }}
              >
                <LabelList
                  position="right"
                  fill="#666"
                  stroke="none"
                  dataKey="name"
                  fontSize={11}
                  formatter={(value: any) => {
                    const str = String(value);
                    return str.length > 18 ? str.slice(0, 16) + "…" : str;
                  }}
                />
                {funnelData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={
                      hasSelection
                        ? entry.highlighted
                          ? entry.fill
                          : faded
                        : entry.fill
                    }
                    opacity={!hasSelection || entry.highlighted ? 1 : 0.3}
                    style={{ cursor: "pointer" }}
                  />
                ))}
              </Funnel>
            </FunnelChart>
        </ChartContainer>
      </div>
    );
  }

  /* ---- HORIZONTAL_BAR ---- */
  if (view.chartType === "HORIZONTAL_BAR") {
    return (
      <div className="h-full w-full outline-none" style={{ height }} onDoubleClick={() => clearSelection()} onClick={(e) => e.stopPropagation()}>
        <ChartContainer config={chartConfig} className="h-full w-full p-0 aspect-auto">
<BarChart data={visibleData} layout="vertical">
              <CartesianGrid horizontal={false} strokeOpacity={0.15} />
              <XAxis type="number" tickFormatter={formatCompactNumber} />
              <YAxis
                dataKey="x"
                type="category"
                width={100}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip content={<ChartTooltipContent />} trigger="hover" />
              <Bar
                dataKey="y"
                isAnimationActive={false}
                activeBar={false}
                onClick={(data: any, _idx: any, event: any) => {
                  const clickedX = data?.payload?.xRaw ?? data?.xRaw ?? data?.payload?.x ?? data?.x;
                  if (clickedX !== undefined) {
                    const e = event?.nativeEvent ?? event;
                    if (e?.ctrlKey || e?.metaKey) {
                      addToSelection(view.xColumn, clickedX);
                    } else {
                      replaceSelection(view.xColumn, clickedX);
                    }
                  }
                }}
              >
                {visibleData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={isPointHighlighted(entry) ? primaryColor : faded}
                      opacity={!hasSelection || isPointHighlighted(entry) ? 1 : 0.3}
                      style={{ cursor: "pointer" }}
                    />
                  ))}
              </Bar>
            </BarChart>
        </ChartContainer>
      </div>
    );
  }

  /* ---- DONUT ---- */
  if (view.chartType === "DONUT") {
    return (
      <div className="h-full w-full outline-none" style={{ height }} onDoubleClick={() => clearSelection()} onClick={(e) => e.stopPropagation()}>
        <ChartContainer config={chartConfig} className="h-full w-full p-0 aspect-auto">
<PieChart>
              <ChartTooltip
                content={<ChartTooltipContent />}
                trigger="hover"
                labelFormatter={(_label: any, payload: any) =>
                  payload?.[0]?.payload?.name ?? ""
                }
                formatter={(value: any, _name: any, item: any) => {
                  const ratio = Number(item?.payload?.ratio ?? 0) * 100;
                  const numeric = Number(value);
                  const valueText = Number.isNaN(numeric)
                    ? String(value)
                    : formatCompactNumber(numeric);
                  return [`${valueText} (${ratio.toFixed(1)}%)`, "Value"];
                }}
              />
              <Legend
                content={() => (
                  <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pt-2" style={{ fontSize: 11 }}>
                    {pieData.map((entry) => (
                      <div key={entry.name} className="flex items-center gap-1">
                        <div
                          className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                          style={{ backgroundColor: pieColorMap[entry.name] }}
                        />
                        <span>{entry.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              />
              <Pie
                data={pieData}
                dataKey="y"
                nameKey="name"
                innerRadius="50%"
                isAnimationActive={false}
                labelLine={false}
                label={({ percent }: any) =>
                  percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : ""
                }
                onClick={(data: any, _idx: any, event: any) => {
                  const clickedX = data?.payload?.xRaw ?? data?.xRaw ?? data?.payload?.x ?? data?.x;
                  if (clickedX !== undefined) {
                    const e = event?.nativeEvent ?? event;
                    if (e?.ctrlKey || e?.metaKey) {
                      addToSelection(view.xColumn, clickedX);
                    } else {
                      replaceSelection(view.xColumn, clickedX);
                    }
                  }
                }}
              >
                {pieData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={
                      hasSelection && !isPointHighlighted(entry)
                        ? faded
                        : pieColorMap[entry.name]
                    }
                    stroke="#ffffff"
                    strokeWidth={1}
                    opacity={!hasSelection || isPointHighlighted(entry) ? 1 : 0.3}
                    style={{ cursor: "pointer" }}
                  />
                ))}
              </Pie>
            </PieChart>
        </ChartContainer>
      </div>
    );
  }

  /* ---- Original chart types: LINE, BAR, PIE ---- */
  return (
    <div className="h-full w-full outline-none" style={{ height }} onDoubleClick={() => clearSelection()} onClick={(e) => e.stopPropagation()}>
      <ChartContainer config={chartConfig} className="h-full w-full p-0 aspect-auto">
{view.chartType === "LINE" ? (
            <AreaChart data={visibleData}>
              <CartesianGrid vertical={false} strokeOpacity={0.15} />
              <XAxis
                dataKey="x"
                type={isNumericX ? "number" : "category"}
                scale={xType === "date" ? "time" : undefined}
                domain={xType === "date" ? ["auto", "auto"] : undefined}
                tickFormatter={xType === "date" ? formatDateTick : undefined}
                angle={rotateXLabels ? -45 : 0}
                textAnchor={rotateXLabels ? "end" : "middle"}
                height={rotateXLabels ? 60 : 30}
                tick={{ fontSize: 11 }}
              />
              <YAxis type="number" tickFormatter={formatCompactNumber} />
              <ChartTooltip
                content={<ChartTooltipContent />}
                trigger="hover"
                labelFormatter={
                  xType === "date"
                    ? (_label: any, payload: any) =>
                        formatDateTick(payload?.[0]?.payload?.x)
                    : undefined
                }
              />

              <Area
                type="monotone"
                dataKey="y"
                stroke={primaryColor}
                fill={primaryColor}
                strokeOpacity={hasSelection ? 0.25 : 1}
                fillOpacity={hasSelection ? 0.05 : 0.15}
                isAnimationActive={false}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const highlighted = isPointHighlighted(payload);

                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill={highlighted ? primaryColor : faded}
                      opacity={!hasSelection || highlighted ? 1 : 0.3}
                      style={{ cursor: "pointer" }}
                      onClick={(e: React.MouseEvent) => {
                        if (e.ctrlKey || e.metaKey) {
                          addToSelection(view.xColumn, payload.xRaw ?? payload.x);
                        } else {
                          replaceSelection(view.xColumn, payload.xRaw ?? payload.x);
                        }
                      }}
                    />
                  );
                }}
              />

              {hasSelection && (
                <Area
                  type="monotone"
                  dataKey="yHL"
                  stroke={primaryColor}
                  fill={primaryColor}
                  strokeWidth={3}
                  strokeOpacity={1}
                  fillOpacity={0.2}
                  isAnimationActive={false}
                  legendType="none"
                  tooltipType="none"
                  data={visibleData.map((d) => ({
                    ...d,
                    yHL: isPointHighlighted(d) ? d.y : null,
                  }))}
                />
              )}
            </AreaChart>
          ) : view.chartType === "BAR" ? (
            <BarChart data={visibleData}>
              <CartesianGrid vertical={false} strokeOpacity={0.15} />
              <XAxis
                dataKey="x"
                type={isNumericX ? "number" : "category"}
                scale={xType === "date" ? "time" : undefined}
                domain={xType === "date" ? ["auto", "auto"] : undefined}
                tickFormatter={xType === "date" ? formatDateTick : undefined}
                angle={rotateXLabels ? -45 : 0}
                textAnchor={rotateXLabels ? "end" : "middle"}
                height={rotateXLabels ? 60 : 30}
                tick={{ fontSize: 11 }}
              />
              <YAxis type="number" tickFormatter={formatCompactNumber} />
              <ChartTooltip
                content={<ChartTooltipContent />}
                trigger="hover"
                labelFormatter={
                  xType === "date"
                    ? (_label: any, payload: any) =>
                        formatDateTick(payload?.[0]?.payload?.x)
                    : undefined
                }
              />

              <Bar
                dataKey="y"
                isAnimationActive={false}
                activeBar={false}
                onClick={(data: any, _idx: any, event: any) => {
                  const clickedX = data?.payload?.xRaw ?? data?.xRaw ?? data?.payload?.x ?? data?.x;
                  if (clickedX !== undefined) {
                    const e = event?.nativeEvent ?? event;
                    if (e?.ctrlKey || e?.metaKey) {
                      addToSelection(view.xColumn, clickedX);
                    } else {
                      replaceSelection(view.xColumn, clickedX);
                    }
                  }
                }}
              >
                {visibleData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={isPointHighlighted(entry) ? primaryColor : faded}
                      opacity={!hasSelection || isPointHighlighted(entry) ? 1 : 0.3}
                      style={{ cursor: "pointer" }}
                    />
                  ))}
              </Bar>
            </BarChart>
          ) : (
            /* PIE */
            <PieChart>
              <ChartTooltip
                content={<ChartTooltipContent />}
                trigger="hover"
                labelFormatter={(_label: any, payload: any) =>
                  payload?.[0]?.payload?.name ?? ""
                }
                formatter={(value: any, _name: any, item: any) => {
                  const ratio = Number(item?.payload?.ratio ?? 0) * 100;
                  const numeric = Number(value);
                  const valueText = Number.isNaN(numeric)
                    ? String(value)
                    : formatCompactNumber(numeric);
                  return [`${valueText} (${ratio.toFixed(1)}%)`, "Value"];
                }}
              />
              <Pie
                data={pieData}
                dataKey="y"
                nameKey="name"
                isAnimationActive={false}
                labelLine={false}
                label={({ percent }: any) =>
                  percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : ""
                }
                onClick={(data: any, _idx: any, event: any) => {
                  const clickedX = data?.payload?.xRaw ?? data?.xRaw ?? data?.payload?.x ?? data?.x;
                  if (clickedX !== undefined) {
                    const e = event?.nativeEvent ?? event;
                    if (e?.ctrlKey || e?.metaKey) {
                      addToSelection(view.xColumn, clickedX);
                    } else {
                      replaceSelection(view.xColumn, clickedX);
                    }
                  }
                }}
              >
                {pieData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={
                      hasSelection && !isPointHighlighted(entry)
                        ? faded
                        : pieColorMap[entry.name]
                    }
                    stroke="#ffffff"
                    strokeWidth={1}
                    opacity={!hasSelection || isPointHighlighted(entry) ? 1 : 0.3}
                    style={{ cursor: "pointer" }}
                  />
                ))}
              </Pie>
            </PieChart>
          )}
      </ChartContainer>
    </div>
  );
});

/* =======================================================
   KPI Renderer (with cross-filtering)
======================================================= */

function KPIRenderer({
  view,
  height,
  filter,
}: {
  view: ChartView;
  height: number | "100%";
  filter?: ChartRendererFilter;
}) {
  const rawData = useTimeFilteredData();
  const { selection, rangeFilter, lassoFilter, hasSelection } = useSelection();

  const { total, filtered, hasFilter } = React.useMemo(
    () => computeKPIValue(rawData, view, filter, selection, rangeFilter, lassoFilter),
    [rawData, view, filter, selection, rangeFilter, lassoFilter]
  );

  return (
    <div
      style={{ height }}
      className="h-full w-full flex flex-col items-center justify-center gap-1"
    >
      <span className="text-2xl font-bold tracking-tight text-primary">
        {formatKPIValue(hasFilter ? filtered : total, view.yLabel)}
      </span>
      {hasFilter && hasSelection && (
        <span className="text-xs text-muted-foreground">
          of {formatKPIValue(total, view.yLabel)} total
        </span>
      )}
    </div>
  );
}

/* =======================================================
   Grouped / Stacked Bar Renderer (with cross-filtering)
======================================================= */

function GroupedBarRenderer({
  view,
  height,
  filter,
  stacked,
}: {
  view: ChartView;
  height: number | "100%";
  filter?: ChartRendererFilter;
  stacked: boolean;
}) {
  const { attributeTypes } = useDataset();
  const rawData = useTimeFilteredData();
  const { selection, rangeFilter, lassoFilter, replaceSelection, addToSelection, clearSelection, hasSelection } = useSelection();

  // Heavy computation: build grouped data WITHOUT selection dependency
  const { rows, groups } = React.useMemo(
    () => buildGroupedSeries(rawData, view, attributeTypes, filter),
    [rawData, view, attributeTypes, filter]
  );

  // Lightweight: compute which x values are highlighted
  const highlightedXValues = React.useMemo(() => {
    if (!hasSelection) return new Set<string>();
    const keys = new Set<string>();
    const rawFiltered = rawData.filter((row: any) =>
      rowMatchesAttributeFilter(row, filter?.includeByColumn)
    );
    for (const row of rawFiltered) {
      if (rowMatchesSelection(row, selection, rangeFilter, lassoFilter)) {
        const xRaw = getValueByPath(row, view.xColumn);
        if (xRaw != null) keys.add(String(xRaw));
      }
    }
    return keys;
  }, [rawData, view.xColumn, selection, rangeFilter, lassoFilter, hasSelection, filter]);

  const rotateXLabels = React.useMemo(
    () => rows.length > 6 || rows.some((r: any) => String(r.x).length > 8),
    [rows]
  );

  const groupColorMap = React.useMemo(() => buildCategoryColorMap(groups), [groups]);

  const chartConfig = React.useMemo(() => {
    const cfg: ChartConfig = {};
    groups.forEach((g) => {
      cfg[g] = {
        label: g,
        color: groupColorMap[g],
      };
    });
    return cfg;
  }, [groups, groupColorMap]);

  if (!rows.length) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
        No compatible data
      </div>
    );
  }

  return (
    <div className="h-full w-full outline-none" style={{ height }} onDoubleClick={() => clearSelection()} onClick={(e) => e.stopPropagation()}>
      <ChartContainer config={chartConfig} className="h-full w-full p-0 aspect-auto">
<BarChart data={rows}>
            <CartesianGrid vertical={false} strokeOpacity={0.15} />
            <XAxis
              dataKey="x"
              type="category"
              tick={{ fontSize: 11 }}
              angle={rotateXLabels ? -45 : 0}
              textAnchor={rotateXLabels ? "end" : "middle"}
              height={rotateXLabels ? 60 : 30}
            />
            <YAxis type="number" tickFormatter={formatCompactNumber} />
            <ChartTooltip content={<ChartTooltipContent />} trigger="hover" />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              iconSize={10}
              iconType="square"
            />
            {groups.map((g) => (
              <Bar
                key={g}
                dataKey={g}
                fill={groupColorMap[g]}
                stackId={stacked ? "a" : undefined}
                radius={stacked ? undefined : [2, 2, 0, 0]}
                isAnimationActive={false}
                activeBar={false}
                onClick={(data: any, _idx: any, event: any) => {
                  const clickedX = data?.payload?.xRaw ?? data?.xRaw ?? data?.payload?.x ?? data?.x;
                  if (clickedX !== undefined) {
                    const e = event?.nativeEvent ?? event;
                    if (e?.ctrlKey || e?.metaKey) {
                      addToSelection(view.xColumn, clickedX);
                    } else {
                      replaceSelection(view.xColumn, clickedX);
                    }
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                {rows.map((row, idx) => (
                  <Cell
                    key={idx}
                    fill={groupColorMap[g]}
                    opacity={
                      !hasSelection || highlightedXValues.has(String(row.x))
                        ? 1
                        : 0.3
                    }
                  />
                ))}
              </Bar>
            ))}
          </BarChart>
      </ChartContainer>
    </div>
  );
}

/* =======================================================
   Horizontal Bar with Drill-Down
======================================================= */

function HorizontalBarDrillDown({
  view,
  height,
  filter,
}: {
  view: ChartView;
  height: number | "100%";
  filter?: ChartRendererFilter;
}) {
  const rawData = useTimeFilteredData();
  const { selection, rangeFilter, lassoFilter, replaceSelection, addToSelection, clearSelection, hasSelection } = useSelection();

  const [drillCategory, setDrillCategory] = React.useState<string | null>(null);

  const categoryColumn = view.groupByColumn!;
  const itemColumn = view.xColumn;
  const yColumn = view.yColumn;
  const agg = view.aggregation || "sum";

  // Filter raw data by view filter (e.g. Status = Won)
  const filteredRawData = React.useMemo(
    () => rawData.filter((row: any) => rowMatchesAttributeFilter(row, filter?.includeByColumn)),
    [rawData, filter]
  );

  // Category-level aggregation (top level)
  const categoryData = React.useMemo(() => {
    const map = new Map<string, { sum: number; count: number }>();
    for (const row of filteredRawData) {
      const cat = getValueByPath(row, categoryColumn);
      if (cat == null) continue;
      const key = String(cat);
      const yRaw = getValueByPath(row, yColumn);
      const yVal = agg === "count" ? 1 : Number(yRaw);
      if (Number.isNaN(yVal) && agg !== "count") continue;
      const existing = map.get(key) ?? { sum: 0, count: 0 };
      existing.sum += yVal;
      existing.count += 1;
      map.set(key, existing);
    }
    const result: GenericPoint[] = Array.from(map.entries()).map(([key, { sum, count }]) => {
      let y: number;
      if (agg === "avg") y = count > 0 ? sum / count : 0;
      else if (agg === "count") y = count;
      else y = sum;
      return { x: key, y, highlighted: true, xRaw: key, xType: "category" as const };
    });
    if (view.sortDescending) result.sort((a, b) => b.y - a.y);
    return result;
  }, [filteredRawData, categoryColumn, yColumn, agg, view.sortDescending]);

  // Drill-down: items within the selected category
  const drillData = React.useMemo(() => {
    if (!drillCategory) return [];
    const map = new Map<string, { sum: number; count: number }>();
    for (const row of filteredRawData) {
      const cat = String(getValueByPath(row, categoryColumn) ?? "");
      if (cat !== drillCategory) continue;
      const item = getValueByPath(row, itemColumn);
      if (item == null) continue;
      const key = String(item);
      const yRaw = getValueByPath(row, yColumn);
      const yVal = agg === "count" ? 1 : Number(yRaw);
      if (Number.isNaN(yVal) && agg !== "count") continue;
      const existing = map.get(key) ?? { sum: 0, count: 0 };
      existing.sum += yVal;
      existing.count += 1;
      map.set(key, existing);
    }
    const result: GenericPoint[] = Array.from(map.entries()).map(([key, { sum, count }]) => {
      let y: number;
      if (agg === "avg") y = count > 0 ? sum / count : 0;
      else if (agg === "count") y = count;
      else y = sum;
      return { x: key, y, highlighted: true, xRaw: key, xType: "category" as const };
    });
    result.sort((a, b) => b.y - a.y);
    if (filter?.top) result.splice(filter.top);
    return result;
  }, [filteredRawData, drillCategory, categoryColumn, itemColumn, yColumn, agg, filter?.top]);

  // Highlighting
  const highlightedXKeys = React.useMemo(() => {
    if (!hasSelection) return null;
    const keys = new Set<any>();
    for (const row of filteredRawData) {
      if (rowMatchesSelection(row, selection, rangeFilter, lassoFilter)) {
        const val = drillCategory
          ? getValueByPath(row, itemColumn)
          : getValueByPath(row, categoryColumn);
        keys.add(val);
      }
    }
    return keys;
  }, [filteredRawData, selection, rangeFilter, lassoFilter, hasSelection, drillCategory, itemColumn, categoryColumn]);

  const isHighlighted = React.useCallback(
    (xRaw: any) => {
      if (!highlightedXKeys) return true;
      return highlightedXKeys.has(xRaw);
    },
    [highlightedXKeys]
  );

  const displayData = drillCategory ? drillData : categoryData;
  const faded = "#cbd5e1";

  // Color map for categories (consistent with donut/pie)
  const categoryColorMap = React.useMemo(
    () => buildCategoryColorMap(categoryData.map((d) => String(d.xRaw ?? d.x))),
    [categoryData]
  );

  // When drilled down, all bars inherit the parent category color
  const barFillColor = drillCategory
    ? (categoryColorMap[drillCategory] ?? "#8da0cb")
    : null; // null = use per-category colors

  const chartConfig = React.useMemo(
    () => ({ y: { label: view.yLabel ?? view.yColumn ?? "" } } satisfies ChartConfig),
    [view.yLabel, view.yColumn]
  );

  if (!displayData.length) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
        No compatible data
      </div>
    );
  }

  return (
    <div className="h-full w-full outline-none flex flex-col" style={{ height }} onDoubleClick={() => clearSelection()} onClick={(e) => e.stopPropagation()}>
      {drillCategory && (
        <button
          className="self-start text-xs text-primary hover:underline px-1 py-0.5 flex items-center gap-1 shrink-0"
          onClick={(e) => { e.stopPropagation(); setDrillCategory(null); }}
        >
          <span>&#8592;</span> Back to categories
        </button>
      )}
      {!drillCategory && (
        <div className="text-[10px] text-muted-foreground px-1 shrink-0">Click a category to drill down</div>
      )}
      <div className="flex-1 min-h-0">
        <ChartContainer config={chartConfig} className="h-full w-full p-0 aspect-auto">
          <BarChart data={displayData} layout="vertical">
            <CartesianGrid horizontal={false} strokeOpacity={0.15} />
            <XAxis type="number" tickFormatter={formatCompactNumber} />
            <YAxis
              dataKey="x"
              type="category"
              width={100}
              tick={{ fontSize: 11 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} trigger="hover" />
            <Bar
              dataKey="y"
              isAnimationActive={false}
              activeBar={false}
              onClick={(data: any, _idx: any, event: any) => {
                const clickedX = data?.payload?.xRaw ?? data?.xRaw ?? data?.payload?.x ?? data?.x;
                if (clickedX === undefined) return;
                if (!drillCategory) {
                  // Drill into category
                  setDrillCategory(String(clickedX));
                } else {
                  // Normal cross-filter selection within drill level
                  const e = event?.nativeEvent ?? event;
                  if (e?.ctrlKey || e?.metaKey) {
                    addToSelection(itemColumn, clickedX);
                  } else {
                    replaceSelection(itemColumn, clickedX);
                  }
                }
              }}
            >
              {displayData.map((entry, index) => {
                const barKey = String(entry.xRaw ?? entry.x);
                const fillColor = barFillColor ?? (categoryColorMap[barKey] ?? "#8da0cb");
                return (
                  <Cell
                    key={index}
                    fill={isHighlighted(entry.xRaw) ? fillColor : faded}
                    opacity={!hasSelection || isHighlighted(entry.xRaw) ? 1 : 0.3}
                    style={{ cursor: "pointer" }}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  );
}

/* =======================================================
   Colored Scatter Renderer (with brushing)
======================================================= */

function ColoredScatterRenderer({
  view,
  height,
  filter,
}: {
  view: ChartView;
  height: number | "100%";
  filter?: ChartRendererFilter;
}) {
  const { attributeTypes } = useDataset();
  const rawData = useTimeFilteredData();
  const { selection, rangeFilter, lassoFilter, replaceSelection, addToSelection, setLassoSelection, clearSelection, hasSelection } = useSelection();

  const containerRef = React.useRef<HTMLDivElement>(null);
  const lassoPathRef = React.useRef<Array<{ x: number; y: number }>>([]);
  const [lassoPixels, setLassoPixels] = React.useState<Array<{ x: number; y: number }>>([]);
  const isDragging = React.useRef(false);

  const { data, groups } = React.useMemo(
    () =>
      buildColoredScatterSeries(
        rawData,
        view,
        selection,
        attributeTypes,
        filter,
        rangeFilter,
        lassoFilter
      ),
    [rawData, view, selection, attributeTypes, filter, rangeFilter, lassoFilter]
  );

  const scatterColorMap = React.useMemo(() => buildCategoryColorMap(groups), [groups]);

  const chartConfig = React.useMemo(() => {
    const cfg: ChartConfig = {};
    groups.forEach((g) => {
      cfg[g] = {
        label: g,
        color: scatterColorMap[g],
      };
    });
    return cfg;
  }, [groups, scatterColorMap]);

  // Compute data ranges for pixel-to-data conversion
  const dataRange = React.useMemo(() => {
    if (!data.length) return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
    const xs = data.map((d) => d.x as number);
    const ys = data.map((d) => d.y);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const xPad = (xMax - xMin) * 0.05 || 1;
    const yPad = (yMax - yMin) * 0.05 || 1;
    return {
      xMin: xMin - xPad,
      xMax: xMax + xPad,
      yMin: yMin - yPad,
      yMax: yMax + yPad,
    };
  }, [data]);

  const pixelToData = React.useCallback(
    (px: number, py: number) => {
      const el = containerRef.current;
      if (!el) return { x: 0, y: 0 };
      const w = el.clientWidth;
      const h = el.clientHeight;
      const plotW = w - SCATTER_MARGIN.left - SCATTER_MARGIN.right;
      const plotH = h - SCATTER_MARGIN.top - SCATTER_MARGIN.bottom;
      const x =
        dataRange.xMin +
        ((px - SCATTER_MARGIN.left) / plotW) * (dataRange.xMax - dataRange.xMin);
      const y =
        dataRange.yMax -
        ((py - SCATTER_MARGIN.top) / plotH) * (dataRange.yMax - dataRange.yMin);
      return { x, y };
    },
    [dataRange]
  );

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      isDragging.current = false;
      lassoPathRef.current = [{ x, y }];
      setLassoPixels([{ x, y }]);
    },
    []
  );

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent) => {
      if (lassoPathRef.current.length === 0) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const last = lassoPathRef.current[lassoPathRef.current.length - 1];
      const dist = Math.hypot(x - last.x, y - last.y);
      if (dist < 3) return; // throttle: skip if <3px from last point
      if (!isDragging.current && dist > 5) isDragging.current = true;
      lassoPathRef.current.push({ x, y });
      setLassoPixels([...lassoPathRef.current]);
    },
    []
  );

  const handleMouseUp = React.useCallback(() => {
    const path = lassoPathRef.current;
    lassoPathRef.current = [];

    if (path.length < 5 || !isDragging.current) {
      // Too few points = click, not lasso
      setLassoPixels([]);
      isDragging.current = false;
      return;
    }

    // Convert pixel path to data coords
    const polygon = path.map((p) => pixelToData(p.x, p.y));

    setLassoSelection({
      xColumn: view.xColumn,
      yColumn: view.yColumn,
      polygon,
    });

    setLassoPixels([]);
    isDragging.current = false;
  }, [pixelToData, setLassoSelection, view.xColumn, view.yColumn]);

  if (!data.length) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
        No compatible data
      </div>
    );
  }

  const lassoSvgPath = lassoPixels.length > 1
    ? lassoPixels.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
    : "";

  return (
    <div
      ref={containerRef}
      className="h-full w-full relative select-none outline-none"
      style={{ height }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={() => clearSelection()}
      onClick={(e) => e.stopPropagation()}
    >
      <ChartContainer config={chartConfig} className="h-full w-full p-0 aspect-auto">
<ScatterChart margin={SCATTER_MARGIN}>
            <CartesianGrid vertical={false} strokeOpacity={0.15} />
            <XAxis
              type="number"
              dataKey="x"
              name={view.xLabel ?? view.xColumn}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={view.yLabel ?? view.yColumn}
              tickFormatter={formatCompactNumber}
            />
            <ChartTooltip trigger="hover" content={<ChartTooltipContent />} />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              iconSize={10}
              iconType="circle"
            />
            {groups.map((g) => {
              const groupData = data.filter((d) => d.group === g);
              return (
                <Scatter
                  key={g}
                  name={g}
                  data={groupData}
                  fill={scatterColorMap[g]}
                  isAnimationActive={false}
                  onClick={(e: any, _idx: any, event: any) => {
                    if (isDragging.current) return;
                    const clickedX = e?.payload?.xRaw ?? e?.payload?.x;
                    if (clickedX !== undefined) {
                      const ne = event?.nativeEvent ?? event;
                      if (ne?.ctrlKey || ne?.metaKey) {
                        addToSelection(view.xColumn, clickedX);
                      } else {
                        replaceSelection(view.xColumn, clickedX);
                      }
                    }
                  }}
                >
                  {groupData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={scatterColorMap[g]}
                      opacity={!hasSelection || entry.highlighted ? 1 : 0.15}
                      style={{ cursor: "pointer" }}
                    />
                  ))}
                </Scatter>
              );
            })}
          </ScatterChart>
      </ChartContainer>

      {/* Freehand lasso overlay */}
      {lassoSvgPath && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
          <path d={lassoSvgPath} fill="rgba(141,160,203,0.1)" stroke="#8da0cb" strokeWidth={1.5} strokeDasharray="4 2" />
        </svg>
      )}
    </div>
  );
}

/* =======================================================
   Plain Scatter with Brush
======================================================= */

function ScatterWithBrush({
  view,
  height,
  filter,
}: {
  view: ChartView;
  height: number | "100%";
  filter?: ChartRendererFilter;
}) {
  const { attributeTypes } = useDataset();
  const rawData = useTimeFilteredData();
  const { selection, rangeFilter, lassoFilter, replaceSelection, addToSelection, setLassoSelection, clearSelection, hasSelection } = useSelection();

  const containerRef = React.useRef<HTMLDivElement>(null);
  const lassoPathRef = React.useRef<Array<{ x: number; y: number }>>([]);
  const [lassoPixels, setLassoPixels] = React.useState<Array<{ x: number; y: number }>>([]);
  const isDragging = React.useRef(false);

  const primaryColor = "#8da0cb";
  const faded = "#cbd5e1";

  const { data, xType: _xType } = React.useMemo(() => {
    return buildSeries(rawData, view, selection, attributeTypes, filter, rangeFilter, lassoFilter);
  }, [rawData, view, selection, attributeTypes, filter, rangeFilter, lassoFilter]);

  const visibleData = React.useMemo(
    () => applyChartViewFilter(data, filter),
    [data, filter]
  );

  const chartConfig = React.useMemo(
    () =>
      ({
        y: { label: view.yLabel ?? view.yColumn },
      } satisfies ChartConfig),
    [view.yLabel, view.yColumn]
  );

  // Compute data ranges for pixel-to-data conversion
  const dataRange = React.useMemo(() => {
    if (!visibleData.length) return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
    const xs = visibleData.map((d) => Number(d.x));
    const ys = visibleData.map((d) => d.y);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const xPad = (xMax - xMin) * 0.05 || 1;
    const yPad = (yMax - yMin) * 0.05 || 1;
    return {
      xMin: xMin - xPad,
      xMax: xMax + xPad,
      yMin: yMin - yPad,
      yMax: yMax + yPad,
    };
  }, [visibleData]);

  const pixelToData = React.useCallback(
    (px: number, py: number) => {
      const el = containerRef.current;
      if (!el) return { x: 0, y: 0 };
      const w = el.clientWidth;
      const h = el.clientHeight;
      const plotW = w - SCATTER_MARGIN.left - SCATTER_MARGIN.right;
      const plotH = h - SCATTER_MARGIN.top - SCATTER_MARGIN.bottom;
      const x =
        dataRange.xMin +
        ((px - SCATTER_MARGIN.left) / plotW) * (dataRange.xMax - dataRange.xMin);
      const y =
        dataRange.yMax -
        ((py - SCATTER_MARGIN.top) / plotH) * (dataRange.yMax - dataRange.yMin);
      return { x, y };
    },
    [dataRange]
  );

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      isDragging.current = false;
      lassoPathRef.current = [{ x, y }];
      setLassoPixels([{ x, y }]);
    },
    []
  );

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent) => {
      if (lassoPathRef.current.length === 0) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const last = lassoPathRef.current[lassoPathRef.current.length - 1];
      const dist = Math.hypot(x - last.x, y - last.y);
      if (dist < 3) return;
      if (!isDragging.current && dist > 5) isDragging.current = true;
      lassoPathRef.current.push({ x, y });
      setLassoPixels([...lassoPathRef.current]);
    },
    []
  );

  const handleMouseUp = React.useCallback(() => {
    const path = lassoPathRef.current;
    lassoPathRef.current = [];

    if (path.length < 5 || !isDragging.current) {
      setLassoPixels([]);
      isDragging.current = false;
      return;
    }

    const polygon = path.map((p) => pixelToData(p.x, p.y));

    setLassoSelection({
      xColumn: view.xColumn,
      yColumn: view.yColumn,
      polygon,
    });

    setLassoPixels([]);
    isDragging.current = false;
  }, [pixelToData, setLassoSelection, view.xColumn, view.yColumn]);

  if (!visibleData.length) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
        No compatible data
      </div>
    );
  }

  const lassoSvgPath = lassoPixels.length > 1
    ? lassoPixels.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
    : "";

  return (
    <div
      ref={containerRef}
      className="h-full w-full relative select-none outline-none"
      style={{ height }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={() => clearSelection()}
      onClick={(e) => e.stopPropagation()}
    >
      <ChartContainer config={chartConfig} className="h-full w-full p-0 aspect-auto">
<ScatterChart margin={SCATTER_MARGIN}>
            <CartesianGrid vertical={false} strokeOpacity={0.15} />
            <XAxis type="number" dataKey="x" tickFormatter={formatCompactNumber} />
            <YAxis type="number" dataKey="y" tickFormatter={formatCompactNumber} />
            <ChartTooltip trigger="hover" content={<ChartTooltipContent />} />

            <Scatter
              data={visibleData}
              isAnimationActive={false}
              onClick={(e: any, _idx: any, event: any) => {
                if (isDragging.current) return;
                const clickedX = e?.payload?.xRaw ?? e?.payload?.x;
                if (clickedX !== undefined) {
                  const ne = event?.nativeEvent ?? event;
                  if (ne?.ctrlKey || ne?.metaKey) {
                    addToSelection(view.xColumn, clickedX);
                  } else {
                    replaceSelection(view.xColumn, clickedX);
                  }
                }
              }}
            >
              {visibleData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.highlighted ? primaryColor : faded}
                  opacity={!hasSelection || entry.highlighted ? 1 : 0.15}
                  style={{ cursor: "pointer" }}
                />
              ))}
            </Scatter>
          </ScatterChart>
      </ChartContainer>

      {/* Freehand lasso overlay */}
      {lassoSvgPath && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
          <path d={lassoSvgPath} fill="rgba(141,160,203,0.1)" stroke="#8da0cb" strokeWidth={1.5} strokeDasharray="4 2" />
        </svg>
      )}
    </div>
  );
}

/* =======================================================
   Table Renderer
======================================================= */

function TableRenderer({
  view,
  height,
  filter,
  replaceSelection,
  addToSelection,
}: {
  view: Extract<View, { chartType: "TABLE" }>;
  height: number | "100%";
  filter?: ChartRendererFilter;
  replaceSelection: (column: string, value: any) => void;
  addToSelection: (column: string, value: any) => void;
}) {
  const rawData = useTimeFilteredData();
  const { selection, rangeFilter, lassoFilter, hasSelection } = useSelection();

  if (rawData.length === 0) {
    return <div>No data</div>;
  }

  const { rows, columns } = React.useMemo(
    () => applyTableViewFilter(rawData, view, filter),
    [rawData, view, filter]
  );

  if (rows.length === 0 || columns.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
        No compatible data
      </div>
    );
  }

  return (
    <div style={{ height }} className="overflow-auto outline-none" onClick={(e) => e.stopPropagation()}>
      <ShadTable>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col}>{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => {
            const highlighted = rowMatchesSelection(row, selection, rangeFilter, lassoFilter);

            return (
              <TableRow
                key={i}
                className={`cursor-pointer ${
                  hasSelection && !highlighted ? "opacity-40" : ""
                }`}
                onClick={(e) => {
                  const value = getValueByPath(row, columns[0]);
                  if (value !== undefined) {
                    if (e.ctrlKey || e.metaKey) {
                      addToSelection(columns[0], value);
                    } else {
                      replaceSelection(columns[0], value);
                    }
                  }
                }}
              >
                {columns.map((col) => (
                  <TableCell key={col}>{getValueByPath(row, col)}</TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </ShadTable>
    </div>
  );
}
