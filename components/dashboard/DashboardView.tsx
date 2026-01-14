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
  const { updateFocus } = useFocus();

  const sortedViews = [...views].sort((a, b) => b.priority - a.priority);

  return (
    <div className="flex flex-wrap gap-4 items-stretch">
      {sortedViews.map((v) => (
        <ViewCard
          key={v.id}
          view={v}
          preview={previewMap[v.id] ?? null}
          onMouseMove={() => updateFocus(v.id)}
        />
      ))}

      {/* ADD preview는 새로운 카드로 ghost 표시 */}
      {addPreview && (
        <ViewCard
          view={addPreview}
          preview={{ type: "ADD", view: addPreview }}
          onMouseMove={() => {}}
        />
      )}
    </div>
  );
}
