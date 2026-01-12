// components/DashboardView.tsx
"use client";

import { View } from "@/types/dashboard";
import { useFocus } from "@/context/FocusContext";
import ViewCard from "./ViewCard";

export default function DashboardView({ views }: { views: View[] }) {
  const { updateFocus } = useFocus();

  const sortedViews = [...views].sort((a, b) => b.priority - a.priority);

  return (
    <div className="flex flex-wrap gap-4 items-stretch">
      {sortedViews.map((v) => (
        <ViewCard key={v.id} view={v} onMouseMove={() => updateFocus(v.id)} />
      ))}
    </div>
  );
}
