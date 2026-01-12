// context/FocusContext.tsx
"use client";
import { createContext, useContext, useState } from "react";

type FocusContextType = {
  focusScore: Record<string, number>;
  updateFocus: (viewId: string) => void;
};

const FocusContext = createContext<FocusContextType | null>(null);

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [focusScore, setFocusScore] = useState<Record<string, number>>({});

  const updateFocus = (id: string) => {
    setFocusScore((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }));
  };

  return (
    <FocusContext.Provider value={{ focusScore, updateFocus }}>
      {children}
    </FocusContext.Provider>
  );
}

export const useFocus = () => {
  const ctx = useContext(FocusContext);
  if (!ctx) throw new Error("useFocus must be used inside FocusProvider");
  return ctx;
};
