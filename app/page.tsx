// app/page.tsx
"use client";

import { useState } from "react";
import DashboardView from "@/components/dashboard/DashboardView";
import { useRecommendation } from "@/hooks/useRecommendation";
import { FocusProvider, useFocus } from "@/context/FocusContext";
import { View } from "@/types/dashboard";
import RecommendationSidebar from "@/components/recommendation/RecommendationSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/SiteHeader";

const initialViews: View[] = [
  {
    id: "v1",
    x: "time",
    y: "sales",
    chartType: "line",
    size: "md",
    priority: 1,
  },
  {
    id: "v2",
    x: "time",
    y: "sales",
    chartType: "bar",
    size: "lg",
    priority: 2,
  },
  {
    id: "v3",
    x: "time",
    y: "sales",
    chartType: "table",
    size: "md",
    priority: 2,
  },
];

function AppContent() {
  const [views, setViews] = useState<View[]>(initialViews);
  const { focusScore } = useFocus();
  const { recommendations, removeRecommendations } = useRecommendation({
    views,
    focusScore,
  });

  const apply = (r: any) => {
    setViews((prev) =>
      prev.map((v) => (v.id === r.payload.id ? { ...v, ...r.payload } : v))
    );
    removeRecommendations(r);
  };

  return (
    <>
      <SidebarInset className="bg-muted/10">
        {" "}
        {/* Subtle grey backgrou dnd for contrast */}
        <SiteHeader />
        <div className="flex flex-1 flex-col overflow-hidden relative">
          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-[1600px] mx-auto p-6 md:p-8">
              <DashboardView views={views} />
            </div>
          </div>
        </div>
      </SidebarInset>
      <RecommendationSidebar recs={recommendations} onAccept={apply} />
    </>
  );
}

export default function Page() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "280px", // Slimmer sidebar
          "--header-height": "4rem",
        } as React.CSSProperties
      }
    >
      <FocusProvider>
        <AppContent />
      </FocusProvider>
    </SidebarProvider>
  );
}
