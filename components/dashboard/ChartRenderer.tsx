"use client";

import * as React from "react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
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
  LineChart,
  Line,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { ChartType } from "@/types/dashboard";

export type ChartRendererProps = {
  type: ChartType;
  x: number[];
  y: number[];
  height?: number | "100%";
  xLabel?: string;
  yLabel?: string;
};

function toSeries(x: number[], y: number[]) {
  const n = Math.min(x.length, y.length);
  return Array.from({ length: n }, (_, i) => ({
    x: x[i],
    y: y[i],
  }));
}

export default function ChartRenderer({
  type,
  x,
  y,
  height = "100%",
  xLabel = "x",
  yLabel = "y",
}: ChartRendererProps) {
  const data = React.useMemo(() => toSeries(x, y), [x, y]);

  const chartConfig = React.useMemo(
    () =>
      ({
        y: { label: yLabel },
      } as const),
    [yLabel]
  );

  if (!data.length) {
    return (
      <div className="h-full w-full rounded-md border bg-background flex items-center justify-center text-xs text-muted-foreground">
        No data
      </div>
    );
  }

  if (type === "TABLE") {
    return (
      <div className="h-full w-full overflow-auto rounded-md border bg-background">
        <ShadTable>
          <TableHeader>
            <TableRow>
              <TableHead>{xLabel}</TableHead>
              <TableHead>{yLabel}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, idx) => (
              <TableRow key={idx}>
                <TableCell>{row.x}</TableCell>
                <TableCell>{row.y}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </ShadTable>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden rounded-md border bg-background">
      <ChartContainer
        config={chartConfig}
        className="h-full w-full"
        style={{ height }}
      >
        {type === "LINE" ? (
          <LineChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="x" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="y" dot={false} strokeWidth={2} />
          </LineChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="x" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="y" radius={4} />
          </BarChart>
        )}
      </ChartContainer>
    </div>
  );
}
