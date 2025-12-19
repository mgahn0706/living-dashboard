"use client";

import React, { memo } from "react";
import { cn } from "@/lib/utils";
// FIX: Use the specific Interaction hook
import { useInteractionContext } from "@/context/InteractionContext";
import { ChartId } from "@/types/types";

interface InteractionWrapperProps {
  chartId: ChartId;
  children: React.ReactNode;
  className?: string;
  index?: number;
  isHero?: boolean;
}

export const InteractionWrapper = memo(
  ({ chartId, children, className }: InteractionWrapperProps) => {
    const { setHover, clickChart, scores } = useInteractionContext();

    const hasInteraction = (scores[chartId] || 0) > 10;

    return (
      <div
        className={cn(
          "relative h-full cursor-pointer rounded-xl border-2 transition-colors duration-200",
          className,
          hasInteraction
            ? "border-primary shadow-md bg-accent/5"
            : "border-transparent hover:border-border hover:bg-accent/5"
        )}
        onMouseEnter={() => setHover(chartId)}
        onMouseLeave={() => setHover(null)}
        onClick={() => clickChart(chartId)}
      >
        <div className="relative h-full overflow-hidden rounded-lg">
          {/* Because the parent (DashboardEngine) did NOT re-render, 
            'children' here is the same object reference. 
            React will skip rendering the heavy UniversalChart inside. */}
          {children}
        </div>
      </div>
    );
  }
);

InteractionWrapper.displayName = "InteractionWrapper";
