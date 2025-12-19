"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, ArrowUpRight } from "lucide-react";
import { InteractiveChartData, ChartType } from "@/types/types";

const chartConfig = {
  desktop: {
    label: "Primary",
    color: "hsl(var(--primary))",
  },
  mobile: {
    label: "Secondary",
    color: "#94a3b8",
  },
} satisfies ChartConfig;

interface UniversalChartProps {
  title: string;
  data: InteractiveChartData[];
  type?: ChartType;
  color?: string;
}

export function UniversalChart({
  title,
  data,
  type = "area",
  color,
}: UniversalChartProps) {
  // Calculate a mock total for display
  const total = React.useMemo(
    () => data.reduce((acc, cur) => acc + (cur.desktop || 0), 0),
    [data]
  );

  const primaryColor = color || "hsl(var(--primary))";

  return (
    <Card className="group h-full flex flex-col border-0 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] bg-white overflow-hidden transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
      {/* Header */}
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-0 px-6 pt-6">
        <div className="space-y-1">
          <CardTitle className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
            {title}
          </CardTitle>
          <CardDescription className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {type} Analysis
          </CardDescription>
        </div>

        {/* KPI Display */}
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1">
            <span className="text-lg font-bold text-slate-900">
              {total.toLocaleString()}
            </span>
          </div>
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 h-5 bg-green-50 text-green-700 hover:bg-green-100 border-0 gap-1"
          >
            <TrendingUp className="h-3 w-3" /> +2.4%
          </Badge>
        </div>
      </CardHeader>

      {/* Chart */}
      <CardContent className="flex-1 min-h-0 px-0 pb-0 relative">
        <ChartContainer
          config={chartConfig}
          className="h-full w-full absolute inset-0"
        >
          {(() => {
            switch (type) {
              case "bar":
                return (
                  <BarChart
                    data={data}
                    margin={{ top: 20, right: 0, bottom: 0, left: -20 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      strokeDasharray="3 3"
                      stroke="#f1f5f9"
                    />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      fontSize={10}
                      tick={{ fill: "#cbd5e1" }}
                      tickFormatter={(val) => val.slice(0, 3)}
                    />
                    <ChartTooltip
                      cursor={{ fill: "#f8fafc" }}
                      content={
                        <ChartTooltipContent
                          className="bg-white border-0 shadow-xl ring-1 ring-black/5 rounded-xl"
                          indicator="dashed"
                        />
                      }
                    />
                    <Bar
                      dataKey="desktop"
                      fill={primaryColor}
                      radius={[6, 6, 0, 0]}
                      barSize={40}
                      fillOpacity={0.9}
                    />
                  </BarChart>
                );

              case "line":
                return (
                  <LineChart
                    data={data}
                    margin={{ top: 20, right: 20, bottom: 5, left: -20 }}
                  >
                    <CartesianGrid
                      vertical={false}
                      strokeDasharray="3 3"
                      stroke="#f1f5f9"
                    />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      fontSize={10}
                      tick={{ fill: "#cbd5e1" }}
                      tickFormatter={(val) => val.slice(0, 3)}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          className="bg-white border-0 shadow-xl ring-1 ring-black/5 rounded-xl"
                          indicator="line"
                        />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="desktop"
                      stroke={primaryColor}
                      strokeWidth={3}
                      dot={false}
                      activeDot={{
                        r: 6,
                        fill: "white",
                        stroke: primaryColor,
                        strokeWidth: 3,
                      }}
                    />
                  </LineChart>
                );

              case "area":
              default:
                return (
                  <AreaChart
                    data={data}
                    margin={{ top: 20, right: 0, bottom: 0, left: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id={`fill-${title}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={primaryColor}
                          stopOpacity={0.15}
                        />
                        <stop
                          offset="100%"
                          stopColor={primaryColor}
                          stopOpacity={0.0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      strokeDasharray="3 3"
                      stroke="#f1f5f9"
                    />
                    <XAxis dataKey="date" hide />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          className="bg-white border-0 shadow-xl ring-1 ring-black/5 rounded-xl"
                          indicator="dot"
                        />
                      }
                    />
                    <Area
                      dataKey="desktop"
                      type="natural"
                      fill={`url(#fill-${title})`}
                      stroke={primaryColor}
                      strokeWidth={2.5}
                      stackId="a"
                    />
                  </AreaChart>
                );
            }
          })()}
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
