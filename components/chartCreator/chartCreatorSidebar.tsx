"use client";

import { useState } from "react";
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
  onAddView,
}: {
  onAddView: (config: View) => void;
}) {
  const { attributeKeys } = useDataset();
  const [selectedType, setSelectedType] = useState<ChartType | null>(null);

  function handleToggle(type: ChartType) {
    setSelectedType((prev) => (prev === type ? null : type));
  }

  return (
    <>
      <SidebarHeader className="shrink-0">
        <h2 className="text-sm font-semibold">Add Visualization</h2>
      </SidebarHeader>

      <SidebarContent className="flex flex-col gap-4 p-4 shrink-0">
        {/* Chart type buttons */}
        <div className="flex items-center gap-1">
          {CHART_BUTTONS.map((c) => {
            const active = selectedType === c.type;

            return (
              <Tooltip key={c.type}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggle(c.type)}
                    className={active ? "bg-accent text-accent-foreground" : ""}
                  >
                    {c.icon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{c.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Config panel */}
        <Collapsible open={!!selectedType}>
          <CollapsibleContent className="overflow-hidden rounded-md border bg-muted/30">
            {selectedType && (
              <div className="p-3 space-y-3">
                <div className="text-xs font-semibold text-muted-foreground">
                  Chart Configuration
                </div>

                <ChartConfigPanel
                  chartType={selectedType}
                  attributeKeys={attributeKeys}
                  onAddView={onAddView}
                />
              </div>
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
  onAddView,
}: {
  chartType: ChartType;
  attributeKeys: string[];
  onAddView: (view: View) => void;
}) {
  const { resolveAttribute, attributeTypes } = useDataset();

  const [xAttr, setXAttr] = useState<string | null>(null);
  const [yAttr, setYAttr] = useState<string | null>(null);
  const [tableAttrs, setTableAttrs] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");

  const canAdd =
    chartType === "TABLE" ? tableAttrs.length > 0 : !!xAttr && !!yAttr;

  function toggleTableAttr(attr: string) {
    setTableAttrs((prev) =>
      prev.includes(attr) ? prev.filter((a) => a !== attr) : [...prev, attr]
    );
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="font-semibold text-muted-foreground">
        {chartType} Settings
      </div>

      {/* Hint */}
      <div className="text-xs text-muted-foreground">
        {chartHint(chartType)}
      </div>

      {/* Title */}
      <input
        className="w-full rounded-md border px-2 py-1 text-sm"
        placeholder="Chart title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      {/* Axis / Columns */}
      {chartType === "TABLE" ? (
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">
            Select columns
          </div>

          <div className="max-h-40 overflow-auto rounded-md border bg-background p-2 space-y-1">
            {attributeKeys.map((k) => (
              <label
                key={k}
                className="flex items-center gap-2 text-xs cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={tableAttrs.includes(k)}
                  onChange={() => toggleTableAttr(k)}
                />
                <span className="flex-1">{k}</span>
                <span className="text-[10px] text-muted-foreground">
                  {attributeTypes[k]}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <>
          <select
            className="w-full rounded-md border px-2 py-1"
            value={xAttr ?? ""}
            onChange={(e) => setXAttr(e.target.value || null)}
          >
            <option value="">Select X attribute</option>
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
            <option value="">Select Y attribute</option>
            {attributeKeys.map((k) => (
              <option key={k} value={k}>
                {k} ({attributeTypes[k]})
              </option>
            ))}
          </select>
        </>
      )}

      {/* Size */}
      <div className="flex gap-2">
        {(["sm", "md", "lg"] as const).map((s) => (
          <Button
            key={s}
            variant={size === s ? "default" : "outline"}
            size="sm"
            onClick={() => setSize(s)}
          >
            {s.toUpperCase()}
          </Button>
        ))}
      </div>

      {/* Add */}
      <Button
        disabled={!canAdd}
        onClick={() => {
          if (chartType === "TABLE") {
            onAddView({
              id: `v_${Date.now()}`,
              chartType,
              columns: tableAttrs,
              size,
              title,
              priority: Date.now(),
            });
            return;
          }

          if (!xAttr || !yAttr) return;

          onAddView({
            id: `v_${Date.now()}`,
            chartType,
            x: resolveAttribute(xAttr),
            y: resolveAttribute(yAttr),
            size,
            title,
            priority: Date.now(),
          });
        }}
      >
        Add Chart
      </Button>
    </div>
  );
}
