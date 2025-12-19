"use client";

import { ChartAreaInteractive } from "@/components/charts/chart-area-interactive";
import { ChartPieInteractive } from "@/components/charts/chart-pie-interactive";
import { ChartBarInteractive } from "@/components/charts/chart-bar-interactive";
import { SectionCards } from "@/components/charts/section-cards";

// The definition of a Widget in your system
export type WidgetConfig = {
  id: string;
  component: React.ComponentType<any>;
  title: string;
  dataKey: string; // Key to find data in your main data object
};

// 1. THE POOL: All available charts defined here
export const WIDGET_REGISTRY: Record<string, WidgetConfig> = {
  "overview-cards": {
    id: "overview-cards",
    component: SectionCards,
    title: "Key Metrics",
    dataKey: "cards",
  },
  "revenue-area": {
    id: "revenue-area",
    component: ChartAreaInteractive,
    title: "Revenue Trends",
    dataKey: "revenue",
  },
  "traffic-bar": {
    id: "traffic-bar",
    component: ChartBarInteractive,
    title: "Traffic Sources",
    dataKey: "traffic",
  },
  "device-pie": {
    id: "device-pie",
    component: ChartPieInteractive,
    title: "Device Usage",
    dataKey: "devices",
  },
  // User can "add" more here later, and they just enter the pool
};
