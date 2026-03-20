"use client";

import { createContext, useContext, useState } from "react";
import { useFocusPathDetector } from "@/hooks/useFocusPathDetector";
import { useSystemMode } from "@/context/SystemModeContext";

/* =======================================================
   Types
======================================================= */

type PointerEventPayload = {
  clientX: number;
  clientY: number;
};

type FocusContextValue = {
  focusScore: Record<string, number>;

  /* ----- Interaction Evidence ----- */
  reportPointerInteraction: (
    viewId: string,
    event: PointerEventPayload
  ) => void;
  reportPointerEnter: (viewId: string) => void;
  reportPointerLeave: (viewId: string) => void;
  reportViewEngagement: (viewId: string, engaged: boolean) => void;

  reportClickInteraction: (viewId: string) => void;
  registerViewIds: (viewIds: string[]) => void;
  restoreFocusScore: (next: Record<string, number>) => void;
};

const FocusContext = createContext<FocusContextValue | null>(null);
export const INITIAL_FOCUS_SCORE = 1_000;
const LEGACY_FOCUS_SCORE_THRESHOLD = 100_000;

function normalizeRestoredFocusScore(next: Record<string, number>) {
  const entries = Object.entries(next).filter(
    ([, value]) => typeof value === "number" && Number.isFinite(value)
  );

  if (entries.length === 0) return {};

  const max = Math.max(...entries.map(([, value]) => value));
  const shouldRescale = max > LEGACY_FOCUS_SCORE_THRESHOLD;
  const scale = shouldRescale ? INITIAL_FOCUS_SCORE / max : 1;

  return Object.fromEntries(
    entries.map(([viewId, value]) => [
      viewId,
      Math.max(0, Number((value * scale).toFixed(3))),
    ])
  );
}

/* =======================================================
   Provider
======================================================= */

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [focusScore, setFocusScore] = useState<Record<string, number>>({});
  const { isSystemA } = useSystemMode();

  const {
    handlePointerMove,
    handlePointerEnter,
    handlePointerLeave,
    setViewEngaged,
    handleClick,
    registerViewIds: registerDetectorViewIds,
  } = useFocusPathDetector(
    (viewId, delta) => {
      if (!isSystemA) return;
      setFocusScore((previous) => ({
        ...previous,
        [viewId]: (previous[viewId] ?? INITIAL_FOCUS_SCORE) + delta,
      }));
    }
  );

  /* -------------------------------------------------------
     Interaction reporting (Evidence layer)
  ------------------------------------------------------- */

  const reportPointerInteraction = (
    viewId: string,
    event: PointerEventPayload
  ) => {
    if (!isSystemA) return;
    handlePointerMove(viewId, event);
  };

  const reportClickInteraction = (viewId: string) => {
    if (!isSystemA) return;
    handleClick(viewId);
  };

  const reportPointerEnter = (viewId: string) => {
    if (!isSystemA) return;
    handlePointerEnter(viewId);
  };

  const reportPointerLeave = (viewId: string) => {
    if (!isSystemA) return;
    handlePointerLeave(viewId);
  };

  const reportViewEngagement = (viewId: string, engaged: boolean) => {
    if (!isSystemA) return;
    setViewEngaged(viewId, engaged);
  };

  const registerViewIds = (viewIds: string[]) => {
    registerDetectorViewIds(viewIds);
    setFocusScore((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const id of viewIds) {
        if (!(id in next)) {
          next[id] = INITIAL_FOCUS_SCORE;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  };

  const restoreFocusScore = (next: Record<string, number>) => {
    setFocusScore(normalizeRestoredFocusScore(next));
  };

  /* -------------------------------------------------------
     Context value
  ------------------------------------------------------- */

  return (
    <FocusContext.Provider
      value={{
        focusScore,
        reportPointerInteraction,
        reportPointerEnter,
        reportPointerLeave,
        reportViewEngagement,
        reportClickInteraction,
        registerViewIds,
        restoreFocusScore,
      }}
    >
      {children}
    </FocusContext.Provider>
  );
}

/* =======================================================
   Hook
======================================================= */

export function useFocus() {
  const context = useContext(FocusContext);

  if (context == null) {
    throw new Error("useFocus must be used inside FocusProvider");
  }

  return context;
}
