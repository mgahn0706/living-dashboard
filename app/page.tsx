"use client";

import { useMemo, useState } from "react";
import DashboardView from "@/components/dashboard/DashboardView";
import { useRecommendation } from "@/hooks/useRecommendation";
import { FocusProvider, useFocus } from "@/context/FocusContext";
import { Recommendation, View } from "@/types/dashboard";
import RecommendationSidebar from "@/components/recommendation/RecommendationSidebar";
import {
  Sidebar,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { SiteHeader } from "@/components/SiteHeader";

import useVoiceInput from "@/hooks/useVoiceInput";
import ChartCreatorSidebar from "@/components/chartCreator/chartCreatorSidebar";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Brush, LayoutGrid, Plus } from "lucide-react";
import { IconSparkles } from "@tabler/icons-react";

/* ===================== Initial Views ===================== */

const initialViews: View[] = [
  {
    id: "v_sales_trend",
    x: [1, 2, 3, 4, 5, 6],
    y: [120, 135, 128, 150, 170, 165],
    chartType: "LINE",
    size: "lg",
    priority: 1,
    xLabel: "Weeks",
    yLabel: "Sales ($K)",
    title: "Overall Sales Trend",
  },
  {
    id: "v_sales_by_category",
    x: [0, 1, 2, 3],
    y: [320, 210, 180, 260],
    chartType: "BAR",
    size: "md",
    priority: 2,
    xLabel: "Categories",
    yLabel: "Sales ($K)",
    title: "Sales by Category",
  },
];

/* ===================== App Content ===================== */

function AppContent() {
  const [views, setViews] = useState<View[]>(initialViews);
  const [acceptedRecommendationIds, setAcceptedRecommendationIds] = useState<
    string[]
  >([]);
  const [textChats, setTextChats] = useState<string[]>([]);
  const [hoveredRec, setHoveredRec] = useState<Recommendation | null>(null);
  const [sidebarMode, setSidebarMode] = useState<"FORMAT" | "STRUCTURE">(
    "FORMAT"
  );

  const { focusScore } = useFocus();
  const voice = useVoiceInput({ lang: "en-US" });

  const {
    recommendations,
    acceptRecommendation,
    isLoading,
    triggerRecommendation,
  } = useRecommendation();

  /* ================= PREVIEW ================= */

  const previewMap = useMemo(() => {
    if (!hoveredRec) return {};
    const r = hoveredRec;
    const map: Record<string, any> = {};

    if (r.payload?.id) {
      map[r.payload.id] = {
        type: r.type === "REMOVE_CONTENT" ? "REMOVE" : "MODIFY",
        view: {
          ...views.find((v) => v.id === r.payload.id),
          ...r.payload,
        },
      };
    }
    return map;
  }, [hoveredRec, views]);

  const addPreview = useMemo(() => {
    if (!hoveredRec || hoveredRec.type !== "NEW_CONTENT") return null;

    return {
      id: hoveredRec.payload.id ?? "preview_add",
      x: hoveredRec.payload.x ?? [],
      y: hoveredRec.payload.y ?? [],
      chartType: hoveredRec.payload.chartType ?? "BAR",
      size: hoveredRec.payload.size ?? "md",
      priority: views.length + 1,
    } satisfies View;
  }, [hoveredRec, views.length]);

  /* ================= APPLY ================= */

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
      <Sidebar side="right" className="border-l h-screen flex flex-col">
        <SidebarHeader className="border-b p-3.5">
          <ToggleGroup
            type="single"
            value={sidebarMode}
            onValueChange={(v) => {
              if (v) setSidebarMode(v as "FORMAT" | "STRUCTURE");
            }}
            className="w-full bg-muted p-1 rounded-lg"
          >
            <ToggleGroupItem
              value="FORMAT"
              className="
      flex-1 flex flex-col items-center justify-center
      gap-0.5 py-2
      data-[state=on]:bg-background
      data-[state=on]:shadow-sm
    "
            >
              <IconSparkles className="size-4" />
              <span className="text-[11px] leading-none text-muted-foreground">
                Recommendations
              </span>
            </ToggleGroupItem>

            <ToggleGroupItem
              value="STRUCTURE"
              className="
      flex-1 flex flex-col items-center justify-center
      gap-0.5 py-2
      data-[state=on]:bg-background
      data-[state=on]:shadow-sm
    "
            >
              <Plus className="size-4" />
              <span className="text-[11px] leading-none text-muted-foreground">
                Add Visualization
              </span>
            </ToggleGroupItem>
          </ToggleGroup>
        </SidebarHeader>

        {sidebarMode === "FORMAT" && (
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
            onSendTextChat={(msg) => {
              setTextChats((prev) => [...prev, msg]);
              triggerRecommendation({
                views,
                textChats: [...textChats, msg],
                focusScore,
                dataSchema: null,
                conversation: [],
              });
            }}
          />
        )}

        {sidebarMode === "STRUCTURE" && <ChartCreatorSidebar />}
      </Sidebar>
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
