// components/ViewCard.tsx
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

/* =======================================================
   Layout constants
======================================================= */

const SIZE_CLASS: Record<View["size"], string> = {
  lg: "basis-[99%]",
  md: "basis-[49%]",
  sm: "basis-[30%]",
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
   ViewCard
======================================================= */

export default function ViewCard({
  view,
  preview = null,
  onMouseMove,
}: {
  view: View;
  preview?: PreviewState;
  onMouseMove: () => void;
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
          "relative z-0",
          preview?.type === "REMOVE" && "opacity-40"
        )}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {view.chartType.toUpperCase()}
          </CardTitle>
          <CardDescription className="text-xs truncate">
            X: [{view.x.length}] · Y: [{view.y.length}]
          </CardDescription>
        </CardHeader>

        <CardContent
          className={cn(CHART_HEIGHT[view.size], "overflow-hidden p-2")}
        >
          <ChartRenderer
            x={view.x}
            y={view.y}
            type={view.chartType}
            height="100%"
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
   MODIFY overlay (ghost overlap)
======================================================= */

function ModifyOverlay({ view, size }: { view: View; size: View["size"] }) {
  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {/* soft dim */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

      {/* preview content */}
      <div className="absolute inset-0 opacity-45">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {view.chartType.toUpperCase()}
          </CardTitle>
          <CardDescription className="text-xs truncate">
            Preview
          </CardDescription>
        </CardHeader>

        <CardContent className={cn(CHART_HEIGHT[size], "p-2")}>
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
   REMOVE overlay (neutral warning)
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
   ADD overlay (ghost new view)
======================================================= */

function AddOverlay({ view, size }: { view: View; size: View["size"] }) {
  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />

      <div className="absolute inset-0 opacity-50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {view.chartType.toUpperCase()}
          </CardTitle>
          <CardDescription className="text-xs truncate">
            New view preview
          </CardDescription>
        </CardHeader>

        <CardContent className={cn(CHART_HEIGHT[size], "p-2")}>
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
