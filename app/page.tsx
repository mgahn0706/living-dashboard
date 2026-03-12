"use client";

import React, { useCallback, useMemo, useState, useEffect, useRef } from "react";
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
import { TimeFilterProvider } from "@/context/TimeFilterContext";
import { CategoryFilterProvider, useCategoryFilter } from "@/context/CategoryFilterContext";

import { useExperimentLogger } from "@/hooks/useExperimentLogger";
import type { VoiceUtterance } from "@/hooks/useVoiceInput";

const AUTO_SAVE_INTERVAL_MS = 60_000;
const AUTO_SAVE_STORAGE_KEY = "ld_dashboard_autosave_session";

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

type SavedDashboardState = {
  savedAt: string;
  views?: View[];
  focusScore?: Record<string, number>;
  textChats?: string[];
  llmReplies?: string[];
  appliedRecommendations?: Recommendation[];
  acceptedRecommendationIds?: string[];
  voiceConversation?: VoiceUtterance[];
  language?: "en-US" | "ko-KR" | "ja-JP";
  experimentSession?: unknown;
};

function getValueByPath(row: any, path: string) {
  return path.split(".").reduce((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return acc[key];
  }, row);
}

function normalizeFilterValue(v: any) {
  if (v == null) return "";
  if (typeof v === "string") return v.trim().toLowerCase();
  return String(v).trim().toLowerCase();
}

function getDistinctValueMap(rows: any[], column: string) {
  const map = new Map<string, any>();
  for (const row of rows) {
    const value = getValueByPath(row, column);
    if (value === null || value === undefined || value === "") continue;
    const key = normalizeFilterValue(value);
    if (!key) continue;
    if (!map.has(key)) map.set(key, value);
  }
  return map;
}

function coerceToExistingValues(
  candidates: Array<string | number | boolean> | undefined,
  rows: any[],
  column: string
): Array<string | number | boolean> {
  if (!Array.isArray(candidates) || candidates.length === 0) return [];
  const existing = getDistinctValueMap(rows, column);
  const out: Array<string | number | boolean> = [];
  for (const v of candidates) {
    const matched = existing.get(normalizeFilterValue(v));
    if (matched !== undefined) out.push(matched);
  }
  return out;
}

function sanitizeFilterForView(
  filter: View["filter"] | undefined,
  view: View,
  rawData: any[]
): View["filter"] | undefined {
  if (!filter) return undefined;

  const next: NonNullable<View["filter"]> = {};

  if (typeof filter.top === "number" && filter.top > 0) {
    next.top = Math.floor(filter.top);
  }

  if (Array.isArray(filter.includeColumns) && view.chartType === "TABLE") {
    const valid = new Set(view.columns);
    const cols = filter.includeColumns.filter((c) => valid.has(c));
    if (cols.length > 0) next.includeColumns = cols;
  }

  const xColumn = view.chartType === "TABLE" ? view.columns[0] : view.xColumn;
  if (xColumn) {
    const xValues = coerceToExistingValues(
      filter.includeXValues,
      rawData,
      xColumn
    ).filter(
      (v): v is string | number => typeof v === "string" || typeof v === "number"
    );
    if (xValues.length > 0) next.includeXValues = xValues;
  }

  if (Array.isArray(filter.includeByColumn)) {
    const rules: Array<{
      column: string;
      includeValues: Array<string | number | boolean>;
    }> = filter.includeByColumn
      .map((rule) => {
        if (!rule?.column) return null;
        const values = coerceToExistingValues(
          rule.includeValues,
          rawData,
          rule.column
        );
        if (values.length === 0) return null;
        return { column: rule.column, includeValues: values };
      })
      .filter(Boolean) as Array<{
      column: string;
      includeValues: Array<string | number | boolean>;
    }>;
    if (rules.length > 0) next.includeByColumn = rules;
  }

  if (Object.keys(next).length === 0) return undefined;
  return next;
}

function hasOwn(obj: any, key: string) {
  return Object.prototype.hasOwnProperty.call(obj ?? {}, key);
}

function resolveFilterPatch(payload: AnyPayload, current: View["filter"]) {
  if (!hasOwn(payload, "filter")) return current;
  return payload?.filter ?? undefined;
}

function getRecommendationTargetViewId(r: Recommendation) {
  const payload = r.payload as AnyPayload;
  return r.targetViewId ?? payload?.id;
}

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
    filter: payload.filter,
    groupByColumn: payload.groupByColumn,
    aggregation: payload.aggregation,
    colorByColumn: payload.colorByColumn,
    sortDescending: payload.sortDescending,
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
    filter: payload.filter,
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
    filter: resolveFilterPatch(payload, base.filter),
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
        filter: payload?.filter ?? undefined,
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
      filter: payload?.filter ?? undefined,
      groupByColumn: payload?.groupByColumn,
      aggregation: payload?.aggregation,
      colorByColumn: payload?.colorByColumn,
      sortDescending: payload?.sortDescending,
    },
    priority
  );
}

function sanitizeInitialGeneratedView(
  view: View,
  attributeKeys: string[],
  attributeTypes: Record<string, "string" | "number" | "date" | "unknown">
): View | null {
  if (view.chartType === "TABLE") {
    const columns = view.columns.filter((col) => attributeKeys.includes(col));
    if (columns.length === 0) return null;
    return { ...view, columns };
  }

  if (
    !attributeKeys.includes(view.xColumn) ||
    !attributeKeys.includes(view.yColumn)
  ) {
    return null;
  }

  const xType = attributeTypes[view.xColumn];
  const yType = attributeTypes[view.yColumn];

  if (view.chartType === "SCATTER") {
    if (xType !== "number" || yType !== "number") return null;
  } else {
    if (yType !== "number") return null;
  }

  return view;
}

function buildFallbackTableView(
  attributeKeys: string[],
  priority: number
): TableView | null {
  if (!attributeKeys.length) return null;
  const columns = attributeKeys.slice(0, Math.min(6, attributeKeys.length));
  if (columns.length === 0) return null;

  return makeTableView(
    {
      id: `v_table_fallback_${Date.now()}`,
      chartType: "TABLE",
      columns,
      size: "md",
      title: "Detailed Data",
    },
    priority
  );
}

/* =====================================================
   Demo Dashboard Views
===================================================== */

function getDemoViews(): View[] {
  return [
    // KPI 1: Total Revenue Won
    {
      id: "demo_kpi_revenue",
      chartType: "KPI",
      xColumn: "",
      yColumn: "Revenue",
      size: "sm",
      priority: 100,
      title: "Total Revenue Won",
      aggregation: "sum",
      yLabel: "$",
      filter: {
        includeByColumn: [{ column: "Status", includeValues: ["Won"] }],
      },
    },
    // KPI 2: Total Units Sold
    {
      id: "demo_kpi_units",
      chartType: "KPI",
      xColumn: "",
      yColumn: "Units",
      size: "sm",
      priority: 99,
      title: "Total Units Sold",
      aggregation: "sum",
      filter: {
        includeByColumn: [{ column: "Status", includeValues: ["Won"] }],
      },
    },
    // KPI 3: Total Won Deals
    {
      id: "demo_kpi_winrate",
      chartType: "KPI",
      xColumn: "",
      yColumn: "Revenue",
      size: "sm",
      priority: 98,
      title: "Total Won Deals",
      aggregation: "count",
      filter: {
        includeByColumn: [{ column: "Status", includeValues: ["Won"] }],
      },
    },
    // KPI 4: Avg Deal Size
    {
      id: "demo_kpi_avgdeal",
      chartType: "KPI",
      xColumn: "",
      yColumn: "Revenue",
      size: "sm",
      priority: 97,
      title: "Avg Deal Size",
      aggregation: "avg",
      yLabel: "$",
      filter: {
        includeByColumn: [{ column: "Status", includeValues: ["Won"] }],
      },
    },
    // Funnel Chart — Revenue by Stage
    {
      id: "demo_funnel",
      chartType: "FUNNEL",
      xColumn: "Stage",
      yColumn: "Revenue",
      size: "lg",
      priority: 96,
      title: "Revenue by Stage",
      aggregation: "sum",
    },
    // Stacked Bar — Sum of Units by Stage, split by Won/Lost
    {
      id: "demo_stacked_units",
      chartType: "STACKED_BAR",
      xColumn: "Stage",
      yColumn: "Units",
      groupByColumn: "Status",
      size: "md",
      priority: 95,
      title: "Units by Stage (Won/Lost)",
    },
    // Revenue by Territory — Clustered bar chart
    {
      id: "demo_rev_territory",
      chartType: "GROUPED_BAR",
      xColumn: "Territory",
      yColumn: "Revenue",
      groupByColumn: "Status",
      size: "md",
      priority: 94,
      title: "Revenue by Territory",
    },
    // Revenue by Country — Bubble map
    {
      id: "demo_map_country",
      chartType: "MAP",
      xColumn: "Country",
      yColumn: "Revenue",
      aggregation: "sum",
      size: "xl",
      priority: 93,
      title: "Revenue by Country",
    },
    // Revenue by Segment — Stacked bar
    {
      id: "demo_rev_segment",
      chartType: "STACKED_BAR",
      xColumn: "Segment",
      yColumn: "Revenue",
      groupByColumn: "Status",
      size: "md",
      priority: 92,
      title: "Revenue by Segment",
    },
    // Revenue by Product Category — Donut chart
    {
      id: "demo_rev_prodcat",
      chartType: "DONUT",
      xColumn: "Product Category",
      yColumn: "Revenue",
      size: "md",
      priority: 92,
      title: "Revenue by Product Category",
    },
    // Won vs Lost by Industry — Stacked bar chart
    {
      id: "demo_wr_industry",
      chartType: "STACKED_BAR",
      xColumn: "Industry",
      yColumn: "Revenue",
      groupByColumn: "Status",
      aggregation: "count",
      size: "md",
      priority: 91,
      title: "Won vs Lost by Industry",
    },
    // Won vs Lost by Campaign Type — Stacked bar chart
    {
      id: "demo_wr_campaign",
      chartType: "STACKED_BAR",
      xColumn: "CampaignType",
      yColumn: "Revenue",
      groupByColumn: "Status",
      aggregation: "count",
      size: "md",
      priority: 90,
      title: "Won vs Lost by Campaign Type",
    },
    // Won vs Lost by Experience Level — Grouped bar
    {
      id: "demo_wr_experience",
      chartType: "GROUPED_BAR",
      xColumn: "Experience Level",
      yColumn: "Revenue",
      groupByColumn: "Status",
      aggregation: "count",
      size: "md",
      priority: 89,
      title: "Won vs Lost by Experience Level",
    },
    // Revenue Trend Over Time — Line chart by CloseDate (Won deals only)
    {
      id: "demo_rev_trend",
      chartType: "LINE",
      xColumn: "CloseDate",
      yColumn: "Revenue",
      size: "md",
      priority: 88,
      title: "Revenue Trend Over Time",
      filter: {
        includeByColumn: [{ column: "Status", includeValues: ["Won"] }],
      },
    },
    // Deal Duration Timeline — Range bar by Stage
    {
      id: "demo_velocity",
      chartType: "RANGE_BAR",
      xColumn: "Created Date",
      x2Column: "CloseDate",
      yColumn: "Stage",
      size: "md",
      priority: 87,
      title: "Deal Duration Timeline",
    },
    // Revenue by Market Maturity — Column chart
    {
      id: "demo_rev_maturity",
      chartType: "BAR",
      xColumn: "Market Maturity",
      yColumn: "Revenue",
      size: "md",
      priority: 85,
      title: "Revenue by Market Maturity",
    },
    // Products by Revenue — Horizontal bar with drill-down by category (Won deals only)
    {
      id: "demo_top_products",
      chartType: "HORIZONTAL_BAR",
      xColumn: "Product Name",
      yColumn: "Revenue",
      groupByColumn: "Product Category",
      size: "md",
      priority: 84,
      title: "Products by Revenue",
      sortDescending: true,
      filter: {
        includeByColumn: [{ column: "Status", includeValues: ["Won"] }],
      },
    },
    // ClosePct vs Revenue Scatter — colored by Segment
    {
      id: "demo_scatter",
      chartType: "SCATTER",
      xColumn: "ClosePct",
      yColumn: "Revenue",
      colorByColumn: "Segment",
      size: "md",
      priority: 83,
      title: "ClosePct vs Revenue",
    },
  ];
}

/* =====================================================
   App Content
===================================================== */

function AppContent() {
  const [views, setViews] = useState<View[]>([]);
  const [acceptedRecommendationIds, setAcceptedRecommendationIds] = useState<
    string[]
  >([]);
  const [appliedRecommendations, setAppliedRecommendations] = useState<
    (Recommendation & { _prevViews: View[] })[]
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
  const [isInitializing, setIsInitializing] = useState(false);
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(false);

  const { focusScore } = useFocus();
  const { schema, attributeKeys, attributeTypes, rawData, loadDemoDataset, resolveAttribute } =
    useDataset();
  const { addFilter: addCategoryFilter } = useCategoryFilter();

  const {
    recommendations,
    llmReplies,
    acceptRecommendation,
    isLoading,
    triggerRecommendation,
    restoreHistory,
  } = useRecommendation();

  const { session: experimentSession, logEvent } = useExperimentLogger();

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

  useEffect(() => {
    if (hasRestoredAutoSaveRef.current) return;
    hasRestoredAutoSaveRef.current = true;

    const stored = localStorage.getItem(AUTO_SAVE_STORAGE_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as SavedDashboardState;
      const restoredViews = Array.isArray(parsed.views) ? parsed.views : [];

      if (restoredViews.length > 0) {
        setViews(restoredViews);
      }

      if (Array.isArray(parsed.textChats)) {
        setTextChats(parsed.textChats.filter((item) => typeof item === "string"));
      }

      if (Array.isArray(parsed.appliedRecommendations)) {
        setAppliedRecommendations(
          parsed.appliedRecommendations.map((rec) => ({
            ...rec,
            _prevViews: restoredViews,
          }))
        );
      }

      if (Array.isArray(parsed.acceptedRecommendationIds)) {
        setAcceptedRecommendationIds(
          parsed.acceptedRecommendationIds.filter((id) => typeof id === "string")
        );
      }

      if (parsed.language === "en-US" || parsed.language === "ko-KR" || parsed.language === "ja-JP") {
        setLanguage(parsed.language);
      }

      if (Array.isArray(parsed.voiceConversation)) {
        voice.restoreConversation(parsed.voiceConversation);
      }

      restoreHistory({
        llmReplies: parsed.llmReplies,
        dismissedRecommendationIds: parsed.acceptedRecommendationIds,
      });
    } catch {
      console.warn("Failed to restore auto-saved dashboard session.");
    }
  }, [restoreHistory, voice]);

  /* ================= PREVIEW ================= */

  const previewMap = useMemo<Record<string, PreviewState>>(() => {
    if (!hoveredRec) return {};

    const targetId = getRecommendationTargetViewId(hoveredRec);
    if (!targetId) return {};

    const base = views.find((v) => v.id === targetId);
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

  const activeRecommendations = useMemo(
    () =>
      recommendations.filter((r) => !acceptedRecommendationIds.includes(r.id)),
    [recommendations, acceptedRecommendationIds]
  );

  const modifyRecommendationsByViewId = useMemo(() => {
    const map: Record<string, Recommendation> = {};
    activeRecommendations.forEach((r) => {
      if (
        r.type !== "MODIFY_CONTENT" &&
        r.type !== "MODIFY_FILTER" &&
        r.type !== "REMOVE_CONTENT"
      )
        return;
      const targetId = getRecommendationTargetViewId(r);
      if (!targetId) return;
      if (!map[targetId]) map[targetId] = r;
    });
    return map;
  }, [activeRecommendations]);

  const newContentRecommendation = useMemo(
    () => activeRecommendations.find((r) => r.type === "NEW_CONTENT") ?? null,
    [activeRecommendations]
  );

  const addPreview = useMemo<View | null>(() => {
    if (!newContentRecommendation) return null;
    const payload = newContentRecommendation.payload as AnyPayload;
    const minPriority =
      views.length > 0 ? Math.min(...views.map((v) => v.priority ?? 0)) : 0;
    return buildNewViewFromPayload(payload, minPriority - 1);
  }, [newContentRecommendation, views]);

  /* ================= APPLY ================= */

  const apply = (r: Recommendation) => {
    logEvent("recommendation", {
      recommendationId: r.id,
      type: r.type,
      action: "accepted",
    });

    setHoveredRec(null);
    setAcceptedRecommendationIds((prev) => [...prev, r.id]);

    setViews((prev) => {
      setAppliedRecommendations((prevHistory) => {
        const key = JSON.stringify({
          type: r.type,
          targetViewId: r.targetViewId ?? null,
          payload: r.payload,
        });
        const exists = prevHistory.some(
          (h) =>
            JSON.stringify({
              type: h.type,
              targetViewId: h.targetViewId ?? null,
              payload: h.payload,
            }) === key
        );
        if (exists) return prevHistory;
        return [{ ...r, _prevViews: prev }, ...prevHistory];
      });
      const payload = r.payload as AnyPayload;

      switch (r.type) {
        case "MODIFY_CONTENT":
        case "MODIFY_FILTER":
        case "RESIZE": {
          const targetId = getRecommendationTargetViewId(r);
          if (!targetId) return prev;
          return prev.map((v) => {
            if (v.id !== targetId) return v;

            const nextType: ChartType = payload?.chartType ?? v.chartType;
            const nextView = normalizeViewUpdate(v, payload, nextType);
            return {
              ...nextView,
              filter: sanitizeFilterForView(
                nextView.filter,
                nextView,
                Array.isArray(rawData) ? rawData : []
              ),
            };
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
          const minPriority =
            prev.length > 0 ? Math.min(...prev.map((v) => v.priority ?? 0)) : 0;
          const built = buildNewViewFromPayload(payload, minPriority - 1);
          const next = {
            ...built,
            filter: sanitizeFilterForView(
              built.filter,
              built,
              Array.isArray(rawData) ? rawData : []
            ),
          } as View;
          return [...prev, next];
        }

        case "REMOVE_CONTENT": {
          const id: string | undefined = getRecommendationTargetViewId(r);
          if (!id) return prev;
          return prev.filter((v) => v.id !== id);
        }

        default:
          return prev;
      }
    });

    acceptRecommendation(r);
  };

  const undoLatestRecommendation = () => {
    setAppliedRecommendations((prev) => {
      const latest = prev[0];
      if (!latest) return prev;
      setViews(latest._prevViews);
      return prev.slice(1);
    });
  };

  const decline = (r: Recommendation) => {
    logEvent("recommendation", {
      recommendationId: r.id,
      type: r.type,
      action: "declined",
    });

    setHoveredRec(null);
    acceptRecommendation(r);
  };

  const handleLoadDemo = async () => {
    try {
      setIsInitializing(true);
      await loadDemoDataset();
      setViews(getDemoViews());
      setSidebarMode("FORMAT");
      // Pre-add Status filter with all values selected
      addCategoryFilter("Status", ["Won", "Lost"]);
    } catch (err) {
      console.error("Failed to load demo dataset:", err);
    } finally {
      setIsInitializing(false);
    }
  };

  const initializeDashboard = async () => {
    try {
      if (!rawData || attributeKeys.length === 0) return;
      setIsInitializing(true);
      const res = await fetch("/api/initial-build", {
        method: "POST",
        body: JSON.stringify({
          attributeKeys,
          attributeTypes,
          dataSchema: schema,
        }),
      });

      const data = (await res.json()) as AnyPayload[];
      if (!Array.isArray(data) || data.length === 0) return;

      let nextViews = data
        .map((payload, i) => buildNewViewFromPayload(payload, data.length - i))
        .map((v) =>
          sanitizeInitialGeneratedView(v, attributeKeys, attributeTypes)
        )
        .filter(Boolean) as View[];

      const hasTableView = nextViews.some((v) => v.chartType === "TABLE");
      if (!hasTableView) {
        const minPriority =
          nextViews.length > 0
            ? Math.min(...nextViews.map((v) => v.priority ?? 0))
            : 0;
        const fallbackTable = buildFallbackTableView(attributeKeys, minPriority - 1);
        if (fallbackTable) {
          nextViews = [...nextViews, fallbackTable];
        }
      }

      if (nextViews.length === 0) {
        const fallbackTable = buildFallbackTableView(attributeKeys, 0);
        if (!fallbackTable) {
          console.warn("No compatible views from initial generation.");
          return;
        }
        nextViews = [fallbackTable];
      }

      setViews(nextViews);
      setSidebarMode("FORMAT");
    } catch (err) {
      console.error("Failed to initialize dashboard:", err);
    } finally {
      setIsInitializing(false);
    }
  };

  /* ================= Save Dashboard State ================= */

  const saveDashboardState = useCallback(() => {
    const payload: SavedDashboardState = {
      savedAt: new Date().toISOString(),
      views,
      focusScore,
      textChats,
      llmReplies,
      voiceConversation: voice.conversation,
      language,
      appliedRecommendations: appliedRecommendations.map(
        ({ _prevViews, ...rest }) => rest
      ),
      acceptedRecommendationIds,
      experimentSession: experimentSession ?? null,
    };

    localStorage.setItem(AUTO_SAVE_STORAGE_KEY, JSON.stringify(payload));
  }, [
    views,
    focusScore,
    textChats,
    llmReplies,
    voice.conversation,
    language,
    appliedRecommendations,
    acceptedRecommendationIds,
    experimentSession,
  ]);

  const saveDashboardStateRef = useRef(saveDashboardState);
  const hasRestoredAutoSaveRef = useRef(false);

  useEffect(() => {
    saveDashboardStateRef.current = saveDashboardState;
  }, [saveDashboardState]);

  useEffect(() => {
    if (!isAutoSaveEnabled) return;

    const intervalId = window.setInterval(() => {
      saveDashboardStateRef.current();
    }, AUTO_SAVE_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [isAutoSaveEnabled]);

  useEffect(() => {
    if (!isAutoSaveEnabled) return;

    const persistOnPageHide = () => {
      saveDashboardStateRef.current();
    };

    window.addEventListener("pagehide", persistOnPageHide);

    return () => window.removeEventListener("pagehide", persistOnPageHide);
  }, [isAutoSaveEnabled]);

  return (
    <>
      <SidebarInset className="bg-muted/10">
        <SiteHeader
          isAutoSaveEnabled={isAutoSaveEnabled}
          onAutoSaveToggle={setIsAutoSaveEnabled}
        />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto p-6 md:p-8">
            <DashboardView
              views={views}
              previewMap={previewMap}
              addPreview={addPreview}
              selectedViewId={selectedViewId}
              isAddMode={sidebarMode === "STRUCTURE"}
              setSidebarMode={setSidebarMode}
              recommendationsByViewId={modifyRecommendationsByViewId}
              newContentRecommendation={newContentRecommendation}
              onRecommendationHover={(r) => setHoveredRec(r)}
              onRecommendationLeave={() => setHoveredRec(null)}
              onAcceptRecommendation={apply}
              onDeclineRecommendation={decline}
              onInitializeDashboard={initializeDashboard}
              onLoadDemo={handleLoadDemo}
              canInitializeDashboard={
                Boolean(rawData) && attributeKeys.length > 0
              }
              isInitializingDashboard={isInitializing}
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
              onApplyFilter={(viewId, filter) => {
                logEvent("view_modify", {
                  viewId,
                  triggeredBy: "manual_filter",
                });
                setViews((prev) =>
                  prev.map((v) =>
                    v.id === viewId
                      ? {
                          ...v,
                          filter: sanitizeFilterForView(
                            filter,
                            v,
                            Array.isArray(rawData) ? rawData : []
                          ),
                        }
                      : v
                  )
                );
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
                AI history
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
            history={appliedRecommendations}
            llmReplies={llmReplies}
            onUndoLatest={undoLatestRecommendation}
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
            onDeleteView={(viewId) => {
              logEvent("view_delete", { viewId });
              setViews((prev) => prev.filter((v) => v.id !== viewId));
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
            <TimeFilterProvider>
              <CategoryFilterProvider>
                <AppContent />
              </CategoryFilterProvider>
            </TimeFilterProvider>
          </DatasetProvider>
        </FocusProvider>
      </SelectionProvider>
    </SidebarProvider>
  );
}
