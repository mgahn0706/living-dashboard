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
} from "recharts";
import { ChartType } from "@/types/dashboard";

/* =======================================================
   Types
======================================================= */

export type ChartRendererProps = {
  type: ChartType;
  x: number[];
  y: number[];
  height?: number | "100%";
  xLabel?: string;
  yLabel?: string;
};

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
   ChartRenderer
======================================================= */

export default function ChartRenderer({
  type,
  x,
  y,
  height = "100%",
  xLabel = "x",
  yLabel = "y",
}: ChartRendererProps) {
  const data = React.useMemo(() => buildSeries(x, y), [x, y]);

  const blue = "#3b82f6";

  const chartConfig = React.useMemo(
    () =>
      ({
        y: { label: yLabel },
      } satisfies ChartConfig),
    [yLabel]
  );

  if (data.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
        No data
      </div>
    );
  }

  /* ===================== TABLE ===================== */

  if (type === "TABLE") {
    return (
      <div className="h-full w-full p-2" style={{ height }}>
        <ShadTable className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>{xLabel}</TableHead>
              <TableHead>{yLabel}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, i) => (
              <TableRow key={i}>
                <TableCell>{row.x}</TableCell>
                <TableCell>{row.y}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </ShadTable>
      </div>
    );
  }

  /* ===================== CHART ===================== */

  return (
    <div className="h-full w-full" style={{ height }}>
      <ChartContainer config={chartConfig} className="h-full w-full p-0">
        <ResponsiveContainer width="100%" height="100%">
          {type === "LINE" ? (
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
                  value: xLabel,
                  position: "insideBottom",
                  offset: -2,
                  style: { fontSize: 10 },
                }}
              />

              <YAxis
                tick={false}
                axisLine={false}
                label={{
                  value: yLabel,
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
          ) : (
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
                  value: xLabel,
                  position: "insideBottom",
                  offset: -2,
                  style: { fontSize: 10 },
                }}
              />

              <YAxis
                tick={false}
                axisLine={false}
                label={{
                  value: yLabel,
                  angle: -90,
                  position: "insideLeft",
                  offset: 0,
                  style: { fontSize: 10 },
                }}
              />

              <ChartTooltip content={<ChartTooltipContent />} />

              <Bar dataKey="y" radius={[6, 6, 4, 4]} fill={blue} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}
