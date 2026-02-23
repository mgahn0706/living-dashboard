"use client";

import { Recommendation, View } from "@/types/dashboard";
import { useFocus } from "@/context/FocusContext";
import ViewCard, { PreviewState } from "./ViewCard";
import { Button } from "../ui/button";
import { ArrowRight } from "lucide-react";

export default function DashboardView({
  views,
  previewMap = {},
  addPreview = null,
  recommendationsByViewId = {},
  newContentRecommendation = null,
  onRecommendationHover,
  onRecommendationLeave,
  onAcceptRecommendation,
  onDeclineRecommendation,
  onInitializeDashboard,
  canInitializeDashboard = true,
  isInitializingDashboard = false,
  selectedViewId,
  isAddMode,
  setSidebarMode,
  onSelect,
  onDelete,
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
  canInitializeDashboard?: boolean;
  isInitializingDashboard?: boolean;
  selectedViewId: string | null;
  isAddMode: boolean;
  setSidebarMode: (mode: "FORMAT" | "STRUCTURE") => void;
  onSelect: (viewId: string) => void;
  onDelete: (viewId: string) => void;
}) {
  const { focusScore, reportPointerInteraction, reportClickInteraction } =
    useFocus();

  const sortedViews = [...views].sort((a, b) => b.priority - a.priority);

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
    <div className="flex flex-wrap gap-4 items-stretch">
      {sortedViews.map((view) => (
        <ViewCard
          key={view.id}
          view={view}
          focusScore={focusScore[view.id] ?? 0}
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
          onDeleteClick={(id) => onDelete(id)}
        />
      ))}

      {addPreview && (
        <ViewCard
          view={addPreview}
          focusScore={0}
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
  );
}
