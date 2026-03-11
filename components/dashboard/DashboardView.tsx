"use client";

import { useMemo } from "react";
import { Recommendation, View } from "@/types/dashboard";
import { INITIAL_FOCUS_SCORE, useFocus } from "@/context/FocusContext";
import ViewCard, { PreviewState } from "./ViewCard";
import { Button } from "../ui/button";
import { ArrowRight } from "lucide-react";
import TimeSlider from "./TimeSlider";

const FOCUS_STABLE_RANGE = 100;
const MIN_VISIBLE_FOCUS_INTENSITY = 0.85;

export default function DashboardView({
  views = [],
  previewMap = {},
  addPreview = null,
  recommendationsByViewId = {},
  newContentRecommendation = null,
  onRecommendationHover,
  onRecommendationLeave,
  onAcceptRecommendation,
  onDeclineRecommendation,
  onInitializeDashboard,
  onLoadDemo,
  canInitializeDashboard = true,
  isInitializingDashboard = false,
  selectedViewId,
  isAddMode,
  setSidebarMode,
  onSelect,
  onApplyFilter,
}: {
  views: View[];
  previewMap?: Record<string, PreviewState>;
  addPreview?: View | null;
  recommendationsByViewId?: Record<string, Recommendation>;
  newContentRecommendation?: Recommendation | null;
  onRecommendationHover?: (rec: Recommendation) => void;
  onRecommendationLeave?: () => void;
  onAcceptRecommendation?: (rec: Recommendation) => void;
  onDeclineRecommendation?: (rec: Recommendation) => void;
  onInitializeDashboard?: () => void;
  onLoadDemo?: () => void;
  canInitializeDashboard?: boolean;
  isInitializingDashboard?: boolean;
  selectedViewId: string | null;
  isAddMode: boolean;
  setSidebarMode: (mode: "FORMAT" | "STRUCTURE") => void;
  onSelect: (viewId: string) => void;
  onApplyFilter?: (viewId: string, filter: View["filter"] | undefined) => void;
}) {
  const { focusScore, reportPointerInteraction, reportClickInteraction } =
    useFocus();

  const sortedViews = [...views].sort((a, b) => b.priority - a.priority);
  const focusIntensityByViewId = useMemo(() => {
    const scored = views.map((view) => ({
      id: view.id,
      score: focusScore[view.id] ?? INITIAL_FOCUS_SCORE,
    }));

    if (scored.length === 0) return {} as Record<string, number>;

    const values = scored.map((item) => item.score);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;
    const map: Record<string, number> = {};

    if (range < FOCUS_STABLE_RANGE) {
      scored.forEach((item) => {
        map[item.id] = 1;
      });
      return map;
    }

    scored.forEach((item) => {
      const normalized = (item.score - min) / range;
      map[item.id] =
        MIN_VISIBLE_FOCUS_INTENSITY +
        Math.max(0, Math.min(1, normalized)) *
          (1 - MIN_VISIBLE_FOCUS_INTENSITY);
    });

    return map;
  }, [views, focusScore]);

  /* =======================================================
     Empty State
  ======================================================= */

  if (views.length === 0) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-md text-muted-foreground relative">
        <div>No views available. Please add a view to get started.</div>

        {!isAddMode && (
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={onLoadDemo}
              disabled={isInitializingDashboard}
            >
              {isInitializingDashboard
                ? "Loading..."
                : "Load Demo Dataset"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSidebarMode("STRUCTURE")}
            >
              Add View
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onInitializeDashboard}
              disabled={!canInitializeDashboard || isInitializingDashboard}
            >
              {isInitializingDashboard
                ? "Initializing..."
                : "Initialize dashboard with LLM"}
            </Button>
          </div>
        )}

        {isAddMode && (
          <ArrowRight className="w-8 h-8 text-primary animate-wiggle-x animate-pulse" />
        )}
      </div>
    );
  }

  /* =======================================================
     Render
  ======================================================= */

  return (
    <>
    <TimeSlider />
    <div className="flex flex-wrap gap-4 items-stretch">
      {sortedViews.map((view) => (
        <ViewCard
          key={view.id}
          view={view}
          focusIntensity={focusIntensityByViewId[view.id] ?? 0.2}
          isSelected={selectedViewId === view.id}
          preview={previewMap[view.id] ?? null}
          recommendation={recommendationsByViewId[view.id] ?? null}
          onRecommendationHover={onRecommendationHover}
          onRecommendationLeave={onRecommendationLeave}
          onAcceptRecommendation={onAcceptRecommendation}
          onDeclineRecommendation={onDeclineRecommendation}
          onPointerMove={(e) =>
            reportPointerInteraction(view.id, {
              clientX: e.clientX,
              clientY: e.clientY,
            })
          }
          onCardClick={() => {
            reportClickInteraction(view.id);
          }}
          onEditClick={() => onSelect(view.id)}
          onApplyFilter={onApplyFilter}
        />
      ))}

      {addPreview && (
        <ViewCard
          view={addPreview}
          focusIntensity={0.2}
          preview={{ type: "ADD", view: addPreview }}
          isSelected={false}
          recommendation={newContentRecommendation}
          onRecommendationHover={onRecommendationHover}
          onRecommendationLeave={onRecommendationLeave}
          onAcceptRecommendation={onAcceptRecommendation}
          onDeclineRecommendation={onDeclineRecommendation}
        />
      )}
    </div>
    </>
  );
}
