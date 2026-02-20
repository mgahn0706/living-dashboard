"use client";

import React, { useMemo, useState, useEffect } from "react";
import DashboardView from "@/components/dashboard/DashboardView";
import { useRecommendation } from "@/hooks/useRecommendation";
import { FocusProvider, useFocus } from "@/context/FocusContext";
import type {
  ChartType,
  ChartView,
  Recommendation,
  TableView,
  View,
} from "@/types/dashboard";
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

import { useExperimentLogger } from "@/hooks/useExperimentLogger";

/* =====================================================
   Types / guards
===================================================== */

type ChartKind = Exclude<ChartType, "TABLE">;

function isTableView(v: View): v is TableView {
  return v.chartType === "TABLE";
}

function isChartView(v: View): v is ChartView {
  return v.chartType !== "TABLE";
}

/**
 * NOTE:
 * Your Recommendation type says `payload: Partial<View>`.
 * That is still ambiguous for TS. We treat it as `any` at the boundary,
 * then normalize into a concrete View *safely* via chartType-based logic.
 */
type AnyPayload = any;

/* =====================================================
   View factories (type-safe)
===================================================== */

function makeChartView(
  kind: ChartKind,
  payload: Partial<ChartView>,
  priority: number
): ChartView {
  return {
    id: payload.id ?? `v_${Date.now()}`,
    chartType: kind,
    xColumn: payload.xColumn ?? "",
    yColumn: payload.yColumn ?? "",
    size: payload.size ?? "md",
    priority,
    xLabel: payload.xLabel,
    yLabel: payload.yLabel,
    title: payload.title ?? "",
  };
}

function makeTableView(
  payload: Partial<TableView>,
  priority: number
): TableView {
  return {
    id: payload.id ?? `v_${Date.now()}`,
    chartType: "TABLE",
    columns: payload.columns ?? [],
    size: payload.size ?? "md",
    priority,
    title: payload.title ?? "",
  };
}

/* =====================================================
   Converters: solve TABLE <-> CHART mapping here
===================================================== */

function deriveChartColumnsFromTable(
  table: TableView,
  incoming?: { xColumn?: string; yColumn?: string }
) {
  const x = incoming?.xColumn ?? table.columns?.[0] ?? "";
  const y = incoming?.yColumn ?? table.columns?.[1] ?? "";
  return { xColumn: x, yColumn: y };
}

function deriveTableColumnsFromChart(
  chart: ChartView,
  incoming?: { columns?: string[] }
) {
  const cols = incoming?.columns;
  if (Array.isArray(cols) && cols.length > 0) return { columns: cols };
  return { columns: [chart.xColumn, chart.yColumn].filter(Boolean) };
}

/**
 * Normalize a (base view + partial payload) into a concrete View with nextType.
 * This is the ONLY place where we interpret ambiguous payload shapes.
 */
function normalizeViewUpdate(
  base: View,
  payload: AnyPayload,
  nextType: ChartType
): View {
  // Common fields we allow to flow through for both kinds
  const common = {
    id: payload?.id ?? base.id,
    size: payload?.size ?? base.size,
    title: payload?.title ?? base.title,
    // keep priority stable unless explicitly overwritten elsewhere (e.g., REORDER)
  };

  if (nextType === "TABLE") {
    if (isTableView(base)) {
      // TABLE -> TABLE
      return makeTableView(
        {
          ...base,
          ...common,
          columns: Array.isArray(payload?.columns)
            ? payload.columns
            : base.columns,
        },
        base.priority
      );
    }

    // CHART -> TABLE
    const chart = base as ChartView;
    const cols = deriveTableColumnsFromChart(chart, payload);
    return makeTableView(
      {
        ...common,
        chartType: "TABLE",
        columns: cols.columns,
      },
      base.priority
    );
  }

  // nextType is chart kind
  const kind = nextType as ChartKind;

  if (isChartView(base)) {
    // CHART -> CHART (maybe kind changes)
    return makeChartView(
      kind,
      {
        ...base,
        ...common,
        chartType: kind,
        xColumn: payload?.xColumn ?? base.xColumn,
        yColumn: payload?.yColumn ?? base.yColumn,
        xLabel: payload?.xLabel ?? base.xLabel,
        yLabel: payload?.yLabel ?? base.yLabel,
      },
      base.priority
    );
  }

  // TABLE -> CHART
  const table = base as TableView;
  const cols = deriveChartColumnsFromTable(table, payload);
  return makeChartView(
    kind,
    {
      ...common,
      chartType: kind,
      xColumn: cols.xColumn,
      yColumn: cols.yColumn,
      xLabel: payload?.xLabel,
      yLabel: payload?.yLabel,
    },
    base.priority
  );
}

/**
 * Build a NEW view from a recommendation payload (NEW_CONTENT / addPreview).
 * Uses chartType in payload (defaults provided by caller).
 */
function buildNewViewFromPayload(payload: AnyPayload, priority: number): View {
  const t: ChartType = payload?.chartType ?? "BAR";

  if (t === "TABLE") {
    return makeTableView(
      {
        id: payload?.id,
        chartType: "TABLE",
        columns: Array.isArray(payload?.columns) ? payload.columns : [],
        size: payload?.size,
        title: payload?.title,
      },
      priority
    );
  }

  const kind = t as ChartKind;
  return makeChartView(
    kind,
    {
      id: payload?.id,
      chartType: kind,
      xColumn: payload?.xColumn ?? "",
      yColumn: payload?.yColumn ?? "",
      size: payload?.size,
      xLabel: payload?.xLabel,
      yLabel: payload?.yLabel,
      title: payload?.title,
    },
    priority
  );
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
    setShownRecIds((prev) => {
      const next = new Set(prev);
      let changed = false;

      recommendations.forEach((r) => {
        if (!next.has(r.id)) {
          logEvent("recommendation", {
            recommendationId: r.id,
            type: r.type,
            action: "shown",
          });
          next.add(r.id);
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [recommendations, logEvent]);

  /* ================= Voice ================= */

  const voice = useVoiceInput({
    lang: language,
    onFinal: (text) => {
      logEvent("voice_input", { length: text.length });

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
    if (!hoveredRec || !hoveredRec.targetViewId) return {};

    const base = views.find((v) => v.id === hoveredRec.targetViewId);
    if (!base) return {};

    const payload = hoveredRec.payload as AnyPayload;
    const nextType: ChartType = payload?.chartType ?? base.chartType;

    const previewView =
      hoveredRec.type === "REMOVE_CONTENT"
        ? base
        : normalizeViewUpdate(base, payload, nextType);

    return {
      [base.id]: {
        type: hoveredRec.type === "REMOVE_CONTENT" ? "REMOVE" : "MODIFY",
        view: previewView,
      },
    };
  }, [hoveredRec, views]);

  const addPreview = useMemo<View | null>(() => {
    if (!hoveredRec || hoveredRec.type !== "NEW_CONTENT") return null;
    const payload = hoveredRec.payload as AnyPayload;
    return buildNewViewFromPayload(payload, views.length + 1);
  }, [hoveredRec, views.length]);

  /* ================= APPLY ================= */

  const apply = (r: Recommendation) => {
    logEvent("recommendation", {
      recommendationId: r.id,
      type: r.type,
      action: "accepted",
    });

    setAcceptedRecommendationIds((prev) => [...prev, r.id]);

    setViews((prev) => {
      const payload = r.payload as AnyPayload;

      switch (r.type) {
        case "MODIFY_CONTENT":
        case "RESIZE": {
          return prev.map((v) => {
            if (v.id !== r.targetViewId) return v;

            const nextType: ChartType = payload?.chartType ?? v.chartType;
            return normalizeViewUpdate(v, payload, nextType);
          });
        }

        case "REORDER": {
          const id: string | undefined = payload?.id;
          if (!id) return prev;

          const nextPriority: number | undefined = payload?.priority;
          if (typeof nextPriority !== "number") return prev;

          return [...prev]
            .map((v, i) =>
              v.id === id
                ? { ...v, priority: nextPriority ?? v.priority ?? i }
                : v
            )
            .sort((a, b) => a.priority - b.priority);
        }

        case "NEW_CONTENT": {
          const next = buildNewViewFromPayload(payload, prev.length + 1);
          return [...prev, next];
        }

        case "REMOVE_CONTENT": {
          const id: string | undefined = payload?.id;
          if (!id) return prev;
          return prev.filter((v) => v.id !== id);
        }

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
                logEvent("view_select", { viewId });

                if (selectedViewId === viewId) {
                  setSelectedViewId(null);
                  setSidebarMode("FORMAT");
                } else {
                  setSelectedViewId(viewId);
                  setSidebarMode("STRUCTURE");
                }
              }}
              onDelete={(viewId) => {
                logEvent("view_delete", { viewId });
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
                logEvent("sidebar_mode_change", { mode: v });
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
              logEvent("text_chat", { length: msg.length });

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
              });

              setSelectedViewId(null);
              setSidebarMode("FORMAT");

              setViews((prev) => prev.map((v) => (v.id === id ? next : v)));
            }}
            onAddView={(payload) => {
              logEvent("view_create", {
                triggeredBy: "manual",
                chartType: payload.chartType,
              });

              setSelectedViewId(null);
              setSidebarMode("FORMAT");

              setViews((prev) => [
                ...prev,
                buildNewViewFromPayload(payload, prev.length + 1),
              ]);
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
