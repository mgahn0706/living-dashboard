"use client";

import { useMemo, useState, useEffect } from "react";
import DashboardView from "@/components/dashboard/DashboardView";
import { useRecommendation } from "@/hooks/useRecommendation";
import { FocusProvider, useFocus } from "@/context/FocusContext";
import type { Recommendation, View } from "@/types/dashboard";
import type { PreviewState } from "@/components/dashboard/ViewCard";
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
import { Edit, Plus } from "lucide-react";
import { IconSparkles } from "@tabler/icons-react";
import { DatasetProvider, useDataset } from "@/context/DatasetContext";
import { SelectionProvider } from "@/context/SelectionContext";

import { useExperimentLogger } from "@/hooks/useExperimentLogger"; // ✅ added

/* =====================================================
   View factories
===================================================== */

type ChartKind = "BAR" | "LINE" | "SCATTER";

function makeChartView(
  kind: ChartKind,
  payload: Partial<View>,
  priority: number
): View {
  return {
    id: payload.id ?? `v_${Date.now()}`,
    chartType: kind,
    xColumn: (payload as any).xColumn ?? "",
    yColumn: (payload as any).yColumn ?? "",
    size: payload.size ?? "md",
    priority,
    xLabel: (payload as any).xLabel,
    yLabel: (payload as any).yLabel,
    title: payload.title ?? "",
  };
}

function makeTableView(payload: Partial<View>, priority: number): View {
  return {
    id: payload.id ?? `v_${Date.now()}`,
    chartType: "TABLE",
    columns: (payload as any).columns ?? [],
    size: payload.size ?? "md",
    priority,
    title: payload.title ?? "",
  };
}

/* =====================================================
   App Content
===================================================== */

function AppContent() {
  const [views, setViews] = useState<View[]>([]);
  const [acceptedRecommendationIds, setAcceptedRecommendationIds] = useState<
    string[]
  >([]);
  const [textChats, setTextChats] = useState<string[]>([]);
  const [hoveredRec, setHoveredRec] = useState<Recommendation | null>(null);
  const [sidebarMode, setSidebarMode] = useState<"FORMAT" | "STRUCTURE">(
    "FORMAT"
  );
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);
  const [language, setLanguage] = useState<"en-US" | "ko-KR" | "ja-JP">(
    "en-US"
  );

  const { focusScore } = useFocus();
  const { schema } = useDataset();

  const {
    recommendations,
    acceptRecommendation,
    isLoading,
    triggerRecommendation,
  } = useRecommendation();

  const { logEvent } = useExperimentLogger();

  /* ================= Recommendation SHOWN ================= */

  const [shownRecIds, setShownRecIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    recommendations.forEach((r) => {
      if (!shownRecIds.has(r.id)) {
        logEvent("recommendation", {
          recommendationId: r.id,
          type: r.type,
          action: "shown",
        });

        setShownRecIds((prev) => {
          const next = new Set(prev);
          next.add(r.id);
          return next;
        });
      }
    });
  }, [recommendations]);

  /* ================= Voice ================= */

  const voice = useVoiceInput({
    lang: language,
    onFinal: (text) => {
      logEvent("voice_input", { length: text.length }); // ✅ added

      triggerRecommendation({
        views,
        textChats: [...textChats, text],
        focusScore,
        dataSchema: schema,
        conversation: voice.conversation,
      });
    },
  });

  /* ================= PREVIEW ================= */

  const previewMap = useMemo<Record<string, PreviewState>>(() => {
    if (!hoveredRec || !hoveredRec.payload?.id) return {};

    const base = views.find((v) => v.id === hoveredRec.payload.id);
    if (!base) return {};

    const previewView =
      base.chartType === "TABLE" || hoveredRec.payload.chartType === "TABLE"
        ? makeTableView({ ...base, ...hoveredRec.payload }, base.priority)
        : makeChartView(
            hoveredRec.payload.chartType ?? base.chartType,
            { ...base, ...hoveredRec.payload },
            base.priority
          );

    return {
      [base.id]: {
        type: hoveredRec.type === "REMOVE_CONTENT" ? "REMOVE" : "MODIFY",
        view: previewView,
      },
    };
  }, [hoveredRec, views]);

  const addPreview = useMemo<View | null>(() => {
    if (!hoveredRec || hoveredRec.type !== "NEW_CONTENT") return null;

    const payload = hoveredRec.payload as Partial<View>;

    return payload.chartType === "TABLE"
      ? makeTableView(payload, views.length + 1)
      : makeChartView(payload.chartType ?? "BAR", payload, views.length + 1);
  }, [hoveredRec, views.length]);

  /* ================= APPLY ================= */

  const apply = (r: Recommendation) => {
    logEvent("recommendation", {
      recommendationId: r.id,
      type: r.type,
      action: "accepted",
    }); // ✅ added

    setAcceptedRecommendationIds((prev) => [...prev, r.id]);

    setViews((prev) => {
      switch (r.type) {
        case "MODIFY_CONTENT":
        case "RESIZE":
          return prev.map((v) =>
            v.id === r.payload.id && r.payload.chartType
              ? v.chartType === "TABLE" || r.payload.chartType === "TABLE"
                ? makeTableView({ ...v, ...r.payload }, v.priority)
                : makeChartView(
                    r.payload.chartType,
                    { ...v, ...r.payload },
                    v.priority
                  )
              : v
          );

        case "REORDER":
          if (!r.payload?.id) return prev;
          return [...prev]
            .map((v, i) =>
              v.id === r.payload.id
                ? {
                    ...v,
                    priority: r.payload.priority ?? v.priority ?? i,
                  }
                : v
            )
            .sort((a, b) => a.priority - b.priority);

        case "NEW_CONTENT": {
          const payload = r.payload as Partial<View>;

          return payload.chartType === "TABLE"
            ? [...prev, makeTableView(payload, prev.length + 1)]
            : [
                ...prev,
                makeChartView(
                  payload.chartType ?? "BAR",
                  payload,
                  prev.length + 1
                ),
              ];
        }

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
      <SidebarInset className="bg-muted/10">
        <SiteHeader />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto p-6 md:p-8">
            <DashboardView
              views={views}
              previewMap={previewMap}
              addPreview={addPreview}
              selectedViewId={selectedViewId}
              isAddMode={sidebarMode === "STRUCTURE"}
              setSidebarMode={setSidebarMode}
              onSelect={(viewId) => {
                logEvent("view_select", { viewId }); // ✅ added

                if (selectedViewId === viewId) {
                  setSelectedViewId(null);
                  setSidebarMode("FORMAT");
                } else {
                  setSelectedViewId(viewId);
                  setSidebarMode("STRUCTURE");
                }
              }}
              onDelete={(viewId) => {
                logEvent("view_delete", { viewId }); // ✅ added

                setViews((prev) => prev.filter((v) => v.id !== viewId));
              }}
            />
          </div>
        </div>
      </SidebarInset>

      <Sidebar side="right" className="border-l h-screen flex flex-col">
        <SidebarHeader className="border-b p-3.5">
          <ToggleGroup
            type="single"
            value={sidebarMode}
            onValueChange={(v) => {
              if (v) {
                logEvent("sidebar_mode_change", { mode: v }); // ✅ added
                setSidebarMode(v as "FORMAT" | "STRUCTURE");
              }
            }}
            className="w-full bg-muted p-1 rounded-lg"
          >
            <ToggleGroupItem value="FORMAT">
              <IconSparkles className="size-4" />
              <span className="text-[11px] leading-none text-muted-foreground">
                Recommendations
              </span>
            </ToggleGroupItem>

            <ToggleGroupItem value="STRUCTURE">
              {selectedViewId ? (
                <>
                  <Edit className="size-4" />
                  <span className="text-[11px] leading-none text-muted-foreground">
                    Edit View
                  </span>
                </>
              ) : (
                <>
                  <Plus className="size-4" />
                  <span className="text-[11px] leading-none text-muted-foreground">
                    Add View
                  </span>
                </>
              )}
            </ToggleGroupItem>
          </ToggleGroup>
        </SidebarHeader>

        {sidebarMode === "FORMAT" && (
          <RecommendationSidebar
            language={language}
            recs={recommendations.filter(
              (r) => !acceptedRecommendationIds.includes(r.id)
            )}
            onAccept={apply}
            onHover={setHoveredRec}
            onLeave={() => setHoveredRec(null)}
            voice={voice}
            textChats={textChats}
            isGenerating={isLoading}
            onChangeLanguage={(lang) => setLanguage(lang)}
            onSendTextChat={(msg) => {
              logEvent("text_chat", {
                length: msg.length,
              }); // ✅ added

              setTextChats((prev) => [...prev, msg]);

              triggerRecommendation({
                views,
                textChats: [...textChats, msg],
                focusScore,
                dataSchema: schema,
                conversation: voice.conversation,
              });
            }}
          />
        )}

        {sidebarMode === "STRUCTURE" && (
          <ChartCreatorSidebar
            selectedView={views.find((v) => v.id === selectedViewId) || null}
            onEditView={(id: string, next: View) => {
              logEvent("view_modify", {
                viewId: id,
                triggeredBy: "manual",
              }); // ✅ added

              setSelectedViewId(null);
              setSidebarMode("FORMAT");

              setViews((prev) => prev.map((v) => (v.id === id ? next : v)));
            }}
            onAddView={(payload) => {
              logEvent("view_create", {
                triggeredBy: "manual",
                chartType: payload.chartType,
              }); // ✅ added

              setSelectedViewId(null);
              setSidebarMode("FORMAT");

              setViews((prev) =>
                payload.chartType === "TABLE"
                  ? [...prev, makeTableView(payload, prev.length + 1)]
                  : [
                      ...prev,
                      makeChartView(
                        payload.chartType,
                        payload,
                        prev.length + 1
                      ),
                    ]
              );
            }}
          />
        )}
      </Sidebar>
    </>
  );
}

/* =====================================================
   Page Wrapper
===================================================== */

export default function Page() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "280px",
          "--header-height": "73px",
        } as React.CSSProperties
      }
    >
      <SelectionProvider>
        <FocusProvider>
          <DatasetProvider>
            <AppContent />
          </DatasetProvider>
        </FocusProvider>
      </SelectionProvider>
    </SidebarProvider>
  );
}
