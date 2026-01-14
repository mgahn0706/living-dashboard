"use client";

import { Recommendation } from "@/types/dashboard";
import { Button } from "@/components/ui/button";
import { IconCheck, IconSparkles } from "@tabler/icons-react";

export default function RecommendationItem({
  recommendation,
  onAccept,
}: {
  recommendation: Recommendation;
  onAccept: (r: Recommendation) => void;
}) {
  return (
    <div className="flex w-full gap-2">
      {/* Icon */}
      <div className="pt-1 text-primary/60">
        <IconSparkles className="size-4" />
      </div>

      {/* Card */}
      <div className="flex w-full flex-col gap-2 rounded-lg border bg-background px-3 py-2.5 text-sm">
        {/* Title */}
        <div className="font-medium leading-tight">{recommendation.title}</div>

        {/* Reason */}
        <div className="text-xs leading-relaxed text-muted-foreground">
          {recommendation.reason}
        </div>

        {/* Footer */}
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
            {recommendation.type}
          </span>

          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs cursor-pointer"
            onClick={() => {
              onAccept(recommendation);
            }}
          >
            <IconCheck className="mr-1 size-3" />
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
