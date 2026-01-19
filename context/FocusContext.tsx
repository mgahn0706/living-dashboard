"use client";

import { createContext, useContext, useState } from "react";
import { useFocusPathDetector } from "@/hooks/useFocusPathDetector";

type FocusContextValue = {
  focusScore: Record<string, number>;
  updateFocus: (
    viewId: string,
    event: { clientX: number; clientY: number }
  ) => void;
};

const FocusContext = createContext<FocusContextValue | null>(null);

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [focusScore, setFocusScore] = useState<Record<string, number>>({});

  const { handlePointerMove } = useFocusPathDetector((viewId, delta) => {
    setFocusScore((previous) => ({
      ...previous,
      [viewId]: (previous[viewId] ?? 0) + delta,
    }));
  });

  const updateFocus = (
    viewId: string,
    event: { clientX: number; clientY: number }
  ) => {
    handlePointerMove(viewId, event);
  };

  return (
    <FocusContext.Provider value={{ focusScore, updateFocus }}>
      {children}
    </FocusContext.Provider>
  );
}

export function useFocus() {
  const context = useContext(FocusContext);
  if (context == null) {
    throw new Error("useFocus must be used inside FocusProvider");
  }
  return context;
}
