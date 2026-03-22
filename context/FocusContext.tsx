"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
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

  /* ----- AI-driven focus boost ----- */
  boostFocusForViews: (viewIds: string[]) => void;
  disengageViews: (viewIds: string[]) => void;
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
  const focusScoreRef = useRef<Record<string, number>>({});
  const pendingDeltaRef = useRef<Record<string, number>>({});
  const flushHandleRef = useRef<number | null>(null);
  const { isSystemA } = useSystemMode();

  const flushPendingFocusUpdates = useCallback(() => {
    flushHandleRef.current = null;

    const pending = pendingDeltaRef.current;
    const viewIds = Object.keys(pending);
    if (viewIds.length === 0) return;

    pendingDeltaRef.current = {};

    setFocusScore((previous) => {
      let changed = false;
      const next = { ...previous };

      for (const viewId of viewIds) {
        const delta = pending[viewId];
        if (!delta) continue;

        const current = next[viewId] ?? INITIAL_FOCUS_SCORE;
        const updated = current + delta;

        if (updated !== current) {
          next[viewId] = updated;
          changed = true;
        }
      }

      if (!changed) return previous;
      focusScoreRef.current = next;
      return next;
    });
  }, []);

  const scheduleFocusFlush = useCallback(() => {
    if (flushHandleRef.current != null) return;
    flushHandleRef.current = window.requestAnimationFrame(
      flushPendingFocusUpdates
    );
  }, [flushPendingFocusUpdates]);

  const {
    handlePointerMove,
    handlePointerEnter,
    handlePointerLeave,
    setViewEngaged,
    handleClick,
    registerViewIds: registerDetectorViewIds,
    boostViewEstimates,
  } = useFocusPathDetector(
    (viewId, delta) => {
      if (!isSystemA) return;
      pendingDeltaRef.current[viewId] =
        (pendingDeltaRef.current[viewId] ?? 0) + delta;
      scheduleFocusFlush();
    }
  );

  /* -------------------------------------------------------
     Interaction reporting (Evidence layer)
  ------------------------------------------------------- */

  const reportPointerInteraction = useCallback((
    viewId: string,
    event: PointerEventPayload
  ) => {
    if (!isSystemA) return;
    handlePointerMove(viewId, event);
  }, [handlePointerMove, isSystemA]);

  const reportClickInteraction = useCallback((viewId: string) => {
    if (!isSystemA) return;
    handleClick(viewId);
  }, [handleClick, isSystemA]);

  const reportPointerEnter = useCallback((viewId: string) => {
    if (!isSystemA) return;
    handlePointerEnter(viewId);
  }, [handlePointerEnter, isSystemA]);

  const reportPointerLeave = useCallback((viewId: string) => {
    if (!isSystemA) return;
    handlePointerLeave(viewId);
  }, [handlePointerLeave, isSystemA]);

  const reportViewEngagement = useCallback((viewId: string, engaged: boolean) => {
    if (!isSystemA) return;
    setViewEngaged(viewId, engaged);
  }, [isSystemA, setViewEngaged]);

  const registerViewIds = useCallback((viewIds: string[]) => {
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
      if (changed) {
        focusScoreRef.current = next;
      }
      return changed ? next : prev;
    });
  }, [registerDetectorViewIds]);

  const restoreFocusScore = useCallback((next: Record<string, number>) => {
    const normalized = normalizeRestoredFocusScore(next);
    pendingDeltaRef.current = {};
    if (flushHandleRef.current != null) {
      window.cancelAnimationFrame(flushHandleRef.current);
      flushHandleRef.current = null;
    }
    focusScoreRef.current = normalized;
    setFocusScore(normalized);
  }, []);

  /* -------------------------------------------------------
     AI-driven focus boost / disengage
  ------------------------------------------------------- */

  const boostFocusForViews = useCallback((viewIds: string[]) => {
    if (!isSystemA || viewIds.length === 0) return;

    // 1. Boost scores to INITIAL_FOCUS_SCORE
    setFocusScore((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const id of viewIds) {
        const current = next[id] ?? INITIAL_FOCUS_SCORE;
        if (current < INITIAL_FOCUS_SCORE) {
          next[id] = Math.round(current + (INITIAL_FOCUS_SCORE - current) / 3);
          changed = true;
        }
      }
      if (changed) {
        focusScoreRef.current = next;
      }
      return changed ? next : prev;
    });

    // 2. Clear any pending negative deltas for these views
    for (const id of viewIds) {
      delete pendingDeltaRef.current[id];
    }

    // 3. Sync detector's internal estimate
    boostViewEstimates(viewIds);

    // 4. Engage each view (stops decay)
    for (const id of viewIds) {
      setViewEngaged(id, true);
    }
  }, [isSystemA, boostViewEstimates, setViewEngaged]);

  const disengageViews = useCallback((viewIds: string[]) => {
    if (!isSystemA || viewIds.length === 0) return;
    for (const id of viewIds) {
      setViewEngaged(id, false);
    }
  }, [isSystemA, setViewEngaged]);

  /* -------------------------------------------------------
     Context value
  ------------------------------------------------------- */

  const contextValue = useMemo(
    () => ({
      focusScore,
      reportPointerInteraction,
      reportPointerEnter,
      reportPointerLeave,
      reportViewEngagement,
      reportClickInteraction,
      registerViewIds,
      restoreFocusScore,
      boostFocusForViews,
      disengageViews,
    }),
    [
      focusScore,
      reportPointerInteraction,
      reportPointerEnter,
      reportPointerLeave,
      reportViewEngagement,
      reportClickInteraction,
      registerViewIds,
      restoreFocusScore,
      boostFocusForViews,
      disengageViews,
    ]
  );

  return (
    <FocusContext.Provider value={contextValue}>
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
