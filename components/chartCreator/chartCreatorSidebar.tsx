// ChartCreatorSidebar.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart3,
  BarChartHorizontal,
  LineChart,
  Table2,
  ScatterChart,
  PieChart,
  Gauge,
  Layers,
  BarChart2,
  GitPullRequestArrow,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SidebarContent, SidebarHeader } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";

import { useDataset } from "@/context/DatasetContext";
import type { ChartType, View } from "@/types/dashboard";

/* =====================================================
   ADD payload (column-based)
===================================================== */

export type NewViewPayload =
  | {
      chartType: "TABLE";
      columns: string[];
      size: "sm" | "md" | "lg" | "xl";
      title: string;
    }
  | {
      chartType: Exclude<ChartType, "TABLE">;
      xColumn: string;
      yColumn: string;
      size: "sm" | "md" | "lg" | "xl";
      title: string;
      groupByColumn?: string;
      aggregation?: "sum" | "avg" | "count";
      colorByColumn?: string;
      x2Column?: string;
      sortDescending?: boolean;
    };

/* =====================================================
   Chart definitions
===================================================== */

const CHART_BUTTONS: {
  type: ChartType;
  icon: React.ReactNode;
  label: string;
}[] = [
  { type: "BAR", icon: <BarChart3 />, label: "Bar Chart" },
  { type: "HORIZONTAL_BAR", icon: <BarChartHorizontal />, label: "Horizontal Bar" },
  { type: "STACKED_BAR", icon: <Layers />, label: "Stacked Bar" },
  { type: "GROUPED_BAR", icon: <BarChart2 />, label: "Grouped Bar" },
  { type: "LINE", icon: <LineChart />, label: "Line Chart" },
  { type: "PIE", icon: <PieChart />, label: "Pie / Donut" },
  { type: "DONUT", icon: <PieChart />, label: "Donut Chart" },
  { type: "FUNNEL", icon: <GitPullRequestArrow />, label: "Funnel Chart" },
  { type: "KPI", icon: <Gauge />, label: "KPI Card" },
  { type: "TABLE", icon: <Table2 />, label: "Table" },
  { type: "SCATTER", icon: <ScatterChart />, label: "Scatter Plot" },
  { type: "RANGE_BAR", icon: <BarChartHorizontal />, label: "Range Bar (Timeline)" },
];

/* =====================================================
   Helpers
===================================================== */

function chartHint(chartType: ChartType) {
  switch (chartType) {
    case "LINE":
      return "Best for number × number (trend over time).";
    case "BAR":
      return "Best for categorical × number comparisons.";
    case "HORIZONTAL_BAR":
      return "Horizontal bars for ranked category comparisons.";
    case "STACKED_BAR":
      return "Stacked bars for part-to-whole by category.";
    case "GROUPED_BAR":
      return "Clustered bars to compare groups side by side.";
    case "SCATTER":
      return "Requires number × number (correlation analysis).";
    case "PIE":
      return "Best for part-to-whole by category.";
    case "DONUT":
      return "Part-to-whole with center space for context.";
    case "KPI":
      return "Single metric card (sum, avg, or count).";
    case "FUNNEL":
      return "Stage-based flow visualization.";
    case "TABLE":
      return "Select multiple attributes to inspect raw values.";
    case "RANGE_BAR":
      return "Timeline chart: pick two date columns (X, X2) and a category (Y).";
    default:
      return null;
  }
}

function isChartTypeAvailable(
  chartType: ChartType,
  attributeKeys: string[],
  numericLikeCount: number
) {
  if (chartType === "TABLE") return attributeKeys.length > 0;
  if (chartType === "KPI") return numericLikeCount >= 1;
  if (chartType === "SCATTER") return numericLikeCount >= 2;
  if (chartType === "RANGE_BAR") return attributeKeys.length >= 3;

  // BAR/LINE/PIE/HORIZONTAL_BAR/STACKED_BAR/GROUPED_BAR/FUNNEL/DONUT
  return numericLikeCount >= 1 && attributeKeys.length >= 2;
}

function isSelectionCompatible(
  chartType: ChartType,
  xAttr: string | null,
  yAttr: string | null,
  isNumericLike: (attr: string) => boolean
) {
  if (chartType === "TABLE") return true;
  if (chartType === "KPI") return !!yAttr && isNumericLike(yAttr);
  if (!xAttr || !yAttr) return false;
  if (xAttr === yAttr) return false;

  const yIsNumeric = isNumericLike(yAttr);

  if (chartType === "SCATTER") {
    return isNumericLike(xAttr) && yIsNumeric;
  }

  if (chartType === "RANGE_BAR") {
    // X and Y just need to be non-empty; x2Column validated separately
    return true;
  }

  return yIsNumeric;
}

/* =====================================================
   Main Component
===================================================== */

export default function ChartCreatorSidebar({
  selectedView,
  onEditView,
  onAddView,
  onDeleteView,
}: {
  selectedView: View | null;
  onEditView: (id: string, next: View) => void; // replace semantics
  onAddView: (payload: NewViewPayload) => void;
  onDeleteView: (id: string) => void;
}) {
  const { attributeKeys, attributeTypes, resolveAttribute } = useDataset();
  const isEditMode = selectedView !== null;

  const [selectedType, setSelectedType] = useState<ChartType | null>(null);

  const isNumericLike = (attr: string) => {
    if (attributeTypes[attr] === "number") return true;
    const values = resolveAttribute(attr);
    if (!Array.isArray(values) || values.length === 0) return false;

    const filtered = values.filter((v) => v !== null && v !== undefined && v !== "");
    if (filtered.length === 0) return false;

    const numericCount = filtered.filter((v) => {
      if (typeof v === "number") return !Number.isNaN(v);
      if (typeof v !== "string") return false;
      const cleaned = v.replace(/,/g, "").trim();
      return cleaned !== "" && !Number.isNaN(Number(cleaned));
    }).length;

    return numericCount / filtered.length >= 0.7;
  };

  const numericLikeCount = attributeKeys.filter((k) => isNumericLike(k)).length;
  const isTypeAvailable = (type: ChartType) =>
    isChartTypeAvailable(type, attributeKeys, numericLikeCount);

  /* ===== prefill chart type ===== */
  useEffect(() => {
    if (!selectedView) {
      setSelectedType(null);
      return;
    }
    setSelectedType(selectedView.chartType);
  }, [selectedView?.id]);

  function handleToggle(type: ChartType) {
    if (!isTypeAvailable(type)) return;
    setSelectedType((prev) => (prev === type ? null : type));
  }

  useEffect(() => {
    if (!selectedType) return;
    if (!isTypeAvailable(selectedType)) {
      setSelectedType(null);
    }
  }, [selectedType, attributeKeys, attributeTypes]);

  return (
    <>
      <SidebarHeader>
        <h2 className="text-sm font-semibold">
          {isEditMode ? "Edit Visualization" : "Add Visualization"}
        </h2>
      </SidebarHeader>

      <SidebarContent className="flex flex-col gap-4 p-4">
        {/* Chart type buttons */}
        <div className="grid grid-cols-4 gap-1">
          {CHART_BUTTONS.map((c) => (
            <Tooltip key={c.type}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggle(c.type)}
                  disabled={!isTypeAvailable(c.type)}
                  className={`flex items-center justify-center p-0 h-8 w-8 ${
                    selectedType === c.type
                      ? "bg-accent text-accent-foreground"
                      : ""
                  }`}
                >
                  <span className="size-4 shrink-0">{c.icon}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{c.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        <Collapsible open={!!selectedType}>
          <CollapsibleContent className="rounded-md border bg-muted/30">
            {selectedType && (
              <ChartConfigPanel
                chartType={selectedType}
                attributeKeys={attributeKeys}
                isEditMode={isEditMode}
                selectedView={selectedView}
                onAddView={onAddView}
                onEditView={onEditView}
                onDeleteView={onDeleteView}
              />
            )}
          </CollapsibleContent>
        </Collapsible>
      </SidebarContent>
    </>
  );
}

/* =====================================================
   Config Panel
===================================================== */

function ChartConfigPanel({
  chartType,
  attributeKeys,
  isEditMode,
  selectedView,
  onAddView,
  onEditView,
  onDeleteView,
}: {
  chartType: ChartType;
  attributeKeys: string[];
  isEditMode: boolean;
  selectedView: View | null;
  onAddView: (payload: NewViewPayload) => void;
  onEditView: (id: string, next: View) => void;
  onDeleteView: (id: string) => void;
}) {
  const { attributeTypes, resolveAttribute } = useDataset();

  const [xAttr, setXAttr] = useState<string | null>(null);
  const [yAttr, setYAttr] = useState<string | null>(null);
  const [x2Attr, setX2Attr] = useState<string | null>(null);
  const [groupByAttr, setGroupByAttr] = useState<string | null>(null);
  const [tableAttrs, setTableAttrs] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [size, setSize] = useState<"sm" | "md" | "lg" | "xl">("md");

  /* ===== prefill form (column-based) ===== */
  useEffect(() => {
    if (!isEditMode || !selectedView) return;

    setTitle(selectedView.title ?? "");
    setSize(selectedView.size ?? "md");

    if (chartType === "TABLE") {
      setTableAttrs(
        selectedView.chartType === "TABLE" ? selectedView.columns : []
      );
      setXAttr(null);
      setYAttr(null);
      return;
    }

    setTableAttrs([]);

    if (selectedView.chartType !== "TABLE") {
      setXAttr(selectedView.xColumn ?? null);
      setYAttr(selectedView.yColumn ?? null);
      setX2Attr(selectedView.x2Column ?? null);
      setGroupByAttr(selectedView.groupByColumn ?? null);
    } else {
      setXAttr(null);
      setYAttr(null);
      setX2Attr(null);
      setGroupByAttr(null);
    }
  }, [isEditMode, selectedView, chartType]);

  const needsGroupBy = chartType === "STACKED_BAR" || chartType === "GROUPED_BAR";

  const canApply =
    chartType === "TABLE"
      ? tableAttrs.length > 0
      : chartType === "RANGE_BAR"
      ? !!xAttr && !!yAttr && !!x2Attr
      : needsGroupBy
      ? !!groupByAttr && isSelectionCompatible(chartType, xAttr, yAttr, (attr) => {
          if (attributeTypes[attr] === "number") return true;
          const values = resolveAttribute(attr);
          if (!Array.isArray(values) || values.length === 0) return false;
          const filtered = values.filter((v) => v !== null && v !== undefined && v !== "");
          if (filtered.length === 0) return false;
          const numericCount = filtered.filter((v) => {
            if (typeof v === "number") return !Number.isNaN(v);
            if (typeof v !== "string") return false;
            const cleaned = v.replace(/,/g, "").trim();
            return cleaned !== "" && !Number.isNaN(Number(cleaned));
          }).length;
          return numericCount / filtered.length >= 0.7;
        })
      : isSelectionCompatible(chartType, xAttr, yAttr, (attr) => {
          if (attributeTypes[attr] === "number") return true;
          const values = resolveAttribute(attr);
          if (!Array.isArray(values) || values.length === 0) return false;

          const filtered = values.filter(
            (v) => v !== null && v !== undefined && v !== ""
          );
          if (filtered.length === 0) return false;

          const numericCount = filtered.filter((v) => {
            if (typeof v === "number") return !Number.isNaN(v);
            if (typeof v !== "string") return false;
            const cleaned = v.replace(/,/g, "").trim();
            return cleaned !== "" && !Number.isNaN(Number(cleaned));
          }).length;

          return numericCount / filtered.length >= 0.7;
        });

  const xLabel =
    chartType === "PIE" || chartType === "DONUT"
      ? "Category"
      : chartType === "KPI"
      ? "(unused)"
      : chartType === "RANGE_BAR"
      ? "Start Date"
      : "Select X";
  const yLabel =
    chartType === "PIE" || chartType === "DONUT"
      ? "Value"
      : chartType === "KPI"
      ? "Metric"
      : chartType === "RANGE_BAR"
      ? "Category (Y)"
      : "Select Y";

  return (
    <div className="p-3 space-y-4 text-sm">
      <div className="font-semibold">{chartType} Settings</div>

      <div className="text-xs text-muted-foreground">
        {chartHint(chartType)}
      </div>

      <input
        className="w-full rounded-md border px-2 py-1"
        placeholder="Chart title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      {chartType === "TABLE" ? (
        <div className="space-y-1">
          {attributeKeys.map((k) => (
            <label key={k} className="flex gap-2 text-xs">
              <input
                type="checkbox"
                checked={tableAttrs.includes(k)}
                onChange={() =>
                  setTableAttrs((prev) =>
                    prev.includes(k)
                      ? prev.filter((a) => a !== k)
                      : [...prev, k]
                  )
                }
              />
              {k}
            </label>
          ))}
        </div>
      ) : (
        <>
          <select
            className="w-full rounded-md border px-2 py-1"
            value={xAttr ?? ""}
            onChange={(e) => setXAttr(e.target.value || null)}
          >
            <option value="">{xLabel}</option>
            {attributeKeys.map((k) => (
              <option key={k} value={k}>
                {k} ({attributeTypes[k]})
              </option>
            ))}
          </select>

          <select
            className="w-full rounded-md border px-2 py-1"
            value={yAttr ?? ""}
            onChange={(e) => setYAttr(e.target.value || null)}
          >
            <option value="">{yLabel}</option>
            {attributeKeys.map((k) => (
              <option key={k} value={k}>
                {k} ({attributeTypes[k]})
              </option>
            ))}
          </select>

          {chartType === "RANGE_BAR" && (
            <select
              className="w-full rounded-md border px-2 py-1"
              value={x2Attr ?? ""}
              onChange={(e) => setX2Attr(e.target.value || null)}
            >
              <option value="">Select X2 Column</option>
              {attributeKeys.map((k) => (
                <option key={k} value={k}>
                  {k} ({attributeTypes[k]})
                </option>
              ))}
            </select>
          )}

          {(chartType === "STACKED_BAR" || chartType === "GROUPED_BAR") && (
            <select
              className="w-full rounded-md border px-2 py-1"
              value={groupByAttr ?? ""}
              onChange={(e) => setGroupByAttr(e.target.value || null)}
            >
              <option value="">Select Group By</option>
              {attributeKeys.map((k) => (
                <option key={k} value={k}>
                  {k} ({attributeTypes[k]})
                </option>
              ))}
            </select>
          )}

          {chartType === "PIE" && (
            <div className="text-[11px] text-muted-foreground">
              Pick a categorical column for Category and a numeric column for
              Value.
            </div>
          )}

          {!canApply && xAttr && yAttr && needsGroupBy && !groupByAttr && (
            <div className="text-[11px] text-destructive">
              Please select a Group By column for {chartType}.
            </div>
          )}
          {!canApply && xAttr && yAttr && (!needsGroupBy || groupByAttr) && (
            <div className="text-[11px] text-destructive">
              Selected attributes are incompatible with {chartType}.
            </div>
          )}
        </>
      )}

      <div className="flex gap-2">
        {(["sm", "md", "lg"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={size === s ? "default" : "outline"}
            onClick={() => setSize(s)}
          >
            {s.toUpperCase()}
          </Button>
        ))}
      </div>

      <Button
        disabled={!canApply}
        onClick={() => {
          /* ================= EDIT (REPLACE) ================= */
          if (isEditMode) {
            if (!selectedView?.id) return;

            const nextView: View =
              chartType === "TABLE"
                ? {
                    id: selectedView.id,
                    chartType: "TABLE",
                    columns: tableAttrs,
                    size,
                    priority: selectedView.priority,
                    title,
                  }
                : {
                    id: selectedView.id,
                    chartType,
                    xColumn: xAttr!, // ✅ store column name
                    yColumn: yAttr!, // ✅ store column name
                    size,
                    priority: selectedView.priority,
                    title,
                    ...(chartType === "RANGE_BAR" && x2Attr
                      ? { x2Column: x2Attr }
                      : {}),
                    ...((chartType === "STACKED_BAR" || chartType === "GROUPED_BAR") && groupByAttr
                      ? { groupByColumn: groupByAttr }
                      : {}),
                  };

            onEditView(selectedView.id, nextView);
            return;
          }

          /* ================= ADD ================= */
          const payload: NewViewPayload =
            chartType === "TABLE"
              ? { chartType, columns: tableAttrs, size, title }
              : {
                  chartType,
                  xColumn: xAttr!, // ✅ store column name
                  yColumn: yAttr!,
                  size,
                  title,
                  ...(chartType === "RANGE_BAR" && x2Attr
                    ? { x2Column: x2Attr }
                    : {}),
                  ...((chartType === "STACKED_BAR" || chartType === "GROUPED_BAR") && groupByAttr
                    ? { groupByColumn: groupByAttr }
                    : {}),
                };

          onAddView(payload);
          setTitle("");
          setXAttr(null);
          setYAttr(null);
          setX2Attr(null);
          setGroupByAttr(null);
          setTableAttrs([]);
        }}
      >
        {isEditMode ? "Apply Changes" : "Add Chart"}
      </Button>

      {isEditMode && selectedView?.id && (
        <Button
          variant="outline"
          className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
          onClick={() => onDeleteView(selectedView.id)}
        >
          Delete View
        </Button>
      )}
    </div>
  );
}
