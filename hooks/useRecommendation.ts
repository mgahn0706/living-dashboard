"use client";

import { useCallback, useRef, useState } from "react";
import { Recommendation } from "@/types/dashboard";
import { VoiceUtterance } from "./useVoiceInput";
import { makePrompt } from "@/lib/llm/makePrompt";
import { scoreViewRelevance } from "@/lib/recommendation/viewRelevance";
import { summarizeRecentRequest, buildRecentRequestMessages } from "@/lib/recommendation/requestSummary";

/* ===================== Types ===================== */

export type LlmReply = { text: string; timestamp: number };

/* ===================== Enriched Schema ===================== */

/**
 * Transform the opaque { type: "primitive" } schema into a rich structure
 * with column types and sample values for categorical columns.
 */
function buildEnrichedSchema(
  dataSchema: any,
  attributeTypes?: Record<string, string>,
  resolveAttribute?: (attr: string) => any[]
): Record<string, { type: string; sampleValues?: (string | number)[] }> | any {
  if (!dataSchema || !attributeTypes) return dataSchema;

  const columns: string[] = [];
  if (dataSchema?.children && typeof dataSchema.children === "object") {
    for (const key of Object.keys(dataSchema.children)) {
      columns.push(key);
    }
  } else if (typeof dataSchema === "object" && !Array.isArray(dataSchema)) {
    for (const key of Object.keys(dataSchema)) {
      columns.push(key);
    }
  }

  if (columns.length === 0) return dataSchema;

  const enriched: Record<string, { type: string; sampleValues?: (string | number)[] }> = {};

  for (const col of columns) {
    const colType = attributeTypes[col] || "unknown";
    const entry: { type: string; sampleValues?: (string | number)[] } = { type: colType };

    // For categorical columns, add sample values (unique, capped at 10)
    if (colType === "string" && resolveAttribute) {
      const allValues = resolveAttribute(col);
      const unique = [...new Set(allValues.filter((v) => v != null && v !== ""))];
      entry.sampleValues = unique.slice(0, 10) as (string | number)[];
    }

    enriched[col] = entry;
  }

  return enriched;
}

/* ===================== Semantic Key ===================== */

function getRecommendationKey(r: Recommendation) {
  return r.id;
}

/* ===================== Hook ===================== */

export function useRecommendation() {
  /** dismissed = client-side truth */
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(
    () => new Set()
  );

  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [llmReplies, setLlmReplies] = useState<LlmReply[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  /** Partial text streamed from the LLM (visible during generation). */
  const [streamingText, setStreamingText] = useState("");

  const lastCallRef = useRef<number>(0);
  const COOLDOWN = 0; // ms

  /* ===================== Trigger (mutateAsync style) ===================== */

  const triggerRecommendation = useCallback(
    async ({
      views,
      focusScore,
      conversation,
      textChats,
      dataSchema,
      attributeTypes,
      resolveAttribute,
      suppressRecommendations = false,
    }: {
      views: any[];
      focusScore: Record<string, number>;
      conversation: VoiceUtterance[];
      textChats: string[];
      dataSchema?: any;
      attributeTypes?: Record<string, string>;
      resolveAttribute?: (attr: string) => any[];
      suppressRecommendations?: boolean;
    }) => {
      const now = Date.now();
      if (now - lastCallRef.current < COOLDOWN) {
        return; // ⛔ cooldown
      }

      lastCallRef.current = now;
      setIsLoading(true);
      setStreamingText("");

      try {
        // Pre-LLM step: compute view relevance scores and filter eligibility
        const userQuery = summarizeRecentRequest(
          buildRecentRequestMessages({ conversation, textChats })
        );
        const relevanceResult = scoreViewRelevance(views, userQuery, dataSchema);

        console.log("View Relevance:", relevanceResult.entries);
        console.log("Drill-down view:", relevanceResult.drillDownViewId);
        console.log("Unmatched columns:", relevanceResult.unmatchedQueryColumns);

        const enrichedSchema = buildEnrichedSchema(dataSchema, attributeTypes, resolveAttribute);

        const prompt = makePrompt({
          views,
          focusScore,
          conversation,
          textChats,
          dataSchema: enrichedSchema,
          attributeTypes,
          viewRelevance: relevanceResult.entries,
          drillDownViewId: relevanceResult.drillDownViewId,
          unmatchedQueryColumns: relevanceResult.unmatchedQueryColumns,
          queryMatchedColumns: relevanceResult.queryMatchedColumns,
        });

        console.log("LLM Prompt:", prompt.content);

        const res = await fetch("/api/recommend", {
          method: "POST",
          body: JSON.stringify({ prompt, views }),
        });

        if (!res.ok || !res.body) {
          console.error("Recommend API returned", res.status);
          return;
        }

        // Read the streamed text incrementally
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setStreamingText(fullText);
        }

        console.log("LLM Response:", fullText);

        // Parse the completed JSON
        const text = fullText.trim();
        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch {
          console.error("LLM returned invalid JSON:", text);
          return;
        }

        const recommendations = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.recommendations)
          ? parsed.recommendations
          : [];

        const reply =
          typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed) &&
          typeof parsed.reply === "string"
            ? parsed.reply.trim()
            : "";

        // Log reasoning block for debugging (not shown in UI)
        if (parsed?.reasoning) {
          console.log("LLM Reasoning:", parsed.reasoning);
        }

        setRecs(
          suppressRecommendations
            ? []
            : recommendations.filter(
                (r: Recommendation) => !dismissedKeys.has(getRecommendationKey(r))
              )
        );
        if (reply) {
          setLlmReplies((prev) => [
            ...prev,
            { text: reply, timestamp: Date.now() },
          ]);
        }
      } finally {
        setIsLoading(false);
        setStreamingText("");
      }
    },
    [dismissedKeys]
  );

  /* ===================== Accept ===================== */

  const acceptRecommendation = useCallback((rec: Recommendation) => {
    const key = getRecommendationKey(rec);

    setDismissedKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });

    setRecs((prev) => prev.filter((r) => getRecommendationKey(r) !== key));
  }, []);

  const restoreHistory = useCallback(
    ({
      llmReplies,
      dismissedRecommendationIds,
    }: {
      llmReplies?: (string | LlmReply)[];
      dismissedRecommendationIds?: string[];
    }) => {
      if (Array.isArray(llmReplies)) {
        setLlmReplies(
          llmReplies
            .map((r) =>
              typeof r === "string"
                ? { text: r, timestamp: Date.now() }
                : r && typeof r === "object" && typeof r.text === "string"
                ? r
                : null
            )
            .filter((r): r is LlmReply => r !== null)
        );
      }

      if (Array.isArray(dismissedRecommendationIds)) {
        setDismissedKeys(
          new Set(
            dismissedRecommendationIds.filter((id) => typeof id === "string")
          )
        );
      }

      setRecs((prev) =>
        prev.filter(
          (r) =>
            !dismissedRecommendationIds?.includes(getRecommendationKey(r))
        )
      );
    },
    []
  );

  const clearRecommendations = useCallback(() => {
    setRecs([]);
    setStreamingText("");
    setIsLoading(false);
  }, []);

  return {
    recommendations: recs,
    llmReplies,
    triggerRecommendation, // ✅ mutateAsync equivalent
    acceptRecommendation,
    isLoading,
    streamingText,
    restoreHistory,
    clearRecommendations,

    resetAccepted: () => {
      setDismissedKeys(new Set());
    },
  };
}
