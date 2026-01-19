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
}: {
  views: View[];
  previewMap?: Record<string, PreviewState>;
  addPreview?: View | null;
}) {
  const { updateFocus, focusScore } = useFocus();

  const sortedViews = [...views].sort((a, b) => b.priority - a.priority);

  return (
    <div className="flex flex-wrap gap-4 items-stretch">
      {sortedViews.map((view) => (
        <ViewCard
          key={view.id}
          view={view}
          focusScore={focusScore[view.id] ?? 0}
          preview={previewMap[view.id] ?? null}
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
          onMouseMove={() => {}}
        />
      )}
    </div>
  );
}
