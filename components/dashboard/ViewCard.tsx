"use client";

import { Recommendation, View, ViewFilter } from "@/types/dashboard";
import type { DecayMode } from "@/types/dashboard";
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
  IconChevronDown,
  IconEye,
  IconFilter,
  IconHandClick,
  IconHandMove,
  IconInfoCircle,
  IconPencil,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";
import { getRecColor, getActionLabel } from "@/components/recommendation/RecommendationSidebar";
import { INITIAL_FOCUS_SCORE } from "@/context/FocusContext";

const SIGNIFICANT_FOCUS_SCORE_THRESHOLD = 700;

/* =======================================================
   Layout constants
======================================================= */

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

function estimateInactivityMinutes(focusScore: number) {
  const clampedScore = Math.max(1, Math.min(INITIAL_FOCUS_SCORE, focusScore));
  const halfLifeSeconds = 90;
  const idleGraceSeconds = 8;
  const decaySeconds =
    halfLifeSeconds * Math.log2(INITIAL_FOCUS_SCORE / clampedScore);

  return Math.max(0, (decaySeconds + idleGraceSeconds) / 60);
}

/* =======================================================
   ViewCard
======================================================= */

function ViewCard({
  view,
  columnSpan,
  focusIntensity,
  focusScoreValue,
  showFocusScore = false,
  isFocusEngaged = false,
  widthPercent = "100%",
  heightPx = 260,
  slotHeightPx = 260,
  decayMode = "shrink",
  isSelected,
  preview = null,
  appliedRecColor,
  recommendation = null,
  recommendationIndex,
  onAcceptRecommendation,
  onDeclineRecommendation,
  onPointerEnter,
  onPointerLeave,
  onFocusEngagementChange,
  onPointerInteraction,
  onCardClick,
  onEditClick,
  onApplyFilter,
  onDrillDown,
}: {
  view: View;
  columnSpan?: number;
  focusIntensity: number;
  focusScoreValue?: number;
  showFocusScore?: boolean;
  isFocusEngaged?: boolean;
  widthPercent?: string;
  heightPx?: number;
  slotHeightPx?: number;
  decayMode?: DecayMode;
  isSelected: boolean;
  preview?: PreviewState;
  appliedRecColor?: string;
  recommendation?: Recommendation | null;
  recommendationIndex?: number;
  onAcceptRecommendation?: (rec: Recommendation) => void;
  onDeclineRecommendation?: (rec: Recommendation) => void;
  onPointerEnter?: (viewId: string) => void;
  onPointerLeave?: (viewId: string) => void;
  onFocusEngagementChange?: (viewId: string, engaged: boolean) => void;
  onPointerInteraction?: (
    viewId: string,
    event: { clientX: number; clientY: number }
  ) => void;
  onCardClick?: (viewId: string) => void;
  onEditClick?: (viewId: string) => void;
  onApplyFilter?: (viewId: string, filter: ViewFilter | undefined) => void;
  onDrillDown?: (viewId: string, category: string | null) => void;
}) {
  const isEditing = isSelected;
  const normalizedFocus = Number.isFinite(focusIntensity)
    ? Math.max(0, Math.min(1, focusIntensity))
    : 0.2;

  // Hover state: readability effects (dissolve, burn, opacity) clear instantly
  // on hover while sizing stays driven by the slow-recovering focusIntensity.
  const [isHovered, setIsHovered] = React.useState(false);
  const readabilityFocus = isHovered ? 1 : normalizedFocus;

  const borderOpacity = 0.1 + readabilityFocus * 0.18;

  const borderColor = `rgba(59, 130, 246, ${borderOpacity.toFixed(3)})`;
  const baseShadow = "0 1px 2px rgba(0, 0, 0, 0.08)";
  const recColor =
    recommendation && recommendationIndex != null
      ? getRecColor(recommendationIndex - 1)
      : undefined;

  // Detect pulsating highlight mode and action verb from appliedRecColor
  // Format: "#3b82f6__pulse__click" → color="#3b82f6", pulse=true, action="click"
  const pulseMatch = appliedRecColor?.match(/^(.+?)__pulse(?:__(.+))?$/);
  const isPulseHighlight = !!pulseMatch;
  const effectiveAppliedRecColor = pulseMatch ? pulseMatch[1] : appliedRecColor;
  const highlightAction = pulseMatch?.[2] || null;

  const contentOpacity = isEditing ? 1 : 0.6 + readabilityFocus * 0.4;
  const cardChromeHeight = recommendation ? 140 : 104;
  const reservedCardHeight = slotHeightPx + cardChromeHeight;
  const widthScale = Number.isFinite(Number.parseFloat(widthPercent))
    ? Math.max(0.25, Math.min(1, Number.parseFloat(widthPercent) / 100))
    : 1;
  const heightScale = Math.max(
    0.25,
    Math.min(1, (heightPx + cardChromeHeight) / reservedCardHeight)
  );
  const hasLowFocusScore =
    typeof focusScoreValue === "number" &&
    focusScoreValue < INITIAL_FOCUS_SCORE - 5;
  const shouldShowFocusAnnotation =
    showFocusScore &&
    hasLowFocusScore &&
    typeof focusScoreValue === "number" &&
    focusScoreValue <= SIGNIFICANT_FOCUS_SCORE_THRESHOLD;
  const estimatedInactiveMinutes = shouldShowFocusAnnotation
    ? estimateInactivityMinutes(focusScoreValue)
    : 0;
  const focusExplanation =
    decayMode === "shrink" || decayMode === "vignette"
      ? `Shrunk due to inactivity for ~${estimatedInactiveMinutes.toFixed(1)} min`
      : `Deemphasized due to inactivity for ~${estimatedInactiveMinutes.toFixed(1)} min`;

  // Shared: skip all decay effects on cards with pending recommendations
  const hasActiveRec = Boolean(recColor);
  const skipDecayEffects = hasActiveRec || isEditing;

  // ---- Burn mode: vignette + tint (only when decayMode === "burn") ----
  // Uses readabilityFocus so effects clear instantly on hover.
  const vignetteStrength =
    decayMode === "burn" && !skipDecayEffects
      ? Math.max(0, Math.min(1, (0.7 - readabilityFocus) / (0.7 - 0.25)))
      : 0;
  const tintOpacity =
    decayMode === "burn" && !skipDecayEffects
      ? Math.max(0, Math.min(1, (0.4 - readabilityFocus) / (0.4 - 0.25))) * 0.025
      : 0;

  // ---- Dissolve mode: opacity, border, blur (only when decayMode === "dissolve") ----
  // Uses readabilityFocus so effects clear instantly on hover.
  const dissolveStrength =
    decayMode === "dissolve" && !skipDecayEffects
      ? Math.max(0, Math.min(1, (0.7 - readabilityFocus) / (0.7 - 0.25)))
      : 0;
  const dissolveOpacity = 1 - dissolveStrength * 0.75; // 1.0 → 0.25
  const dissolveBorderOpacity = borderOpacity * (1 - dissolveStrength * 0.95); // fades to ~5%
  const dissolveBlur = dissolveStrength * 2; // 0 → 2px

  // ---- Vignette mode: three-stage progressive decay ----
  // Stage 1 (1000→700): shrink only (handled by widthScale/heightScale)
  // Stage 2 (700→250):  mild dissolve — opacity fade, no blur
  // Stage 3 (250→150):  burnt paper edges fade in at the card perimeter
  // All readability effects use readabilityFocus so they clear on hover.
  const isVignette = decayMode === "vignette" && !skipDecayEffects;

  // Stage 2: mild opacity fade (onset at 0.7, full at 0.25)
  const vignetteMildDissolve = isVignette
    ? Math.max(0, Math.min(1, (0.7 - readabilityFocus) / (0.7 - 0.25)))
    : 0;
  const vignetteOpacity = 1 - vignetteMildDissolve * 0.45; // 1.0 → 0.55 (milder than dissolve)
  const vignetteBorderOpacity = borderOpacity * (1 - vignetteMildDissolve * 0.7);

  // Stage 3: burnt paper edges (onset at intensity 0.4 ≈ score 200, full at 0.25 ≈ score 0)
  const burnEdgeStrength = isVignette
    ? Math.max(0, Math.min(1, (0.4 - readabilityFocus) / (0.4 - 0.25)))
    : 0;
  // Scale the vignette inset to current card size so it stays proportional at thumbnail
  const cardScale = Math.min(widthScale, heightScale);
  const burnBlur = 16 * burnEdgeStrength * cardScale;
  const burnSpread = 8 * burnEdgeStrength * cardScale;
  const burnEdgeShadow = burnEdgeStrength > 0
    ? `inset 0 0 ${burnBlur.toFixed(1)}px ${burnSpread.toFixed(1)}px rgba(30, 10, 0, ${(0.22 * burnEdgeStrength).toFixed(3)}), ` +
      `inset 0 0 ${(burnBlur * 1.6).toFixed(1)}px ${(burnSpread * 0.5).toFixed(1)}px rgba(160, 80, 10, ${(0.12 * burnEdgeStrength).toFixed(3)})`
    : "";

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

  React.useEffect(() => {
    onFocusEngagementChange?.(view.id, isFocusEngaged || isFilterOpen);

    return () => {
      onFocusEngagementChange?.(view.id, false);
    };
  }, [isFilterOpen, isFocusEngaged, onFocusEngagementChange, view.id]);

  const canManualFilter = Boolean(onApplyFilter) && preview == null;
  const minCardWidth =
    view.chartType === "KPI"
      ? recommendation || canManualFilter
        ? 240
        : 180
      : undefined;
  const clampedSpan = Math.max(1, Math.min(12, columnSpan ?? 4));
  const gridSpanClass =
    clampedSpan === 1
      ? "col-span-12 sm:col-span-1"
      : clampedSpan === 2
        ? "col-span-12 sm:col-span-2"
        : clampedSpan === 3
          ? "col-span-12 md:col-span-3"
          : clampedSpan === 4
            ? "col-span-12 md:col-span-4"
            : clampedSpan === 5
              ? "col-span-12 md:col-span-5"
              : clampedSpan === 6
                ? "col-span-12 md:col-span-6"
                : clampedSpan === 7
                  ? "col-span-12 md:col-span-7"
                  : clampedSpan === 8
                    ? "col-span-12 md:col-span-8"
                    : clampedSpan === 9
                      ? "col-span-12 md:col-span-9"
                      : clampedSpan === 10
                        ? "col-span-12 md:col-span-10"
                        : clampedSpan === 11
                          ? "col-span-12 md:col-span-11"
                          : "col-span-12";
  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      onPointerInteraction?.(view.id, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
    },
    [onPointerInteraction, view.id]
  );
  const handleCardClick = React.useCallback(() => {
    onCardClick?.(view.id);
  }, [onCardClick, view.id]);
  const handlePointerEnterCard = React.useCallback(() => {
    setIsHovered(true);
    onPointerEnter?.(view.id);
  }, [onPointerEnter, view.id]);
  const handlePointerLeaveCard = React.useCallback(() => {
    setIsHovered(false);
    onPointerLeave?.(view.id);
  }, [onPointerLeave, view.id]);
  const handleEditClick = React.useCallback(() => {
    onEditClick?.(view.id);
  }, [onEditClick, view.id]);

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

      <div
        className={cn("relative w-full min-w-0 self-start", gridSpanClass)}
        style={{ minHeight: `${reservedCardHeight}px` }}
      >
      <Card
        data-view-id={view.id}
        onPointerEnter={handlePointerEnterCard}
        onPointerLeave={handlePointerLeaveCard}
        onPointerMove={handlePointerMove}
        onClick={handleCardClick}
        style={{
          borderColor: dissolveStrength > 0
            ? `rgba(59, 130, 246, ${dissolveBorderOpacity.toFixed(3)})`
            : vignetteMildDissolve > 0
              ? `rgba(59, 130, 246, ${vignetteBorderOpacity.toFixed(3)})`
              : borderColor,
          borderStyle: dissolveStrength > 0.5 ? "dashed" : undefined,
          boxShadow:
            isPulseHighlight
              ? undefined // Let CSS animation control box-shadow
              : !isEditing && recColor
                ? `0 0 0 2px ${recColor}33, 0 4px 24px ${recColor}22`
                : burnEdgeStrength > 0
                  ? `${baseShadow}, ${burnEdgeShadow}`
                  : vignetteStrength > 0
                    ? `${baseShadow}, inset 0 0 ${(32 * vignetteStrength).toFixed(1)}px ${(16 * vignetteStrength).toFixed(1)}px rgba(120, 60, 0, ${(0.18 * vignetteStrength).toFixed(3)})`
                    : baseShadow,
          backgroundColor: tintOpacity > 0 ? `rgba(180, 100, 20, ${tintOpacity.toFixed(4)})` : undefined,
          opacity: dissolveStrength > 0
            ? dissolveOpacity
            : vignetteMildDissolve > 0
              ? vignetteOpacity
              : undefined,
          width: "100%",
          minWidth: 0,
          transform: `scale(${widthScale}, ${heightScale})`,
          transformOrigin: "top left",
          willChange: "transform, opacity",
          ...(isPulseHighlight && effectiveAppliedRecColor ? {
            "--hl-color-22": `${effectiveAppliedRecColor}22`,
            "--hl-color-33": `${effectiveAppliedRecColor}33`,
            "--hl-color-55": `${effectiveAppliedRecColor}55`,
          } as React.CSSProperties : {}),
        }}
        className={cn(
          "relative overflow-hidden transition-[transform,opacity,box-shadow,background-color,border-color] duration-300 ease-out cursor-pointer",
          "h-full",
          "hover:ring-1 hover:ring-ring",
          isEditing &&
            "ring-2 ring-primary shadow-lg animate-[editingBreath_2.4s_ease-in-out_infinite]",
          isPulseHighlight && !isEditing && "animate-highlight-pulse"
        )}
      >
        {recommendation && (
          <RecommendationBanner
            recommendation={recommendation}
            orderIndex={recommendationIndex}
            onAccept={onAcceptRecommendation}
            onDecline={onDeclineRecommendation}
          />
        )}

        {/* Base View */}
        <div
          className={cn(
            "relative z-0 flex flex-col flex-1 min-h-0",
            preview?.type === "REMOVE" && "opacity-40"
          )}
        >
          {/* Header */}
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex flex-1 flex-col gap-1">
                <CardTitle className="min-w-0 flex flex-wrap items-center gap-1 text-sm">
                  {view.title || view.id}
              <div className="min-w-0 flex flex-1 flex-col gap-1">
                <CardTitle className="min-w-0 flex flex-wrap items-center gap-1 text-sm">
                  {view.title || view.id}

                  {isEditing && (
                    <span className="text-[10px] text-primary font-medium">
                      (Editing)
                    </span>
                  )}

                  {showFocusScore && typeof focusScoreValue === "number" && (
                    <span className="rounded-full border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Focus {Math.round(focusScoreValue)}
                    </span>
                  )}
                </CardTitle>

                {shouldShowFocusAnnotation && (
                  <div className="flex items-start gap-1.5 rounded-md border border-amber-300/60 bg-amber-50 px-2 py-1 text-[10px] leading-snug text-amber-900">
                    <IconInfoCircle className="mt-0.5 size-3 shrink-0 text-amber-700" />
                    <CardDescription className="text-[10px] leading-snug text-amber-900">
                      {focusExplanation}
                    </CardDescription>
                  </div>
                )}
              </div>
                  {isEditing && (
                    <span className="text-[10px] text-primary font-medium">
                      (Editing)
                    </span>
                  )}

                  {showFocusScore && typeof focusScoreValue === "number" && (
                    <span className="rounded-full border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Focus {Math.round(focusScoreValue)}
                    </span>
                  )}
                </CardTitle>

                {shouldShowFocusAnnotation && (
                  <div className="flex items-start gap-1.5 rounded-md border border-amber-300/60 bg-amber-50 px-2 py-1 text-[10px] leading-snug text-amber-900">
                    <IconInfoCircle className="mt-0.5 size-3 shrink-0 text-amber-700" />
                    <CardDescription className="text-[10px] leading-snug text-amber-900">
                      {focusExplanation}
                    </CardDescription>
                  </div>
                )}
              </div>

              <div className="ml-auto flex shrink-0 items-center gap-1">
                {/* Action verb badge for HIGHLIGHT (pulsating mode) */}
                {isPulseHighlight && highlightAction && effectiveAppliedRecColor && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide animate-pulse"
                    style={{
                      backgroundColor: `${effectiveAppliedRecColor}20`,
                      color: effectiveAppliedRecColor,
                    }}
                  >
                    {highlightAction === "drill-down" && <IconChevronDown className="size-3" />}
                    {highlightAction === "click" && <IconHandClick className="size-3" />}
                    {highlightAction === "hover" && <IconHandMove className="size-3" />}
                    {highlightAction === "view" && <IconEye className="size-3" />}
                    {highlightAction === "drill-down" ? "Drill down" :
                     highlightAction === "click" ? "Click" :
                     highlightAction === "hover" ? "Hover" : "View"}
                  </span>
                )}
                {/* "Applied" badge for non-pulse recommendation completions */}
                {effectiveAppliedRecColor && !recommendation && !isPulseHighlight && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      backgroundColor: `${effectiveAppliedRecColor}15`,
                      color: effectiveAppliedRecColor,
                    }}
                  >
                    <IconCheck className="size-3" />
                    Applied
                  </span>
                )}
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
                    handleEditClick();
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
            className="relative flex p-0 overflow-hidden transition-[height,filter] duration-300 ease-out"
            style={{
              height: `${slotHeightPx}px`,
              filter: dissolveBlur > 0 ? `blur(${dissolveBlur.toFixed(1)}px)` : undefined,
            }}
          >
            <div
              className="relative size-full transition-opacity duration-300 ease-out"
              style={{ opacity: contentOpacity }}
            >
              <ChartRenderer
                view={view}
                filter={view.filter}
                height="100%"
                onDrillDown={onDrillDown}
                onEngagementChange={onFocusEngagementChange}
              />
            </div>
          </CardContent>

        </div>

        {/* Preview overlays */}
        {preview?.type === "MODIFY" && (
          <ModifyOverlay
            view={preview.view}
            heightPx={heightPx}
            onDrillDown={onDrillDown}
          />
        )}

        {preview?.type === "REMOVE" && <RemoveOverlay />}

        {preview?.type === "ADD" && (
          <AddOverlay
            view={preview.view}
            heightPx={heightPx}
            onDrillDown={onDrillDown}
          />
        )}
      </Card>
      </div>
    </>
  );
}

function areViewFiltersEqual(
  left: ViewFilter | undefined,
  right: ViewFilter | undefined
) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

export default React.memo(ViewCard, (prev, next) => {
  const isSameFocusInfo =
    prev.showFocusScore === next.showFocusScore &&
    (!next.showFocusScore || prev.focusScoreValue === next.focusScoreValue);

  return (
    prev.view === next.view &&
    prev.focusIntensity === next.focusIntensity &&
    isSameFocusInfo &&
    prev.isFocusEngaged === next.isFocusEngaged &&
    prev.widthPercent === next.widthPercent &&
    isSameFocusInfo &&
    prev.isFocusEngaged === next.isFocusEngaged &&
    prev.widthPercent === next.widthPercent &&
    prev.heightPx === next.heightPx &&
    prev.slotHeightPx === next.slotHeightPx &&
    prev.slotHeightPx === next.slotHeightPx &&
    prev.decayMode === next.decayMode &&
    prev.isSelected === next.isSelected &&
    prev.preview === next.preview &&
    prev.appliedRecColor === next.appliedRecColor &&
    prev.recommendation === next.recommendation &&
    prev.recommendationIndex === next.recommendationIndex &&
    areViewFiltersEqual(prev.view.filter, next.view.filter)
  );
});

/* =======================================================
   Recommendation Banner
======================================================= */

function RecommendationBanner({
  recommendation,
  orderIndex,
  onAccept,
  onDecline,
}: {
  recommendation: Recommendation;
  orderIndex?: number;
  onAccept?: (rec: Recommendation) => void;
  onDecline?: (rec: Recommendation) => void;
}) {
  const color =
    orderIndex != null ? getRecColor(orderIndex - 1) : "#3b82f6";

  return (
    <div
      className="relative z-20 flex items-center gap-2 px-3 py-1.5 text-xs border-b"
      style={{
        borderLeftWidth: "3px",
        borderLeftColor: color,
        backgroundColor: `${color}0a`,
        borderBottomColor: `${color}20`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <IconSparkles className="size-3.5" style={{ color }} />
      <span className="font-semibold text-[11px]">
        AI Suggestion{orderIndex != null ? ` #${orderIndex}` : ""}
      </span>
      <span
        className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {getActionLabel(recommendation)}
      </span>

      <div className="ml-auto flex items-center gap-1">
        {recommendation.type === "NEW_CONTENT" && (
          <button
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: color }}
            onClick={(e) => {
              e.stopPropagation();
              onAccept?.(recommendation);
            }}
          >
            <IconCheck className="size-3" />
            Apply
          </button>
        )}
        <button
          className="rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onDecline?.(recommendation);
          }}
          aria-label="Dismiss"
        >
          <IconX className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

/* =======================================================
   MODIFY overlay
======================================================= */

function ModifyOverlay({
  view,
  heightPx,
  onDrillDown,
}: {
  view: View;
  heightPx: number;
  onDrillDown?: (viewId: string, category: string | null) => void;
}) {
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
          className="flex p-0 overflow-hidden"
          style={{ height: `${heightPx}px` }}
        >
          <ChartRenderer
            view={view}
            filter={view.filter}
            height="100%"
            onDrillDown={onDrillDown}
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

function AddOverlay({
  view,
  heightPx,
  onDrillDown,
}: {
  view: View;
  heightPx: number;
  onDrillDown?: (viewId: string, category: string | null) => void;
}) {
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
          className="flex p-0 overflow-hidden"
          style={{ height: `${heightPx}px` }}
        >
          <ChartRenderer
            view={view}
            filter={view.filter}
            height="100%"
            onDrillDown={onDrillDown}
          />
        </CardContent>
      </div>
    </div>
  );
}
