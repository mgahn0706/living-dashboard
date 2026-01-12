// app/api/recommend/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();

  // ⚠️ 실제로는 focusScore + current views 기반
  return NextResponse.json([
    {
      id: "r1",
      title: "Emphasize sales trend",
      type: "RESIZE",
      payload: { size: "lg" },
      reason: "High focus score on sales view",
    },
    {
      id: "r2",
      title: "Add profit vs sales scatter plot",
      type: "ADD_VIEW",
      payload: {
        id: "v_new",
        x: "sales",
        y: "profit",
        chartType: "scatter",
        size: "md",
        priority: 1,
      },
      reason:
        "Users focusing on sales data might want to see profit correlation",
    },
  ]);
}
