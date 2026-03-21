"use client";

import React, {
  useCallback,
  useMemo,
  useState,
  useEffect,
  useRef,
} from "react";
import DashboardView from "@/components/dashboard/DashboardView";
import { useRecommendation, type LlmReply } from "@/hooks/useRecommendation";
import { FocusProvider, useFocus } from "@/context/FocusContext";
import type {
  ChartType,
  ChartView,
  DecayMode,
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
import { getRecColor } from "@/components/recommendation/RecommendationSidebar";
import { DatasetProvider, useDataset } from "@/context/DatasetContext";
import { SelectionProvider, useSelection } from "@/context/SelectionContext";
import { TimeFilterProvider } from "@/context/TimeFilterContext";
import { useTimeFilter } from "@/context/TimeFilterContext";
import {
  CategoryFilterProvider,
  useCategoryFilter,
} from "@/context/CategoryFilterContext";
import { useSystemMode } from "@/context/SystemModeContext";

import type { ExperimentSession } from "@/hooks/useExperimentLogger";
import type { VoiceUtterance } from "@/hooks/useVoiceInput";
import { useLogging } from "@/hooks/useLogging";
import { useChat, type ChatEntry } from "@/hooks/useChat";

const IMPORT_STORAGE_KEY = "ld_dashboard_import_session";

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
  systemMode?: "A" | "B" | null;
  views?: View[];
  focusScore?: Record<string, number>;
  textChats?: string[];
  llmReplies?: (string | LlmReply)[];
  appliedRecommendations?: Array<
    Recommendation & {
      _prevViews?: View[];
      _historyBatchId?: string;
    }
  >;
  acceptedRecommendationIds?: string[];
  voiceConversation?: VoiceUtterance[];
  language?: "en-US" | "ko-KR" | "ja-JP";
  chatMessages?: ChatEntry[];
  experimentSession?: unknown;
};

type DashboardStateFile = {
  version: 1;
  exportedAt: string;
  dataset?: unknown;
  dashboard: SavedDashboardState;
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
      (v): v is string | number =>
        typeof v === "string" || typeof v === "number"
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
    x2Column: payload.x2Column,
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
        x2Column: payload?.x2Column ?? base.x2Column,
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
      x2Column: payload?.x2Column,
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
  } else if (view.chartType === "RANGE_BAR") {
    // RANGE_BAR: yColumn is a category label (string), not a number
    return sanitizeX2Column(view as ChartView, attributeKeys, attributeTypes);
  } else {
    if (yType !== "number") return null;
  }

  return view;
}

/**
 * For RANGE_BAR views, validate that x2Column points to an actual
 * date column. If not, attempt to find the best fallback date column.
 */
function sanitizeX2Column(
  view: ChartView,
  attributeKeys: string[],
  attributeTypes: Record<string, string>
): ChartView {
  if (view.chartType !== "RANGE_BAR" || !view.x2Column) return view;

  // Exact match — valid
  if (attributeKeys.includes(view.x2Column)) return view;

  // Fuzzy match (case/whitespace insensitive)
  const normalized = view.x2Column.replace(/\s+/g, "").toLowerCase();
  const fuzzy = attributeKeys.find(
    (k) => k.replace(/\s+/g, "").toLowerCase() === normalized
  );
  if (fuzzy) return { ...view, x2Column: fuzzy };

  // Hallucinated name — pick the first date column that isn't xColumn
  const dateColumns = attributeKeys.filter((k) => attributeTypes[k] === "date");
  const fallback = dateColumns.find((c) => c !== view.xColumn) ?? dateColumns[0];
  if (fallback) {
    console.warn(
      `[sanitizeX2Column] Corrected "${view.x2Column}" → "${fallback}"`
    );
    return { ...view, x2Column: fallback };
  }

  return { ...view, x2Column: undefined };
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
    // KPI 5: Total Lost Deals
  
    // KPI 6: Total Revenue Lost
    {
      id: "demo_kpi_revlost",
      chartType: "KPI",
      xColumn: "",
      yColumn: "Revenue",
      size: "sm",
      priority: 97,
      title: "Total Revenue Lost",
      aggregation: "sum",
      yLabel: "$",
      filter: {
        includeByColumn: [{ column: "Status", includeValues: ["Lost"] }],
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
    (Recommendation & { _prevViews: View[]; _historyBatchId?: string })[]
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
  const [decayMode, setDecayMode] = useState<DecayMode>("vignette");
  const [isFocusScoreVisible, setIsFocusScoreVisible] = useState(false);
  const [appliedRecColorByViewId, setAppliedRecColorByViewId] = useState<
    Record<string, string>
  >({});
  const restoredFromStorageRef = useRef(false);
  const { systemMode, setSystemMode } = useSystemMode();
  const isLivingFeaturesEnabled = systemMode !== "B";
  const areRecommendationsEnabled = systemMode !== "B";

  const { clearSelection } = useSelection();
  const { focusScore, restoreFocusScore } = useFocus();
  const {
    schema,
    attributeKeys,
    attributeTypes,
    rawData,
    resolveAttribute,
    loadDemoDataset,
    restoreDataset,
  } = useDataset();
  const { timeFilter, selectedColumn, setSelectedColumn, setTimeFilter } =
    useTimeFilter();
  const {
    addFilter: addCategoryFilter,
    categoryFilters,
    removeFilter: removeCategoryFilter,
    selectAll: selectAllCategoryFilter,
    deselectAll: deselectAllCategoryFilter,
    toggleValue: toggleCategoryFilterValue,
    clearAll: clearAllCategoryFilters,
  } = useCategoryFilter();

  const {
    recommendations,
    llmReplies,
    acceptRecommendation,
    isLoading,
    streamingText,
    triggerRecommendation,
    restoreHistory,
    clearRecommendations,
    resetAccepted,
  } = useRecommendation();

  const {
    messages: chatMessages,
    isLoading: isChatLoading,
    streamingText: chatStreamingText,
    sendMessage: sendChatMessage,
    restoreMessages: restoreChatMessages,
    clearMessages: clearChatMessages,
  } = useChat();

  const {
    session: experimentSession,
    logUserEvent,
    restoreSession,
  } = useLogging();

  /* ================= Recommendation SHOWN ================= */

  const [shownRecIds, setShownRecIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isLivingFeaturesEnabled) return;

    setShownRecIds((prev) => {
      const next = new Set(prev);
      let changed = false;

      recommendations.forEach((r) => {
        if (!next.has(r.id)) {
          logUserEvent(
            "recommendation_shown",
            {
              recommendationId: r.id,
              recommendationType: r.type,
            },
            views,
            focusScore
          );
          next.add(r.id);
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [focusScore, isLivingFeaturesEnabled, logUserEvent, recommendations, views]);

  useEffect(() => {
    if (isLivingFeaturesEnabled) return;
    clearRecommendations();
    setHoveredRec(null);
    setShownRecIds(new Set());
  }, [clearRecommendations, isLivingFeaturesEnabled]);

  /* ================= Voice ================= */

  const voice = useVoiceInput({
    lang: language,
    onFinal: (text) => {
      logUserEvent(
        "llm_request",
        {
          requestSource: "voice",
          message: text,
          messageLength: text.length,
        },
        views,
        focusScore
      );

      if (areRecommendationsEnabled) {
        triggerRecommendation({
          views,
          textChats: [...textChats, text],
          focusScore,
          dataSchema: schema,
          attributeTypes,
          resolveAttribute,
          conversation: voice.conversation,
          suppressRecommendations: false,
        });
      } else {
        sendChatMessage({
          text,
          source: "voice",
          views,
          dataSchema: schema,
        });
      }
    },
  });

  const restoreDashboardState = useCallback(
    (parsed: SavedDashboardState) => {
      const restoredViews = Array.isArray(parsed.views) ? parsed.views : [];

      setViews(restoredViews);
      setSelectedViewId(null);
      setSidebarMode("FORMAT");
      setHoveredRec(null);
      setShownRecIds(new Set());

      setTextChats(
        Array.isArray(parsed.textChats)
          ? parsed.textChats.filter((item) => typeof item === "string")
          : []
      );

      setAppliedRecommendations(
        Array.isArray(parsed.appliedRecommendations)
          ? parsed.appliedRecommendations.map((rec) => ({
              ...rec,
              _prevViews: Array.isArray(rec._prevViews)
                ? rec._prevViews
                : restoredViews,
            }))
          : []
      );

      const restoredAcceptedIds = Array.isArray(
        parsed.acceptedRecommendationIds
      )
        ? parsed.acceptedRecommendationIds.filter(
            (id) => typeof id === "string"
          )
        : [];
      setAcceptedRecommendationIds(restoredAcceptedIds);

      if (
        parsed.language === "en-US" ||
        parsed.language === "ko-KR" ||
        parsed.language === "ja-JP"
      ) {
        setLanguage(parsed.language);
      } else {
        setLanguage("en-US");
      }

      if (parsed.systemMode === "A" || parsed.systemMode === "B") {
        setSystemMode(parsed.systemMode);
      }

      if (
        parsed.focusScore &&
        typeof parsed.focusScore === "object" &&
        !Array.isArray(parsed.focusScore)
      ) {
        restoreFocusScore(parsed.focusScore);
      } else {
        restoreFocusScore({});
      }

      voice.restoreConversation(
        Array.isArray(parsed.voiceConversation) ? parsed.voiceConversation : []
      );

      resetAccepted();
      restoreHistory({
        llmReplies: Array.isArray(parsed.llmReplies) ? parsed.llmReplies : [],
        dismissedRecommendationIds: restoredAcceptedIds,
      });

      restoreChatMessages(
        Array.isArray(parsed.chatMessages) ? parsed.chatMessages : []
      );

      const nextExperimentSession =
        parsed.experimentSession &&
        typeof parsed.experimentSession === "object" &&
        !Array.isArray(parsed.experimentSession)
          ? (parsed.experimentSession as ExperimentSession)
          : null;
      restoreSession(nextExperimentSession);
    },
    [
      resetAccepted,
      restoreChatMessages,
      restoreFocusScore,
      restoreHistory,
      restoreSession,
      setSystemMode,
      voice,
    ]
  );

  useEffect(() => {
    if (restoredFromStorageRef.current) return;
    restoredFromStorageRef.current = true;

    const stored = sessionStorage.getItem(IMPORT_STORAGE_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as unknown;

      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid stored dashboard state");
      }

      const importedDashboard =
        "dashboard" in parsed &&
        parsed.dashboard &&
        typeof parsed.dashboard === "object"
          ? parsed.dashboard
          : parsed;

      const importedDataset = "dataset" in parsed ? parsed.dataset : undefined;

      if (importedDataset !== undefined && importedDataset !== null) {
        restoreDataset(importedDataset);
      }

      restoreDashboardState(importedDashboard as SavedDashboardState);
      sessionStorage.removeItem(IMPORT_STORAGE_KEY);
    } catch {
      console.warn("Failed to restore imported dashboard session.");
      sessionStorage.removeItem(IMPORT_STORAGE_KEY);
    }
  }, [restoreDashboardState, restoreDataset]);

  const loggedReplyTimestampsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    llmReplies.forEach((reply) => {
      if (loggedReplyTimestampsRef.current.has(reply.timestamp)) return;
      loggedReplyTimestampsRef.current.add(reply.timestamp);
      logUserEvent(
        "llm_response",
        {
          message: reply.text,
          messageLength: reply.text.length,
        },
        views,
        focusScore
      );
    });
  }, [focusScore, llmReplies, logUserEvent, views]);

  /* ================= PREVIEW ================= */

  const previewMap = useMemo<Record<string, PreviewState>>(() => {
    if (!areRecommendationsEnabled || !hoveredRec) return {};

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

  const activeRecommendations = useMemo(() => {
    if (!areRecommendationsEnabled) return [];
    return recommendations.filter((r) => !acceptedRecommendationIds.includes(r.id));
  }, [areRecommendationsEnabled, recommendations, acceptedRecommendationIds]);

  // Separate HIGHLIGHT recs (auto-applied) from actionable recs (shown in sidebar)
  const actionableRecommendations = useMemo(
    () => activeRecommendations.filter((r) => r.type !== "HIGHLIGHT"),
    [activeRecommendations]
  );

  // Auto-apply HIGHLIGHT recommendations immediately (pulsate + scroll)
  const appliedHighlightIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const highlights = activeRecommendations.filter(
      (r) =>
        r.type === "HIGHLIGHT" &&
        !appliedHighlightIdsRef.current.has(r.id)
    );
    if (highlights.length === 0) return;

    let firstScrollDone = false;
    for (const r of highlights) {
      appliedHighlightIdsRef.current.add(r.id);
      const targetId = getRecommendationTargetViewId(r);
      if (!targetId) continue;

      // Scroll to the first highlighted view only
      if (!firstScrollDone) {
        const el = document.querySelector(
          `[data-view-id="${targetId}"]`
        ) as HTMLElement | null;
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        firstScrollDone = true;
      }

      // Set pulsating color with action verb encoded
      const action =
        (r.payload as any)?.highlightAction || "view";
      const color = "#3b82f6";
      setAppliedRecColorByViewId((prev) => ({
        ...prev,
        [targetId]: `${color}__pulse__${action}`,
      }));

      // Clear after 15 seconds
      setTimeout(() => {
        setAppliedRecColorByViewId((prev) => {
          const next = { ...prev };
          delete next[targetId];
          return next;
        });
      }, 15_000);

      // Dismiss from active recommendations
      acceptRecommendation(r);
    }
  }, [activeRecommendations, acceptRecommendation]);

  const modifyRecommendationsByViewId = useMemo(() => {
    const map: Record<string, Recommendation> = {};
    activeRecommendations.forEach((r) => {
      if (r.type === "NEW_CONTENT") return;
      const targetId = getRecommendationTargetViewId(r);
      if (!targetId) return;
      if (!map[targetId]) map[targetId] = r;
    });
    return map;
  }, [activeRecommendations]);

  // Stable order map: lock each recommendation to its original index so
  // colors don't shift when earlier recommendations are applied/removed.
  const stableOrderRef = useRef<Record<string, number>>({});
  const recommendationOrderMap = useMemo(() => {
    activeRecommendations.forEach((r, idx) => {
      if (!(r.id in stableOrderRef.current)) {
        stableOrderRef.current[r.id] = idx + 1;
      }
    });
    return { ...stableOrderRef.current };
  }, [activeRecommendations]);

  const viewTitlesMap = useMemo(() => {
    const map: Record<string, string> = {};
    views.forEach((v) => {
      map[v.id] = v.title || v.id;
    });
    return map;
  }, [views]);

  const newContentRecommendation = useMemo(
    () => activeRecommendations.find((r) => r.type === "NEW_CONTENT") ?? null,
    [activeRecommendations]
  );

  const addPreview = useMemo<View | null>(() => {
    if (!newContentRecommendation) return null;
    const payload = newContentRecommendation.payload as AnyPayload;
    const minPriority =
      views.length > 0 ? Math.min(...views.map((v) => v.priority ?? 0)) : 0;
    let built = buildNewViewFromPayload(payload, minPriority - 1);
    if (built.chartType === "RANGE_BAR" && "x2Column" in built) {
      built = sanitizeX2Column(built as ChartView, attributeKeys, attributeTypes);
    }
    return built;
  }, [newContentRecommendation, views, attributeKeys, attributeTypes]);

  /* ================= APPLY ================= */

  const applyRecommendationSet = useCallback(
    (
      recommendationsToApply: Recommendation[],
      options?: {
        historyBatchId?: string;
        logEventType?: string;
      }
    ) => {
      if (recommendationsToApply.length === 0) return;

      setHoveredRec(null);
      setAcceptedRecommendationIds((prev) => [
        ...prev,
        ...recommendationsToApply.map((r) => r.id),
      ]);

      setViews((prev) => {
        let nextViews = prev;
        const historyEntries: (Recommendation & {
          _prevViews: View[];
          _historyBatchId?: string;
        })[] = [];

        recommendationsToApply.forEach((r) => {
          const payload = r.payload as AnyPayload;

          historyEntries.push({
            ...r,
            _prevViews: options?.historyBatchId ? prev : nextViews,
            _historyBatchId: options?.historyBatchId,
          });

          switch (r.type) {
            case "MODIFY_CONTENT":
            case "MODIFY_FILTER":
            case "RESIZE": {
              const targetId = getRecommendationTargetViewId(r);
              if (!targetId) return;
              nextViews = nextViews.map((v) => {
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
              return;
            }

            case "REORDER": {
              const id: string | undefined = payload?.id;
              const nextPriority: number | undefined = payload?.priority;
              if (!id || typeof nextPriority !== "number") return;

              nextViews = [...nextViews]
                .map((v, i) =>
                  v.id === id
                    ? { ...v, priority: nextPriority ?? v.priority ?? i }
                    : v
                )
                .sort((a, b) => a.priority - b.priority);
              return;
            }

            case "NEW_CONTENT": {
              const minPriority =
                nextViews.length > 0
                  ? Math.min(...nextViews.map((v) => v.priority ?? 0))
                  : 0;
              let built = buildNewViewFromPayload(payload, minPriority - 1);
              if (built.chartType === "RANGE_BAR" && "x2Column" in built) {
                built = sanitizeX2Column(
                  built as ChartView,
                  attributeKeys,
                  attributeTypes
                );
              }
              const next = {
                ...built,
                filter: sanitizeFilterForView(
                  built.filter,
                  built,
                  Array.isArray(rawData) ? rawData : []
                ),
              } as View;
              nextViews = [...nextViews, next];
              return;
            }

            case "REMOVE_CONTENT": {
              const id: string | undefined = getRecommendationTargetViewId(r);
              if (!id) return;
              nextViews = nextViews.filter((v) => v.id !== id);
              return;
            }

            case "HIGHLIGHT": {
              // HIGHLIGHT does NOT modify views — it only triggers visual attention
              const targetId = getRecommendationTargetViewId(r);
              if (!targetId) return;
              const el = document.querySelector(
                `[data-view-id="${targetId}"]`
              ) as HTMLElement | null;
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
              }
              return;
            }

            default:
              return;
          }
        });

        setAppliedRecommendations((prevHistory) => [
          ...historyEntries.reverse(),
          ...prevHistory,
        ]);

        if (options?.logEventType) {
          logUserEvent(
            options.logEventType,
            {
              recommendationIds: recommendationsToApply.map((r) => r.id),
              recommendationTypes: recommendationsToApply.map((r) => r.type),
              recommendationCount: recommendationsToApply.length,
            },
            prev,
            focusScore,
            { viewsOverride: nextViews }
          );
        } else {
          recommendationsToApply.forEach((r) => {
            logUserEvent(
              "recommendation_accepted",
              {
                recommendationId: r.id,
                recommendationType: r.type,
              },
              prev,
              focusScore,
              { viewsOverride: nextViews }
            );
          });
        }

        return nextViews;
      });

      recommendationsToApply.forEach((r) => {
        const targetId = getRecommendationTargetViewId(r);
        if (targetId) {
          const orderIdx = recommendationOrderMap[r.id];
          const color = orderIdx != null ? getRecColor(orderIdx - 1) : "#3b82f6";
          const action = (r.payload as any)?.highlightAction || "view";
          const colorValue = r.type === "HIGHLIGHT" ? `${color}__pulse__${action}` : color;
          setAppliedRecColorByViewId((prev) => ({
            ...prev,
            [targetId]: colorValue,
          }));
          setTimeout(() => {
            setAppliedRecColorByViewId((prev) => {
              const next = { ...prev };
              delete next[targetId];
              return next;
            });
          }, 10_000);
        }

        acceptRecommendation(r);
      });
    },
    [acceptRecommendation, focusScore, logUserEvent, rawData, recommendationOrderMap]
  );

  const apply = (r: Recommendation) => {
    applyRecommendationSet([r]);
  };

  const undoLatestRecommendation = () => {
    setAppliedRecommendations((prev) => {
      const latest = prev[0];
      if (!latest) return prev;
      const latestBatchId = latest._historyBatchId;

      if (latestBatchId) {
        const batchedEntries = prev.filter(
          (entry) => entry._historyBatchId === latestBatchId
        );
        const remainingEntries = prev.filter(
          (entry) => entry._historyBatchId !== latestBatchId
        );
        const batchStartViews =
          batchedEntries[batchedEntries.length - 1]?._prevViews ?? latest._prevViews;
        setViews(batchStartViews);
        return remainingEntries;
      }

      setViews(latest._prevViews);
      return prev.slice(1);
    });
  };

  const applyAll = () => {
    const batchId = `apply_all_${Date.now()}`;
    applyRecommendationSet(actionableRecommendations, {
      historyBatchId: batchId,
      logEventType: "recommendation_apply_all",
    });
  };

  const decline = (r: Recommendation) => {
    logUserEvent(
      "recommendation_declined",
      {
        recommendationId: r.id,
        recommendationType: r.type,
      },
      views,
      focusScore
    );

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
        const fallbackTable = buildFallbackTableView(
          attributeKeys,
          minPriority - 1
        );
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

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  /* Auto-scroll to first recommendation target when new recommendations arrive */
  useEffect(() => {
    if (!areRecommendationsEnabled || actionableRecommendations.length === 0) return;
    const first = actionableRecommendations.find((r) => r.targetViewId);
    if (!first?.targetViewId) return;
    const el = document.querySelector(`[data-view-id="${first.targetViewId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [actionableRecommendations, areRecommendationsEnabled]);
  const exportDashboardState = useCallback(() => {
    const exportedAt = new Date().toISOString();
    const payload: DashboardStateFile = {
      version: 1,
      exportedAt,
      dataset: rawData ?? null,
      dashboard: {
        savedAt: exportedAt,
        systemMode,
        views,
        focusScore,
        textChats,
        llmReplies,
        chatMessages,
        voiceConversation: voice.conversation,
        language,
        appliedRecommendations,
        acceptedRecommendationIds,
        experimentSession: experimentSession ?? null,
      },
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const timestamp = exportedAt.replace(/[:.]/g, "-");

    a.href = url;
    a.download = `living-dashboard-state-${timestamp}.json`;
    a.click();

    URL.revokeObjectURL(url);

    const logBlob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt,
            experimentSession: experimentSession ?? null,
          },
          null,
          2
        ),
      ],
      {
        type: "application/json",
      }
    );
    const logUrl = URL.createObjectURL(logBlob);
    const logAnchor = document.createElement("a");

    logAnchor.href = logUrl;
    logAnchor.download = `living-dashboard-log-${timestamp}.json`;
    logAnchor.click();

    URL.revokeObjectURL(logUrl);
  }, [
    acceptedRecommendationIds,
    appliedRecommendations,
    experimentSession,
    focusScore,
    language,
    llmReplies,
    rawData,
    systemMode,
    textChats,
    views,
    voice.conversation,
  ]);

  const handleViewFilterChange = useCallback(
    (viewId: string, filter: View["filter"] | undefined) => {
      setViews((prev) => {
        const nextViews = prev.map((v) =>
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
        );

        logUserEvent(
          "data_filter",
          {
            filterScope: "view",
            viewId,
            triggeredBy: "manual_filter",
          },
          prev,
          focusScore,
          { viewsOverride: nextViews }
        );

        return nextViews;
      });
    },
    [focusScore, logUserEvent, rawData]
  );

  const handleCategoryFilterAdd = useCallback(
    (column: string, values: string[]) => {
      addCategoryFilter(column, values);
      logUserEvent(
        "data_filter",
        {
          filterScope: "category",
          action: "add",
          column,
          selectedValues: values,
        },
        views,
        focusScore
      );
    },
    [addCategoryFilter, focusScore, logUserEvent, views]
  );

  const handleCategoryFilterToggle = useCallback(
    (column: string, value: string) => {
      const active = categoryFilters.find((filter) => filter.column === column);
      const isSelected = active?.selectedValues.has(value) ?? false;
      toggleCategoryFilterValue(column, value);
      logUserEvent(
        "data_filter",
        {
          filterScope: "category",
          action: isSelected ? "remove_value" : "add_value",
          column,
          value,
        },
        views,
        focusScore
      );
    },
    [categoryFilters, focusScore, logUserEvent, toggleCategoryFilterValue, views]
  );

  const handleCategoryFilterSelectAll = useCallback(
    (column: string, values: string[]) => {
      selectAllCategoryFilter(column, values);
      logUserEvent(
        "data_filter",
        {
          filterScope: "category",
          action: "select_all",
          column,
          selectedValues: values,
        },
        views,
        focusScore
      );
    },
    [focusScore, logUserEvent, selectAllCategoryFilter, views]
  );

  const handleCategoryFilterDeselectAll = useCallback(
    (column: string) => {
      deselectAllCategoryFilter(column);
      logUserEvent(
        "data_filter",
        {
          filterScope: "category",
          action: "deselect_all",
          column,
        },
        views,
        focusScore
      );
    },
    [deselectAllCategoryFilter, focusScore, logUserEvent, views]
  );

  const handleCategoryFilterRemove = useCallback(
    (column: string) => {
      removeCategoryFilter(column);
      logUserEvent(
        "data_filter",
        {
          filterScope: "category",
          action: "remove_filter",
          column,
        },
        views,
        focusScore
      );
    },
    [focusScore, logUserEvent, removeCategoryFilter, views]
  );

  const handleTimeColumnChange = useCallback(
    (column: string | null) => {
      setSelectedColumn(column);
      setTimeFilter(null);
      logUserEvent(
        "data_filter",
        {
          filterScope: "time",
          action: "select_column",
          column,
        },
        views,
        focusScore
      );
    },
    [focusScore, logUserEvent, setSelectedColumn, setTimeFilter, views]
  );

  const handleTimeFilterChange = useCallback(
    (filter: { column: string; min: number; max: number } | null) => {
      setTimeFilter(filter);
      logUserEvent(
        "data_filter",
        {
          filterScope: "time",
          action: filter ? "update_range" : "clear_range",
          column: filter?.column ?? selectedColumn,
          min: filter?.min ?? null,
          max: filter?.max ?? null,
        },
        views,
        focusScore
      );
    },
    [focusScore, logUserEvent, selectedColumn, setTimeFilter, views]
  );

  const handleDrillDown = useCallback(
    (viewId: string, category: string | null) => {
      logUserEvent(
        "drill_down",
        {
          viewId,
          category,
          action: category ? "enter" : "exit",
        },
        views,
        focusScore
      );
    },
    [focusScore, logUserEvent, views]
  );

  const handleResetAllFilters = useCallback(() => {
    setViews((prev) =>
      prev.map((v) => ({ ...v, filter: undefined }))
    );
    clearAllCategoryFilters();
    clearSelection();
    setTimeFilter(null);

    logUserEvent("data_filter", { filterScope: "reset_all" }, views, focusScore);
  }, [clearAllCategoryFilters, clearSelection, focusScore, logUserEvent, setTimeFilter, views]);

  return (
    <>
      <SidebarInset className="bg-muted/10">
        <SiteHeader
          onExportDashboardState={exportDashboardState}
          onResetAllFilters={handleResetAllFilters}
          decayMode={decayMode}
          onDecayModeChange={setDecayMode}
          isFocusScoreVisible={isFocusScoreVisible}
          onFocusScoreVisibilityChange={setIsFocusScoreVisible}
        />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto p-6 md:p-8">
            <DashboardView
              views={views}
              previewMap={previewMap}
              addPreview={addPreview}
              decayMode={decayMode}
              showFocusScore={isFocusScoreVisible}
              selectedViewId={selectedViewId}
              isAddMode={sidebarMode === "STRUCTURE"}
              setSidebarMode={setSidebarMode}
              recommendationsByViewId={modifyRecommendationsByViewId}
              recommendationOrderMap={recommendationOrderMap}
              appliedRecColorByViewId={appliedRecColorByViewId}
              newContentRecommendation={newContentRecommendation}
              onAcceptRecommendation={apply}
              onDeclineRecommendation={decline}
              onInitializeDashboard={initializeDashboard}
              onLoadDemo={handleLoadDemo}
              canInitializeDashboard={
                Boolean(rawData) && attributeKeys.length > 0
              }
              isInitializingDashboard={isInitializing}
              onSelect={(viewId) => {
                logUserEvent("view_select", { viewId }, views, focusScore);

                if (selectedViewId === viewId) {
                  setSelectedViewId(null);
                  setSidebarMode("FORMAT");
                } else {
                  setSelectedViewId(viewId);
                  setSidebarMode("STRUCTURE");
                }
              }}
              onApplyFilter={handleViewFilterChange}
              onAddCategoryFilter={handleCategoryFilterAdd}
              onToggleCategoryFilter={handleCategoryFilterToggle}
              onSelectAllCategoryFilter={handleCategoryFilterSelectAll}
              onDeselectAllCategoryFilter={handleCategoryFilterDeselectAll}
              onRemoveCategoryFilter={handleCategoryFilterRemove}
              timeFilter={timeFilter}
              selectedTimeColumn={selectedColumn}
              onTimeColumnChange={handleTimeColumnChange}
              onTimeFilterChange={handleTimeFilterChange}
              onDrillDown={handleDrillDown}
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
                logUserEvent(
                  "sidebar_mode_change",
                  { mode: v },
                  views,
                  focusScore
                );
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
            history={appliedRecommendations.filter((r) => r.type !== "HIGHLIGHT")}
            activeRecommendations={actionableRecommendations}
            llmReplies={llmReplies}
            recommendationsEnabled={areRecommendationsEnabled}
            viewTitles={viewTitlesMap}
            onUndoLatest={undoLatestRecommendation}
            onAcceptRecommendation={apply}
            onDeclineRecommendation={decline}
            onAcceptAllRecommendations={applyAll}
            voice={voice}
            textChats={textChats}
            isGenerating={areRecommendationsEnabled ? isLoading : isChatLoading}
            streamingText={areRecommendationsEnabled ? streamingText : chatStreamingText}
            chatMessages={chatMessages}
            onChangeLanguage={(lang) => setLanguage(lang)}
            onSendTextChat={(msg) => {
              logUserEvent(
                "llm_request",
                {
                  requestSource: "text",
                  message: msg,
                  messageLength: msg.length,
                },
                views,
                focusScore
              );

              if (areRecommendationsEnabled) {
                setTextChats((prev) => [...prev, msg]);
                triggerRecommendation({
                  views,
                  textChats: [...textChats, msg],
                  focusScore,
                  dataSchema: schema,
                  attributeTypes,
                  resolveAttribute,
                  conversation: voice.conversation,
                  suppressRecommendations: false,
                });
              } else {
                sendChatMessage({
                  text: msg,
                  source: "text",
                  views,
                  dataSchema: schema,
                });
              }
            }}
          />
        )}

        {sidebarMode === "STRUCTURE" && (
          <ChartCreatorSidebar
            selectedView={views.find((v) => v.id === selectedViewId) || null}
            onEditView={(id: string, next: View) => {
              setSelectedViewId(null);
              setSidebarMode("FORMAT");

              setViews((prev) => {
                const nextViews = prev.map((v) => (v.id === id ? next : v));
                logUserEvent(
                  "view_modify",
                  {
                    viewId: id,
                    triggeredBy: "manual",
                  },
                  prev,
                  focusScore,
                  { viewsOverride: nextViews }
                );
                return nextViews;
              });
            }}
            onAddView={(payload) => {
              setSelectedViewId(null);
              setSidebarMode("FORMAT");

              setViews((prev) => {
                const nextViews = [
                  ...prev,
                  buildNewViewFromPayload(payload, prev.length + 1),
                ];
                logUserEvent(
                  "view_create",
                  {
                    triggeredBy: "manual",
                    chartType: payload.chartType,
                  },
                  prev,
                  focusScore,
                  { viewsOverride: nextViews }
                );
                return nextViews;
              });
            }}
            onDeleteView={(viewId) => {
              setViews((prev) => {
                const nextViews = prev.filter((v) => v.id !== viewId);
                logUserEvent(
                  "view_delete",
                  { viewId },
                  prev,
                  focusScore,
                  { viewsOverride: nextViews }
                );
                return nextViews;
              });
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
      defaultOpen={false}
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
