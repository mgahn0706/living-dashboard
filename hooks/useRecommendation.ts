"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Recommendation } from "@/types/dashboard";
import { VoiceUtterance } from "./useVoiceInput";
import { makePrompt } from "@/lib/llm/makePrompt";

/* ===================== Semantic Key ===================== */

function getRecommendationKey(r: Recommendation) {
  return JSON.stringify({
    type: r.type,
    payload: r.payload,
  });
}

/* ===================== Hook ===================== */

export function useRecommendation() {
  /** dismissed = client-side truth */
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(
    () => new Set()
  );

  const [recs, setRecs] = useState<Recommendation[]>([]);
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

        const data: Recommendation[] = await res.json();

        setRecs(
          data.filter((r) => !dismissedKeys.has(getRecommendationKey(r)))
        );
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

  return {
    recommendations: recs,
    triggerRecommendation, // ✅ mutateAsync equivalent
    acceptRecommendation,
    isLoading,

    resetAccepted: () => {
      setDismissedKeys(new Set());
    },
  };
}
