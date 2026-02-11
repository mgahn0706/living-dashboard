"use client";

import { View } from "@/types/dashboard";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../ui/card";
import { Button } from "../ui/button";
import ChartRenderer from "./ChartRenderer";
import { cn } from "@/lib/utils";
import React from "react";
import { IconCheck, IconPencil } from "@tabler/icons-react";

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
  isSelected,
  preview = null,
  focusScore,
  onPointerMove,
  onCardClick,
  onEditClick,
}: {
  view: View;
  isSelected: boolean;
  preview?: PreviewState;
  focusScore: number;
  onPointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onCardClick?: () => void;
  onEditClick?: () => void;
}) {
  const isEditing = isSelected;

  return (
    <>
      <style jsx>{`
        @keyframes editingBreath {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.25);
            transform: scale(1.01);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(59, 130, 246, 0);
            transform: scale(1.015);
          }
        }
      `}</style>

      <Card
        onPointerMove={onPointerMove}
        onClick={onCardClick}
        className={cn(
          SIZE_CLASS[view.size],
          "relative overflow-hidden transition-all cursor-pointer",
          "hover:ring-1 hover:ring-ring",
          isEditing &&
            "ring-2 ring-primary shadow-lg animate-[editingBreath_2.4s_ease-in-out_infinite]"
        )}
      >
        {/* Base View */}
        <div
          className={cn(
            "relative z-0 flex flex-col",
            preview?.type === "REMOVE" && "opacity-40"
          )}
        >
          {/* Header */}
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1">
                {view.title || view.id}

                {isEditing && (
                  <span className="text-[10px] text-primary font-medium">
                    (Editing)
                  </span>
                )}
              </CardTitle>

              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">
                  Focus: {formatFocus(focusScore)}
                </span>

                {/* ⭐ Edit button now fully separated */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation(); // prevent card click
                    onEditClick?.();
                  }}
                >
                  {isEditing ? (
                    <IconCheck size={16} />
                  ) : (
                    <IconPencil size={16} />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>

          {/* Content */}
          <CardContent
            className={cn(CHART_HEIGHT[view.size], "flex p-0 overflow-hidden")}
          >
            <ChartRenderer view={view} height="100%" />
          </CardContent>
        </div>

        {/* Preview overlays */}
        {preview?.type === "MODIFY" && (
          <ModifyOverlay view={preview.view} size={view.size} />
        )}

        {preview?.type === "REMOVE" && <RemoveOverlay />}

        {preview?.type === "ADD" && (
          <AddOverlay view={preview.view} size={view.size} />
        )}
      </Card>
    </>
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
            {view.title || view.chartType.toUpperCase()}
          </CardTitle>
          <CardDescription className="text-xs truncate">
            Preview
          </CardDescription>
        </CardHeader>

        <CardContent
          className={cn(CHART_HEIGHT[size], "flex p-0 overflow-hidden")}
        >
          <ChartRenderer view={view} height="100%" />
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
          <ChartRenderer view={view} height="100%" />
        </CardContent>
      </div>
    </div>
  );
}
