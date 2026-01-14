import { NextResponse } from "next/server";

/* ===================== Types ===================== */

type VoiceUtterance = {
  id: string;
  text: string;
  timestamp: number;
  lang: string;
};

type View = {
  id: string;
  chartType: "LINE" | "BAR" | "TABLE";
  size: "lg" | "md" | "sm";
  priority: number;
  x: any;
  y: any;
};

type Recommendation = {
  id: string;
  title: string;
  type:
    | "REORDER"
    | "RESIZE"
    | "NEW_CONTENT"
    | "MODIFY_CONTENT"
    | "REMOVE_CONTENT";
  payload: Partial<View> & { id?: string };
  reason: string;
};

/* ===================== Utils ===================== */

function pickViewId(views: View[], preference: Array<View["chartType"]>) {
  for (const t of preference) {
    const found = views.find((v) => v.chartType === t);
    if (found) return found.id;
  }
  return views[0]?.id;
}

/* ===================== API ===================== */

export async function POST(req: Request) {
  const body = await req.json();

  const conversation: VoiceUtterance[] = body.conversation ?? [];
  const views: View[] = body.views ?? [];

  const recentFive = [...conversation]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  const textBlob = recentFive.map((u) => u.text.toLowerCase()).join(" ");

  const recommendations: Recommendation[] = [];

  /* ===================== MODIFY: LINE ===================== */

  if (textBlob.includes("line")) {
    const targetId = pickViewId(views, ["LINE", "BAR", "TABLE"]);
    if (targetId) {
      recommendations.push({
        id: `r_line_${targetId}`, // ✅ stable
        title: "Switch to line chart",
        type: "MODIFY_CONTENT",
        payload: { id: targetId, chartType: "LINE" },
        reason: "Users mentioned trends or changes over time",
      });
    }
  }

  /* ===================== MODIFY: BAR ===================== */

  if (textBlob.includes("bar") || textBlob.includes("compare")) {
    const targetId = pickViewId(views, ["BAR", "LINE", "TABLE"]);
    if (targetId) {
      recommendations.push({
        id: `r_bar_${targetId}`, // ✅ stable
        title: "Switch to bar chart",
        type: "MODIFY_CONTENT",
        payload: { id: targetId, chartType: "BAR" },
        reason: "Conversation suggests comparing values",
      });
    }
  }

  /* ===================== RESIZE ===================== */

  if (
    textBlob.includes("focus") ||
    textBlob.includes("important") ||
    textBlob.includes("look at this")
  ) {
    const target = [...views].sort((a, b) => a.priority - b.priority)[0];

    if (target) {
      recommendations.push({
        id: `r_resize_lg_${target.id}`, // ✅ stable
        title: "Emphasize this view",
        type: "RESIZE",
        payload: { id: target.id, size: "lg" },
        reason: "Users are focusing on this metric",
      });
    }
  }

  /* ===================== REORDER ===================== */

  if (
    textBlob.includes("first") ||
    textBlob.includes("start with") ||
    textBlob.includes("main")
  ) {
    const targetId = pickViewId(views, ["LINE", "BAR", "TABLE"]);
    if (targetId) {
      recommendations.push({
        id: `r_reorder_top_${targetId}`, // ✅ stable
        title: "Move view to top",
        type: "REORDER",
        payload: { id: targetId, priority: 0 },
        reason: "Conversation implies this view should be primary",
      });
    }
  }

  /* ===================== NEW CONTENT (STABLE!) ===================== */

  if (
    textBlob.includes("why") ||
    textBlob.includes("reason") ||
    textBlob.includes("explain")
  ) {
    const EXISTS = views.some((v) => v.id === "v_breakdown");

    if (!EXISTS) {
      recommendations.push({
        id: "r_new_breakdown", // ✅ single semantic id
        title: "Add breakdown view",
        type: "NEW_CONTENT",
        payload: {
          id: "v_breakdown", // ✅ stable view id
          chartType: "BAR",
          x: [0, 1, 2, 3],
          y: [40, 25, 20, 15],
          size: "md",
          priority: views.length + 1,
        },
        reason: "Users are asking for explanations or causes",
      });
    }
  }

  /* ===================== REMOVE ===================== */

  if (
    textBlob.includes("ignore") ||
    textBlob.includes("not relevant") ||
    textBlob.includes("doesn't matter")
  ) {
    const target = [...views].sort((a, b) => b.priority - a.priority)[0];

    if (target) {
      recommendations.push({
        id: `r_remove_${target.id}`, // ✅ stable
        title: "Remove the least relevant view",
        type: "REMOVE_CONTENT",
        payload: { id: target.id },
        reason: "Conversation suggests this view is no longer useful",
      });
    }
  }

  return NextResponse.json(recommendations);
}
