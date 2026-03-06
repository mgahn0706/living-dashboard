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

export type RangeFilter = {
  xColumn: string;
  yColumn: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
};

type SelectionContextType = {
  selection: SelectionState;

  /** Range filter for scatter brushing */
  rangeFilter: RangeFilter | null;

  /** replace selection (single active dimension model) */
  replaceSelection: (column: string, value: any) => void;

  /** set brush/range selection (clears discrete selection) */
  setBrushSelection: (range: RangeFilter | null) => void;

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
  const [rangeFilter, setRangeFilter] = useState<RangeFilter | null>(null);

  /* ===============================
     Replace Selection
     - Always keep only ONE column
     - If same value clicked again -> clear
     - Clears range filter
  =============================== */

  const replaceSelection = useCallback((column: string, value: any) => {
    setRangeFilter(null);
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
     Brush Selection
     - Sets range filter
     - Clears discrete selection
  =============================== */

  const setBrushSelection = useCallback((range: RangeFilter | null) => {
    setSelection({});
    setRangeFilter(range);
  }, []);

  /* ===============================
     Clear All
  =============================== */

  const clearSelection = useCallback(() => {
    setSelection({});
    setRangeFilter(null);
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
    if (rangeFilter) return true;
    return Object.values(selection).some((set) => set && set.size > 0);
  }, [selection, rangeFilter]);

  /* ===============================
     Context Value
  =============================== */

  const value = useMemo(
    () => ({
      selection,
      rangeFilter,
      replaceSelection,
      setBrushSelection,
      clearSelection,
      isSelected,
      hasSelection,
    }),
    [selection, rangeFilter, replaceSelection, setBrushSelection, clearSelection, isSelected, hasSelection]
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
