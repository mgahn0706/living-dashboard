"use client";

import { useCallback, useRef, useState } from "react";
import { Recommendation } from "@/types/dashboard";
import { VoiceUtterance } from "./useVoiceInput";
import { makePrompt } from "@/lib/llm/makePrompt";

/* ===================== Types ===================== */

export type LlmReply = { text: string; timestamp: number };

/* ===================== Semantic Key ===================== */

function getRecommendationKey(r: Recommendation) {
  return r.id;
}

type RecommendationApiResponse =
  | Recommendation[]
  | {
      reply?: string;
      recommendations?: Recommendation[];
    };

/* ===================== Hook ===================== */

export function useRecommendation() {
  /** dismissed = client-side truth */
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(
    () => new Set()
  );

  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [llmReplies, setLlmReplies] = useState<LlmReply[]>([]);
  const [isLoading, setIsLoading] = useState(false);

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
    }: {
      views: any[];
      focusScore: Record<string, number>;
      conversation: VoiceUtterance[];
      textChats: string[];
      dataSchema?: any;
    }) => {
      const now = Date.now();
      if (now - lastCallRef.current < COOLDOWN) {
        return; // ⛔ cooldown
      }

      lastCallRef.current = now;
      setIsLoading(true);

      try {
        const prompt = makePrompt({
          views,
          focusScore,
          conversation,
          textChats,
          dataSchema,
        });

        console.log("LLM Prompt:", prompt.content);

        const res = await fetch("/api/recommend", {
          method: "POST",
          body: JSON.stringify({ prompt, views }),
        });

        const data: RecommendationApiResponse = await res.json();

        const recommendations = Array.isArray(data)
          ? data
          : Array.isArray(data?.recommendations)
          ? data.recommendations
          : [];

        const reply =
          typeof data === "object" &&
          data !== null &&
          !Array.isArray(data) &&
          typeof data.reply === "string"
            ? data.reply.trim()
            : "";

        setRecs(
          recommendations.filter((r) => !dismissedKeys.has(getRecommendationKey(r)))
        );
        if (reply) {
          setLlmReplies((prev) => [...prev, { text: reply, timestamp: Date.now() }]);
        }
      } finally {
        setIsLoading(false);
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

  return {
    recommendations: recs,
    llmReplies,
    triggerRecommendation, // ✅ mutateAsync equivalent
    acceptRecommendation,
    isLoading,
    restoreHistory,

    resetAccepted: () => {
      setDismissedKeys(new Set());
    },
  };
}
