"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InteractiveChartData } from "@/types/types";

// ... [useIsMobile hook remains same] ...
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

const chartConfig = {
  desktop: {
    label: "Metric A",
    color: "hsl(var(--chart-1))",
  },
  mobile: {
    label: "Metric B",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;

// FIX: Use the imported type instead of inline definition
interface ChartProps {
  title: string;
  data: InteractiveChartData[];
  color?: string;
}

export function ChartAreaInteractive({ title, data, color }: ChartProps) {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("all");

  const filteredData = React.useMemo(() => {
    if (timeRange === "all") return data;
    const days = timeRange === "90d" ? 90 : 30;
    return data.slice(-days);
  }, [data, timeRange]);

  return (
    <Card className="h-full flex flex-col overflow-hidden border-0 shadow-none bg-background/50 backdrop-blur-sm">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1 text-center sm:text-left">
          <CardTitle>{title}</CardTitle>
          <CardDescription>Historical trend analysis</CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[120px] rounded-lg sm:ml-auto">
            <SelectValue placeholder="All Time" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="90d">Last 3 mos</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6 flex-1 min-h-0">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-full w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient
                id={`fillDesktop-${title}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={color || "var(--color-desktop)"}
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor={color || "var(--color-desktop)"}
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              opacity={0.5}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(val) => {
                try {
                  return new Date(val).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                } catch {
                  return val;
                }
              }}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Area
              dataKey="desktop"
              type="natural"
              fill={`url(#fillDesktop-${title})`}
              stroke={color || "var(--color-desktop)"}
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
