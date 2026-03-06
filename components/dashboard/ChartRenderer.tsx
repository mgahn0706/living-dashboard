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
import { useDataset } from "@/context/DatasetContext";
import { useSelection, type RangeFilter } from "@/context/SelectionContext";

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

function rowMatchesSelection(
  row: any,
  selection: any,
  rangeFilter?: RangeFilter | null
) {
  const hasDiscrete = selection && Object.keys(selection).length > 0;
  const hasRange = !!rangeFilter;

  if (!hasDiscrete && !hasRange) return true;

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
  rangeFilter?: RangeFilter | null
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
        highlighted: rowMatchesSelection(row, selection, rangeFilter),
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
  rangeFilter?: RangeFilter | null
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
    if (rowMatchesSelection(row, selection, rangeFilter)) {
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
  rangeFilter?: RangeFilter | null
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
  const hasFilter = hasDiscrete || hasRange;

  if (!hasFilter) {
    return { total, filtered: total, hasFilter: false };
  }

  const selectedData = data.filter((row) =>
    rowMatchesSelection(row, selection, rangeFilter)
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
  rangeFilter?: RangeFilter | null
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
      highlighted: rowMatchesSelection(row, selection, rangeFilter),
      xRaw,
      xType: "number",
      group,
    });
  });

  return { data: points, groups: Array.from(groupSet).sort() };
}

/* =======================================================
   Color palette
======================================================= */

const GROUP_PALETTE = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#ec4899",
];

const FUNNEL_PALETTE = [
  "#3b82f6",
  "#60a5fa",
  "#93c5fd",
  "#bfdbfe",
  "#dbeafe",
];

/* =======================================================
   Format helpers
======================================================= */

function formatKPIValue(value: number, yLabel?: string) {
  if (yLabel === "%") {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (yLabel === "$") {
    return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  if (Math.abs(value) >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
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
  const { rawData, attributeTypes } = useDataset();
  const { selection, rangeFilter, replaceSelection, clearSelection, hasSelection } = useSelection();

  const blue = "#3b82f6";
  const faded = "#cbd5e1";
  const piePalette = GROUP_PALETTE;

  /* ---- All hooks must be called unconditionally (React rules) ---- */
  const isChartView = view.chartType !== "TABLE";
  const chartView = isChartView ? (view as ChartView) : null;

  // Heavy computation: build base data WITHOUT selection dependency (stable across clicks)
  const { data: baseData, xType } = React.useMemo(() => {
    if (!chartView) return { data: [] as GenericPoint[], xType: "category" as const };
    return buildSeries(rawData ?? [], chartView, {}, attributeTypes, filter, null);
  }, [rawData, chartView, attributeTypes, filter]);

  // Lightweight: compute which x values are highlighted by current selection
  const highlightedXKeys = React.useMemo(() => {
    if (!hasSelection || !chartView) return null;
    const keys = new Set<any>();
    const rawFiltered = (rawData ?? []).filter((row: any) =>
      rowMatchesAttributeFilter(row, filter?.includeByColumn)
    );
    for (const row of rawFiltered) {
      if (rowMatchesSelection(row, selection, rangeFilter)) {
        const xRaw = getValueByPath(row, chartView.xColumn);
        keys.add(xRaw);
      }
    }
    return keys;
  }, [rawData, chartView, selection, rangeFilter, hasSelection, filter]);

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

  const pieData = React.useMemo(() => {
    const total = visibleData.reduce((sum, d) => sum + (Number(d.y) || 0), 0);
    return visibleData.map((d) => ({
      ...d,
      name: String(d.xRaw ?? d.x),
      ratio: total > 0 ? d.y / total : 0,
    }));
  }, [visibleData]);

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
      />
    );
  }

  /* ---- KPI ---- */
  if (view.chartType === "KPI") {
    return (
      <KPIRenderer view={view as ChartView} height={height} filter={filter} />
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
<FunnelChart>
              <Tooltip
                trigger="hover"
                formatter={(value: any) => [
                  Number(value).toLocaleString(),
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
              <XAxis type="number" />
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
                onClick={(data: any) => {
                  const clickedX = data?.payload?.xRaw ?? data?.xRaw ?? data?.payload?.x ?? data?.x;
                  if (clickedX !== undefined) {
                    replaceSelection(view.xColumn, clickedX);
                  }
                }}
              >
                {visibleData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={isPointHighlighted(entry) ? blue : faded}
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
                    : numeric.toLocaleString();
                  return [`${valueText} (${ratio.toFixed(1)}%)`, "Value"];
                }}
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
                onClick={(data: any) => {
                  const clickedX = data?.payload?.xRaw ?? data?.xRaw ?? data?.payload?.x ?? data?.x;
                  if (clickedX !== undefined) {
                    replaceSelection(view.xColumn, clickedX);
                  }
                }}
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={
                      hasSelection
                        ? isPointHighlighted(entry)
                          ? blue
                          : faded
                        : piePalette[index % piePalette.length]
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
              />
              <YAxis type="number" />
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
                stroke={blue}
                fill={blue}
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
                      fill={highlighted ? blue : faded}
                      opacity={!hasSelection || highlighted ? 1 : 0.3}
                      style={{ cursor: "pointer" }}
                      onClick={() =>
                        replaceSelection(view.xColumn, payload.xRaw ?? payload.x)
                      }
                    />
                  );
                }}
              />

              {hasSelection && (
                <Area
                  type="monotone"
                  dataKey="yHL"
                  stroke={blue}
                  fill={blue}
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
              />
              <YAxis type="number" />
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
                onClick={(data: any) => {
                  const clickedX = data?.payload?.xRaw ?? data?.xRaw ?? data?.payload?.x ?? data?.x;
                  if (clickedX !== undefined) {
                    replaceSelection(view.xColumn, clickedX);
                  }
                }}
              >
                {visibleData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={isPointHighlighted(entry) ? blue : faded}
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
                    : numeric.toLocaleString();
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
                onClick={(data: any) => {
                  const clickedX = data?.payload?.xRaw ?? data?.xRaw ?? data?.payload?.x ?? data?.x;
                  if (clickedX !== undefined) {
                    replaceSelection(view.xColumn, clickedX);
                  }
                }}
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={
                      hasSelection
                        ? isPointHighlighted(entry)
                          ? blue
                          : faded
                        : piePalette[index % piePalette.length]
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
  const { rawData } = useDataset();
  const { selection, rangeFilter, hasSelection } = useSelection();

  const { total, filtered, hasFilter } = React.useMemo(
    () => computeKPIValue(rawData ?? [], view, filter, selection, rangeFilter),
    [rawData, view, filter, selection, rangeFilter]
  );

  return (
    <div
      style={{ height }}
      className="h-full w-full flex flex-col items-center justify-center gap-1"
    >
      <span className="text-3xl font-bold tracking-tight text-primary">
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
  const { rawData, attributeTypes } = useDataset();
  const { selection, rangeFilter, replaceSelection, clearSelection, hasSelection } = useSelection();

  // Heavy computation: build grouped data WITHOUT selection dependency
  const { rows, groups } = React.useMemo(
    () => buildGroupedSeries(rawData ?? [], view, attributeTypes, filter),
    [rawData, view, attributeTypes, filter]
  );

  // Lightweight: compute which x values are highlighted
  const highlightedXValues = React.useMemo(() => {
    if (!hasSelection) return new Set<string>();
    const keys = new Set<string>();
    const rawFiltered = (rawData ?? []).filter((row: any) =>
      rowMatchesAttributeFilter(row, filter?.includeByColumn)
    );
    for (const row of rawFiltered) {
      if (rowMatchesSelection(row, selection, rangeFilter)) {
        const xRaw = getValueByPath(row, view.xColumn);
        if (xRaw != null) keys.add(String(xRaw));
      }
    }
    return keys;
  }, [rawData, view.xColumn, selection, rangeFilter, hasSelection, filter]);

  const chartConfig = React.useMemo(() => {
    const cfg: ChartConfig = {};
    groups.forEach((g, i) => {
      cfg[g] = {
        label: g,
        color: GROUP_PALETTE[i % GROUP_PALETTE.length],
      };
    });
    return cfg;
  }, [groups]);

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
            <XAxis dataKey="x" type="category" tick={{ fontSize: 11 }} />
            <YAxis type="number" />
            <ChartTooltip content={<ChartTooltipContent />} trigger="hover" />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              iconSize={10}
              iconType="square"
            />
            {groups.map((g, i) => (
              <Bar
                key={g}
                dataKey={g}
                fill={GROUP_PALETTE[i % GROUP_PALETTE.length]}
                stackId={stacked ? "a" : undefined}
                radius={stacked ? undefined : [2, 2, 0, 0]}
                isAnimationActive={false}
                activeBar={false}
                onClick={(data: any) => {
                  const clickedX = data?.payload?.xRaw ?? data?.xRaw ?? data?.payload?.x ?? data?.x;
                  if (clickedX !== undefined) {
                    replaceSelection(view.xColumn, clickedX);
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                {rows.map((row, idx) => (
                  <Cell
                    key={idx}
                    fill={GROUP_PALETTE[i % GROUP_PALETTE.length]}
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
  const { rawData, attributeTypes } = useDataset();
  const { selection, rangeFilter, replaceSelection, setBrushSelection, clearSelection, hasSelection } = useSelection();

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [brushStart, setBrushStart] = React.useState<{ x: number; y: number } | null>(null);
  const [brushEnd, setBrushEnd] = React.useState<{ x: number; y: number } | null>(null);
  const isDragging = React.useRef(false);

  const { data, groups } = React.useMemo(
    () =>
      buildColoredScatterSeries(
        rawData ?? [],
        view,
        selection,
        attributeTypes,
        filter,
        rangeFilter
      ),
    [rawData, view, selection, attributeTypes, filter, rangeFilter]
  );

  const chartConfig = React.useMemo(() => {
    const cfg: ChartConfig = {};
    groups.forEach((g, i) => {
      cfg[g] = {
        label: g,
        color: GROUP_PALETTE[i % GROUP_PALETTE.length],
      };
    });
    return cfg;
  }, [groups]);

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
      if (!el) return { dx: 0, dy: 0 };
      const w = el.clientWidth;
      const h = el.clientHeight;
      const plotW = w - SCATTER_MARGIN.left - SCATTER_MARGIN.right;
      const plotH = h - SCATTER_MARGIN.top - SCATTER_MARGIN.bottom;
      const dx =
        dataRange.xMin +
        ((px - SCATTER_MARGIN.left) / plotW) * (dataRange.xMax - dataRange.xMin);
      const dy =
        dataRange.yMax -
        ((py - SCATTER_MARGIN.top) / plotH) * (dataRange.yMax - dataRange.yMin);
      return { dx, dy };
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
      setBrushStart({ x, y });
      setBrushEnd({ x, y });
    },
    []
  );

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent) => {
      if (!brushStart) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const dx = Math.abs(x - brushStart.x);
      const dy = Math.abs(y - brushStart.y);
      if (dx > 5 || dy > 5) isDragging.current = true;
      setBrushEnd({ x, y });
    },
    [brushStart]
  );

  const handleMouseUp = React.useCallback(() => {
    if (!brushStart || !brushEnd) {
      setBrushStart(null);
      setBrushEnd(null);
      return;
    }

    if (!isDragging.current) {
      // Small movement = click, not brush. Clear brush state.
      setBrushStart(null);
      setBrushEnd(null);
      return;
    }

    // Convert pixel coords to data coords
    const p1 = pixelToData(brushStart.x, brushStart.y);
    const p2 = pixelToData(brushEnd.x, brushEnd.y);

    const xMin = Math.min(p1.dx, p2.dx);
    const xMax = Math.max(p1.dx, p2.dx);
    const yMin = Math.min(p1.dy, p2.dy);
    const yMax = Math.max(p1.dy, p2.dy);

    setBrushSelection({
      xColumn: view.xColumn,
      yColumn: view.yColumn,
      xMin,
      xMax,
      yMin,
      yMax,
    });

    setBrushStart(null);
    setBrushEnd(null);
  }, [brushStart, brushEnd, pixelToData, setBrushSelection, view.xColumn, view.yColumn]);

  if (!data.length) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
        No compatible data
      </div>
    );
  }

  const showBrushRect = brushStart && brushEnd && isDragging.current;

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
            />
            <ChartTooltip trigger="hover" content={<ChartTooltipContent />} />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              iconSize={10}
              iconType="circle"
            />
            {groups.map((g, i) => {
              const groupData = data.filter((d) => d.group === g);
              return (
                <Scatter
                  key={g}
                  name={g}
                  data={groupData}
                  fill={GROUP_PALETTE[i % GROUP_PALETTE.length]}
                  isAnimationActive={false}
                  onClick={(e: any) => {
                    if (isDragging.current) return;
                    const clickedX = e?.payload?.xRaw ?? e?.payload?.x;
                    if (clickedX !== undefined) {
                      replaceSelection(view.xColumn, clickedX);
                    }
                  }}
                >
                  {groupData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={GROUP_PALETTE[i % GROUP_PALETTE.length]}
                      opacity={!hasSelection || entry.highlighted ? 1 : 0.15}
                      style={{ cursor: "pointer" }}
                    />
                  ))}
                </Scatter>
              );
            })}
          </ScatterChart>
      </ChartContainer>

      {/* Brush selection rectangle */}
      {showBrushRect && (
        <div
          className="absolute pointer-events-none border border-blue-500/50 bg-blue-500/10 rounded-sm"
          style={{
            left: Math.min(brushStart.x, brushEnd.x),
            top: Math.min(brushStart.y, brushEnd.y),
            width: Math.abs(brushEnd.x - brushStart.x),
            height: Math.abs(brushEnd.y - brushStart.y),
          }}
        />
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
  const { rawData, attributeTypes } = useDataset();
  const { selection, rangeFilter, replaceSelection, setBrushSelection, clearSelection, hasSelection } = useSelection();

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [brushStart, setBrushStart] = React.useState<{ x: number; y: number } | null>(null);
  const [brushEnd, setBrushEnd] = React.useState<{ x: number; y: number } | null>(null);
  const isDragging = React.useRef(false);

  const blue = "#3b82f6";
  const faded = "#cbd5e1";

  const { data, xType } = React.useMemo(() => {
    return buildSeries(rawData ?? [], view, selection, attributeTypes, filter, rangeFilter);
  }, [rawData, view, selection, attributeTypes, filter, rangeFilter]);

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
      if (!el) return { dx: 0, dy: 0 };
      const w = el.clientWidth;
      const h = el.clientHeight;
      const plotW = w - SCATTER_MARGIN.left - SCATTER_MARGIN.right;
      const plotH = h - SCATTER_MARGIN.top - SCATTER_MARGIN.bottom;
      const dx =
        dataRange.xMin +
        ((px - SCATTER_MARGIN.left) / plotW) * (dataRange.xMax - dataRange.xMin);
      const dy =
        dataRange.yMax -
        ((py - SCATTER_MARGIN.top) / plotH) * (dataRange.yMax - dataRange.yMin);
      return { dx, dy };
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
      setBrushStart({ x, y });
      setBrushEnd({ x, y });
    },
    []
  );

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent) => {
      if (!brushStart) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const dx = Math.abs(x - brushStart.x);
      const dy = Math.abs(y - brushStart.y);
      if (dx > 5 || dy > 5) isDragging.current = true;
      setBrushEnd({ x, y });
    },
    [brushStart]
  );

  const handleMouseUp = React.useCallback(() => {
    if (!brushStart || !brushEnd) {
      setBrushStart(null);
      setBrushEnd(null);
      return;
    }

    if (!isDragging.current) {
      setBrushStart(null);
      setBrushEnd(null);
      return;
    }

    const p1 = pixelToData(brushStart.x, brushStart.y);
    const p2 = pixelToData(brushEnd.x, brushEnd.y);

    const xMin = Math.min(p1.dx, p2.dx);
    const xMax = Math.max(p1.dx, p2.dx);
    const yMin = Math.min(p1.dy, p2.dy);
    const yMax = Math.max(p1.dy, p2.dy);

    setBrushSelection({
      xColumn: view.xColumn,
      yColumn: view.yColumn,
      xMin,
      xMax,
      yMin,
      yMax,
    });

    setBrushStart(null);
    setBrushEnd(null);
  }, [brushStart, brushEnd, pixelToData, setBrushSelection, view.xColumn, view.yColumn]);

  if (!visibleData.length) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
        No compatible data
      </div>
    );
  }

  const showBrushRect = brushStart && brushEnd && isDragging.current;

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
            <XAxis type="number" dataKey="x" />
            <YAxis type="number" dataKey="y" />
            <ChartTooltip trigger="hover" content={<ChartTooltipContent />} />

            <Scatter
              data={visibleData}
              isAnimationActive={false}
              onClick={(e: any) => {
                if (isDragging.current) return;
                const clickedX = e?.payload?.xRaw ?? e?.payload?.x;
                if (clickedX !== undefined) {
                  replaceSelection(view.xColumn, clickedX);
                }
              }}
            >
              {visibleData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.highlighted ? blue : faded}
                  opacity={!hasSelection || entry.highlighted ? 1 : 0.15}
                  style={{ cursor: "pointer" }}
                />
              ))}
            </Scatter>
          </ScatterChart>
      </ChartContainer>

      {/* Brush selection rectangle */}
      {showBrushRect && (
        <div
          className="absolute pointer-events-none border border-blue-500/50 bg-blue-500/10 rounded-sm"
          style={{
            left: Math.min(brushStart.x, brushEnd.x),
            top: Math.min(brushStart.y, brushEnd.y),
            width: Math.abs(brushEnd.x - brushStart.x),
            height: Math.abs(brushEnd.y - brushStart.y),
          }}
        />
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
}: {
  view: Extract<View, { chartType: "TABLE" }>;
  height: number | "100%";
  filter?: ChartRendererFilter;
  replaceSelection: (column: string, value: any) => void;
}) {
  const { rawData } = useDataset();
  const { selection, rangeFilter, hasSelection } = useSelection();

  if (!Array.isArray(rawData) || rawData.length === 0) {
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
            const highlighted = rowMatchesSelection(row, selection, rangeFilter);

            return (
              <TableRow
                key={i}
                className={`cursor-pointer ${
                  hasSelection && !highlighted ? "opacity-40" : ""
                }`}
                onClick={() => {
                  const value = getValueByPath(row, columns[0]);
                  if (value !== undefined) {
                    replaceSelection(columns[0], value);
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
