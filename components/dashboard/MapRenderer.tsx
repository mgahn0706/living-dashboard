"use client";

import React from "react";
import { ChartView } from "@/types/dashboard";
import { useDataset } from "@/context/DatasetContext";
import { useSelection } from "@/context/SelectionContext";
import { useTimeFilter } from "@/context/TimeFilterContext";
import { useCategoryFilter } from "@/context/CategoryFilterContext";
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

/* =======================================================
   Simplified world land outlines (lon, lat)
======================================================= */

const WORLD_LAND: Array<Array<[number, number]>> = [
  // North America
  [
    [-170, 66], [-168, 72], [-140, 70], [-120, 74], [-95, 73], [-80, 76],
    [-65, 73], [-58, 52], [-55, 47], [-60, 46], [-67, 44], [-70, 42],
    [-75, 36], [-81, 25], [-83, 10], [-84, 9], [-88, 14], [-92, 15],
    [-97, 18], [-105, 20], [-110, 24], [-117, 32], [-122, 37], [-125, 49],
    [-130, 55], [-137, 59], [-145, 60], [-155, 60], [-165, 63], [-170, 66],
  ],
  // South America
  [
    [-80, 10], [-77, 8], [-72, 12], [-62, 11], [-60, 8], [-52, 3],
    [-48, 0], [-35, -5], [-38, -13], [-39, -17], [-43, -23], [-50, -28],
    [-54, -34], [-58, -38], [-65, -42], [-72, -48], [-74, -52], [-68, -55],
    [-64, -55], [-60, -52], [-55, -35], [-53, -33], [-50, -22], [-48, -15],
    [-50, -5], [-52, 2], [-60, 5], [-68, 10], [-72, 12], [-75, 11],
    [-80, 10],
  ],
  // Europe
  [
    [-10, 36], [-10, 43], [-5, 48], [0, 49], [2, 51], [5, 54], [8, 55],
    [12, 56], [14, 55], [20, 55], [24, 58], [28, 60], [30, 65], [28, 71],
    [20, 71], [15, 67], [10, 64], [5, 62], [0, 58], [-5, 58], [-10, 52],
    [-10, 36],
  ],
  // Africa
  [
    [-17, 15], [-17, 21], [-13, 28], [-5, 36], [0, 36], [10, 37],
    [12, 33], [25, 32], [33, 30], [36, 22], [43, 12], [51, 12],
    [42, 2], [42, -2], [40, -10], [36, -20], [33, -26], [28, -33],
    [18, -35], [15, -28], [12, -18], [12, -6], [10, 0], [9, 5],
    [3, 6], [-3, 5], [-8, 5], [-12, 7], [-15, 11], [-17, 15],
  ],
  // Asia (main body)
  [
    [28, 42], [35, 37], [36, 34], [40, 38], [50, 38], [55, 42],
    [63, 40], [68, 38], [72, 20], [75, 15], [80, 10], [78, 7],
    [80, 8], [85, 15], [88, 22], [92, 22], [97, 16], [100, 14],
    [103, 2], [105, 5], [108, 14], [110, 20], [115, 23], [120, 23],
    [122, 30], [125, 34], [129, 36], [132, 42], [140, 44], [143, 50],
    [137, 55], [120, 55], [100, 53], [90, 50], [80, 52], [70, 55],
    [60, 55], [50, 52], [43, 47], [40, 44], [28, 42],
  ],
  // Northern Asia (Siberia)
  [
    [28, 55], [40, 58], [55, 55], [70, 56], [80, 54], [90, 52],
    [100, 54], [115, 55], [125, 58], [135, 60], [145, 60], [160, 64],
    [170, 66], [180, 67], [180, 72], [170, 72], [145, 70], [120, 73],
    [100, 72], [80, 72], [60, 70], [40, 68], [30, 65], [28, 60],
    [28, 55],
  ],
  // Australia
  [
    [115, -15], [120, -14], [130, -12], [137, -12], [142, -11],
    [146, -15], [150, -22], [153, -28], [150, -35], [146, -38],
    [138, -36], [130, -32], [125, -35], [115, -34], [113, -26],
    [114, -22], [115, -15],
  ],
  // Greenland
  [
    [-50, 60], [-55, 65], [-53, 70], [-45, 74], [-35, 76], [-22, 76],
    [-18, 72], [-25, 68], [-35, 65], [-45, 62], [-50, 60],
  ],
  // UK / Ireland (simplified)
  [
    [-10, 50], [-6, 54], [-5, 58], [-3, 58], [-2, 56], [0, 52],
    [2, 52], [2, 51], [-1, 50], [-5, 50], [-10, 50],
  ],
  // Japan (simplified)
  [
    [130, 31], [132, 34], [136, 35], [140, 38], [140, 42], [142, 44],
    [145, 44], [145, 42], [141, 39], [140, 36], [136, 34], [132, 33],
    [130, 31],
  ],
  // New Zealand (simplified)
  [
    [166, -45], [168, -44], [172, -41], [178, -37], [177, -38],
    [175, -41], [170, -46], [166, -45],
  ],
  // Indonesia / SE Asia (simplified)
  [
    [96, 6], [100, 3], [104, -3], [106, -6], [110, -7], [115, -8],
    [120, -8], [125, -8], [128, -5], [130, -3], [133, -3], [136, -2],
    [136, -5], [130, -8], [125, -10], [120, -10], [115, -10], [110, -8],
    [104, -6], [100, 0], [96, 6],
  ],
  // Madagascar
  [
    [44, -12], [50, -15], [50, -23], [47, -25], [44, -24], [43, -18],
    [44, -12],
  ],
];

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

function landPolygonToPath(coords: Array<[number, number]>): string {
  return (
    coords
      .map((c, i) => {
        const [x, y] = projectCoordinates(c);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ") + " Z"
  );
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
  const { categoryFilters } = useCategoryFilter();

  return React.useMemo(() => {
    if (!Array.isArray(rawData)) return [];
    let data = rawData;

    // Apply time filter
    if (timeFilter) {
      const { column, min, max } = timeFilter;
      data = data.filter((row: any) => {
        const val = getValueByPath(row, column);
        if (val == null || val === "") return false;
        const ts = Date.parse(String(val));
        if (Number.isNaN(ts)) return false;
        return ts >= min && ts <= max;
      });
    }

    // Apply category filters (e.g. Status = Won / Lost)
    for (const cf of categoryFilters) {
      if (cf.selectedValues.size === 0) continue;
      data = data.filter((row: any) => {
        const val = getValueByPath(row, cf.column);
        if (val == null) return false;
        return cf.selectedValues.has(String(val));
      });
    }

    return data;
  }, [rawData, timeFilter, categoryFilters]);
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
  const { scale } = React.useMemo(() => {
    const maxVal = Math.max(...bubbleData.map((d) => d.value), 1);
    // Scale: min radius 6, max radius 35
    const scaleFn = (v: number) => 6 + (v / maxVal) * 29;
    return { scale: scaleFn };
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
  const surfaceColor = "#dce8f0";
  const frameColor = "#e2e8f0";
  const landColor = "#f0f0ec";
  const coastColor = "#c8d0d7";

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

        {/* Clip land polygons to the map area */}
        <defs>
          <clipPath id={`map-clip-${view.id}`}>
            <rect
              x={MAP_PADDING}
              y={MAP_PADDING}
              width={MAP_WIDTH - MAP_PADDING * 2}
              height={MAP_HEIGHT - MAP_PADDING * 2}
              rx={24}
            />
          </clipPath>
        </defs>

        {/* Land masses */}
        <g clipPath={`url(#map-clip-${view.id})`}>
          {WORLD_LAND.map((coords, i) => (
            <path
              key={i}
              d={landPolygonToPath(coords)}
              fill={landColor}
              stroke={coastColor}
              strokeWidth={0.5}
              strokeLinejoin="round"
            />
          ))}
        </g>

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
