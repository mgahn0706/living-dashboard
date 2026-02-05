// components/DashboardView.tsx
"use client";

import { View } from "@/types/dashboard";
import { useFocus } from "@/context/FocusContext";
import ViewCard, { PreviewState } from "./ViewCard";
import { Button } from "../ui/button";

export default function DashboardView({
  views,
  previewMap = {},
  addPreview = null,
  selectedViewId,
  isAddMode,
  setSidebarMode,
  onSelect,
}: {
  views: View[];
  previewMap?: Record<string, PreviewState>;
  addPreview?: View | null;
  selectedViewId: string | null;
  isAddMode: boolean;
  setSidebarMode: (mode: "FORMAT" | "STRUCTURE") => void;
  onSelect: (viewId: string) => void;
}) {
  const { focusScore, reportPointerInteraction, reportClickInteraction } =
    useFocus();

  const sortedViews = [...views].sort((a, b) => b.priority - a.priority);

  if (views.length === 0) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-md text-muted-foreground">
        <div>No views available. Please add a view to get started.</div>
        {!isAddMode && (
          <Button
            variant="default"
            size="sm"
            disabled={isAddMode}
            onClick={() => setSidebarMode("STRUCTURE")}
          >
            Add View
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-4 items-stretch">
      {sortedViews.map((view) => (
        <ViewCard
          view={view}
          focusScore={focusScore[view.id] ?? 0}
          isSelected={selectedViewId === view.id}
          preview={previewMap[view.id] ?? null}
          onPointerMove={(e) =>
            reportPointerInteraction(view.id, {
              clientX: e.clientX,
              clientY: e.clientY,
            })
          }
          onCardClick={() => reportClickInteraction(view.id)}
          onEditClick={() => onSelect(view.id)}
        />
      ))}

      {addPreview && (
        <ViewCard
          view={addPreview}
          focusScore={0}
          preview={{ type: "ADD", view: addPreview }}
          isSelected={false}
        />
      )}
    </div>
  );
}
