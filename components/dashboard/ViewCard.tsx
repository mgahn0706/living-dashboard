"use client";

import { Recommendation, View } from "@/types/dashboard";
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
import {
  IconCheck,
  IconPencil,
  IconSparkles,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

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
  recommendation = null,
  onRecommendationHover,
  onRecommendationLeave,
  onAcceptRecommendation,
  onDeclineRecommendation,
  onPointerMove,
  onCardClick,
  onEditClick,
  onDeleteClick,
}: {
  view: View;
  isSelected: boolean;
  preview?: PreviewState;
  focusScore: number;
  recommendation?: Recommendation | null;
  onRecommendationHover?: (rec: Recommendation) => void;
  onRecommendationLeave?: () => void;
  onAcceptRecommendation?: (rec: Recommendation) => void;
  onDeclineRecommendation?: (rec: Recommendation) => void;
  onPointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onCardClick?: () => void;
  onEditClick?: () => void;
  onDeleteClick?: (id: string) => void;
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
        {recommendation && (
          <RecommendationBanner
            recommendation={recommendation}
            onAccept={onAcceptRecommendation}
            onHover={onRecommendationHover}
            onLeave={onRecommendationLeave}
            onDecline={onDeclineRecommendation}
          />
        )}

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

                {/* Edit Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditClick?.();
                  }}
                >
                  {isEditing ? (
                    <IconCheck size={16} />
                  ) : (
                    <IconPencil size={16} />
                  )}
                </Button>

                {/* Delete Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteClick?.(view.id);
                  }}
                >
                  <IconTrash size={16} className="text-destructive" />
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
   Recommendation Banner
======================================================= */

const REC_STYLES: Record<Recommendation["type"], string> = {
  MODIFY_CONTENT:
    "border-sky-200/70 bg-gradient-to-br from-sky-50/90 to-sky-100/60 text-sky-900 shadow-[0_10px_25px_rgba(14,116,144,0.18)] dark:border-sky-900/60 dark:from-sky-950/50 dark:to-sky-900/25 dark:text-sky-100",
  NEW_CONTENT:
    "border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 to-emerald-100/60 text-emerald-900 shadow-[0_10px_25px_rgba(16,185,129,0.16)] dark:border-emerald-900/60 dark:from-emerald-950/50 dark:to-emerald-900/25 dark:text-emerald-100",
  REORDER:
    "border-amber-200/70 bg-gradient-to-br from-amber-50/90 to-amber-100/60 text-amber-900 shadow-[0_10px_25px_rgba(245,158,11,0.16)] dark:border-amber-900/60 dark:from-amber-950/50 dark:to-amber-900/25 dark:text-amber-100",
  RESIZE:
    "border-violet-200/70 bg-gradient-to-br from-violet-50/90 to-violet-100/60 text-violet-900 shadow-[0_10px_25px_rgba(139,92,246,0.16)] dark:border-violet-900/60 dark:from-violet-950/50 dark:to-violet-900/25 dark:text-violet-100",
  REMOVE_CONTENT:
    "border-rose-200/70 bg-gradient-to-br from-rose-50/90 to-rose-100/60 text-rose-900 shadow-[0_10px_25px_rgba(244,63,94,0.16)] dark:border-rose-900/60 dark:from-rose-950/50 dark:to-rose-900/25 dark:text-rose-100",
};

function RecommendationBanner({
  recommendation,
  onAccept,
  onHover,
  onLeave,
  onDecline,
}: {
  recommendation: Recommendation;
  onAccept?: (rec: Recommendation) => void;
  onHover?: (rec: Recommendation) => void;
  onLeave?: () => void;
  onDecline?: (rec: Recommendation) => void;
}) {
  return (
    <div className="absolute right-3 top-3 z-20">
      <HoverCard
        openDelay={120}
        onOpenChange={(open) => {
          if (open) onHover?.(recommendation);
          else onLeave?.();
        }}
      >
        <HoverCardTrigger asChild>
          <button
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide shadow-sm backdrop-blur-sm",
              "transition-colors",
              REC_STYLES[recommendation.type]
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <IconSparkles className="size-3" />
            <span>Recommendation</span>
          </button>
        </HoverCardTrigger>

        <HoverCardContent
          align="start"
          side="right"
          sideOffset={12}
          className={cn(
            "w-80 text-xs leading-relaxed",
            "border px-3 py-2 shadow-lg backdrop-blur-sm",
            REC_STYLES[recommendation.type]
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">
            Recommendation
          </div>
          <div className="font-medium text-sm leading-snug">
            {recommendation.title}
          </div>
          <div className="mt-1 text-muted-foreground">
            {recommendation.reason}
          </div>

          <div className="mt-2 flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onAccept?.(recommendation);
              }}
            >
              Apply
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onDecline?.(recommendation);
              }}
              aria-label="Decline recommendation"
            >
              <IconX className="size-3" />
            </Button>
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
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
