"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";

/* =====================================================
   Types
===================================================== */

export type SelectionState = {
  [column: string]: Set<any>;
};

type SelectionContextType = {
  selection: SelectionState;

  /** replace selection (single active dimension model) */
  replaceSelection: (column: string, value: any) => void;

  /** completely clear all selections */
  clearSelection: () => void;

  /** check if specific value is selected */
  isSelected: (column: string, value: any) => boolean;

  /** check if any selection exists */
  hasSelection: boolean;
};

/* =====================================================
   Context
===================================================== */

const SelectionContext = createContext<SelectionContextType | null>(null);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelection] = useState<SelectionState>({});

  /* ===============================
     Replace Selection
     - Always keep only ONE column
     - If same value clicked again -> clear
  =============================== */

  const replaceSelection = useCallback((column: string, value: any) => {
    setSelection((prev) => {
      const currentSet = prev[column];

      // if same column & same value already selected -> clear
      if (currentSet?.has(value) && Object.keys(prev).length === 1) {
        return {};
      }

      // replace entire selection with new column/value
      return {
        [column]: new Set([value]),
      };
    });
  }, []);

  /* ===============================
     Clear All
  =============================== */

  const clearSelection = useCallback(() => {
    setSelection({});
  }, []);

  /* ===============================
     Helper: isSelected
  =============================== */

  const isSelected = useCallback(
    (column: string, value: any) => {
      return selection[column]?.has(value) ?? false;
    },
    [selection]
  );

  /* ===============================
     Derived State
  =============================== */

  const hasSelection = useMemo(() => {
    return Object.values(selection).some((set) => set && set.size > 0);
  }, [selection]);

  /* ===============================
     Context Value
  =============================== */

  const value = useMemo(
    () => ({
      selection,
      replaceSelection,
      clearSelection,
      isSelected,
      hasSelection,
    }),
    [selection, replaceSelection, clearSelection, isSelected, hasSelection]
  );

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

/* =====================================================
   Hook
===================================================== */

export function useSelection() {
  const ctx = useContext(SelectionContext);

  if (!ctx) {
    throw new Error("useSelection must be used inside SelectionProvider");
  }

  return ctx;
}
