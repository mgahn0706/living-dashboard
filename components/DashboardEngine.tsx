"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";
import { InteractiveChartData, DataPoint } from "@/types/types";
import { useLayoutContext } from "@/context/InteractionContext";
import { UniversalChart } from "./charts/UniversalChart";
import { InteractionWrapper } from "./InteractionWrapper";

// ... [getGridSpan helper remains same] ...
const getGridSpan = (index: number, pattern: string) => {
  if (pattern === "FOCUS") {
    if (index === 0) return "md:col-span-3 md:row-span-2 h-[450px] md:h-auto";
    return "col-span-1 h-[250px] md:h-auto";
  }
  if (pattern === "COMPARISON") {
    if (index < 2) return "md:col-span-2 md:row-span-2 h-[400px] md:h-auto";
    return "col-span-1 h-[250px] md:h-auto";
  }
  return "col-span-1 h-[300px]";
};

const adaptData = (genericData: DataPoint[]): InteractiveChartData[] => {
  return genericData.map((d, i) => ({
    date: d.name || new Date(2023, 0, i).toISOString(),
    desktop: d.value,
    mobile: Math.floor(d.value * 0.6),
    mw: i + 1,
  }));
};

export const DashboardEngine = () => {
  // FIX: This hook does NOT emit when scores update. Only layout/order.
  const {
    pattern,
    pendingPattern,
    sortedCharts,
    confirmLayout,
    hasPendingUpdate,
  } = useLayoutContext();

  if (!sortedCharts.length) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No charts active.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full p-2 relative">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-lg font-semibold tracking-tight">
          Analytics Overview
        </h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Current:{" "}
          <span className="font-mono font-bold text-foreground">{pattern}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-20">
        {sortedCharts.map((chart, index) => {
          const isHero =
            (pattern === "FOCUS" && index === 0) ||
            (pattern === "COMPARISON" && index < 2);

          return (
            <InteractionWrapper
              key={chart.id}
              chartId={chart.id}
              index={index}
              isHero={isHero}
              className={getGridSpan(index, pattern)}
            >
              <UniversalChart
                title={chart.title}
                color={chart.color}
                type={chart.chartType}
                data={adaptData(chart.data)}
              />
            </InteractionWrapper>
          );
        })}
      </div>

      {hasPendingUpdate && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-foreground text-background px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 border border-white/20">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground/80 uppercase tracking-wider">
                Dashboard Update Ready
              </span>
              <span className="text-sm font-bold flex items-center gap-2">
                {pattern !== pendingPattern
                  ? `Switch to ${pendingPattern} View`
                  : "Reorder Charts based on Interest"}
              </span>
            </div>

            <Button
              onClick={confirmLayout}
              size="sm"
              className="rounded-full px-6 font-bold bg-background text-foreground hover:bg-background/90"
            >
              Apply <RefreshCcw className="ml-2 h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
