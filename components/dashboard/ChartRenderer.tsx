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
  ResponsiveContainer,
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
import { useSelection } from "@/context/SelectionContext";

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
    // If the column is known as date, treat numeric epochs as date.
    if (hint === "date") {
      const ms =
        Math.abs(n) < 3e10 // ~year 2960 in seconds
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
  const numericValues: number[] = [];

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
      numericValues.push(n);
    }
  }

  const ratio = filtered.length * 0.6;
  if (dateStringCount >= ratio) return "date";

  if (numberCount >= ratio && numericValues.length) {
    return "number";
  }

  return "category";
}

function resolveXType(points: GenericPoint[]) {
  if (!points.length) return "category" as const;
  const allDate = points.every((p) => p.xType === "date");
  if (allDate) return "date" as const;
  const allNumber = points.every((p) => p.xType === "number");
  if (allNumber) return "number" as const;
  return "category" as const;
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

function rowMatchesSelection(row: any, selection: any) {
  if (!selection || Object.keys(selection).length === 0) return true;

  return Object.entries(selection).every(([col, values]: any) => {
    if (!values || values.size === 0) return true;
    const val = getValueByPath(row, col);
    return values.has(val);
  });
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
  filter?: ChartRendererFilter
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
        highlighted: rowMatchesSelection(row, selection),
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
  filter?: ChartRendererFilter
): GroupedSeriesResult {
  if (!Array.isArray(rawData) || !view.groupByColumn) {
    return { rows: [], groups: [], xLabels: [] };
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

  return { rows, groups, xLabels };
}

/* ---- KPI value computation ---- */

function computeKPIValue(
  rawData: any[],
  view: ChartView,
  filter?: ChartRendererFilter
): number {
  if (!Array.isArray(rawData)) return 0;

  let data = rawData;
  if (filter?.includeByColumn) {
    data = data.filter((row) =>
      rowMatchesAttributeFilter(row, filter.includeByColumn)
    );
  }

  const agg = view.aggregation || "sum";
  if (agg === "count") return data.length;

  const values = data
    .map((row) => {
      const val = getValueByPath(row, view.yColumn);
      return typeof val === "number" ? val : Number(val);
    })
    .filter((v) => !Number.isNaN(v));

  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  if (agg === "avg") return sum / values.length;
  return sum;
}

/* ---- Scatter with color-by column ---- */

type ColoredPoint = GenericPoint & { group: string };

function buildColoredScatterSeries(
  rawData: any[],
  view: ChartView,
  selection: any,
  attributeTypes: Record<string, "string" | "number" | "date" | "unknown">,
  filter?: ChartRendererFilter
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
      highlighted: rowMatchesSelection(row, selection),
      xRaw,
      xType: "number",
      group,
    });
  });

  return { data: points, groups: Array.from(groupSet).sort() };
}

/* =======================================================
   Renderer
======================================================= */

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
   Main Renderer
======================================================= */

export default function ChartRenderer({
  view,
  height = "100%",
  filter,
}: {
  view: View;
  height?: number | "100%";
  filter?: ChartRendererFilter;
}) {
  const { rawData, attributeTypes } = useDataset();
  const { selection, replaceSelection, hasSelection } = useSelection();

  const blue = "#3b82f6";
  const faded = "#cbd5e1";
  const piePalette = GROUP_PALETTE;

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
      <KPIRenderer view={view} height={height} filter={filter} />
    );
  }

  /* ---- STACKED_BAR / GROUPED_BAR ---- */
  if (
    (view.chartType === "STACKED_BAR" || view.chartType === "GROUPED_BAR") &&
    view.groupByColumn
  ) {
    return (
      <GroupedBarRenderer
        view={view}
        height={height}
        filter={filter}
        stacked={view.chartType === "STACKED_BAR"}
      />
    );
  }

  /* ---- SCATTER with colorByColumn ---- */
  if (view.chartType === "SCATTER" && view.colorByColumn) {
    return (
      <ColoredScatterRenderer view={view} height={height} filter={filter} />
    );
  }

  /* ---- Standard single-series charts ---- */
  const { data, xType } = React.useMemo(() => {
    return buildSeries(rawData ?? [], view, selection, attributeTypes, filter);
  }, [rawData, view, selection, attributeTypes, filter]);

  const visibleData = React.useMemo(
    () => applyChartViewFilter(data, filter),
    [data, filter]
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
        y: { label: view.yLabel ?? view.yColumn },
      } satisfies ChartConfig),
    [view.yLabel, view.yColumn]
  );

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
      }));

    return (
      <div className="h-full w-full" style={{ height }}>
        <ChartContainer config={chartConfig} className="h-full w-full p-0">
          <ResponsiveContainer width="100%" height="100%">
            <FunnelChart>
              <Tooltip
                formatter={(value: any) => [
                  Number(value).toLocaleString(),
                  "Count",
                ]}
              />
              <Funnel dataKey="value" data={funnelData} isAnimationActive={false}>
                <LabelList
                  position="right"
                  fill="#666"
                  stroke="none"
                  dataKey="name"
                  fontSize={11}
                />
                {funnelData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    );
  }

  /* ---- HORIZONTAL_BAR ---- */
  if (view.chartType === "HORIZONTAL_BAR") {
    return (
      <div className="h-full w-full" style={{ height }}>
        <ChartContainer config={chartConfig} className="h-full w-full p-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visibleData} layout="vertical">
              <CartesianGrid horizontal={false} strokeOpacity={0.15} />
              <XAxis type="number" />
              <YAxis
                dataKey="x"
                type="category"
                width={100}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="y">
                {visibleData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.highlighted ? blue : faded}
                    opacity={!hasSelection || entry.highlighted ? 1 : 0.3}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    );
  }

  /* ---- DONUT ---- */
  if (view.chartType === "DONUT") {
    return (
      <div className="h-full w-full" style={{ height }}>
        <ChartContainer config={chartConfig} className="h-full w-full p-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <ChartTooltip
                content={<ChartTooltipContent />}
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
                labelLine={false}
                label={({ percent }: any) =>
                  percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : ""
                }
                onClick={(data: any) => {
                  const clickedX = data?.xRaw ?? data?.x;
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
                        ? entry.highlighted
                          ? blue
                          : faded
                        : piePalette[index % piePalette.length]
                    }
                    stroke="#ffffff"
                    strokeWidth={1}
                    opacity={!hasSelection || entry.highlighted ? 1 : 0.3}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>
    );
  }

  /* ---- Original chart types: LINE, BAR, PIE, SCATTER ---- */
  return (
    <div className="h-full w-full" style={{ height }}>
      <ChartContainer config={chartConfig} className="h-full w-full p-0">
        <ResponsiveContainer width="100%" height="100%">
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
                  const highlighted = payload.highlighted;

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
                  dataKey="y"
                  stroke={blue}
                  fill={blue}
                  strokeWidth={3}
                  strokeOpacity={1}
                  fillOpacity={0.2}
                  isAnimationActive={false}
                  data={visibleData.map((d) =>
                    d.highlighted ? d : { ...d, y: null }
                  )}
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
                labelFormatter={
                  xType === "date"
                    ? (_label: any, payload: any) =>
                        formatDateTick(payload?.[0]?.payload?.x)
                    : undefined
                }
              />

              <Bar
                dataKey="y"
                onClick={(data: any) => {
                  const clickedX = data?.payload?.xRaw ?? data?.payload?.x;
                  if (clickedX !== undefined) {
                    replaceSelection(view.xColumn, clickedX);
                  }
                }}
              >
                {visibleData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.highlighted ? blue : faded}
                    opacity={!hasSelection || entry.highlighted ? 1 : 0.3}
                  />
                ))}
              </Bar>
            </BarChart>
          ) : view.chartType === "PIE" ? (
            <PieChart>
              <ChartTooltip
                content={<ChartTooltipContent />}
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
                labelLine={false}
                label={({ percent }: any) =>
                  percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : ""
                }
                onClick={(data: any) => {
                  const clickedX = data?.xRaw ?? data?.x;
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
                        ? entry.highlighted
                          ? blue
                          : faded
                        : piePalette[index % piePalette.length]
                    }
                    stroke="#ffffff"
                    strokeWidth={1}
                    opacity={!hasSelection || entry.highlighted ? 1 : 0.3}
                  />
                ))}
              </Pie>
            </PieChart>
          ) : (
            <ScatterChart>
              <CartesianGrid vertical={false} strokeOpacity={0.15} />
              <XAxis type="number" dataKey="x" />
              <YAxis type="number" dataKey="y" />
              <ChartTooltip content={<ChartTooltipContent />} />

              <Scatter
                data={visibleData}
                onClick={(e: any) => {
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
                    opacity={!hasSelection || entry.highlighted ? 1 : 0.3}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          )}
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}

/* =======================================================
   KPI Renderer
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

  const value = React.useMemo(
    () => computeKPIValue(rawData ?? [], view, filter),
    [rawData, view, filter]
  );

  return (
    <div
      style={{ height }}
      className="h-full w-full flex flex-col items-center justify-center gap-1"
    >
      <span className="text-3xl font-bold tracking-tight text-primary">
        {formatKPIValue(value, view.yLabel)}
      </span>
    </div>
  );
}

/* =======================================================
   Grouped / Stacked Bar Renderer
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

  const { rows, groups } = React.useMemo(
    () => buildGroupedSeries(rawData ?? [], view, attributeTypes, filter),
    [rawData, view, attributeTypes, filter]
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

  if (!rows.length) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
        No compatible data
      </div>
    );
  }

  return (
    <div className="h-full w-full" style={{ height }}>
      <ChartContainer config={chartConfig} className="h-full w-full p-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows}>
            <CartesianGrid vertical={false} strokeOpacity={0.15} />
            <XAxis dataKey="x" type="category" tick={{ fontSize: 11 }} />
            <YAxis type="number" />
            <ChartTooltip content={<ChartTooltipContent />} />
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
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}

/* =======================================================
   Colored Scatter Renderer
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
  const { selection, replaceSelection, hasSelection } = useSelection();

  const { data, groups } = React.useMemo(
    () =>
      buildColoredScatterSeries(
        rawData ?? [],
        view,
        selection,
        attributeTypes,
        filter
      ),
    [rawData, view, selection, attributeTypes, filter]
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

  if (!data.length) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
        No compatible data
      </div>
    );
  }

  const groupColorMap = new Map<string, string>();
  groups.forEach((g, i) => {
    groupColorMap.set(g, GROUP_PALETTE[i % GROUP_PALETTE.length]);
  });

  return (
    <div className="h-full w-full" style={{ height }}>
      <ChartContainer config={chartConfig} className="h-full w-full p-0">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart>
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
            <ChartTooltip content={<ChartTooltipContent />} />
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
                  onClick={(e: any) => {
                    const clickedX = e?.payload?.xRaw ?? e?.payload?.x;
                    if (clickedX !== undefined) {
                      replaceSelection(view.xColumn, clickedX);
                    }
                  }}
                />
              );
            })}
          </ScatterChart>
        </ResponsiveContainer>
      </ChartContainer>
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
  const { selection, hasSelection } = useSelection();

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
    <div style={{ height }} className="overflow-auto">
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
            const highlighted = rowMatchesSelection(row, selection);

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
