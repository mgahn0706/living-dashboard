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
} from "recharts";

import type { View } from "@/types/dashboard";
import { useDataset } from "@/context/DatasetContext";

/* =======================================================
   Types
======================================================= */

type DataPoint = {
  x: number;
  y: number;
};

/* =======================================================
   Utils
======================================================= */

function buildSeries(x: number[], y: number[]): DataPoint[] {
  const n = Math.min(x.length, y.length);
  return Array.from({ length: n }, (_, i) => ({
    x: x[i],
    y: y[i],
  }));
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
  const blue = "#3b82f6";

  /* =======================
     TABLE VIEW
  ======================== */

  if (view.chartType === "TABLE") {
    return <TableRenderer view={view} height={height} />;
  }

  /* =======================
     CHART VIEW
  ======================== */

  const data = React.useMemo(
    () => buildSeries(view.x, view.y),
    [view.x, view.y]
  );

  const chartConfig = React.useMemo(
    () =>
      ({
        y: { label: view.yLabel ?? "y" },
      } satisfies ChartConfig),
    [view.yLabel]
  );

  if (data.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
        No data
      </div>
    );
  }

  return (
    <div className="h-full w-full" style={{ height }}>
      <ChartContainer config={chartConfig} className="h-full w-full p-0">
        <ResponsiveContainer width="100%" height="100%">
          {view.chartType === "LINE" ? (
            /* ========== LINE ========== */
            <AreaChart
              data={data}
              margin={{ top: 4, right: 6, left: -8, bottom: 10 }}
            >
              <defs>
                <linearGradient id="fillBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={blue} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={blue} stopOpacity={0.06} />
                </linearGradient>
              </defs>

              <CartesianGrid vertical={false} strokeOpacity={0.15} />

              <XAxis
                dataKey="x"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                label={{
                  value: view.xLabel ?? "x",
                  position: "insideBottom",
                  offset: -2,
                  style: { fontSize: 10 },
                }}
              />

              <YAxis
                tick={false}
                axisLine={false}
                label={{
                  value: view.yLabel ?? "y",
                  angle: -90,
                  position: "insideLeft",
                  offset: 0,
                  style: { fontSize: 10 },
                }}
              />

              <ChartTooltip content={<ChartTooltipContent />} />

              <Area
                type="monotone"
                dataKey="y"
                stroke={blue}
                strokeWidth={2}
                fill="url(#fillBlue)"
                dot={false}
              />
            </AreaChart>
          ) : view.chartType === "BAR" ? (
            /* ========== BAR ========== */
            <BarChart
              data={data}
              barCategoryGap={14}
              margin={{ top: 4, right: 6, left: -8, bottom: 10 }}
            >
              <CartesianGrid vertical={false} strokeOpacity={0.15} />

              <XAxis
                dataKey="x"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                label={{
                  value: view.xLabel ?? "x",
                  position: "insideBottom",
                  offset: -2,
                  style: { fontSize: 10 },
                }}
              />

              <YAxis
                tick={false}
                axisLine={false}
                label={{
                  value: view.yLabel ?? "y",
                  angle: -90,
                  position: "insideLeft",
                  offset: 0,
                  style: { fontSize: 10 },
                }}
              />

              <ChartTooltip content={<ChartTooltipContent />} />

              <Bar dataKey="y" radius={[6, 6, 4, 4]} fill={blue} />
            </BarChart>
          ) : (
            /* ========== SCATTER ========== */
            <ScatterChart margin={{ top: 4, right: 6, left: -8, bottom: 10 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.15} />

              <XAxis
                type="number"
                dataKey="x"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                label={{
                  value: view.xLabel ?? "x",
                  position: "insideBottom",
                  offset: -2,
                  style: { fontSize: 10 },
                }}
              />

              <YAxis
                type="number"
                dataKey="y"
                tick={false}
                axisLine={false}
                label={{
                  value: view.yLabel ?? "y",
                  angle: -90,
                  position: "insideLeft",
                  offset: 0,
                  style: { fontSize: 10 },
                }}
              />

              <ChartTooltip content={<ChartTooltipContent />} />

              <Scatter data={data} fill={blue} />
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
}: {
  view: Extract<View, { chartType: "TABLE" }>;
  height: number | "100%";
}) {
  const { rawData } = useDataset();

  if (!Array.isArray(rawData) || rawData.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
        No data
      </div>
    );
  }

  return (
    <div className="h-full w-full p-2 overflow-auto" style={{ height }}>
      <ShadTable className="text-xs">
        <TableHeader>
          <TableRow>
            {view.columns.map((col) => (
              <TableHead key={col}>{col}</TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {rawData.map((row, i) => (
            <TableRow key={i}>
              {view.columns.map((col) => (
                <TableCell key={col}>
                  {col
                    .split(".")
                    .reduce<any>(
                      (acc, k) => (acc == null ? undefined : acc[k]),
                      row
                    )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </ShadTable>
    </div>
  );
}
