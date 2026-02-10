import { NextResponse } from "next/server";

/* ===================== Types ===================== */

type View = {
  id: string;
  chartType: "LINE" | "BAR" | "TABLE";
  size: "lg" | "md" | "sm";
  priority: number;
  xColumn: string;
  yColumn: string;
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

/* ===================== Utilities ===================== */

function softIncludes(text: string, keywords: string[]) {
  return keywords.some((k) => text.includes(k));
}

function pickView(
  views: View[],
  preference: View["chartType"][]
): View | undefined {
  for (const t of preference) {
    const found = views.find((v) => v.chartType === t);
    if (found) return found;
  }
  return views[0];
}

/* ===================== LLM-like Intent Parsing ===================== */

function parseIntentFromPrompt(prompt: string) {
  const text = prompt.toLowerCase();

  return {
    wantsToChange: softIncludes(text, [
      "change",
      "different",
      "another",
      "modify",
      "adjust",
    ]),
    wantsTrend: softIncludes(text, [
      "trend",
      "over time",
      "change",
      "evolution",
    ]),
    wantsComparison: softIncludes(text, [
      "compare",
      "difference",
      "vs",
      "distribution",
      "mislead",
    ]),
    wantsExplanation: softIncludes(text, ["why", "reason", "explain", "cause"]),
    wantsFocus: softIncludes(text, ["important", "focus", "key", "main"]),
    wantsCleanup: softIncludes(text, ["ignore", "not relevant", "remove"]),
  };
}

/* ===================== LLM-like Reasoning Engine ===================== */

function inferRecommendations({
  views,
  intent,
}: {
  views: View[];
  intent: ReturnType<typeof parseIntentFromPrompt>;
}): Recommendation[] {
  const recs: Recommendation[] = [];

  /* ---------- MODIFY CONTENT ---------- */

  console.log(intent, views);

  if (intent.wantsToChange) {
    const target = views[0];
    const alternativeTypes = ["LINE", "BAR", "TABLE"].filter(
      (t) => t !== target.chartType
    ) as View["chartType"][];

    if (target && alternativeTypes.length > 0) {
      recs.push({
        id: `r_modify_change_${target.id}`,
        title: "Change chart type",
        type: "MODIFY_CONTENT",
        payload: { id: target.id, chartType: alternativeTypes[0] },
        reason:
          "The discussion indicates a desire to change the current visualization, removing potential misleading aspects.",
      });
    }
  }

  if (intent.wantsTrend) {
    const target = pickView(views, ["LINE", "BAR", "TABLE"]);
    if (target && target.chartType !== "LINE") {
      recs.push({
        id: `r_modify_line_${target.id}`,
        title: "Emphasize trends with a line chart",
        type: "MODIFY_CONTENT",
        payload: { id: target.id, chartType: "LINE" },
        reason:
          "The discussion indicates interest in temporal trends or changes.",
      });
    }
  }

  if (intent.wantsComparison) {
    const target = pickView(views, ["BAR", "LINE", "TABLE"]);
    if (target && target.chartType !== "BAR") {
      recs.push({
        id: `r_modify_bar_${target.id}`,
        title: "Use bar chart for comparison",
        type: "MODIFY_CONTENT",
        payload: { id: target.id, chartType: "BAR" },
        reason: "The conversation suggests comparing values across categories.",
      });
    }
  }

  /* ---------- FOCUS / RESIZE ---------- */

  if (intent.wantsFocus) {
    const target = [...views].sort((a, b) => a.priority - b.priority)[0];

    if (target && target.size !== "lg") {
      recs.push({
        id: `r_resize_focus_${target.id}`,
        title: "Highlight a key view",
        type: "RESIZE",
        payload: { id: target.id, size: "lg" },
        reason: "Participants appear to be focusing on a particular metric.",
      });
    }
  }

  /* ---------- NEW CONTENT ---------- */

  if (intent.wantsExplanation) {
    const exists = views.some((v) => v.id === "v_explanation");

    if (!exists) {
      recs.push({
        id: "r_new_explanation",
        title: "Add explanatory breakdown view",
        type: "NEW_CONTENT",
        payload: {
          id: "v_explanation",
          chartType: "BAR",
          xColumn: "Category",
          yColumn: "Frequency",
          size: "md",
          priority: views.length + 1,
        },
        reason: "Users are asking for explanations or underlying causes.",
      });
    }
  }

  /* ---------- REMOVE ---------- */

  if (intent.wantsCleanup && views.length > 1) {
    const target = [...views].sort((a, b) => b.priority - a.priority)[0];

    recs.push({
      id: `r_remove_${target.id}`,
      title: "Remove less relevant view",
      type: "REMOVE_CONTENT",
      payload: { id: target.id },
      reason: "Some views appear to be no longer relevant to the discussion.",
    });
  }

  return recs;
}

/* ===================== API ===================== */

export async function POST(req: Request) {
  const body = await req.json();

  const prompt: string = body?.prompt?.content ?? "";

  const views: View[] = body?.views ?? body?.prompt?.views ?? [];

  /* 1️⃣ Parse intent (LLM-like) */
  const intent = parseIntentFromPrompt(prompt);

  /* 2️⃣ Infer recommendations */
  const recommendations = inferRecommendations({
    views,
    intent,
  });

  /* 3️⃣ Simulate LLM latency */
  await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));

  return NextResponse.json(recommendations);
}
