// components/recommendation/RecommendationItem.tsx
"use client";

import { Recommendation } from "@/types/dashboard";
import { Button } from "@/components/ui/button";
import { IconCheck } from "@tabler/icons-react";

export default function RecommendationItem({
  recommendation,
  onAccept,
}: {
  recommendation: Recommendation;
  onAccept: (r: Recommendation) => void;
}) {
  return (
    <div className="flex w-full gap-2">
      {/* AI bubble */}
      <div className="flex max-w-[90%] flex-col gap-2 rounded-2xl bg-muted/50 px-4 py-3 text-sm shadow-sm">
        <div className="font-medium">{recommendation.title}</div>

        <div className="text-xs text-muted-foreground leading-relaxed">
          {recommendation.reason}
        </div>

        {/* Meta */}
        <div className="text-[10px] text-muted-foreground/60">
          Type: {recommendation.type}
        </div>

        {/* Action */}
        <div className="pt-1">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 gap-1 text-xs"
            onClick={() => onAccept(recommendation)}
          >
            <IconCheck className="size-3" />
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
