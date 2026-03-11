"use client";

import React from "react";
import { ChartView } from "@/types/dashboard";
import { useDataset } from "@/context/DatasetContext";
import { useSelection } from "@/context/SelectionContext";
import { useTimeFilter } from "@/context/TimeFilterContext";
import { formatCompactNumber } from "@/lib/utils";

/* =======================================================
   Country centroids (lon, lat)
======================================================= */

const COUNTRY_COORDS: Record<string, [number, number]> = {
  "United States": [-98, 39],
  Canada: [-106, 56],
  Brazil: [-51, -14],
  Mexico: [-102, 23],
  "United Kingdom": [-3, 54],
  Germany: [10, 51],
  France: [2, 46],
  Spain: [-4, 40],
  Denmark: [10, 56],
  India: [79, 22],
  Japan: [138, 36],
  Australia: [134, -25],
  China: [104, 35],
  "South Korea": [128, 36],
  Italy: [12, 42],
  Netherlands: [5, 52],
  Sweden: [15, 62],
  Norway: [8, 62],
  Switzerland: [8, 47],
  Argentina: [-64, -34],
  Colombia: [-74, 4],
  Chile: [-71, -35],
  "South Africa": [25, -29],
  Nigeria: [8, 10],
  Kenya: [38, 0],
  Egypt: [30, 27],
  Turkey: [35, 39],
  Russia: [100, 60],
  Singapore: [104, 1],
  "New Zealand": [174, -41],
  Indonesia: [120, -5],
  Thailand: [101, 15],
  Vietnam: [108, 14],
  Philippines: [122, 12],
  Malaysia: [102, 4],
  "Saudi Arabia": [45, 24],
  "United Arab Emirates": [54, 24],
  Israel: [35, 31],
  Poland: [20, 52],
  Ireland: [-8, 53],
  Portugal: [-8, 39],
  Belgium: [4, 51],
  Austria: [14, 47],
  Finland: [26, 64],
  Greece: [22, 39],
  "Czech Republic": [15, 50],
  Romania: [25, 46],
  Hungary: [19, 47],
  Ukraine: [32, 49],
  Peru: [-76, -10],
  Venezuela: [-66, 8],
  Ecuador: [-78, -2],
  Taiwan: [121, 24],
};

const MAP_WIDTH = 800;
const MAP_HEIGHT = 450;
const MAP_PADDING = 24;
const MAX_LATITUDE = 82;

function clampLatitude(latitude: number): number {
  return Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, latitude));
}

function mercatorY(latitude: number): number {
  const latRad = (clampLatitude(latitude) * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + latRad / 2));
}

const MERCATOR_MIN_Y = mercatorY(-MAX_LATITUDE);
const MERCATOR_MAX_Y = mercatorY(MAX_LATITUDE);

function projectCoordinates([longitude, latitude]: [number, number]): [number, number] {
  const x =
    MAP_PADDING + ((longitude + 180) / 360) * (MAP_WIDTH - MAP_PADDING * 2);
  const yRatio =
    (MERCATOR_MAX_Y - mercatorY(latitude)) /
    (MERCATOR_MAX_Y - MERCATOR_MIN_Y);
  const y = MAP_PADDING + yRatio * (MAP_HEIGHT - MAP_PADDING * 2);
  return [x, y];
}

/* =======================================================
   Filter helpers (duplicated minimally from ChartRenderer)
======================================================= */

function getValueByPath(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const keys = path.split(".");
  let cur = obj;
  for (const k of keys) {
    if (cur == null) return undefined;
    cur = cur[k];
  }
  return cur;
}

function rowMatchesAttributeFilter(
  row: any,
  includeByColumn?: Array<{ column: string; includeValues: Array<string | number | boolean> }>
): boolean {
  if (!includeByColumn || includeByColumn.length === 0) return true;
  return includeByColumn.every(({ column, includeValues }) => {
    const val = getValueByPath(row, column);
    return includeValues.some((iv) => String(iv) === String(val));
  });
}

/* =======================================================
   Types
======================================================= */

type ChartRendererFilter = {
  top?: number;
  includeXValues?: Array<string | number>;
  includeColumns?: string[];
  includeByColumn?: Array<{
    column: string;
    includeValues: Array<string | number | boolean>;
  }>;
};

type BubbleData = {
  country: string;
  coords: [number, number];
  projected: [number, number];
  value: number;
};

/* =======================================================
   useTimeFilteredData (minimal copy)
======================================================= */

function useTimeFilteredData(): any[] {
  const { rawData } = useDataset();
  const { timeFilter } = useTimeFilter();

  return React.useMemo(() => {
    if (!Array.isArray(rawData)) return [];
    if (!timeFilter) return rawData;
    const { column, min, max } = timeFilter;
    return rawData.filter((row: any) => {
      const val = getValueByPath(row, column);
      if (val == null || val === "") return false;
      const ts = Date.parse(String(val));
      if (Number.isNaN(ts)) return false;
      return ts >= min && ts <= max;
    });
  }, [rawData, timeFilter]);
}

/* =======================================================
   MapRenderer Component
======================================================= */

export default function MapRenderer({
  view,
  height,
  filter,
}: {
  view: ChartView;
  height: number | "100%";
  filter?: ChartRendererFilter;
}) {
  const rawData = useTimeFilteredData();
  const {
    selection,
    rangeFilter,
    lassoFilter,
    replaceSelection,
    addToSelection,
    clearSelection,
    hasSelection,
  } = useSelection();

  const countryColumn = view.xColumn;
  const yColumn = view.yColumn;
  const agg = view.aggregation || "sum";

  // Cross-filter: when selection is from another chart, filter data so values update
  const crossFilteredData = React.useMemo(() => {
    if (!hasSelection) return rawData;
    // Inline selection matching (mirrors ChartRenderer's rowMatchesSelection)
    return rawData.filter((row: any) => {
      // Discrete selection
      if (selection && Object.keys(selection).length > 0) {
        const match = Object.entries(selection).every(([col, values]: any) => {
          if (!values || values.size === 0) return true;
          const val = getValueByPath(row, col);
          return values.has(val);
        });
        if (!match) return false;
      }
      // Range filter
      if (rangeFilter) {
        const xVal = Number(getValueByPath(row, rangeFilter.xColumn));
        const yVal = Number(getValueByPath(row, rangeFilter.yColumn));
        if (Number.isNaN(xVal) || Number.isNaN(yVal)) return false;
        if (xVal < rangeFilter.xMin || xVal > rangeFilter.xMax || yVal < rangeFilter.yMin || yVal > rangeFilter.yMax) return false;
      }
      // Lasso filter
      if (lassoFilter) {
        const xVal = Number(getValueByPath(row, lassoFilter.xColumn));
        const yVal = Number(getValueByPath(row, lassoFilter.yColumn));
        if (Number.isNaN(xVal) || Number.isNaN(yVal)) return false;
        let inside = false;
        const poly = lassoFilter.polygon;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const xi = poly[i].x, yi = poly[i].y;
          const xj = poly[j].x, yj = poly[j].y;
          if ((yi > yVal) !== (yj > yVal) && xVal < ((xj - xi) * (yVal - yi)) / (yj - yi) + xi) {
            inside = !inside;
          }
        }
        if (!inside) return false;
      }
      return true;
    });
  }, [rawData, hasSelection, selection, rangeFilter, lassoFilter]);

  // Filter + aggregate by country
  const bubbleData = React.useMemo(() => {
    const filtered = crossFilteredData.filter((row: any) =>
      rowMatchesAttributeFilter(row, filter?.includeByColumn)
    );

    const map = new Map<string, { sum: number; count: number }>();
    for (const row of filtered) {
      const country = getValueByPath(row, countryColumn);
      if (country == null) continue;
      const key = String(country);
      const yRaw = getValueByPath(row, yColumn);
      const yVal = agg === "count" ? 1 : Number(yRaw);
      if (Number.isNaN(yVal) && agg !== "count") continue;
      const existing = map.get(key) ?? { sum: 0, count: 0 };
      existing.sum += yVal;
      existing.count += 1;
      map.set(key, existing);
    }

    const result: BubbleData[] = [];
    for (const [country, { sum, count }] of map.entries()) {
      const coords = COUNTRY_COORDS[country];
      if (!coords) continue;
      let value: number;
      if (agg === "avg") value = count > 0 ? sum / count : 0;
      else if (agg === "count") value = count;
      else value = sum;
      result.push({ country, coords, projected: projectCoordinates(coords), value });
    }

    return result;
  }, [crossFilteredData, countryColumn, yColumn, agg, filter]);

  // Compute bubble scale
  const { maxValue, scale } = React.useMemo(() => {
    const maxVal = Math.max(...bubbleData.map((d) => d.value), 1);
    // Scale: min radius 6, max radius 35
    const scaleFn = (v: number) => 6 + (v / maxVal) * 29;
    return { maxValue: maxVal, scale: scaleFn };
  }, [bubbleData]);

  // Highlighting: which countries match the current selection
  const highlightedCountries = React.useMemo(() => {
    if (!hasSelection) return null;
    const keys = new Set<string>();
    const filtered = rawData.filter((row: any) =>
      rowMatchesAttributeFilter(row, filter?.includeByColumn)
    );
    for (const row of filtered) {
      // Check if row matches current selection
      const matchesDiscrete =
        !selection || Object.keys(selection).length === 0 ||
        Object.entries(selection).every(([col, values]: any) => {
          if (!values || values.size === 0) return true;
          const val = getValueByPath(row, col);
          return values.has(val);
        });

      let matchesRange = true;
      if (rangeFilter) {
        const xVal = Number(getValueByPath(row, rangeFilter.xColumn));
        const yVal = Number(getValueByPath(row, rangeFilter.yColumn));
        matchesRange =
          !Number.isNaN(xVal) &&
          !Number.isNaN(yVal) &&
          xVal >= rangeFilter.xMin &&
          xVal <= rangeFilter.xMax &&
          yVal >= rangeFilter.yMin &&
          yVal <= rangeFilter.yMax;
      }

      let matchesLasso = true;
      if (lassoFilter) {
        const xVal = Number(getValueByPath(row, lassoFilter.xColumn));
        const yVal = Number(getValueByPath(row, lassoFilter.yColumn));
        if (Number.isNaN(xVal) || Number.isNaN(yVal)) {
          matchesLasso = false;
        } else {
          // Point-in-polygon (ray-casting)
          let inside = false;
          const poly = lassoFilter.polygon;
          for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y;
            const xj = poly[j].x, yj = poly[j].y;
            if ((yi > yVal) !== (yj > yVal) && xVal < ((xj - xi) * (yVal - yi)) / (yj - yi) + xi) {
              inside = !inside;
            }
          }
          matchesLasso = inside;
        }
      }

      if (matchesDiscrete && matchesRange && matchesLasso) {
        const country = getValueByPath(row, countryColumn);
        if (country != null) keys.add(String(country));
      }
    }
    return keys;
  }, [rawData, selection, rangeFilter, lassoFilter, hasSelection, countryColumn, filter]);

  // Tooltip state
  const [tooltip, setTooltip] = React.useState<{
    country: string;
    value: number;
    x: number;
    y: number;
  } | null>(null);

  const bubbleColor = "#8da0cb"; // primaryColor
  const fadedColor = "#cbd5e1";
  const gridColor = "#d7dee7";
  const surfaceColor = "#f7f9fc";
  const frameColor = "#e2e8f0";

  if (!bubbleData.length) {
    return (
      <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
        No geographic data available
      </div>
    );
  }

  return (
    <div
      className="h-full w-full relative outline-none"
      style={{ height }}
      onDoubleClick={() => clearSelection()}
      onClick={(e) => e.stopPropagation()}
    >
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="World map bubble chart"
      >
        <rect
          x={MAP_PADDING}
          y={MAP_PADDING}
          width={MAP_WIDTH - MAP_PADDING * 2}
          height={MAP_HEIGHT - MAP_PADDING * 2}
          rx={24}
          fill={surfaceColor}
          stroke={frameColor}
        />

        {[-60, -30, 0, 30, 60].map((latitude) => {
          const [, y] = projectCoordinates([0, latitude]);
          return (
            <line
              key={`lat-${latitude}`}
              x1={MAP_PADDING}
              x2={MAP_WIDTH - MAP_PADDING}
              y1={y}
              y2={y}
              stroke={gridColor}
              strokeDasharray="4 6"
            />
          );
        })}

        {[-120, -60, 0, 60, 120].map((longitude) => {
          const [x] = projectCoordinates([longitude, 0]);
          return (
            <line
              key={`lon-${longitude}`}
              x1={x}
              x2={x}
              y1={MAP_PADDING}
              y2={MAP_HEIGHT - MAP_PADDING}
              stroke={gridColor}
              strokeDasharray="4 6"
            />
          );
        })}

        <text x={MAP_PADDING + 10} y={MAP_PADDING + 20} fontSize="13" fill="#64748b">
          Lat/Lon reference grid
        </text>

        {bubbleData.map((d) => {
          const isHighlighted = !highlightedCountries || highlightedCountries.has(d.country);
          const r = scale(d.value);
          return (
            <g
              key={d.country}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                if (e.ctrlKey || e.metaKey) {
                  addToSelection(countryColumn, d.country);
                } else {
                  replaceSelection(countryColumn, d.country);
                }
              }}
              onMouseEnter={(e: React.MouseEvent) => {
                setTooltip({
                  country: d.country,
                  value: d.value,
                  x: e.clientX,
                  y: e.clientY,
                });
              }}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={d.projected[0]}
                cy={d.projected[1]}
                r={r}
                fill={isHighlighted ? bubbleColor : fadedColor}
                fillOpacity={isHighlighted ? 0.7 : 0.25}
                stroke={isHighlighted ? bubbleColor : fadedColor}
                strokeWidth={1}
                strokeOpacity={0.8}
              />
              {r > 12 && (
                <text
                  x={d.projected[0]}
                  y={d.projected[1]}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{
                    fontSize: Math.min(r * 0.6, 11),
                    fill: "#fff",
                    fontWeight: 600,
                    pointerEvents: "none",
                  }}
                >
                  {formatCompactNumber(d.value)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <div className="font-medium">{tooltip.country}</div>
          <div className="text-muted-foreground">
            {view.yLabel ?? view.yColumn}: {formatCompactNumber(tooltip.value)}
          </div>
        </div>
      )}
    </div>
  );
}
