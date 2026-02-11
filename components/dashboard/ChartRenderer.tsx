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
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell,
} from "recharts";

import type { View } from "@/types/dashboard";
import { useDataset } from "@/context/DatasetContext";
import { useSelection } from "@/context/SelectionContext";

/* =======================================================
   Types
======================================================= */

type GenericPoint = {
  x: any;
  y: any;
  highlighted: boolean;
};

/* =======================================================
   Utils
======================================================= */

function getValueByPath(row: any, path: string) {
  return path.split(".").reduce((acc, key) => {
    if (acc == null) return undefined;
    return acc[key];
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

function rowMatchesSelection(row: any, selection: any) {
  if (!selection || Object.keys(selection).length === 0) return true;

  return Object.entries(selection).every(([col, values]: any) => {
    if (!values || values.size === 0) return true;
    const val = getValueByPath(row, col);
    return values.has(val);
  });
}

function buildSeries(
  rawData: any[],
  view: Extract<View, { chartType: "BAR" | "LINE" | "SCATTER" }>,
  selection: any
): GenericPoint[] {
  if (!Array.isArray(rawData)) return [];

  return rawData
    .map((row) => {
      const xRaw = getValueByPath(row, view.xColumn);
      const yRaw = getValueByPath(row, view.yColumn);

      const xParsed = detectAndParse(xRaw);
      const yParsed = detectAndParse(yRaw);

      if (view.chartType === "SCATTER") {
        if (typeof xParsed !== "number" || typeof yParsed !== "number")
          return null;
      }

      if (view.chartType === "LINE" || view.chartType === "BAR") {
        if (typeof yParsed !== "number") return null;
      }

      return {
        x: xParsed instanceof Date ? xParsed.getTime() : xParsed,
        y: yParsed,
        highlighted: rowMatchesSelection(row, selection),
      };
    })
    .filter(Boolean) as GenericPoint[];
}

/* =======================================================
   Renderer
======================================================= */

export default function ChartRenderer({
  view,
  height = "100%",
}: {
  view: View;
  height?: number | "100%";
}) {
  const { rawData } = useDataset();
  const { selection, replaceSelection, hasSelection } = useSelection();

  const blue = "#3b82f6";
  const faded = "#cbd5e1";

  if (view.chartType === "TABLE") {
    return (
      <TableRenderer
        view={view}
        height={height}
        replaceSelection={replaceSelection}
      />
    );
  }

  const data = React.useMemo(() => {
    return buildSeries(rawData ?? [], view, selection);
  }, [rawData, view, selection]);

  const chartConfig = React.useMemo(
    () =>
      ({
        y: { label: view.yLabel ?? view.yColumn },
      } satisfies ChartConfig),
    [view.yLabel, view.yColumn]
  );

  if (!data.length) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
        No compatible data
      </div>
    );
  }

  const isNumericX = typeof data[0].x === "number";

  return (
    <div className="h-full w-full" style={{ height }}>
      <ChartContainer config={chartConfig} className="h-full w-full p-0">
        <ResponsiveContainer width="100%" height="100%">
          {view.chartType === "LINE" ? (
            <AreaChart data={data}>
              <CartesianGrid vertical={false} strokeOpacity={0.15} />
              <XAxis dataKey="x" type={isNumericX ? "number" : "category"} />
              <YAxis type="number" />
              <ChartTooltip content={<ChartTooltipContent />} />

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
                      onClick={() => replaceSelection(view.xColumn, payload.x)}
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
                  data={data.map((d) =>
                    d.highlighted ? d : { ...d, y: null }
                  )}
                />
              )}
            </AreaChart>
          ) : view.chartType === "BAR" ? (
            <BarChart data={data}>
              <CartesianGrid vertical={false} strokeOpacity={0.15} />
              <XAxis dataKey="x" type={isNumericX ? "number" : "category"} />
              <YAxis type="number" />
              <ChartTooltip content={<ChartTooltipContent />} />

              <Bar
                dataKey="y"
                onClick={(data: any) => {
                  const clickedX = data?.payload?.x;
                  if (clickedX !== undefined) {
                    replaceSelection(view.xColumn, clickedX);
                  }
                }}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.highlighted ? blue : faded}
                    opacity={!hasSelection || entry.highlighted ? 1 : 0.3}
                  />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <ScatterChart>
              <CartesianGrid vertical={false} strokeOpacity={0.15} />
              <XAxis type="number" dataKey="x" />
              <YAxis type="number" dataKey="y" />
              <ChartTooltip content={<ChartTooltipContent />} />

              <Scatter
                data={data}
                onClick={(e: any) => {
                  const clickedX = e?.payload?.x;
                  if (clickedX !== undefined) {
                    replaceSelection(view.xColumn, clickedX);
                  }
                }}
              >
                {data.map((entry, index) => (
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
  replaceSelection,
}: {
  view: Extract<View, { chartType: "TABLE" }>;
  height: number | "100%";
  replaceSelection: (column: string, value: any) => void;
}) {
  const { rawData } = useDataset();
  const { selection, hasSelection } = useSelection();

  if (!Array.isArray(rawData) || rawData.length === 0) {
    return <div>No data</div>;
  }

  return (
    <div style={{ height }} className="overflow-auto">
      <ShadTable>
        <TableHeader>
          <TableRow>
            {view.columns.map((col) => (
              <TableHead key={col}>{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rawData.map((row, i) => {
            const highlighted = rowMatchesSelection(row, selection);

            return (
              <TableRow
                key={i}
                className={`cursor-pointer ${
                  hasSelection && !highlighted ? "opacity-40" : ""
                }`}
                onClick={() => {
                  const value = getValueByPath(row, view.columns[0]);
                  if (value !== undefined) {
                    replaceSelection(view.columns[0], value);
                  }
                }}
              >
                {view.columns.map((col) => (
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
