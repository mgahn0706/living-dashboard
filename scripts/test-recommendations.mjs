/**
 * Test script: generates initial views then runs 10 questions through the
 * full recommendation pipeline and compares against expected behavior.
 *
 * Usage:
 *   1. Start the dev server: pnpm dev
 *   2. Run: node scripts/test-recommendations.mjs
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
  Stage: "string",
  Segment: "string",
  "Experience Level": "string",
  "Product Tier": "string",
  CampaignType: "string",
  Industry: "string",
  "Market Maturity": "string",
  Territory: "string",
  Country: "string",
  "State Province": "string",
  "Created Date": "date",
  CloseDate: "date",
  Status: "string",
  Units: "number",
  Revenue: "number",
  ClosePct: "number",
  "Product Name": "string",
  "Product Category": "string",
  "List Price": "number",
};

// Enriched schema (matches buildEnrichedSchema output)
const enrichedSchema = {};
for (const col of attributeKeys) {
  enrichedSchema[col] = { type: attributeTypes[col] };
}
// Add sample values for categorical columns (representative subset)
const sampleValues = {
  Stage: ["Negotiation", "Qualification", "Proposal", "Closed Won", "Closed Lost", "Prospecting"],
  Segment: ["Enterprise", "Mid-Market", "SMB"],
  "Experience Level": ["Junior", "Mid-Level", "Senior"],
  "Product Tier": ["Basic", "Standard", "Premium"],
  CampaignType: ["Webinar", "Conference", "Email", "Social", "Referral"],
  Industry: ["Healthcare", "Finance", "Manufacturing", "Technology", "Retail"],
  "Market Maturity": ["Emerging", "Growth", "Mature"],
  Territory: ["APAC", "EMEA", "LATAM", "North America"],
  Country: ["United States", "Germany", "Brazil", "Australia", "Japan", "United Kingdom", "India", "Canada", "France", "Denmark"],
  "State Province": ["California", "New York", "Texas", "Victoria", "São Paulo"],
  Status: ["Won", "Lost", "Open"],
  "Product Name": ["Office Suite Basic", "Parental Control Suite", "Travel Adapter Kit", "Network Hub Pro", "Security Camera"],
  "Product Category": ["Software", "Accessories", "Devices", "Services"],
};
for (const [col, vals] of Object.entries(sampleValues)) {
  if (enrichedSchema[col]) enrichedSchema[col].sampleValues = vals;
}

// ── Questions with expected behavior ──────────────────────────────────
const testCases = [
  {
    question: "How much revenue is won by the Devices category?",
    expectedTypes: ["MODIFY_FILTER", "CLICK"],
    expectedBehavior: "Filter or click to show Revenue where Product Category=Devices AND Status=Won",
    mustNotDo: "Should NOT create new view if a view already shows Product Category or Revenue",
  },
  {
    question: "List the revenue generated for each product category?",
    expectedTypes: ["MODIFY_FILTER", "MODIFY_CONTENT", "NEW_CONTENT"],
    expectedBehavior: "Show revenue broken down by Product Category — either filter existing view or create BAR/TABLE with Product Category x Revenue",
    mustNotDo: "Should NOT put a string column as yColumn",
  },
  {
    question: "How many units were lost in the negotiation stage?",
    expectedTypes: ["MODIFY_FILTER", "CLICK", "NEW_CONTENT"],
    expectedBehavior: "Filter to Status=Lost AND Stage=Negotiation, showing Units. Or create KPI with Units, aggregation=sum, filter Status=Lost+Stage=Negotiation",
    mustNotDo: "Should NOT filter unrelated views",
  },
  {
    question: "Which regions have the most mature markets?",
    expectedTypes: ["CLICK"],
    expectedBehavior: "CLICK on 'Mature' bar in the Market Maturity chart. This cross-filters MAP and other views to show only mature market data. User can then hover the MAP.",
    mustNotDo: "Should NOT create a BAR chart with two string columns (Territory, Market Maturity). yColumn must be numeric.",
  },
  {
    question: "Which campaign led to the most wins for the Manufacturing domain?",
    expectedTypes: ["MODIFY_FILTER", "NEW_CONTENT"],
    expectedBehavior: "Filter to Industry=Manufacturing and Status=Won, then show by CampaignType. Or create STACKED_BAR/BAR with CampaignType x Revenue, filter Industry=Manufacturing+Status=Won",
    mustNotDo: "Should NOT use string columns as yColumn",
  },
  {
    question: "Which campaign was the first one to start in July 2025?",
    expectedTypes: ["MODIFY_FILTER", "NEW_CONTENT"],
    expectedBehavior: "This needs a date filter. Filter views to Created Date in July 2025 timeframe, or create a TABLE showing CampaignType + Created Date sorted by date",
    mustNotDo: "Should NOT guess filter values that don't exist in data",
  },
  {
    question: "What was the revenue goal at the Proposal stage in the North America territory?",
    expectedTypes: ["MODIFY_FILTER", "CLICK"],
    expectedBehavior: "Filter to Stage=Proposal AND Territory=North America, showing Revenue. Or CLICK on Proposal in a Stage chart then filter to North America",
    mustNotDo: "Should NOT filter unrelated views",
  },
  {
    question: "What are the subcategories in the Service category?",
    expectedTypes: ["MODIFY_FILTER", "NEW_CONTENT"],
    expectedBehavior: "Filter TABLE to Product Category=Services and show Product Name column. Or create new TABLE with Product Name filtered by Product Category=Services",
    mustNotDo: "Should NOT use non-existent category values",
  },
  {
    question: "Which two industries lead to the most revenue won in Germany and Denmark?",
    expectedTypes: ["MODIFY_FILTER", "NEW_CONTENT"],
    expectedBehavior: "Filter to Country in [Germany, Denmark] AND Status=Won, show by Industry. Or create BAR with Industry x Revenue, filtered to those countries and Won status",
    mustNotDo: "Should NOT filter unrelated views or use string as yColumn",
  },
  {
    question: "In which time period did Australia's performance peak?",
    expectedTypes: ["MODIFY_FILTER", "NEW_CONTENT", "CLICK"],
    expectedBehavior: "Filter to Country=Australia on a LINE chart with CloseDate x Revenue. Or CLICK Australia on MAP. Or create LINE chart filtered to Country=Australia",
    mustNotDo: "Should NOT use string columns as yColumn for LINE chart",
  },
];

// ── Relevance scoring (mirrors viewRelevance.ts) ──────────────────────

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
  return query.toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/)
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
  let totalScore = 0, matchedTokens = 0;
  for (const token of queryTokens) {
    let bestMatch = 0;
    for (const col of boundCols) bestMatch = Math.max(bestMatch, tokenMatchScore(token, col));
    bestMatch = Math.max(bestMatch, tokenMatchScore(token, title) * 0.7);
    if (view.chartType) bestMatch = Math.max(bestMatch, tokenMatchScore(token, view.chartType) * 0.3);
    if (bestMatch > 0) { matchedTokens++; totalScore += bestMatch; }
  }
  return queryTokens.length > 0
    ? (totalScore / queryTokens.length) * (matchedTokens / queryTokens.length) : 0;
}

function scoreColumnRelevance(queryTokens, schemaColumns) {
  const matched = [];
  for (const col of schemaColumns) {
    let bestScore = 0;
    for (const token of queryTokens) bestScore = Math.max(bestScore, tokenMatchScore(token, col));
    if (bestScore >= 0.5) matched.push(col);
  }
  return matched;
}

function scoreViewRelevance(views, userQuery) {
  const queryTokens = extractQueryTokens(userQuery);
  let drillDownViewId = null;
  for (const view of views) {
    if (view.chartType === "HORIZONTAL_BAR" && view.groupByColumn) {
      drillDownViewId = view.id; break;
    }
  }
  const entries = views.map((view) => {
    const relevanceScore = Math.round(scoreView(view, queryTokens) * 100) / 100;
    return {
      viewId: view.id, relevanceScore,
      isCandidate: relevanceScore >= 0.1,
      filterEligibleColumns: [...new Set([...getBoundColumns(view), ...attributeKeys])],
    };
  });

  // No force-promotion — instead compute unmatched columns
  const queryMatchedColumns = scoreColumnRelevance(queryTokens, attributeKeys);
  const candidateBoundColumns = new Set();
  for (const entry of entries) {
    if (entry.isCandidate) {
      const view = views.find((v) => v.id === entry.viewId);
      if (view) for (const col of getBoundColumns(view)) candidateBoundColumns.add(col);
    }
  }
  const unmatchedQueryColumns = queryMatchedColumns.filter((col) => !candidateBoundColumns.has(col));

  return { entries, drillDownViewId, unmatchedQueryColumns, queryMatchedColumns };
}

// ── Prompt builder (mirrors current makePrompt.ts) ──────────────────

function buildPrompt({ views, candidateViews, contextViews, candidateAnnotations,
  unmatchedAnnotation, drillDownInfo, focusScore, question }) {
  return `
You are an AI agent that generates adaptive dashboard recommendations
for a collaborative data analysis environment called Living Dashboard.

Your task is to output dashboard adaptation commands based on:
- current dashboard layout
- user focus signals
- conversation context
- dataset schema (with column types and sample values)
- pre-computed view relevance scores

SYSTEM GOAL: Improve analytical efficiency by recommending view adaptations.
IMPORTANT: You guide the user to find answers through dashboard interactions.
You do NOT answer analytical questions directly.

OUTPUT CONTRACT (STRICT):
Return ONLY a JSON object:
{
  "reasoning": {
    "userNeed": string,
    "queryColumns": string[],
    "suggestedChartType": string | null,
    "relevantViews": string[],
    "currentGap": string
  },
  "reply": string,
  "recommendations": Recommendation[]
}

REASONING BLOCK (required - fill BEFORE generating recommendations):
- "userNeed": What the user wants to see or understand.
- "queryColumns": Schema column names relevant to the question.
- "suggestedChartType": Chart type for new view if needed, null otherwise.
- "relevantViews": View IDs from CANDIDATE VIEWS. Can be empty.
- "currentGap": What is missing from the dashboard.

DECISION TREE (follow strictly, in priority order):
1. If relevantViews is NOT empty: ALWAYS prefer CLICK, DRILL_DOWN, or
   MODIFY_FILTER on those existing views. Do NOT create NEW_CONTENT if a
   CLICK or filter on an existing view can answer the question.
2. If relevantViews IS empty AND no existing view can answer the question
   BUT queryColumns map to real schema columns: recommend NEW_CONTENT.
3. If relevantViews IS empty AND queryColumns is empty: no recommendations.

CRITICAL: Do NOT skip to branch 2 when branch 1 applies.

Each recommendation:
{
  "id": string, "title": string,
  "type": "REORDER"|"RESIZE"|"NEW_CONTENT"|"MODIFY_CONTENT"|"MODIFY_FILTER"|"REMOVE_CONTENT"|"DRILL_DOWN"|"CLICK",
  "targetViewId"?: string, "payload": Partial<View>, "reason": string
}

Rules:
- DO NOT include text outside JSON. No markdown.
- "reply" must be a short assistant-style response.
- Valid filter: { "top": N }, { "includeXValues": [...] }, { "includeByColumn": [{ "column": str, "includeValues": [...] }] }
- NEVER output empty arrays for filter lists.
- Filter values MUST use sampleValues from DATA SCHEMA as reference.
- Valid chartType: "BAR","LINE","SCATTER","PIE","TABLE","MAP","STACKED_BAR","GROUPED_BAR","HORIZONTAL_BAR","DONUT","FUNNEL","KPI","RANGE_BAR"

CHART TYPE SELECTION GUIDE (for NEW_CONTENT):
- BAR: string(x) + number(y). Categorical comparisons.
- LINE: date(x) + number(y). Trends.
- SCATTER: number(x) + number(y). Optional colorByColumn.
- MAP: country/geography(x) + number(y).
- STACKED_BAR/GROUPED_BAR: string(x) + number(y) + string(groupByColumn).
- KPI: number(y) only. Single metric.
- TABLE: columns[] array.
Column constraints: yColumn MUST be "number" type. NEVER use "string" as yColumn.

CLICK (HIGHEST PRIORITY when applicable):
- If a value the user asks about exists as a data point on a chart, recommend CLICK.
- CLICK cross-filters ALL other views, instantly answering the question.
- ALWAYS prefer CLICK over NEW_CONTENT when the value exists on a chart.
- Example: "which regions have mature markets?" + chart shows Market Maturity with "Mature" bar → CLICK "Mature".
- payload: { "clickTarget": "the Mature bar" }

DRILL_DOWN: prefer over MODIFY_FILTER for drill-down-capable views.
For DRILL_DOWN: payload should include "drillTarget".

NEW_CONTENT:
Use ONLY when no CLICK or filter can answer. yColumn MUST be "number" type.
Examples:
BAR: { "chartType":"BAR","xColumn":"Segment","yColumn":"Revenue","title":"Revenue by Segment" }
KPI: { "chartType":"KPI","yColumn":"Revenue","aggregation":"avg","title":"Avg Deal Revenue","filter":{"includeByColumn":[{"column":"Status","includeValues":["Won"]}]} }
STACKED_BAR: { "chartType":"STACKED_BAR","xColumn":"Territory","yColumn":"Revenue","groupByColumn":"Market Maturity","title":"Revenue by Territory & Maturity" }

VIEW RELEVANCE ANNOTATIONS:
${candidateAnnotations || "(no candidate views match the current query)"}

UNMATCHED QUERY COLUMNS:
${unmatchedAnnotation}

DRILL-DOWN CAPABILITY:
${drillDownInfo}

DATA SCHEMA:
${JSON.stringify(enrichedSchema, null, 2)}

CANDIDATE VIEWS (target recommendations here):
${candidateViews.length > 0 ? JSON.stringify(candidateViews, null, 2) : "None - no existing views match. Consider NEW_CONTENT."}

CONTEXT VIEWS (for awareness only):
${contextViews.length > 0 ? JSON.stringify(contextViews, null, 2) : "None"}

CURRENT FOCUS SCORE:
${JSON.stringify(focusScore, null, 2)}

TEXT CHAT:
- ${question}

RECENT REQUEST SUMMARY:
${question}

Return ONLY valid JSON. Follow DECISION TREE strictly.
No explanation. No markdown. No additional text.
`.trim();
}

// ── Validation checks ──────────────────────────────────────────────

function validateRecommendations(recs, testCase) {
  const issues = [];

  for (const rec of recs) {
    // Check yColumn is numeric for chart types
    if (rec.type === "NEW_CONTENT" && rec.payload) {
      const ct = rec.payload.chartType;
      if (ct && ct !== "TABLE" && ct !== "RANGE_BAR") {
        const yCol = rec.payload.yColumn;
        if (yCol && attributeTypes[yCol] !== "number") {
          issues.push(`FAIL: yColumn="${yCol}" is ${attributeTypes[yCol] || "unknown"}, must be number (chartType=${ct})`);
        }
        if (ct === "SCATTER") {
          const xCol = rec.payload.xColumn;
          if (xCol && attributeTypes[xCol] !== "number") {
            issues.push(`FAIL: SCATTER xColumn="${xCol}" is ${attributeTypes[xCol] || "unknown"}, must be number`);
          }
        }
      }
      // Check columns exist
      if (rec.payload.xColumn && !attributeKeys.includes(rec.payload.xColumn)) {
        issues.push(`FAIL: xColumn="${rec.payload.xColumn}" not in schema`);
      }
      if (rec.payload.yColumn && !attributeKeys.includes(rec.payload.yColumn)) {
        issues.push(`FAIL: yColumn="${rec.payload.yColumn}" not in schema`);
      }
      if (ct === "TABLE" && Array.isArray(rec.payload.columns)) {
        for (const col of rec.payload.columns) {
          if (!attributeKeys.includes(col)) issues.push(`FAIL: TABLE column "${col}" not in schema`);
        }
        if (rec.payload.columns.length === 0) issues.push("FAIL: TABLE has empty columns array");
      }
    }

    // Check targetViewId for modifications
    if (["MODIFY_FILTER", "MODIFY_CONTENT", "RESIZE", "REORDER", "REMOVE_CONTENT"].includes(rec.type)) {
      if (!rec.targetViewId) issues.push(`FAIL: ${rec.type} missing targetViewId`);
    }

    // Check filter values use sampleValues
    if (rec.payload?.filter?.includeByColumn) {
      for (const rule of rec.payload.filter.includeByColumn) {
        if (!attributeKeys.includes(rule.column)) {
          issues.push(`FAIL: filter column "${rule.column}" not in schema`);
        }
        if (!rule.includeValues || rule.includeValues.length === 0) {
          issues.push(`FAIL: empty includeValues for column "${rule.column}"`);
        }
      }
    }
  }

  // Check if any expected type was produced
  const types = recs.map((r) => r.type);
  const matchesExpected = testCase.expectedTypes.some((t) => types.includes(t));
  if (!matchesExpected && recs.length > 0) {
    issues.push(`WARN: expected one of [${testCase.expectedTypes.join(",")}] but got [${types.join(",")}]`);
  }
  if (recs.length === 0) {
    issues.push("WARN: no recommendations produced");
  }

  return issues;
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log("=== GENERATING INITIAL VIEWS ===\n");
  const buildRes = await fetch(`${BASE}/api/initial-build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attributeKeys, attributeTypes, dataSchema: enrichedSchema }),
    signal: AbortSignal.timeout(120_000),
  });
  const views = await buildRes.json();
  console.log(`Generated ${views.length} views:`);
  for (const v of views) {
    const cols = getBoundColumns(v);
    console.log(`  - ${v.id} (${v.chartType}): "${v.title}" [${cols.join(", ")}]`);
  }
  console.log();

  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const q = tc.question;
    console.log(`\n${"=".repeat(70)}`);
    console.log(`Q${i + 1}: ${q}`);
    console.log(`Expected: ${tc.expectedBehavior}`);
    console.log(`Must NOT: ${tc.mustNotDo}`);
    console.log("=".repeat(70));

    // Compute relevance
    const relevance = scoreViewRelevance(views, q);
    const candidates = relevance.entries.filter((e) => e.isCandidate);
    console.log(`\nCandidates: ${candidates.length > 0 ? candidates.map((c) => `${c.viewId}(${c.relevanceScore})`).join(", ") : "NONE"}`);
    console.log(`Query-matched columns: [${relevance.queryMatchedColumns.join(", ")}]`);
    console.log(`Unmatched columns: [${relevance.unmatchedQueryColumns.join(", ")}]`);

    const candidateViews = views.filter((v) =>
      relevance.entries.find((e) => e.viewId === v.id)?.isCandidate
    );
    const contextViews = views.filter(
      (v) => !relevance.entries.find((e) => e.viewId === v.id)?.isCandidate
    );
    const candidateAnnotations = relevance.entries
      .filter((e) => e.isCandidate)
      .map((e) => `  - View "${e.viewId}": relevance=${e.relevanceScore}, filterEligible=[${e.filterEligibleColumns.join(", ")}]`)
      .join("\n");

    const unmatchedAnnotation = relevance.unmatchedQueryColumns.length > 0
      ? relevance.unmatchedQueryColumns.map((col) => `  - "${col}" (type: ${attributeTypes[col]})`).join("\n")
      : "  (none)";

    const drillDownView = relevance.drillDownViewId
      ? views.find((v) => v.id === relevance.drillDownViewId) : null;
    const drillDownInfo = drillDownView
      ? `View "${drillDownView.id}" (title: "${drillDownView.title}") is a HORIZONTAL_BAR with groupByColumn="${drillDownView.groupByColumn}".`
      : "No drill-down-capable view exists.";

    const focusScore = {};
    for (const v of views) focusScore[v.id] = 0.5;

    const promptContent = buildPrompt({
      views, candidateViews, contextViews, candidateAnnotations,
      unmatchedAnnotation, drillDownInfo, focusScore, question: q,
    });

    const prompt = { role: "system", content: promptContent };

    // Call /api/recommend
    const recRes = await fetch(`${BASE}/api/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, views }),
      signal: AbortSignal.timeout(120_000),
    });

    const fullText = await recRes.text();
    let parsed;
    try {
      parsed = JSON.parse(fullText.trim());
    } catch {
      console.error("\nFAILED TO PARSE JSON:", fullText.slice(0, 300));
      results.push({ question: q, error: "Invalid JSON", reasoning: null, reply: "", recommendations: [], issues: ["FAIL: invalid JSON response"], tc });
      continue;
    }

    const reasoning = parsed.reasoning || null;
    const reply = parsed.reply || "";
    const recommendations = parsed.recommendations || [];

    console.log("\nReasoning:", JSON.stringify(reasoning, null, 2));
    console.log("Reply:", reply);
    console.log("Recommendations:");
    for (const r of recommendations) {
      const payload = r.payload ? JSON.stringify(r.payload) : "{}";
      console.log(`  [${r.type}] ${r.title} → target: ${r.targetViewId || "NEW"} | payload: ${payload.slice(0, 120)}`);
    }

    // Validate
    const issues = validateRecommendations(recommendations, tc);
    if (issues.length > 0) {
      console.log("\nValidation issues:");
      for (const issue of issues) console.log(`  ${issue}`);
    } else {
      console.log("\n  PASS - no validation issues");
    }

    results.push({ question: q, reasoning, reply, recommendations, issues, tc });
  }

  // ── Summary table ──────────────────────────────────────────────
  console.log("\n\n" + "=".repeat(120));
  console.log("SUMMARY TABLE");
  console.log("=".repeat(120) + "\n");

  console.log(
    pad("Q#", 4) + pad("Question", 55) + pad("Types", 25) +
    pad("Has Issues?", 14) + "Key Issue / Result"
  );
  console.log("-".repeat(120));

  let passCount = 0;
  let failCount = 0;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const types = r.recommendations.map((rec) => rec.type);
    const typeStr = types.length > 0 ? [...new Set(types)].join(", ") : "NO_RECS";
    const fails = (r.issues || []).filter((s) => s.startsWith("FAIL"));
    const warns = (r.issues || []).filter((s) => s.startsWith("WARN"));
    const hasIssue = fails.length > 0 ? "FAIL" : warns.length > 0 ? "WARN" : "PASS";

    if (hasIssue === "FAIL") failCount++;
    else passCount++;

    const keyIssue = fails.length > 0
      ? fails[0] : warns.length > 0
      ? warns[0] : "OK";

    console.log(
      pad(`${i + 1}`, 4) +
      pad(r.question.slice(0, 53), 55) +
      pad(typeStr, 25) +
      pad(hasIssue, 14) +
      keyIssue.slice(0, 60)
    );
  }

  console.log("-".repeat(120));
  console.log(`\nResults: ${passCount} passed, ${failCount} failed out of ${results.length} questions\n`);

  // ── Detailed JSON ──────────────────────────────────────────────
  const outputPath = "scripts/test-results.json";
  const fs = await import("fs");
  fs.writeFileSync(outputPath, JSON.stringify(results.map((r) => ({
    question: r.question,
    expectedTypes: r.tc.expectedTypes,
    expectedBehavior: r.tc.expectedBehavior,
    mustNotDo: r.tc.mustNotDo,
    actualTypes: r.recommendations.map((rec) => rec.type),
    reasoning: r.reasoning,
    reply: r.reply,
    recommendations: r.recommendations,
    issues: r.issues,
  })), null, 2));
  console.log(`Detailed results written to ${outputPath}`);
}

function pad(str, len) {
  return String(str).padEnd(len);
}

main().catch(console.error);
