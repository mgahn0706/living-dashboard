import { View } from "@/types/dashboard";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../ui/card";
import ChartRenderer from "./ChartRenderer";

const SIZE_CLASS: Record<View["size"], string> = {
  lg: "basis-[99%]",
  md: "basis-[49%]",
  sm: "basis-[30%]",
};

const CHART_HEIGHT: Record<View["size"], string> = {
  lg: "h-[320px]",
  md: "h-[260px]",
  sm: "h-[200px]",
};

export default function ViewCard({
  view,
  onMouseMove,
}: {
  view: View;
  onMouseMove: () => void;
}) {
  return (
    <Card
      onMouseMove={onMouseMove}
      className={`
        ${SIZE_CLASS[view.size]}
        transition-all
        hover:ring-1 hover:ring-ring
        overflow-hidden
      `}
    >
      {/* ---------- Header (text only) ---------- */}
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">
          {view.chartType.toUpperCase()}
        </CardTitle>
        <CardDescription className="text-xs truncate">
          X: [{view.x.length}] points · Y: [{view.y.length}] points
        </CardDescription>
      </CardHeader>

      {/* ---------- Chart Area (clamped) ---------- */}
      <CardContent
        className={`
          ${CHART_HEIGHT[view.size]}
          overflow-hidden
          p-2
        `}
      >
        <ChartRenderer
          x={view.x}
          y={view.y}
          type={view.chartType}
          height="100%"
        />
      </CardContent>
    </Card>
  );
}
