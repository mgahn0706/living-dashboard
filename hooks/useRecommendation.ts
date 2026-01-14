"use client";

import { useEffect, useMemo, useState } from "react";
import { Recommendation } from "@/types/dashboard";

const POLL_INTERVAL = 3000;

/* ===================== Semantic Key ===================== */

function getRecommendationKey(r: Recommendation) {
  return JSON.stringify({
    type: r.type,
    payload: r.payload,
  });
}

/* ===================== Hook ===================== */

export function useRecommendation({
  views,
  focusScore,
  conversation,
  enabled = true,
}: {
  views: any[];
  focusScore: Record<string, number>;
  conversation: any[];
  enabled?: boolean;
}) {
  /** 🔥 dismissed = client-side truth */
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(
    () => new Set()
  );

  const [recs, setRecs] = useState<Recommendation[]>([]);

  const stableContext = useMemo(
    () => ({ views, focusScore, conversation }),
    [JSON.stringify({ views, focusScore, conversation })]
  );

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const poll = async () => {
      const res = await fetch("/api/recommend", {
        method: "POST",
        body: JSON.stringify(stableContext),
      });

      const data: Recommendation[] = await res.json();
      if (cancelled) return;

      setRecs((prev) => {
        const merged = data.filter((r) => {
          const key = getRecommendationKey(r);
          return !dismissedKeys.has(key);
        });

        return merged;
      });
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [stableContext, enabled, dismissedKeys]);

  /* ===================== Accept ===================== */

  const acceptRecommendation = (rec: Recommendation) => {
    const key = getRecommendationKey(rec);

    setDismissedKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });

    // optimistic UI
    setRecs((prev) => prev.filter((r) => getRecommendationKey(r) !== key));
  };

  return {
    recommendations: recs,
    acceptRecommendation,

    /** optional */
    resetAccepted: () => {
      setDismissedKeys(new Set());
    },
  };
}
