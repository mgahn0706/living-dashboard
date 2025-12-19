"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

// Corrected Import

const chartConfig = {
  goals: {
    label: "Goals",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

interface ChartBarProps {
  data: {
    team: string;
    goals: number;
    fill: string;
  }[];
  className?: string;
}

export function ChartBarInteractive({ data, className }: ChartBarProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Top Scoring Teams</CardTitle>
        <CardDescription>Most goals scored this season</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
          <BarChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="team"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar dataKey="goals" fill="var(--color-goals)" radius={8} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
