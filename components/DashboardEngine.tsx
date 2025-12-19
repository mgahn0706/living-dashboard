"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCcw, LayoutDashboard } from "lucide-react";
import { InteractiveChartData, DataPoint } from "@/types/types";

import { motion, AnimatePresence } from "framer-motion";
import { useLayoutContext } from "@/context/InteractionContext";
import { UniversalChart } from "./charts/UniversalChart";
import { InteractionWrapper } from "./InteractionWrapper";

// --- Helpers ---
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
// --- Animation Config ---
const springTransition = {
  type: "spring" as const, // <--- Add 'as const' here
  stiffness: 350,
  damping: 30,
  mass: 1,
};

export const DashboardEngine = () => {
  const {
    pattern,
    pendingPattern,
    sortedCharts,
    confirmLayout,
    hasPendingUpdate,
  } = useLayoutContext();

  if (!sortedCharts.length) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-2 text-muted-foreground">
        <div className="h-12 w-12 rounded-full bg-muted/20 flex items-center justify-center">
          <LayoutDashboard className="h-6 w-6 opacity-50" />
        </div>
        <p>No active charts</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-full p-2 relative">
      <div className="flex justify-between items-center px-1">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Analytics Overview
          </h2>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            Current Mode:
            <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              {pattern}
            </span>
          </div>
        </div>
      </div>

      {/* layoutRoot: specific optimization for Grid layouts in Framer Motion.
        It helps avoid distortion during the transform.
      */}
      <motion.div
        layoutRoot
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-24"
      >
        <AnimatePresence mode="popLayout">
          {sortedCharts.map((chart, index) => {
            const isHero =
              (pattern === "FOCUS" && index === 0) ||
              (pattern === "COMPARISON" && index < 2);

            return (
              <motion.div
                key={chart.id} // Key MUST be the unique ID, not index
                layout // <--- THE MAGIC PROP: Enables automatic layout animation
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={springTransition}
                className={getGridSpan(index, pattern)}
                style={{ zIndex: isHero ? 10 : 1 }} // Ensure heroes float above during animation
              >
                <InteractionWrapper
                  chartId={chart.id}
                  index={index}
                  isHero={isHero}
                  className="h-full" // Wrapper fills the motion div
                >
                  <UniversalChart
                    title={chart.title}
                    color={chart.color}
                    type={chart.chartType}
                    data={adaptData(chart.data)}
                  />
                </InteractionWrapper>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {/* Floating Banner Animation */}
      <AnimatePresence>
        {hasPendingUpdate && (
          <motion.div
            initial={{ y: 50, opacity: 0, x: "-50%" }}
            animate={{ y: 0, opacity: 1, x: "-50%" }}
            exit={{ y: 50, opacity: 0, x: "-50%" }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="fixed bottom-10 left-1/2 z-50"
          >
            <div className="bg-slate-900 text-white pl-6 pr-2 py-2 rounded-full shadow-2xl flex items-center gap-6 border border-white/10">
              <div className="flex flex-col py-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Optimization Ready
                </span>
                <span className="text-sm font-bold flex items-center gap-2">
                  {pattern !== pendingPattern
                    ? `Switch to ${pendingPattern}`
                    : "Reorder Metrics"}
                </span>
              </div>

              <Button
                onClick={confirmLayout}
                size="sm"
                className="rounded-full px-5 h-9 font-bold bg-white text-slate-900 hover:bg-slate-200"
              >
                Apply <RefreshCcw className="ml-2 h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
