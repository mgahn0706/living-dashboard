// components/DashboardView.tsx
"use client";

import { View } from "@/types/dashboard";
import { useFocus } from "@/context/FocusContext";
import ViewCard, { PreviewState } from "./ViewCard";

/**
 * previewMap / addPreview 는
 * - recommendation hover 시 만들어진다고 가정
 * - 여기서는 구조만 보여줌
 */
export default function DashboardView({
  views,
  previewMap = {},
  addPreview = null,
  selectedViewId,
  onSelect,
}: {
  views: View[];
  previewMap?: Record<string, PreviewState>;
  addPreview?: View | null;
  selectedViewId: string | null;
  onSelect: (viewId: string) => void;
}) {
  const { updateFocus, focusScore } = useFocus();

  const sortedViews = [...views].sort((a, b) => b.priority - a.priority);

  if (views.length === 0) {
    return (
      <div className="w-full h-64 flex items-center justify-center border-2 border-dashed rounded-md text-muted-foreground">
        No views available. Please add a view to get started.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-4 items-stretch">
      {sortedViews.map((view) => (
        <ViewCard
          key={view.id}
          view={view}
          focusScore={focusScore[view.id] ?? 0}
          preview={previewMap[view.id] ?? null}
          isSelected={selectedViewId === view.id}
          onClick={() => onSelect(view.id)}
          onMouseMove={(event) =>
            updateFocus(view.id, {
              clientX: event.clientX,
              clientY: event.clientY,
            })
          }
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
