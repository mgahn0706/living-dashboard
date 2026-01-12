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
    }, 3000000000000);

    return () => clearInterval(interval);
  }, [context]);

  return recs;
}
