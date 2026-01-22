"use client";

import { useMemo, useState } from "react";
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
  /* ===================== 1. Overall Trend ===================== */
  {
    id: "v_sales_trend",
    // time (e.g., weeks)
    x: [1, 2, 3, 4, 5, 6],
    // total sales
    y: [120, 135, 128, 150, 170, 165],
    chartType: "LINE",
    size: "lg",
    priority: 1,
    xLabel: "Weeks",
    yLabel: "Sales ($K)",
    title: "Overall Sales Trend",
  },

  /* ===================== 2. Category Comparison ===================== */
  {
    id: "v_sales_by_category",
    // category indices: A, B, C, D
    x: [0, 1, 2, 3],
    // sales per category
    y: [320, 210, 180, 260],
    chartType: "BAR",
    size: "md",
    priority: 2,
    xLabel: "Categories",
    yLabel: "Sales ($K)",
    title: "Sales by Category",
  },

  /* ===================== 3. Growth Rate Over Time ===================== */
  {
    id: "v_sales_growth_rate",
    // weeks
    x: [2, 3, 4, 5, 6],
    // week-over-week growth (%)
    y: [12, -5, 17, 13, -3],
    chartType: "LINE",
    size: "md",
    priority: 3,
    xLabel: "Weeks",
    yLabel: "Growth Rate (%)",
    title: "Week-over-Week Sales Growth Rate",
  },

  /* ===================== 4. Regional Contribution ===================== */
  {
    id: "v_sales_by_region",
    // regions: North, South, East, West
    x: [0, 1, 2, 3],
    // contribution (%)
    y: [35, 25, 20, 20],
    chartType: "BAR",
    size: "sm",
    priority: 4,
    xLabel: "Regions",
    yLabel: "Contribution (%)",
    title: "Sales Contribution by Region",
  },

  /* ===================== 5. Top Products Table ===================== */
  {
    id: "v_top_products",
    // product rank
    x: [1, 2, 3, 4, 5],
    // sales
    y: [95, 88, 76, 61, 54],
    chartType: "TABLE",
    size: "sm",
    priority: 5,
    xLabel: "Product Rank",
    yLabel: "Sales ($K)",
    title: "Top 5 Products by Sales",
  },

  /* ===================== 6. Anomaly / Spike Detection ===================== */
  {
    id: "v_sales_spikes",
    // weeks
    x: [1, 2, 3, 4, 5, 6],
    // deviation from moving average
    y: [0, 5, -8, 12, 18, -4],
    chartType: "LINE",
    size: "sm",
    priority: 6,
    xLabel: "Weeks",
    yLabel: "Deviation ($K)",
    title: "Sales Deviation from Moving Average",
  },
];

/* ===================== App Content ===================== */

function AppContent() {
  const [views, setViews] = useState<View[]>(initialViews);
  const [acceptedRecommendationIds, setAcceptedRecommendationIds] = useState<
    string[]
  >([]);
  const [textChats, setTextChats] = useState<string[]>([]);

  /** 🔥 핵심: hover된 recommendation */
  const [hoveredRec, setHoveredRec] = useState<Recommendation | null>(null);

  const { focusScore } = useFocus();
  const voice = useVoiceInput({ lang: "en-US" });

  const { recommendations, acceptRecommendation, isLoading } =
    useRecommendation({
      views,
      focusScore,
      conversation: voice.conversation,
      textChats,
      enabled: voice.isListening || textChats.length > 0,
    });

  /* ================= PREVIEW DERIVATION ================= */

  const previewMap = useMemo(() => {
    if (!hoveredRec) return {};

    const r = hoveredRec;
    const map: Record<string, any> = {};

    switch (r.type) {
      case "MODIFY_CONTENT":
      case "RESIZE": {
        if (!r.payload?.id) break;
        map[r.payload.id] = {
          type: "MODIFY",
          view: { ...views.find((v) => v.id === r.payload.id)!, ...r.payload },
        };
        break;
      }

      case "REMOVE_CONTENT": {
        if (!r.payload?.id) break;
        map[r.payload.id] = { type: "REMOVE" };
        break;
      }
    }

    return map;
  }, [hoveredRec, views]);

  const addPreview = useMemo(() => {
    if (!hoveredRec) return null;
    if (hoveredRec.type !== "NEW_CONTENT") return null;

    return {
      id: hoveredRec.payload.id ?? "preview_add",
      x: hoveredRec.payload.x ?? [],
      y: hoveredRec.payload.y ?? [],
      chartType: hoveredRec.payload.chartType ?? "BAR",
      size: hoveredRec.payload.size ?? "md",
      priority: views.length + 1,
    } satisfies View;
  }, [hoveredRec, views.length]);

  /* ================= APPLY (unchanged) ================= */

  const apply = (r: Recommendation) => {
    setAcceptedRecommendationIds((prev) => [...prev, r.id]);

    setViews((prev) => {
      switch (r.type) {
        case "MODIFY_CONTENT":
        case "RESIZE":
          return prev.map((v) =>
            v.id === r.payload.id ? { ...v, ...r.payload } : v
          );

        case "REORDER": {
          if (!r.payload?.id) return prev;

          return [...prev]
            .map((v, i) => {
              if (v.id !== r.payload.id) return v;

              return {
                ...v,
                priority: r.payload.priority ?? v.priority ?? i,
              };
            })
            .sort(
              (a, b) =>
                (a.priority ?? Number.MAX_SAFE_INTEGER) -
                (b.priority ?? Number.MAX_SAFE_INTEGER)
            );
        }

        case "NEW_CONTENT":
          return [
            ...prev,
            {
              id: r.payload.id ?? `v_${Date.now()}`,
              x: r.payload.x ?? [],
              y: r.payload.y ?? [],
              chartType: r.payload.chartType ?? "BAR",
              size: r.payload.size ?? "md",
              priority: prev.length + 1,
            },
          ];

        case "REMOVE_CONTENT":
          return prev.filter((v) => v.id !== r.payload.id);

        default:
          return prev;
      }
    });

    acceptRecommendation(r);
  };

  return (
    <>
      {/* ================= DASHBOARD ================= */}
      <SidebarInset className="bg-muted/10">
        <SiteHeader />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto p-6 md:p-8">
            <DashboardView
              views={views}
              previewMap={previewMap}
              addPreview={addPreview}
            />
          </div>
        </div>
      </SidebarInset>

      {/* ================= SIDEBAR ================= */}
      <RecommendationSidebar
        recs={recommendations.filter(
          (r) => !acceptedRecommendationIds.includes(r.id)
        )}
        onAccept={apply}
        onHover={setHoveredRec}
        onLeave={() => setHoveredRec(null)}
        voice={voice}
        textChats={textChats}
        isGenerating={isLoading}
        onSendTextChat={(msg) => setTextChats((prev) => [...prev, msg])}
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
