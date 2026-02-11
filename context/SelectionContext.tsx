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

  /** toggle a single value for a column */
  toggleSelection: (column: string, value: any) => void;

  /** completely clear all selections */
  clearSelection: () => void;

  /** clear selection for a specific column */
  clearColumn: (column: string) => void;

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
     Toggle Selection
  =============================== */

  const toggleSelection = useCallback((column: string, value: any) => {
    console.log("toggleSelection", column, value);
    setSelection((prev) => {
      const currentSet = new Set(prev[column] ?? []);

      if (currentSet.has(value)) {
        currentSet.delete(value);
      } else {
        currentSet.add(value);
      }

      return {
        ...prev,
        [column]: currentSet,
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
     Clear Single Column
  =============================== */

  const clearColumn = useCallback((column: string) => {
    setSelection((prev) => {
      const next = { ...prev };
      delete next[column];
      return next;
    });
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
      toggleSelection,
      clearSelection,
      clearColumn,
      isSelected,
      hasSelection,
    }),
    [
      selection,
      toggleSelection,
      clearSelection,
      clearColumn,
      isSelected,
      hasSelection,
    ]
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
