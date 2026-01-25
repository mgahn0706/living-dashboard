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
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";

import type { ChartType } from "@/types/dashboard";

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
   Component
===================================================== */

export default function ChartCreatorSidebar() {
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
            Chart buttons
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

        <Collapsible open={!!selectedType}>
          <CollapsibleContent
            className="
      overflow-hidden
      rounded-md
      border
      bg-muted/30
      data-[state=open]:animate-collapsible-down
      data-[state=closed]:animate-collapsible-up
    "
          >
            {selectedType && (
              <div className="p-3 space-y-3">
                <div className="text-xs font-semibold text-muted-foreground">
                  Chart Configuration
                </div>
                <ChartConfigPanel chartType={selectedType} />
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

function ChartConfigPanel({ chartType }: { chartType: ChartType }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="font-semibold text-muted-foreground">
        {chartType} Settings
      </div>

      {/* Title */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Title</label>
        <input
          className="w-full rounded-md border px-2 py-1 text-sm"
          placeholder="Chart title"
        />
      </div>

      {/* Axis config */}
      {chartType !== "TABLE" && (
        <>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">X Axis</label>
            <input
              className="w-full rounded-md border px-2 py-1 text-sm"
              placeholder="Select field"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Y Axis</label>
            <input
              className="w-full rounded-md border px-2 py-1 text-sm"
              placeholder="Select field"
            />
          </div>
        </>
      )}

      {/* Size */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Size</label>
        <div className="flex gap-2">
          {(["sm", "md", "lg"] as const).map((s) => (
            <Button key={s} variant="outline" size="sm">
              {s.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
