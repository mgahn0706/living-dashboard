"use client";

import React from "react";
import { useDataset } from "@/context/DatasetContext";
import { useTimeFilter, type TimeFilter } from "@/context/TimeFilterContext";
import { Slider } from "@/components/ui/slider";

export default function TimeSlider({
  timeFilter: controlledTimeFilter,
  selectedColumn: controlledSelectedColumn,
  onTimeFilterChange,
  onSelectedColumnChange,
}: {
  timeFilter?: TimeFilter | null;
  selectedColumn?: string | null;
  onTimeFilterChange?: (filter: TimeFilter | null) => void;
  onSelectedColumnChange?: (column: string | null) => void;
}) {
  const { attributeTypes, rawData, resolveAttribute } = useDataset();
  const { timeFilter, setTimeFilter, selectedColumn, setSelectedColumn } =
    useTimeFilter();
  const activeTimeFilter =
    controlledTimeFilter === undefined ? timeFilter : controlledTimeFilter;
  const activeSelectedColumn =
    controlledSelectedColumn === undefined
      ? selectedColumn
      : controlledSelectedColumn;

  const dateColumns = React.useMemo(
    () =>
      Object.entries(attributeTypes)
        .filter(([, type]) => type === "date")
        .map(([col]) => col),
    [attributeTypes]
  );

  const { minTs, maxTs } = React.useMemo(() => {
    if (!activeSelectedColumn || !rawData) return { minTs: 0, maxTs: 0 };
    const values = resolveAttribute(activeSelectedColumn);
    const timestamps = values
      .map((v: any) => {
        if (v == null || v === "") return NaN;
        const d = Date.parse(String(v));
        return Number.isNaN(d) ? NaN : d;
      })
      .filter((t: number) => !Number.isNaN(t));
    if (timestamps.length === 0) return { minTs: 0, maxTs: 0 };
    return {
      minTs: Math.min(...timestamps),
      maxTs: Math.max(...timestamps),
    };
  }, [activeSelectedColumn, rawData, resolveAttribute]);

  if (dateColumns.length === 0 || !rawData) return null;

  const currentMin = activeTimeFilter?.min ?? minTs;
  const currentMax = activeTimeFilter?.max ?? maxTs;

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
    });

  return (
    <div className="mb-4 px-2 py-2 border rounded-lg bg-card flex items-center gap-3">
      <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
        Time
      </label>

      <select
        className="rounded border px-2 py-1 text-xs bg-background"
        value={activeSelectedColumn ?? ""}
        onChange={(e) => {
          const col = e.target.value || null;
          if (onSelectedColumnChange) {
            onSelectedColumnChange(col);
          } else {
            setSelectedColumn(col);
            setTimeFilter(null);
          }
        }}
      >
        <option value="">Select column</option>
        {dateColumns.map((col) => (
          <option key={col} value={col}>
            {col}
          </option>
        ))}
      </select>

      {activeSelectedColumn && minTs < maxTs && (
        <>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            {formatDate(currentMin)}
          </span>
          <Slider
            className="flex-1 min-w-[120px]"
            min={minTs}
            max={maxTs}
            step={86400000}
            value={[currentMin, currentMax]}
            onValueChange={([newMin, newMax]) => {
              const nextFilter = {
                column: activeSelectedColumn,
                min: newMin,
                max: newMax,
              };
              if (onTimeFilterChange) {
                onTimeFilterChange(nextFilter);
              } else {
                setTimeFilter(nextFilter);
              }
            }}
          />
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            {formatDate(currentMax)}
          </span>
        </>
      )}

      {activeTimeFilter && (
        <button
          className="text-xs text-muted-foreground hover:text-foreground ml-1"
          onClick={() =>
            onTimeFilterChange ? onTimeFilterChange(null) : setTimeFilter(null)
          }
        >
          Clear
        </button>
      )}
    </div>
  );
}
