import { View } from "@/types/dashboard";
import { Card, CardHeader, CardTitle, CardDescription } from "../ui/card";
import ChartRenderer from "./ChartRenderer";

const SIZE_CLASS: Record<View["size"], string> = {
  lg: "basis-[99%]",
  md: "basis-[49%]",
  sm: "basis-[30%]",
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
      key={view.id}
      onMouseMove={onMouseMove}
      className={`
          ${SIZE_CLASS[view.size]}
          transition-all
          hover:ring-1 hover:ring-ring
        `}
    >
      <CardHeader>
        <CardTitle className="text-sm">
          {view.chartType.toUpperCase()}
        </CardTitle>
        <CardDescription className="text-xs">
          X: {view.x}, Y: {view.y}
        </CardDescription>
        <ChartRenderer />
      </CardHeader>
    </Card>
  );
}
