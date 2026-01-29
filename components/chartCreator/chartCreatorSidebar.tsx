"use client";

import { useEffect, useState } from "react";
import { BarChart3, LineChart, Table2, ScatterChart } from "lucide-react";

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

export type NewViewPayload =
  | {
      chartType: "TABLE";
      columns: string[];
      size: "sm" | "md" | "lg";
      title: string;
    }
  | {
      chartType: "BAR" | "LINE" | "SCATTER";
      x: number[];
      y: number[];
      size: "sm" | "md" | "lg";
      title: string;
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
  { type: "LINE", icon: <LineChart />, label: "Line Chart" },
  { type: "TABLE", icon: <Table2 />, label: "Table" },
  { type: "SCATTER", icon: <ScatterChart />, label: "Scatter Plot" },
];

/* =====================================================
   Helpers
===================================================== */

function chartHint(chartType: ChartType) {
  switch (chartType) {
    case "LINE":
      return "Best for date/number × number (trend over time).";
    case "BAR":
      return "Best for categorical/string × number comparisons.";
    case "SCATTER":
      return "Requires number × number (correlation analysis).";
    case "TABLE":
      return "Select multiple attributes to inspect raw values.";
    default:
      return null;
  }
}

/* =====================================================
   Main Component
===================================================== */

export default function ChartCreatorSidebar({
  selectedView,
  onEditView,
  onAddView,
}: {
  selectedView: View | null;
  onEditView: (id: string, patch: Partial<View>) => void;
  onAddView: (payload: NewViewPayload) => void; // ★ View 아님
}) {
  const { attributeKeys } = useDataset();
  const isEditMode = selectedView !== null;

  const [selectedType, setSelectedType] = useState<ChartType | null>(null);

  /* ===== prefill chart type ===== */
  useEffect(() => {
    if (isEditMode && selectedView) {
      setSelectedType(selectedView.chartType);
    }
  }, [isEditMode, selectedView]);

  function handleToggle(type: ChartType) {
    setSelectedType((prev) => (prev === type ? null : type));
  }

  return (
    <>
      <SidebarHeader>
        <h2 className="text-sm font-semibold">
          {isEditMode ? "Edit Visualization" : "Add Visualization"}
        </h2>
      </SidebarHeader>

      <SidebarContent className="flex flex-col gap-4 p-4">
        {/* Chart type buttons */}
        <div className="flex gap-1">
          {CHART_BUTTONS.map((c) => (
            <Tooltip key={c.type}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleToggle(c.type)}
                  className={
                    selectedType === c.type
                      ? "bg-accent text-accent-foreground"
                      : ""
                  }
                >
                  {c.icon}
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
}: {
  chartType: ChartType;
  attributeKeys: string[];
  isEditMode: boolean;
  selectedView: View | null;
  onAddView: (payload: NewViewPayload) => void;
  onEditView: (id: string, patch: Partial<View>) => void;
}) {
  const { resolveAttribute, attributeTypes } = useDataset();

  const [xAttr, setXAttr] = useState<string | null>(null);
  const [yAttr, setYAttr] = useState<string | null>(null);
  const [tableAttrs, setTableAttrs] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");

  /* ===== prefill form ===== */
  useEffect(() => {
    if (!isEditMode || !selectedView) return;

    setTitle(selectedView.title ?? "");
    setSize(selectedView.size ?? "md");

    if (chartType === "TABLE") {
      setTableAttrs((selectedView as any).columns ?? []);
      return;
    }

    const inferKey = (vals: number[]) =>
      attributeKeys.find(
        (k) => JSON.stringify(resolveAttribute(k)) === JSON.stringify(vals)
      ) ?? null;

    setXAttr(inferKey((selectedView as any).x ?? []));
    setYAttr(inferKey((selectedView as any).y ?? []));
  }, [isEditMode, selectedView, chartType, attributeKeys, resolveAttribute]);

  const canApply =
    chartType === "TABLE" ? tableAttrs.length > 0 : !!xAttr && !!yAttr;

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
            <option value="">Select X</option>
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
            <option value="">Select Y</option>
            {attributeKeys.map((k) => (
              <option key={k} value={k}>
                {k} ({attributeTypes[k]})
              </option>
            ))}
          </select>
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
          if (isEditMode) {
            if (!selectedView || !selectedView.id) return;

            const patch: Partial<View> =
              chartType === "TABLE"
                ? { chartType, columns: tableAttrs, size, title }
                : {
                    chartType,
                    x: resolveAttribute(xAttr!),
                    y: resolveAttribute(yAttr!),
                    size,
                    title,
                  };

            onEditView(selectedView.id, patch);
            return;
          }

          // ADD
          const payload: NewViewPayload =
            chartType === "TABLE"
              ? { chartType, columns: tableAttrs, size, title }
              : {
                  chartType,
                  x: resolveAttribute(xAttr!),
                  y: resolveAttribute(yAttr!),
                  size,
                  title,
                };

          onAddView(payload);
          setTitle("");
          setXAttr(null);
          setYAttr(null);
          setTableAttrs([]);
        }}
      >
        {isEditMode ? "Apply Changes" : "Add Chart"}
      </Button>
    </div>
  );
}
