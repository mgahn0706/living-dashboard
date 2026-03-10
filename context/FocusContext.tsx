"use client";

import { createContext, useContext, useState } from "react";
import { useFocusPathDetector } from "@/hooks/useFocusPathDetector";

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

  reportClickInteraction: (viewId: string) => void;
};

const FocusContext = createContext<FocusContextValue | null>(null);
export const INITIAL_FOCUS_SCORE = 10_000_000;

/* =======================================================
   Provider
======================================================= */

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [focusScore, setFocusScore] = useState<Record<string, number>>({});

  const { handlePointerMove, handleClick } = useFocusPathDetector(
    (viewId, delta) => {
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
    handlePointerMove(viewId, event);
  };

  const reportClickInteraction = (viewId: string) => {
    handleClick(viewId);
  };

  /* -------------------------------------------------------
     Context value
  ------------------------------------------------------- */

  return (
    <FocusContext.Provider
      value={{
        focusScore,
        reportPointerInteraction,
        reportClickInteraction,
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
