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
   Types
===================================================== */

type DraftChartConfig = {
  chartType: ChartType;
  title?: string;
  size: "sm" | "md" | "lg";

  // resolved values
  x: number[];
  y: number[];
};

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
        {/* =======================
            Chart type buttons
        ======================== */}
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

        {/* =======================
            Config panel
        ======================== */}
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
  const { resolveAttribute } = useDataset();

  const [xAttr, setXAttr] = useState<string | null>(null);
  const [yAttr, setYAttr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [size, setSize] = useState<"sm" | "md" | "lg">("md");

  const canAdd = chartType === "TABLE" ? false : !!xAttr && !!yAttr;

  return (
    <div className="space-y-4 text-sm">
      <div className="font-semibold text-muted-foreground">
        {chartType} Settings
      </div>

      {/* Title */}
      <input
        className="w-full rounded-md border px-2 py-1 text-sm"
        placeholder="Chart title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      {/* Axis */}
      {chartType !== "TABLE" && (
        <>
          <select
            className="w-full rounded-md border px-2 py-1"
            value={xAttr ?? ""}
            onChange={(e) => setXAttr(e.target.value || null)}
          >
            <option value="">Select X attribute</option>
            {attributeKeys.map((k) => (
              <option key={k} value={k}>
                {k}
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
                {k}
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
          if (!xAttr || !yAttr) return;

          const x = resolveAttribute(xAttr);
          const y = resolveAttribute(yAttr);

          onAddView({
            id: `v_${Date.now()}`,
            chartType,
            x,
            y,
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
