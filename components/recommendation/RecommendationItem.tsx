"use client";

import { Recommendation } from "@/types/dashboard";
import { Button } from "@/components/ui/button";
import { IconCheck, IconSparkles } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

const typeStyles: Record<Recommendation["type"], string> = {
  MODIFY_CONTENT:
    "border-sky-200/70 bg-gradient-to-br from-sky-50/80 to-sky-100/50 shadow-[0_6px_18px_rgba(14,116,144,0.12)] dark:border-sky-900/60 dark:from-sky-950/40 dark:to-sky-900/20 dark:shadow-[0_6px_18px_rgba(2,132,199,0.12)]",
  NEW_CONTENT:
    "border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 to-emerald-100/50 shadow-[0_6px_18px_rgba(16,185,129,0.12)] dark:border-emerald-900/60 dark:from-emerald-950/40 dark:to-emerald-900/20 dark:shadow-[0_6px_18px_rgba(16,185,129,0.12)]",
  REORDER:
    "border-amber-200/70 bg-gradient-to-br from-amber-50/80 to-amber-100/50 shadow-[0_6px_18px_rgba(245,158,11,0.12)] dark:border-amber-900/60 dark:from-amber-950/40 dark:to-amber-900/20 dark:shadow-[0_6px_18px_rgba(245,158,11,0.12)]",
  RESIZE:
    "border-violet-200/70 bg-gradient-to-br from-violet-50/80 to-violet-100/50 shadow-[0_6px_18px_rgba(139,92,246,0.12)] dark:border-violet-900/60 dark:from-violet-950/40 dark:to-violet-900/20 dark:shadow-[0_6px_18px_rgba(139,92,246,0.12)]",
  REMOVE_CONTENT:
    "border-rose-200/70 bg-gradient-to-br from-rose-50/80 to-rose-100/50 shadow-[0_6px_18px_rgba(244,63,94,0.12)] dark:border-rose-900/60 dark:from-rose-950/40 dark:to-rose-900/20 dark:shadow-[0_6px_18px_rgba(244,63,94,0.12)]",
};

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
      <div
        className={cn(
          "flex w-full flex-col gap-2 rounded-lg border px-3 py-2.5 text-sm",
          typeStyles[recommendation.type]
        )}
      >
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
