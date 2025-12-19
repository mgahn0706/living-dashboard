"use client";

import React from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { PlusCircle, LayoutDashboard } from "lucide-react";

import { ChartSeries, ChartType } from "@/types/types";
import dashboardData from "./data.json";
import {
  InteractionProvider,
  useInteraction,
} from "@/context/InteractionContext";
import { DashboardEngine } from "@/components/DashboardEngine";

// --- Data Setup ---
const chartTypes: ChartType[] = ["area", "bar", "line"];
const initialData: ChartSeries[] = (dashboardData as any[]).map((d, i) => ({
  ...d,
  color: d.color || "hsl(var(--primary))",
  chartType: chartTypes[i % chartTypes.length],
}));

// const DashboardToolbar = () => {
//   const { addChartToPool } = useInteraction();

//   const handleAdd = () => {
//     const newId = `live-${Date.now()}`;
//     const randomType =
//       chartTypes[Math.floor(Math.random() * chartTypes.length)];
//     addChartToPool({
//       id: newId,
//       title: `Metric ${randomType.toUpperCase()}`,
//       color: "#3b82f6",
//       chartType: randomType,
//       data: Array.from({ length: 7 }, (_, i) => ({
//         name: `T-${i}`,
//         value: Math.floor(Math.random() * 100),
//       })),
//     });
//   };

//   return (
//     <div className="flex items-center justify-between px-6 py-4 border-b bg-background/50 backdrop-blur-md sticky top-0 z-10">
//       <div className="flex items-center gap-3">
//         <div className="p-2 bg-primary/10 rounded-lg">
//           <LayoutDashboard className="h-5 w-5 text-primary" />
//         </div>
//         <div>
//           <h1 className="text-sm font-semibold text-foreground">Overview</h1>
//           <p className="text-xs text-muted-foreground">
//             Real-time performance metrics
//           </p>
//         </div>
//       </div>

//       <div className="flex items-center gap-2">
//         <Button
//           variant="default"
//           size="sm"
//           onClick={handleAdd}
//           className="h-8 gap-2 rounded-full px-4 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
//         >
//           <PlusCircle className="h-3.5 w-3.5" />
//           Add Widget
//         </Button>
//       </div>
//     </div>
//   );
// };

export default function Page() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "280px", // Slimmer sidebar
          "--header-height": "4rem",
        } as React.CSSProperties
      }
    >
      <InteractionProvider initialCharts={initialData}>
        <SidebarInset className="bg-muted/10">
          {" "}
          {/* Subtle grey background for contrast */}
          <SiteHeader />
          <div className="flex flex-1 flex-col overflow-hidden relative">
            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-[1600px] mx-auto p-6 md:p-8">
                <DashboardEngine />
              </div>
            </div>
          </div>
        </SidebarInset>
        <AppSidebar />
      </InteractionProvider>
    </SidebarProvider>
  );
}
