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
} from "recharts";

import type { View, ViewFilter } from "@/types/dashboard";
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

    // Heuristic: treat large epoch-like numbers as dates.
    const abs = Math.abs(n);
    const looksLikeSeconds = abs >= 1e9 && abs < 5e10;
    const looksLikeMs = abs >= 1e11 && abs < 5e13;
    if (looksLikeSeconds || looksLikeMs) {
      const ms = looksLikeSeconds ? n * 1000 : n;
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
    const sorted = [...numericValues].map((v) => Math.abs(v)).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const looksLikeSeconds = median >= 1e9 && median < 5e10;
    const looksLikeMs = median >= 1e11 && median < 5e13;
    if (looksLikeSeconds || looksLikeMs) return "date";
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

function buildSeries(
  rawData: any[],
  view: Extract<View, { chartType: "BAR" | "LINE" | "SCATTER" | "PIE" }>,
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

      if (
        view.chartType === "LINE" ||
        view.chartType === "BAR" ||
        view.chartType === "PIE"
      ) {
        if (typeof yParsed !== "number") return null;
      }

      return {
        x: xParsed.x as number | string,
        y: yParsed,
        highlighted: rowMatchesSelection(row, selection),
        xRaw: xParsed.xRaw,
        xType: xParsed.xType,
      };
    })
    .filter(Boolean) as GenericPoint[];

  const xType = inferredXType;

  // 🔥 Aggregate for LINE, BAR and PIE
  if (
    view.chartType === "LINE" ||
    view.chartType === "BAR" ||
    view.chartType === "PIE"
  ) {
    const grouped = new Map<any, GenericPoint>();

    for (const point of mapped) {
      if (!grouped.has(point.x)) {
        grouped.set(point.x, { ...point });
      } else {
        const existing = grouped.get(point.x)!;
        existing.y += point.y; // sum aggregation
        existing.highlighted = existing.highlighted || point.highlighted; // preserve highlight
      }
    }

    const aggregated = Array.from(grouped.values());
    if (xType === "date" || xType === "number") {
      aggregated.sort((a, b) => Number(a.x) - Number(b.x));
    }

    return { data: aggregated, xType };
  }

  return { data: mapped, xType };
}

/* =======================================================
   Renderer
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

  const { data, xType } = React.useMemo(() => {
    return buildSeries(rawData ?? [], view, selection, attributeTypes, filter);
  }, [rawData, view, selection, attributeTypes, filter]);
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

  if (!visibleData.length) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
        No compatible data
      </div>
    );
  }

  const isNumericX = xType === "number" || xType === "date";

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

              {/* Base Line */}
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

              {/* Highlight Overlay */}
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
              <ChartTooltip content={<ChartTooltipContent />} />
              <Pie
                data={visibleData}
                dataKey="y"
                nameKey="x"
                onClick={(data: any) => {
                  const clickedX = data?.xRaw ?? data?.x;
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
