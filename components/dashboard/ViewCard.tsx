"use client";

import { View } from "@/types/dashboard";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../ui/card";
import ChartRenderer from "./ChartRenderer";
import { cn } from "@/lib/utils";
import React from "react";

/* =======================================================
   Layout constants
======================================================= */

const SIZE_CLASS: Record<View["size"], string> = {
  lg: "basis-[24%]",
  md: "basis-[24%]",
  sm: "basis-[24%]",
};

const CHART_HEIGHT: Record<View["size"], string> = {
  lg: "h-[320px]",
  md: "h-[260px]",
  sm: "h-[200px]",
};

/* =======================================================
   Preview Types
======================================================= */

export type PreviewState =
  | { type: "MODIFY"; view: View }
  | { type: "REMOVE" }
  | { type: "ADD"; view: View }
  | null;

/* =======================================================
   Utils
======================================================= */

function formatFocus(score: number) {
  const pct = Math.round(score * 100);
  if (pct >= 1000) return `High (${pct}%)`;
  if (pct >= 500) return `Med (${pct}%)`;
  return `Low (${pct}%)`;
}

/* =======================================================
   ViewCard
======================================================= */

export default function ViewCard({
  view,
  preview = null,
  focusScore,
  onMouseMove,
}: {
  view: View;
  preview?: PreviewState;
  focusScore: number;
  onMouseMove: React.MouseEventHandler<HTMLDivElement>;
}) {
  return (
    <Card
      onMouseMove={onMouseMove}
      className={cn(
        SIZE_CLASS[view.size],
        "relative overflow-hidden transition-all hover:ring-1 hover:ring-ring"
      )}
    >
      {/* ================= Base View ================= */}
      <div
        className={cn(
          "relative z-0 flex flex-col",
          preview?.type === "REMOVE" && "opacity-40"
        )}
      >
        {/* ---------- Header ---------- */}
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{view.title || view.id}</CardTitle>

            <span className="text-[10px] text-muted-foreground">
              Focus: {formatFocus(focusScore)}
            </span>
          </div>
        </CardHeader>

        {/* ---------- Chart ---------- */}
        <CardContent
          className={cn(CHART_HEIGHT[view.size], "flex p-0 overflow-hidden")}
        >
          <ChartRenderer
            x={view.x}
            y={view.y}
            type={view.chartType}
            height="100%"
            xLabel={view.xLabel}
            yLabel={view.yLabel}
          />
        </CardContent>
      </div>

      {/* ================= Preview Overlays ================= */}
      {preview?.type === "MODIFY" && (
        <ModifyOverlay view={preview.view} size={view.size} />
      )}

      {preview?.type === "REMOVE" && <RemoveOverlay />}

      {preview?.type === "ADD" && (
        <AddOverlay view={preview.view} size={view.size} />
      )}
    </Card>
  );
}

/* =======================================================
   MODIFY overlay
======================================================= */

function ModifyOverlay({ view, size }: { view: View; size: View["size"] }) {
  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

      <div className="absolute inset-0 opacity-45 flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {view.chartType.toUpperCase()}
          </CardTitle>
          <CardDescription className="text-xs truncate">
            Preview
          </CardDescription>
        </CardHeader>

        <CardContent
          className={cn(CHART_HEIGHT[size], "flex p-0 overflow-hidden")}
        >
          <ChartRenderer
            x={view.x}
            y={view.y}
            type={view.chartType}
            height="100%"
          />
        </CardContent>
      </div>
    </div>
  );
}

/* =======================================================
   REMOVE overlay
======================================================= */

function RemoveOverlay() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/60 backdrop-blur-sm">
      <div className="rounded-md border border-dashed border-muted-foreground/40 px-4 py-2 text-xs text-muted-foreground">
        This view will be removed
      </div>
    </div>
  );
}

/* =======================================================
   ADD overlay
======================================================= */

function AddOverlay({ view, size }: { view: View; size: View["size"] }) {
  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />

      <div className="absolute inset-0 opacity-50 flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {view.chartType.toUpperCase()}
          </CardTitle>
          <CardDescription className="text-xs truncate">
            New view preview
          </CardDescription>
        </CardHeader>

        <CardContent
          className={cn(CHART_HEIGHT[size], "flex p-0 overflow-hidden")}
        >
          <ChartRenderer
            x={view.x}
            y={view.y}
            type={view.chartType}
            height="100%"
          />
        </CardContent>
      </div>
    </div>
  );
}
