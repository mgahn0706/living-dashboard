import type { View, ChartView, TableView } from "@/types/dashboard";

/* =======================================================
   View Relevance Scoring & Filter Eligibility

   Runs BEFORE the LLM call to deterministically:
   1. Score each view's relevance to the user query (0-1)
   2. Compute which columns each view can be filtered on
   3. Partition views into candidates vs context-only
======================================================= */

export type ViewRelevanceEntry = {
  viewId: string;
  relevanceScore: number;
  isCandidate: boolean;
  /** Columns bound to this view that are valid filter targets */
  filterEligibleColumns: string[];
};

export type ViewRelevanceResult = {
  entries: ViewRelevanceEntry[];
  drillDownViewId: string | null;
  /** Schema columns that matched the user query but are NOT bound to any candidate view */
  unmatchedQueryColumns: string[];
  /** All schema columns that matched the user query tokens */
  queryMatchedColumns: string[];
};

/** Minimum relevance score for a view to be considered a candidate. */
const CANDIDATE_THRESHOLD = 0.1;

/**
 * Extract all column names bound to a view (the columns it actually uses).
 */
function getBoundColumns(view: View): string[] {
  const cols: string[] = [];

  if (view.chartType === "TABLE") {
    const tv = view as TableView;
    if (tv.columns) cols.push(...tv.columns);
  } else {
    const cv = view as ChartView;
    if (cv.xColumn) cols.push(cv.xColumn);
    if (cv.yColumn) cols.push(cv.yColumn);
    if (cv.groupByColumn) cols.push(cv.groupByColumn);
    if (cv.colorByColumn) cols.push(cv.colorByColumn);
    if (cv.x2Column) cols.push(cv.x2Column);
  }

  return [...new Set(cols.filter(Boolean))];
}

/**
 * Extract keywords from a user query for matching against column names and values.
 * Lowercases, strips punctuation, removes common stop words.
 */
function extractQueryTokens(query: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "need", "must",
    "i", "me", "my", "we", "our", "you", "your", "he", "she", "it",
    "they", "them", "their", "this", "that", "these", "those",
    "what", "which", "who", "whom", "where", "when", "how", "why",
    "and", "or", "but", "if", "then", "than", "so", "because",
    "in", "on", "at", "to", "for", "of", "with", "by", "from", "up",
    "about", "into", "through", "during", "before", "after", "between",
    "show", "display", "see", "look", "tell", "give", "find", "get",
    "want", "like", "please", "just", "also", "more", "most", "very",
    "much", "many", "some", "any", "all", "each", "every", "both",
    "not", "no", "nor", "only", "own", "same", "too",
  ]);

  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w));
}

/**
 * Compute a fuzzy match score between a query token and a column/title string.
 * Returns 1.0 for exact substring match, partial for close matches, 0 for no match.
 */
function tokenMatchScore(token: string, target: string): number {
  const t = token.toLowerCase();
  const tgt = target.toLowerCase().replace(/[_\s]+/g, " ");

  // Exact match of the full target
  if (t === tgt) return 1.0;

  // Token is a substring of target or vice versa
  if (tgt.includes(t) || t.includes(tgt)) return 0.8;

  // Check individual words in the target (e.g., "product_category" -> ["product", "category"])
  const targetWords = tgt.split(/[\s_]+/);
  for (const tw of targetWords) {
    if (tw === t) return 0.9;
    if (tw.includes(t) || t.includes(tw)) return 0.6;
  }

  return 0;
}

/**
 * Score each schema column's relevance to the user query.
 * Returns only columns with a strong match (>= 0.5).
 */
function scoreColumnRelevance(
  queryTokens: string[],
  schemaColumns: string[]
): string[] {
  const matched: string[] = [];
  for (const col of schemaColumns) {
    let bestScore = 0;
    for (const token of queryTokens) {
      bestScore = Math.max(bestScore, tokenMatchScore(token, col));
    }
    if (bestScore >= 0.5) matched.push(col);
  }
  return matched;
}

/**
 * Score a single view's relevance to the user query.
 */
function scoreView(
  view: View,
  queryTokens: string[],
  schemaColumns: string[]
): number {
  if (queryTokens.length === 0) return 0;

  const boundCols = getBoundColumns(view);
  const title = view.title || "";

  let totalScore = 0;
  let matchedTokens = 0;

  for (const token of queryTokens) {
    let bestMatch = 0;

    // Match against bound columns
    for (const col of boundCols) {
      bestMatch = Math.max(bestMatch, tokenMatchScore(token, col));
    }

    // Match against view title
    bestMatch = Math.max(bestMatch, tokenMatchScore(token, title) * 0.7);

    // Match against chart type
    if (view.chartType) {
      bestMatch = Math.max(
        bestMatch,
        tokenMatchScore(token, view.chartType) * 0.3
      );
    }

    if (bestMatch > 0) {
      matchedTokens++;
      totalScore += bestMatch;
    }
  }

  // Normalize: proportion of query tokens that matched, weighted by match quality
  return queryTokens.length > 0
    ? (totalScore / queryTokens.length) * (matchedTokens / queryTokens.length)
    : 0;
}

/**
 * Compute filter-eligible columns for a view.
 * A view can be filtered on:
 * - Its bound columns (xColumn, yColumn, groupByColumn, etc.)
 * - Any column in the schema (via includeByColumn), but only if it's in the schema
 */
function getFilterEligibleColumns(
  view: View,
  schemaColumns: string[]
): string[] {
  // All schema columns are technically eligible via includeByColumn,
  // but we prioritize bound columns for directness
  const bound = getBoundColumns(view);
  const eligible = new Set(bound);

  // Also include schema columns that are semantically related
  // (the LLM can use includeByColumn for any schema column)
  for (const col of schemaColumns) {
    eligible.add(col);
  }

  return [...eligible];
}

/**
 * Main entry point: score all views against the user query.
 */
export function scoreViewRelevance(
  views: View[],
  userQuery: string,
  dataSchema?: any
): ViewRelevanceResult {
  const queryTokens = extractQueryTokens(userQuery);

  // Extract column names from schema
  const schemaColumns: string[] = [];
  if (dataSchema) {
    if (Array.isArray(dataSchema)) {
      for (const entry of dataSchema) {
        if (entry?.name) schemaColumns.push(entry.name);
      }
    } else if (typeof dataSchema === "object") {
      for (const key of Object.keys(dataSchema)) {
        schemaColumns.push(key);
      }
    }
  }

  // Find the drill-down-capable view (HORIZONTAL_BAR with groupByColumn)
  let drillDownViewId: string | null = null;
  for (const view of views) {
    if (
      view.chartType === "HORIZONTAL_BAR" &&
      (view as ChartView).groupByColumn
    ) {
      drillDownViewId = view.id;
      break;
    }
  }

  const entries: ViewRelevanceEntry[] = views.map((view) => {
    const relevanceScore = scoreView(view, queryTokens, schemaColumns);
    return {
      viewId: view.id,
      relevanceScore: Math.round(relevanceScore * 100) / 100,
      isCandidate: relevanceScore >= CANDIDATE_THRESHOLD,
      filterEligibleColumns: getFilterEligibleColumns(view, schemaColumns),
    };
  });

  // Match query tokens against schema columns (independent of views)
  const queryMatchedColumns = scoreColumnRelevance(queryTokens, schemaColumns);

  // Determine which matched columns are NOT covered by any candidate view
  const candidateBoundColumns = new Set<string>();
  for (const entry of entries) {
    if (entry.isCandidate) {
      const view = views.find((v) => v.id === entry.viewId);
      if (view) {
        for (const col of getBoundColumns(view)) {
          candidateBoundColumns.add(col);
        }
      }
    }
  }

  const unmatchedQueryColumns = queryMatchedColumns.filter(
    (col) => !candidateBoundColumns.has(col)
  );

  return { entries, drillDownViewId, unmatchedQueryColumns, queryMatchedColumns };
}
