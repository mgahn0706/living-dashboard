// hooks/useRecommendation.ts
"use client";
import { useEffect, useState } from "react";
import { Recommendation } from "@/types/dashboard";

export function useRecommendation(context: any) {
  const [recs, setRecs] = useState<Recommendation[]>([]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch("/api/recommend", {
        method: "POST",
        body: JSON.stringify(context),
      });
      const data = await res.json();
      setRecs(data);
    }, 3000000);

    return () => clearInterval(interval);
  }, [context]);

  const refresh = async () => {
    const res = await fetch("/api/recommend", {
      method: "POST",
      body: JSON.stringify(context),
    });
    const data = await res.json();
    setRecs(data);
  };

  return {
    recommendations: recs,
    refresh,
    removeRecommendations: (rec: Recommendation) => {
      setRecs((prev) => prev.filter((r) => r.id !== rec.id));
    },
  };
}
