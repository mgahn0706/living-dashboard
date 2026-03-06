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

export type LassoFilter = {
  xColumn: string;
  yColumn: string;
  polygon: Array<{ x: number; y: number }>;
};

type SelectionContextType = {
  selection: SelectionState;

  /** Range filter for scatter brushing */
  rangeFilter: RangeFilter | null;

  /** Lasso filter for freehand scatter selection */
  lassoFilter: LassoFilter | null;

  /** replace selection (single active dimension model) */
  replaceSelection: (column: string, value: any) => void;

  /** add/toggle a value in the current selection (Ctrl+Click) */
  addToSelection: (column: string, value: any) => void;

  /** set brush/range selection (clears discrete selection) */
  setBrushSelection: (range: RangeFilter | null) => void;

  /** set lasso selection (clears discrete + range selection) */
  setLassoSelection: (lasso: LassoFilter | null) => void;

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
  const [lassoFilter, setLassoFilter] = useState<LassoFilter | null>(null);

  /* ===============================
     Replace Selection
     - Always keep only ONE column
     - If same value clicked again -> clear
     - Clears range filter
  =============================== */

  const replaceSelection = useCallback((column: string, value: any) => {
    setRangeFilter(null);
    setLassoFilter(null);
    setSelection(() => {
      return {
        [column]: new Set([value]),
      };
    });
  }, []);

  /* ===============================
     Add to Selection (Ctrl+Click)
     - Toggle value on same column
     - If different column, start fresh
  =============================== */

  const addToSelection = useCallback((column: string, value: any) => {
    setRangeFilter(null);
    setLassoFilter(null);
    setSelection((prev) => {
      const existingColumns = Object.keys(prev);
      if (existingColumns.length > 0 && !prev[column]) {
        return { [column]: new Set([value]) };
      }
      const existing = prev[column] ?? new Set();
      const next = new Set(existing);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      if (next.size === 0) return {};
      return { [column]: next };
    });
  }, []);

  /* ===============================
     Brush Selection
     - Sets range filter
     - Clears discrete selection
  =============================== */

  const setBrushSelection = useCallback((range: RangeFilter | null) => {
    setSelection({});
    setLassoFilter(null);
    setRangeFilter(range);
  }, []);

  /* ===============================
     Lasso Selection
     - Sets lasso filter
     - Clears discrete + range selection
  =============================== */

  const setLassoSelection = useCallback((lasso: LassoFilter | null) => {
    setSelection({});
    setRangeFilter(null);
    setLassoFilter(lasso);
  }, []);

  /* ===============================
     Clear All
  =============================== */

  const clearSelection = useCallback(() => {
    setSelection({});
    setRangeFilter(null);
    setLassoFilter(null);
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
    if (lassoFilter) return true;
    return Object.values(selection).some((set) => set && set.size > 0);
  }, [selection, rangeFilter, lassoFilter]);

  /* ===============================
     Context Value
  =============================== */

  const value = useMemo(
    () => ({
      selection,
      rangeFilter,
      lassoFilter,
      replaceSelection,
      addToSelection,
      setBrushSelection,
      setLassoSelection,
      clearSelection,
      isSelected,
      hasSelection,
    }),
    [selection, rangeFilter, lassoFilter, replaceSelection, addToSelection, setBrushSelection, setLassoSelection, clearSelection, isSelected, hasSelection]
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
