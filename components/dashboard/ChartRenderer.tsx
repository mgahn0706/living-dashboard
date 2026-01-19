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

  const blue = "#3b82f6"; // blue-500

  const chartConfig = React.useMemo(
    () =>
      ({
        y: { label: yLabel },
      } satisfies ChartConfig),
    [yLabel]
  );

  if (data.length === 0) {
    return (
      <div className="h-full w-full rounded-md border bg-background flex items-center justify-center text-xs text-muted-foreground">
        No data
      </div>
    );
  }

  /* ===================== TABLE ===================== */

  if (type === "TABLE") {
    return (
      <div
        className="h-full w-full rounded-md border bg-background p-3"
        style={{ height }}
      >
        <ShadTable className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="text-muted-foreground">{xLabel}</TableHead>
              <TableHead className="text-muted-foreground">{yLabel}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, i) => (
              <TableRow key={i}>
                <TableCell className="py-1">{row.x}</TableCell>
                <TableCell className="py-1">{row.y}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </ShadTable>
      </div>
    );
  }

  /* ===================== CHART ===================== */

  return (
    <div
      className="h-full w-full rounded-md border bg-background"
      style={{ height }}
    >
      <ChartContainer
        config={chartConfig}
        className="h-full w-full px-4 pt-3 pb-2"
      >
        {type === "LINE" ? (
          <>
            <AreaChart
              data={data}
              margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="fillBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={blue} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={blue} stopOpacity={0.06} />
                </linearGradient>
              </defs>

              <CartesianGrid
                vertical={false}
                strokeDasharray="2 6"
                strokeOpacity={0.15}
              />

              <XAxis
                dataKey="x"
                tickLine={false}
                axisLine={false}
                tick={{
                  fontSize: 11,
                  fill: "hsl(var(--muted-foreground))",
                }}
              />

              <YAxis tick={false} tickLine={false} axisLine={false} />

              <ChartTooltip content={<ChartTooltipContent />} />

              <Area
                type="monotone"
                dataKey="y"
                stroke={blue}
                strokeWidth={2.2}
                fill="url(#fillBlue)"
                dot={false}
              />
            </AreaChart>
          </>
        ) : (
          <BarChart
            data={data}
            barCategoryGap={14}
            margin={{ top: 8, right: 8, left: -10, bottom: 0 }}
          >
            <CartesianGrid vertical={false} strokeOpacity={0.15} />

            <XAxis
              dataKey="x"
              tickLine={false}
              axisLine={false}
              tick={{
                fontSize: 11,
                fill: "hsl(var(--muted-foreground))",
              }}
            />

            <YAxis tick={false} tickLine={false} axisLine={false} />

            <ChartTooltip content={<ChartTooltipContent />} />

            <Bar
              dataKey="y"
              radius={[6, 6, 4, 4]}
              fill={blue}
              fillOpacity={0.9}
            />
          </BarChart>
        )}
      </ChartContainer>
    </div>
  );
}
