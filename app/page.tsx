"use client";

import { useState } from "react";
import DashboardView from "@/components/dashboard/DashboardView";
import { useRecommendation } from "@/hooks/useRecommendation";
import { FocusProvider, useFocus } from "@/context/FocusContext";
import { Recommendation, View } from "@/types/dashboard";
import RecommendationSidebar from "@/components/recommendation/RecommendationSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/SiteHeader";

import useVoiceInput from "@/hooks/useVoiceInput";

/* ===================== Initial Views ===================== */

const initialViews: View[] = [
  {
    id: "v_sales_trend",
    // time (e.g., weeks)
    x: [1, 2, 3, 4, 5, 6],
    // sales
    y: [120, 135, 128, 150, 170, 165],
    chartType: "LINE",
    size: "lg",
    priority: 1,
  },
  {
    id: "v_sales_comparison",
    // categories encoded as indices
    x: [0, 1, 2, 3],
    // sales per category
    y: [320, 210, 180, 260],
    chartType: "BAR",
    size: "md",
    priority: 2,
  },
  {
    id: "v_sales_table",
    // row index
    x: [1, 2, 3, 4, 5],
    // sales values
    y: [120, 135, 128, 150, 170],
    chartType: "TABLE",
    size: "sm",
    priority: 3,
  },
];

/* ===================== App Content ===================== */

function AppContent() {
  const [views, setViews] = useState<View[]>(initialViews);
  const [acceptedRecommendationIds, setAcceptedRecommendationIds] = useState<
    string[]
  >([]);

  /* 🔹 focus signal */
  const { focusScore } = useFocus();

  /* 🔹 voice conversation (single source of truth) */
  const voice = useVoiceInput({ lang: "en-US" });

  const { recommendations, acceptRecommendation } = useRecommendation({
    views,
    focusScore,
    conversation: voice.conversation,
    enabled: voice.isListening,
  });

  const apply = (r: Recommendation) => {
    setAcceptedRecommendationIds((prev) => [...prev, r.id]);

    setViews((prev) => {
      switch (r.type) {
        /* ================= MODIFY / RESIZE ================= */
        case "MODIFY_CONTENT":
        case "RESIZE": {
          if (!r.payload?.id) return prev;

          return prev.map((v) =>
            v.id === r.payload.id
              ? {
                  ...v,
                  ...r.payload,
                }
              : v
          );
        }

        /* ================= REORDER ================= */
        case "REORDER": {
          if (!r.payload?.id || r.payload.priority == null) return prev;

          return [...prev]
            .map((v) =>
              v.id === r.payload.id
                ? { ...v, priority: r.payload.priority! }
                : v
            )
            .sort((a, b) => a.priority - b.priority);
        }

        /* ================= NEW CONTENT ================= */
        case "NEW_CONTENT": {
          const newView: View = {
            id: r.payload.id ?? `v_${Date.now()}`,
            x: r.payload.x ?? [],
            y: r.payload.y ?? [],
            chartType: r.payload.chartType ?? "BAR",
            size: r.payload.size ?? "md",
            priority: prev.length + 1,
          };

          return [...prev, newView];
        }

        /* ================= REMOVE ================= */
        case "REMOVE_CONTENT": {
          if (!r.payload?.id) return prev;
          return prev.filter((v) => v.id !== r.payload.id);
        }

        default:
          return prev;
      }
    });

    /* ✅ mark accepted (important for dedup / fade-out) */
    acceptRecommendation(r);
  };

  console.log("Recommendations:", recommendations, acceptedRecommendationIds);

  return (
    <>
      {/* ================= MAIN DASHBOARD ================= */}
      <SidebarInset className="bg-muted/10">
        <SiteHeader />

        <div className="flex flex-1 flex-col overflow-hidden relative">
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-[1600px] mx-auto p-6 md:p-8">
              <DashboardView views={views} />
            </div>
          </div>
        </div>
      </SidebarInset>

      {/* ================= RECOMMENDATION SIDEBAR ================= */}
      <RecommendationSidebar
        recs={recommendations.filter(
          (r) => !acceptedRecommendationIds.includes(r.id)
        )}
        onAccept={apply}
        voice={voice}
      />
    </>
  );
}

/* ===================== Page Wrapper ===================== */

export default function Page() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "280px",
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
