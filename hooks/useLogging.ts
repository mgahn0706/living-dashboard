"use client";

import { useCallback } from "react";
import { useExperimentLogger } from "@/hooks/useExperimentLogger";
import type { View } from "@/types/dashboard";

type FocusScore = Record<string, number>;

type LogOptions = {
  viewsOverride?: View[];
  focusScoreOverride?: FocusScore;
};

function serializeViews(views: View[]) {
  return views.map((view) => ({
    id: view.id,
    title: view.title,
    chartType: view.chartType,
    priority: view.priority,
    size: view.size,
    filter: view.filter ?? null,
    ...(view.chartType === "TABLE"
      ? { columns: view.columns }
      : {
          xColumn: view.xColumn,
          yColumn: view.yColumn,
          groupByColumn: view.groupByColumn ?? null,
          aggregation: view.aggregation ?? null,
        }),
  }));
}

export function useLogging() {
  const experimentLogger = useExperimentLogger();

  const logUserEvent = useCallback(
    (
      eventType: string,
      payload: Record<string, unknown> = {},
      views: View[],
      focusScore: FocusScore,
      options: LogOptions = {}
    ) => {
      const effectiveViews = options.viewsOverride ?? views;
      const effectiveFocusScore = options.focusScoreOverride ?? focusScore;

      experimentLogger.logEvent(eventType, {
        ...payload,
        currentViewState: serializeViews(effectiveViews),
        visualizationCount: effectiveViews.length,
        focusScore: effectiveFocusScore,
        loggedAt: new Date().toISOString(),
      });
    },
    [experimentLogger]
  );

  return {
    ...experimentLogger,
    logUserEvent,
  };
}
