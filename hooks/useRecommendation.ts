"use client";

import { useCallback, useRef, useState } from "react";
import { Recommendation } from "@/types/dashboard";
import { VoiceUtterance } from "./useVoiceInput";
import { makePrompt } from "@/lib/llm/makePrompt";

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
  const [llmReplies, setLlmReplies] = useState<string[]>([]);
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
          setLlmReplies((prev) => [...prev, reply]);
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
      llmReplies?: string[];
      dismissedRecommendationIds?: string[];
    }) => {
      if (Array.isArray(llmReplies)) {
        setLlmReplies(llmReplies.filter((reply) => typeof reply === "string"));
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
