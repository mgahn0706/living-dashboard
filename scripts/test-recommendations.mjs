/**
 * Test script: generates initial views then runs 10 questions through the
 * full recommendation pipeline (viewRelevance → makePrompt → /api/recommend).
 *
 * Usage: node scripts/test-recommendations.mjs
 */

const BASE = "http://localhost:3099";

// ── Revenue.csv schema ──────────────────────────────────────────────
const attributeKeys = [
  "Stage", "Segment", "Experience Level", "Product Tier", "CampaignType",
  "Industry", "Market Maturity", "Territory", "Country", "State Province",
  "Created Date", "CloseDate", "Status", "Units", "Revenue", "ClosePct",
  "Product Name", "Product Category", "List Price",
];

const attributeTypes = {
  Stage: "categorical",
  Segment: "categorical",
  "Experience Level": "categorical",
  "Product Tier": "categorical",
  CampaignType: "categorical",
  Industry: "categorical",
  "Market Maturity": "categorical",
  Territory: "categorical",
  Country: "categorical",
  "State Province": "categorical",
  "Created Date": "date",
  CloseDate: "date",
  Status: "categorical",
  Units: "numeric",
  Revenue: "numeric",
  ClosePct: "numeric",
  "Product Name": "categorical",
  "Product Category": "categorical",
  "List Price": "numeric",
};

const dataSchema = attributeKeys.map((name) => ({
  name,
  type: attributeTypes[name],
}));

// ── Questions ──────────────────────────────────────────────────────
const questions = [
  "How much revenue is won by the Devices category?",
  "List the revenue generated for each product category?",
  "How many units were lost in the negotiation stage?",
  "Which regions have the most mature markets?",
  "Which campaign led to the most wins for the Manufacturing domain?",
  "Which campaign was the first one to start in July 2025?",
  "What was the revenue goal at the Proposal stage in the North America territory?",
  "What are the subcategories in the Service category?",
  "Which two industries lead to the most revenue won in Germany and Denmark?",
  "In which time period did Australia's performance peak?",
];

// ── Helpers ──────────────────────────────────────────────────────────

// Import viewRelevance scoring (we replicate the logic inline since this
// is an mjs script outside Next.js runtime)

function getBoundColumns(view) {
  const cols = [];
  if (view.chartType === "TABLE") {
    if (view.columns) cols.push(...view.columns);
  } else {
    if (view.xColumn) cols.push(view.xColumn);
    if (view.yColumn) cols.push(view.yColumn);
    if (view.groupByColumn) cols.push(view.groupByColumn);
    if (view.colorByColumn) cols.push(view.colorByColumn);
    if (view.x2Column) cols.push(view.x2Column);
  }
  return [...new Set(cols.filter(Boolean))];
}

function extractQueryTokens(query) {
  const stopWords = new Set([
    "the","a","an","is","are","was","were","be","been","being",
    "have","has","had","do","does","did","will","would","could",
    "should","may","might","shall","can","need","must",
    "i","me","my","we","our","you","your","he","she","it",
    "they","them","their","this","that","these","those",
    "what","which","who","whom","where","when","how","why",
    "and","or","but","if","then","than","so","because",
    "in","on","at","to","for","of","with","by","from","up",
    "about","into","through","during","before","after","between",
    "show","display","see","look","tell","give","find","get",
    "want","like","please","just","also","more","most","very",
    "much","many","some","any","all","each","every","both",
    "not","no","nor","only","own","same","too",
  ]);
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w));
}

function tokenMatchScore(token, target) {
  const t = token.toLowerCase();
  const tgt = target.toLowerCase().replace(/[_\s]+/g, " ");
  if (t === tgt) return 1.0;
  if (tgt.includes(t) || t.includes(tgt)) return 0.8;
  const targetWords = tgt.split(/[\s_]+/);
  for (const tw of targetWords) {
    if (tw === t) return 0.9;
    if (tw.includes(t) || t.includes(tw)) return 0.6;
  }
  return 0;
}

function scoreView(view, queryTokens) {
  if (queryTokens.length === 0) return 0;
  const boundCols = getBoundColumns(view);
  const title = view.title || "";
  let totalScore = 0;
  let matchedTokens = 0;
  for (const token of queryTokens) {
    let bestMatch = 0;
    for (const col of boundCols) {
      bestMatch = Math.max(bestMatch, tokenMatchScore(token, col));
    }
    bestMatch = Math.max(bestMatch, tokenMatchScore(token, title) * 0.7);
    if (view.chartType) {
      bestMatch = Math.max(bestMatch, tokenMatchScore(token, view.chartType) * 0.3);
    }
    if (bestMatch > 0) { matchedTokens++; totalScore += bestMatch; }
  }
  return queryTokens.length > 0
    ? (totalScore / queryTokens.length) * (matchedTokens / queryTokens.length)
    : 0;
}

function scoreViewRelevance(views, userQuery) {
  const queryTokens = extractQueryTokens(userQuery);
  const schemaCols = attributeKeys;
  let drillDownViewId = null;
  for (const view of views) {
    if (view.chartType === "HORIZONTAL_BAR" && view.groupByColumn) {
      drillDownViewId = view.id;
      break;
    }
  }
  const entries = views.map((view) => {
    const relevanceScore = Math.round(scoreView(view, queryTokens) * 100) / 100;
    return {
      viewId: view.id,
      relevanceScore,
      isCandidate: relevanceScore >= 0.1,
      filterEligibleColumns: [...new Set([...getBoundColumns(view), ...schemaCols])],
    };
  });
  const hasCandidates = entries.some((e) => e.isCandidate);
  if (!hasCandidates && queryTokens.length > 0) {
    const sorted = [...entries].sort((a, b) => b.relevanceScore - a.relevanceScore);
    for (let i = 0; i < Math.min(2, sorted.length); i++) {
      const entry = entries.find((e) => e.viewId === sorted[i].viewId);
      if (entry) entry.isCandidate = true;
    }
  }
  return { entries, drillDownViewId };
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  // Step 1: Generate initial views
  console.log("=== GENERATING INITIAL VIEWS ===\n");
  const buildRes = await fetch(`${BASE}/api/initial-build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attributeKeys, attributeTypes, dataSchema }),
  });
  const views = await buildRes.json();
  console.log(`Generated ${views.length} views:`);
  for (const v of views) {
    const cols = getBoundColumns(v);
    console.log(`  - ${v.id} (${v.chartType}): "${v.title}" [${cols.join(", ")}]`);
  }
  console.log();

  // Step 2: Run each question
  const results = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`\n=== Q${i + 1}: ${q} ===\n`);

    // Compute relevance
    const relevance = scoreViewRelevance(views, q);
    const candidates = relevance.entries.filter((e) => e.isCandidate);
    console.log(`Candidates: ${candidates.map((c) => `${c.viewId}(${c.relevanceScore})`).join(", ")}`);
    console.log(`Drill-down view: ${relevance.drillDownViewId || "none"}`);

    // Build prompt (replicate makePrompt inline)
    const candidateViews = views.filter((v) =>
      relevance.entries.find((e) => e.viewId === v.id)?.isCandidate
    );
    const contextViews = views.filter(
      (v) => !relevance.entries.find((e) => e.viewId === v.id)?.isCandidate
    );
    const candidateAnnotations = relevance.entries
      .filter((e) => e.isCandidate)
      .map(
        (e) =>
          `  - View "${e.viewId}": relevance=${e.relevanceScore}, filterEligible=[${e.filterEligibleColumns.join(", ")}]`
      )
      .join("\n");

    const drillDownView = relevance.drillDownViewId
      ? views.find((v) => v.id === relevance.drillDownViewId)
      : null;
    const drillDownInfo = drillDownView
      ? `View "${drillDownView.id}" (title: "${drillDownView.title}") is a HORIZONTAL_BAR with groupByColumn="${drillDownView.groupByColumn}".`
      : "No drill-down-capable view exists.";

    // Build prompt content (abbreviated — the actual makePrompt is used server-side,
    // but we need to pass the prompt object to /api/recommend)
    // We'll construct the prompt similarly to makePrompt.ts
    const focusScore = {};
    for (const v of views) focusScore[v.id] = 0.5;

    const promptContent = buildPromptContent({
      views,
      candidateViews,
      contextViews,
      candidateAnnotations,
      drillDownInfo,
      focusScore,
      dataSchema,
      question: q,
    });

    const prompt = { role: "system", content: promptContent };

    // Call /api/recommend
    const recRes = await fetch(`${BASE}/api/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, views }),
    });

    const fullText = await recRes.text();

    let parsed;
    try {
      parsed = JSON.parse(fullText.trim());
    } catch {
      console.error("Invalid JSON response:", fullText.slice(0, 200));
      results.push({ question: q, error: "Invalid JSON", reasoning: null, reply: "", recommendations: [] });
      continue;
    }

    const reasoning = parsed.reasoning || null;
    const reply = parsed.reply || "";
    const recommendations = parsed.recommendations || [];

    console.log("Reasoning:", JSON.stringify(reasoning, null, 2));
    console.log("Reply:", reply);
    console.log("Recommendations:");
    for (const r of recommendations) {
      console.log(`  [${r.type}] ${r.title} → target: ${r.targetViewId || "new"}`);
    }

    results.push({ question: q, reasoning, reply, recommendations });
  }

  // Step 3: Print summary table
  console.log("\n\n========================================");
  console.log("SUMMARY TABLE");
  console.log("========================================\n");

  console.log(
    padRight("Q#", 4) +
      padRight("Question", 65) +
      padRight("Action Type", 20) +
      padRight("Targets Existing?", 18) +
      "Details"
  );
  console.log("-".repeat(160));

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const types = r.recommendations.map((rec) => rec.type);
    const hasNew = types.includes("NEW_CONTENT");
    const hasFilter = types.includes("MODIFY_FILTER");
    const hasDrillDown = types.includes("DRILL_DOWN");
    const hasClick = types.includes("CLICK");
    const hasModify = types.includes("MODIFY_CONTENT");

    let actionSummary = "NO_CHANGE";
    if (r.error) actionSummary = "ERROR";
    else if (types.length > 0) actionSummary = [...new Set(types)].join(", ");

    const targetsExisting = r.recommendations.some((rec) => rec.targetViewId) ? "Yes" : (hasNew ? "New visual" : "N/A");

    const details = r.recommendations.length > 0
      ? r.recommendations.map((rec) => `${rec.type}: ${rec.title}`).join(" | ")
      : (r.reply || "No recommendations");

    console.log(
      padRight(`${i + 1}`, 4) +
        padRight(r.question.slice(0, 63), 65) +
        padRight(actionSummary, 20) +
        padRight(targetsExisting, 18) +
        details.slice(0, 120)
    );
  }

  // Step 4: Detailed JSON output
  console.log("\n\n========================================");
  console.log("DETAILED RESULTS (JSON)");
  console.log("========================================\n");
  console.log(JSON.stringify(results, null, 2));
}

function padRight(str, len) {
  return String(str).padEnd(len);
}

function buildPromptContent({ views, candidateViews, contextViews, candidateAnnotations, drillDownInfo, focusScore, dataSchema, question }) {
  return `
You are an AI agent that generates adaptive dashboard recommendations
for a collaborative data analysis environment called Living Dashboard.

Your task is to output dashboard adaptation commands based on:
- current dashboard layout
- user focus signals
- conversation context
- dataset schema
- pre-computed view relevance scores

SYSTEM GOAL: Improve analytical efficiency by recommending view adaptations.
IMPORTANT: You guide the user to find answers through dashboard interactions.
You do NOT answer analytical questions directly.

OUTPUT CONTRACT (STRICT):
Return ONLY a JSON object:
{
  "reasoning": {
    "userNeed": string,
    "relevantViews": string[],
    "currentGap": string
  },
  "reply": string,
  "recommendations": Recommendation[]
}

REASONING BLOCK (required):
- "userNeed": What the user wants to see or understand.
- "relevantViews": Array of view IDs relevant to answering the question. ONLY from CANDIDATE VIEWS.
- "currentGap": What is currently missing from the dashboard.

Each recommendation:
{
  "id": string,
  "title": string,
  "type": "REORDER" | "RESIZE" | "NEW_CONTENT" | "MODIFY_CONTENT" | "MODIFY_FILTER" | "REMOVE_CONTENT" | "DRILL_DOWN" | "CLICK",
  "targetViewId"?: string,
  "payload": Partial<View>,
  "reason": string
}

Rules:
- DO NOT include text outside JSON
- "reply" must be a short assistant-style response
- Valid filter shapes: { "top": number }, { "includeXValues": [...] }, { "includeColumns": [...] }, { "includeByColumn": [{ "column": string, "includeValues": [...] }] }
- NEVER output empty arrays for filter lists
- Filter values MUST match existing values in the dataset
- Valid chartType: "BAR", "LINE", "SCATTER", "PIE", "TABLE", "MAP", "STACKED_BAR", "GROUPED_BAR", "HORIZONTAL_BAR", "DONUT", "FUNNEL", "KPI", "RANGE_BAR"
- For DRILL_DOWN: targetViewId must be the drill-down view, payload should include "drillTarget"
- For CLICK: targetViewId is the view to click on, payload should include "clickTarget"
- Prefer DRILL_DOWN and CLICK over MODIFY_FILTER when more direct

CANDIDATE VS CONTEXT VIEWS:
CANDIDATE VIEWS are pre-scored as relevant. Target recommendations here.
CONTEXT VIEWS have low relevance. Do NOT target unless strongly justified.

VIEW RELEVANCE ANNOTATIONS:
${candidateAnnotations}

MODIFY_FILTER ELIGIBILITY:
Only emit MODIFY_FILTER if the filter column appears in the view's filterEligible list.

CHART TYPE REFERENCE:
- BAR: xColumn=categories, yColumn=measure
- LINE: xColumn=date, yColumn=measure
- SCATTER: two numeric axes, optional colorByColumn
- PIE/DONUT: xColumn=categories, yColumn=measure
- TABLE: columns array
- MAP: xColumn=country, yColumn=measure
- STACKED_BAR/GROUPED_BAR: xColumn=categories, yColumn=measure, groupByColumn=splitter
- HORIZONTAL_BAR: horizontal bars, groupByColumn for drill-down
- FUNNEL: xColumn=stage, yColumn=measure
- KPI: yColumn=measure, aggregation
- RANGE_BAR: xColumn=start date, x2Column=end date, yColumn=category

DRILL-DOWN CAPABILITY:
${drillDownInfo}

CLICK INTERACTIONS:
All charts support click cross-filtering. Recommend CLICK when a specific data point click would answer the question.

DATA SCHEMA:
${JSON.stringify(dataSchema, null, 2)}

CANDIDATE VIEWS (target recommendations here):
${JSON.stringify(candidateViews, null, 2)}

CONTEXT VIEWS (for awareness only):
${contextViews.length > 0 ? JSON.stringify(contextViews, null, 2) : "None"}

CURRENT FOCUS SCORE:
${JSON.stringify(focusScore, null, 2)}

TEXT CHAT:
- ${question}

RECENT REQUEST SUMMARY:
${question}

Return ONLY valid JSON with "reasoning", "reply", and "recommendations".
No explanation. No markdown. No additional text.
`.trim();
}

main().catch(console.error);
