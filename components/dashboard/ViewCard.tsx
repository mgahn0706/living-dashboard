"use client";

import { Recommendation, View, ViewFilter } from "@/types/dashboard";
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
import { useDataset } from "@/context/DatasetContext";
import * as Popover from "@radix-ui/react-popover";
import {
  IconCheck,
  IconFilter,
  IconPencil,
  IconSparkles,
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
  xl: "basis-[49%]",
  lg: "basis-[32%]",
  md: "basis-[24%]",
  sm: "basis-[24%]",
};

const KPI_SIZE_CLASS: Record<View["size"], string> = {
  xl: "basis-[11.5%]",
  lg: "basis-[11.5%]",
  md: "basis-[11.5%]",
  sm: "basis-[11.5%]",
};

const CHART_HEIGHT: Record<View["size"], string> = {
  xl: "h-[400px]",
  lg: "h-[260px]",
  md: "h-[210px]",
  sm: "h-[170px]",
};

const KPI_HEIGHT: Record<View["size"], string> = {
  xl: "h-[120px]",
  lg: "h-[120px]",
  md: "h-[100px]",
  sm: "h-[80px]",
};

/* =======================================================
   Preview Types
======================================================= */

export type PreviewState =
  | { type: "MODIFY"; view: View }
  | { type: "REMOVE" }
  | { type: "ADD"; view: View }
  | null;

function toDistinctStringOptions(values: any[], limit = 120) {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const v of values) {
    if (v === null || v === undefined || v === "") continue;
    const raw = String(v).trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
    if (out.length >= limit) break;
  }

  return out;
}

function buildFilterFromDraft(draft: {
  top: string;
  includeXValues: string[];
  includeColumns: string[];
  byColumn: string;
  byValues: string[];
}): ViewFilter | undefined {
  const next: ViewFilter = {};

  const top = Number(draft.top);
  if (!Number.isNaN(top) && top > 0) {
    next.top = Math.floor(top);
  }

  const includeXValues = draft.includeXValues
    .map((v) => v.trim())
    .filter(Boolean);
  if (includeXValues.length > 0) {
    next.includeXValues = includeXValues;
  }

  const includeColumns = draft.includeColumns
    .map((s) => s.trim())
    .filter(Boolean);
  if (includeColumns.length > 0) {
    next.includeColumns = includeColumns;
  }

  const byColumn = draft.byColumn.trim();
  const byValues = draft.byValues.map((v) => v.trim()).filter(Boolean);
  if (byColumn && byValues.length > 0) {
    next.includeByColumn = [{ column: byColumn, includeValues: byValues }];
  }

  if (Object.keys(next).length === 0) return undefined;
  return next;
}

/* =======================================================
   ViewCard
======================================================= */

export default React.memo(function ViewCard({
  view,
  focusIntensity,
  isSelected,
  preview = null,
  recommendation = null,
  onRecommendationHover,
  onRecommendationLeave,
  onAcceptRecommendation,
  onDeclineRecommendation,
  onPointerMove,
  onCardClick,
  onEditClick,
  onApplyFilter,
}: {
  view: View;
  focusIntensity: number;
  isSelected: boolean;
  preview?: PreviewState;
  recommendation?: Recommendation | null;
  onRecommendationHover?: (rec: Recommendation) => void;
  onRecommendationLeave?: () => void;
  onAcceptRecommendation?: (rec: Recommendation) => void;
  onDeclineRecommendation?: (rec: Recommendation) => void;
  onPointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onCardClick?: () => void;
  onEditClick?: () => void;
  onApplyFilter?: (viewId: string, filter: ViewFilter | undefined) => void;
}) {
  const isEditing = isSelected;
  const normalizedFocus = Number.isFinite(focusIntensity)
    ? Math.max(0, Math.min(1, focusIntensity))
    : 0.2;
  const borderOpacity = 0.08 + normalizedFocus * 0.34;
  const borderWidth = 1 + normalizedFocus * 1.2;
  const glowOpacity = 0.02 + normalizedFocus * 0.12;
  const borderColor = `rgba(59, 130, 246, ${borderOpacity.toFixed(3)})`;
  const borderGlow = `0 0 0 ${borderWidth.toFixed(2)}px rgba(59, 130, 246, ${glowOpacity.toFixed(3)})`;
  const baseShadow = "0 1px 2px rgba(0, 0, 0, 0.08)";
  const { attributeKeys, resolveAttribute } = useDataset();
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [draft, setDraft] = React.useState({
    top: "",
    includeXValues: [] as string[],
    includeColumns: [] as string[],
    byColumn: "",
    byValues: [] as string[],
  });

  const xFilterColumn =
    view.chartType === "TABLE" ? view.columns[0] ?? "" : view.xColumn;
  const xValueOptions = React.useMemo(
    () =>
      xFilterColumn
        ? toDistinctStringOptions(resolveAttribute(xFilterColumn))
        : ([] as string[]),
    [xFilterColumn, resolveAttribute]
  );
  const byValueOptions = React.useMemo(
    () =>
      draft.byColumn
        ? toDistinctStringOptions(resolveAttribute(draft.byColumn))
        : ([] as string[]),
    [draft.byColumn, resolveAttribute]
  );

  React.useEffect(() => {
    const by = view.filter?.includeByColumn?.[0];
    setDraft({
      top: view.filter?.top != null ? String(view.filter.top) : "",
      includeXValues:
        view.filter?.includeXValues?.map((v) => String(v)) ?? [],
      includeColumns: view.filter?.includeColumns ?? [],
      byColumn: by?.column ?? "",
      byValues: by?.includeValues?.map((v) => String(v)) ?? [],
    });
  }, [view.id, view.filter]);

  const canManualFilter = Boolean(onApplyFilter) && preview == null;

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
        style={{
          borderColor,
          boxShadow: `${borderGlow}, ${baseShadow}`,
        }}
        className={cn(
          view.chartType === "KPI" ? KPI_SIZE_CLASS[view.size] : SIZE_CLASS[view.size],
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
                {canManualFilter && (
                  <Popover.Root
                    open={isFilterOpen}
                    onOpenChange={(open) => setIsFilterOpen(open)}
                  >
                    <Popover.Trigger asChild>
                      <Button
                        variant={view.filter ? "secondary" : "ghost"}
                        size="icon"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Edit filter"
                      >
                        <IconFilter size={16} />
                      </Button>
                    </Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Content
                        side="bottom"
                        align="end"
                        sideOffset={8}
                        className="z-[200] w-72 rounded-md border bg-background p-2 shadow-md"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="mb-2 text-[11px] font-medium">View Filter</div>

                        <div className="max-h-[320px] overflow-y-auto pr-1 space-y-2 text-[11px]">
                          <label className="block">
                            <span className="mb-1 block text-muted-foreground">Top N</span>
                            <input
                              className="w-full rounded border px-2 py-1 text-xs"
                              placeholder="e.g. 5"
                              value={draft.top}
                              onChange={(e) =>
                                setDraft((prev) => ({ ...prev, top: e.target.value }))
                              }
                            />
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-muted-foreground">
                              X Values
                            </span>
                            <div className="max-h-24 overflow-auto rounded border p-1">
                              <div className="flex flex-wrap gap-1">
                                {xValueOptions.map((value) => {
                                  const selected =
                                    draft.includeXValues.includes(value);
                                  return (
                                    <button
                                      key={value}
                                      type="button"
                                      className={cn(
                                        "rounded-full border px-2 py-1 text-[11px] transition",
                                        selected
                                          ? "border-primary bg-primary/10 text-primary"
                                          : "border-border bg-background text-muted-foreground"
                                      )}
                                      onClick={() =>
                                        setDraft((prev) => ({
                                          ...prev,
                                          includeXValues: prev.includeXValues.includes(value)
                                            ? prev.includeXValues.filter((v) => v !== value)
                                            : [...prev.includeXValues, value],
                                        }))
                                      }
                                    >
                                      {value}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </label>

                          {view.chartType === "TABLE" && (
                            <label className="block">
                              <span className="mb-1 block text-muted-foreground">
                                Columns
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {view.columns.map((col) => {
                                  const selected = draft.includeColumns.includes(col);
                                  return (
                                    <button
                                      key={col}
                                      type="button"
                                      className={cn(
                                        "rounded-full border px-2 py-1 text-[11px] transition",
                                        selected
                                          ? "border-primary bg-primary/10 text-primary"
                                          : "border-border bg-background text-muted-foreground"
                                      )}
                                      onClick={() =>
                                        setDraft((prev) => ({
                                          ...prev,
                                          includeColumns: prev.includeColumns.includes(col)
                                            ? prev.includeColumns.filter((c) => c !== col)
                                            : [...prev.includeColumns, col],
                                        }))
                                      }
                                    >
                                      {col}
                                    </button>
                                  );
                                })}
                              </div>
                            </label>
                          )}

                          <label className="block">
                            <span className="mb-1 block text-muted-foreground">
                              Attribute Column
                            </span>
                            <select
                              className="w-full rounded border px-2 py-1 text-xs"
                              value={draft.byColumn}
                              onChange={(e) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  byColumn: e.target.value,
                                  byValues: [],
                                }))
                              }
                            >
                              <option value="">Select attribute</option>
                              {attributeKeys.map((k) => (
                                <option key={k} value={k}>
                                  {k}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-muted-foreground">
                              Attribute Values
                            </span>
                            <div className="max-h-24 overflow-auto rounded border p-1">
                              <div className="flex flex-wrap gap-1">
                                {byValueOptions.map((value) => {
                                  const selected = draft.byValues.includes(value);
                                  return (
                                    <button
                                      key={value}
                                      type="button"
                                      className={cn(
                                        "rounded-full border px-2 py-1 text-[11px] transition",
                                        selected
                                          ? "border-primary bg-primary/10 text-primary"
                                          : "border-border bg-background text-muted-foreground"
                                      )}
                                      onClick={() =>
                                        setDraft((prev) => ({
                                          ...prev,
                                          byValues: prev.byValues.includes(value)
                                            ? prev.byValues.filter((v) => v !== value)
                                            : [...prev.byValues, value],
                                        }))
                                      }
                                    >
                                      {value}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </label>
                        </div>

                        <div className="mt-2 flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              onApplyFilter?.(view.id, undefined);
                              setIsFilterOpen(false);
                            }}
                          >
                            Clear
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              const next = buildFilterFromDraft(draft);
                              onApplyFilter?.(view.id, next);
                              setIsFilterOpen(false);
                            }}
                          >
                            Apply
                          </Button>
                        </div>
                      </Popover.Content>
                    </Popover.Portal>
                  </Popover.Root>
                )}

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
              </div>
            </div>
          </CardHeader>

          {/* Content */}
          <CardContent
            className={cn(
              view.chartType === "KPI" ? KPI_HEIGHT[view.size] : CHART_HEIGHT[view.size],
              "flex p-0 overflow-hidden"
            )}
          >
            <ChartRenderer view={view} filter={view.filter} height="100%" />
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
});

/* =======================================================
   Recommendation Banner
======================================================= */

const REC_STYLES: Record<Recommendation["type"], string> = {
  MODIFY_CONTENT:
    "border-sky-200/70 bg-gradient-to-br from-sky-50/90 to-sky-100/60 text-sky-900 shadow-[0_10px_25px_rgba(14,116,144,0.18)] dark:border-sky-900/60 dark:from-sky-950/50 dark:to-sky-900/25 dark:text-sky-100",
  MODIFY_FILTER:
    "border-cyan-200/70 bg-gradient-to-br from-cyan-50/90 to-cyan-100/60 text-cyan-900 shadow-[0_10px_25px_rgba(8,145,178,0.18)] dark:border-cyan-900/60 dark:from-cyan-950/50 dark:to-cyan-900/25 dark:text-cyan-100",
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
          className={cn(
            view.chartType === "KPI" ? KPI_HEIGHT[size] : CHART_HEIGHT[size],
            "flex p-0 overflow-hidden"
          )}
        >
          <ChartRenderer view={view} filter={view.filter} height="100%" />
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
          className={cn(
            view.chartType === "KPI" ? KPI_HEIGHT[size] : CHART_HEIGHT[size],
            "flex p-0 overflow-hidden"
          )}
        >
          <ChartRenderer view={view} filter={view.filter} height="100%" />
        </CardContent>
      </div>
    </div>
  );
}
