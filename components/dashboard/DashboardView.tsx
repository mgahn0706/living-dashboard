"use client";

import React from "react";
import { useEffect, useMemo } from "react";
import { Recommendation, View } from "@/types/dashboard";
import type { DecayMode } from "@/app/page";
import { INITIAL_FOCUS_SCORE, useFocus } from "@/context/FocusContext";
import { useDataset } from "@/context/DatasetContext";
import { useCategoryFilter } from "@/context/CategoryFilterContext";
import ViewCard, { PreviewState } from "./ViewCard";
import { Button } from "../ui/button";
import { ArrowRight, Plus, X } from "lucide-react";
import TimeSlider from "./TimeSlider";

const FOCUS_STABLE_RANGE = 5;
const MIN_VISIBLE_FOCUS_INTENSITY = 0.25;

/* Continuous sizing ranges driven by focus intensity.
   max ~32% → ~3 cards per row at full focus; min ~16% → thumbnail.
   Heights kept compact for a commercial dashboard feel. */
const CHART_BASIS = { min: 16, max: 32 };
const CHART_HEIGHT = { min: 100, max: 260 };
const KPI_BASIS = { min: 8, max: 11.5 };
const KPI_HEIGHT = { min: 56, max: 100 };

function lerp(min: number, max: number, t: number) {
  return min + t * (max - min);
}

export default function DashboardView({
  views = [],
  previewMap = {},
  addPreview = null,
  decayMode = "shrink",
  recommendationsByViewId = {},
  recommendationOrderMap = {},
  appliedRecColorByViewId = {},
  newContentRecommendation = null,
  onAcceptRecommendation,
  onDeclineRecommendation,
  onInitializeDashboard,
  onLoadDemo,
  canInitializeDashboard = true,
  isInitializingDashboard = false,
  selectedViewId,
  isAddMode,
  setSidebarMode,
  onSelect,
  onApplyFilter,
}: {
  views: View[];
  previewMap?: Record<string, PreviewState>;
  addPreview?: View | null;
  decayMode?: DecayMode;
  recommendationsByViewId?: Record<string, Recommendation>;
  recommendationOrderMap?: Record<string, number>;
  appliedRecColorByViewId?: Record<string, string>;
  newContentRecommendation?: Recommendation | null;
  onAcceptRecommendation?: (rec: Recommendation) => void;
  onDeclineRecommendation?: (rec: Recommendation) => void;
  onInitializeDashboard?: () => void;
  onLoadDemo?: () => void;
  canInitializeDashboard?: boolean;
  isInitializingDashboard?: boolean;
  selectedViewId: string | null;
  isAddMode: boolean;
  setSidebarMode: (mode: "FORMAT" | "STRUCTURE") => void;
  onSelect: (viewId: string) => void;
  onApplyFilter?: (viewId: string, filter: View["filter"] | undefined) => void;
}) {
  const { focusScore, reportPointerInteraction, reportClickInteraction, registerViewIds } =
    useFocus();

  // Register all view IDs so they start decaying immediately, not only on hover.
  useEffect(() => {
    if (views.length > 0) {
      registerViewIds(views.map((v) => v.id));
    }
  }, [views, registerViewIds]);

  const sortedViews = [...views].sort((a, b) => b.priority - a.priority);
  const focusIntensityByViewId = useMemo(() => {
    const map: Record<string, number> = {};

    if (views.length === 0) return map;

    views.forEach((view) => {
      const score = focusScore[view.id] ?? INITIAL_FOCUS_SCORE;

      if (score >= INITIAL_FOCUS_SCORE - FOCUS_STABLE_RANGE) {
        map[view.id] = 1;
        return;
      }

      const normalized = Math.max(
        0,
        Math.min(1, score / INITIAL_FOCUS_SCORE)
      );
      map[view.id] =
        MIN_VISIBLE_FOCUS_INTENSITY +
        normalized * (1 - MIN_VISIBLE_FOCUS_INTENSITY);
    });

    return map;
  }, [views, focusScore]);

  const sizingByViewId = useMemo(() => {
    const map: Record<string, { flexBasis: string; heightPx: number }> = {};
    views.forEach((view) => {
      const t = focusIntensityByViewId[view.id] ?? 0.25;
      const isKpi = view.chartType === "KPI";
      const basis = isKpi ? KPI_BASIS : CHART_BASIS;
      const height = isKpi ? KPI_HEIGHT : CHART_HEIGHT;
      map[view.id] = {
        flexBasis: `${lerp(basis.min, basis.max, t).toFixed(1)}%`,
        heightPx: Math.round(lerp(height.min, height.max, t)),
      };
    });
    return map;
  }, [views, focusIntensityByViewId]);

  /* =======================================================
     Empty State
  ======================================================= */

  if (views.length === 0) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-md text-muted-foreground relative">
        <div>No views available. Please add a view to get started.</div>

        {!isAddMode && (
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={onLoadDemo}
              disabled={isInitializingDashboard}
            >
              {isInitializingDashboard
                ? "Loading..."
                : "Load Demo Dataset"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSidebarMode("STRUCTURE")}
            >
              Add View
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onInitializeDashboard}
              disabled={!canInitializeDashboard || isInitializingDashboard}
            >
              {isInitializingDashboard
                ? "Initializing..."
                : "Initialize dashboard with LLM"}
            </Button>
          </div>
        )}

        {isAddMode && (
          <ArrowRight className="w-8 h-8 text-primary animate-wiggle-x animate-pulse" />
        )}
      </div>
    );
  }

  /* =======================================================
     Render
  ======================================================= */

  return (
    <>
    <TimeSlider />
    <CategoryFilterBar />
    <div className="flex flex-wrap gap-4 items-start">
      {sortedViews.map((view) => (
        <ViewCard
          key={view.id}
          view={view}
          focusIntensity={focusIntensityByViewId[view.id] ?? 0.2}
          flexBasis={sizingByViewId[view.id]?.flexBasis ?? "32%"}
          heightPx={sizingByViewId[view.id]?.heightPx ?? 260}
          decayMode={decayMode}
          isSelected={selectedViewId === view.id}
          preview={previewMap[view.id] ?? null}
          appliedRecColor={appliedRecColorByViewId[view.id]}
          recommendation={recommendationsByViewId[view.id] ?? null}
          recommendationIndex={
            recommendationsByViewId[view.id]
              ? recommendationOrderMap[recommendationsByViewId[view.id].id]
              : undefined
          }
          onAcceptRecommendation={onAcceptRecommendation}
          onDeclineRecommendation={onDeclineRecommendation}
          onPointerMove={(e) =>
            reportPointerInteraction(view.id, {
              clientX: e.clientX,
              clientY: e.clientY,
            })
          }
          onCardClick={() => {
            reportClickInteraction(view.id);
          }}
          onEditClick={() => onSelect(view.id)}
          onApplyFilter={onApplyFilter}
        />
      ))}

      {addPreview && (
        <ViewCard
          view={addPreview}
          focusIntensity={0.2}
          flexBasis="32%"
          heightPx={260}
          preview={{ type: "ADD", view: addPreview }}
          isSelected={false}
          recommendation={newContentRecommendation}
          recommendationIndex={
            newContentRecommendation
              ? recommendationOrderMap[newContentRecommendation.id]
              : undefined
          }
          onAcceptRecommendation={onAcceptRecommendation}
          onDeclineRecommendation={onDeclineRecommendation}
        />
      )}
    </div>
    </>
  );
}

/* =======================================================
   Category Filter Bar
======================================================= */

function CategoryFilterBar() {
  const { attributeKeys, attributeTypes, resolveAttribute, rawData } = useDataset();
  const { categoryFilters, addFilter, removeFilter, toggleValue, selectAll, deselectAll } = useCategoryFilter();
  const [addOpen, setAddOpen] = React.useState(false);

  // String columns that don't already have a filter
  const availableColumns = React.useMemo(
    () =>
      attributeKeys.filter(
        (k) =>
          attributeTypes[k] === "string" &&
          !categoryFilters.some((f) => f.column === k)
      ),
    [attributeKeys, attributeTypes, categoryFilters]
  );

  if (!rawData) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {categoryFilters.map((cf) => (
        <CategoryFilterChips
          key={cf.column}
          column={cf.column}
          selectedValues={cf.selectedValues}
          onToggle={(val) => toggleValue(cf.column, val)}
          onSelectAll={(vals) => selectAll(cf.column, vals)}
          onDeselectAll={() => deselectAll(cf.column)}
          onRemove={() => removeFilter(cf.column)}
        />
      ))}

      {availableColumns.length > 0 && (
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setAddOpen(!addOpen)}
          >
            <Plus className="h-3 w-3" /> Add Filter
          </Button>
          {addOpen && (
            <div className="absolute top-8 left-0 z-50 rounded-md border bg-popover p-1 shadow-md min-w-[160px]">
              {availableColumns.map((col) => (
                <button
                  key={col}
                  className="w-full text-left px-2 py-1 text-xs rounded hover:bg-accent"
                  onClick={() => {
                    const values = resolveAttribute(col);
                    const unique = Array.from(
                      new Set(
                        values
                          .filter((v: any) => v != null && v !== "")
                          .map((v: any) => String(v))
                      )
                    ).sort();
                    addFilter(col, unique);
                    setAddOpen(false);
                  }}
                >
                  {col}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryFilterChips({
  column,
  selectedValues,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onRemove,
}: {
  column: string;
  selectedValues: Set<string>;
  onToggle: (value: string) => void;
  onSelectAll: (values: string[]) => void;
  onDeselectAll: () => void;
  onRemove: () => void;
}) {
  const { resolveAttribute } = useDataset();

  const uniqueValues = React.useMemo(() => {
    const values = resolveAttribute(column);
    return Array.from(
      new Set(
        values
          .filter((v: any) => v != null && v !== "")
          .map((v: any) => String(v))
      )
    ).sort();
  }, [column, resolveAttribute]);

  const allSelected = uniqueValues.length === selectedValues.size;

  return (
    <div className="flex items-center gap-1 rounded-md border bg-card px-2 py-1">
      <span className="text-xs font-medium text-muted-foreground mr-1">
        {column}:
      </span>

      {uniqueValues.map((val) => {
        const isOn = selectedValues.has(val);
        return (
          <button
            key={val}
            onClick={() => onToggle(val)}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${
              isOn
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {val}
          </button>
        );
      })}

      <button
        onClick={() => (allSelected ? onDeselectAll() : onSelectAll(uniqueValues))}
        className="px-1 text-[10px] text-muted-foreground hover:text-foreground ml-1"
        title={allSelected ? "Deselect all" : "Select all"}
      >
        {allSelected ? "None" : "All"}
      </button>

      <button
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive ml-0.5"
        title="Remove filter"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
