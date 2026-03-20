"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

export type TimeFilter = {
  column: string;
  min: number; // timestamp ms
  max: number; // timestamp ms
};

type TimeFilterContextType = {
  timeFilter: TimeFilter | null;
  setTimeFilter: (filter: TimeFilter | null) => void;
  selectedColumn: string | null;
  setSelectedColumn: (column: string | null) => void;
};

const TimeFilterContext = createContext<TimeFilterContextType | null>(null);

export function TimeFilterProvider({ children }: { children: React.ReactNode }) {
  const [timeFilter, setTimeFilterState] = useState<TimeFilter | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<string | null>("Created Date");

  const setTimeFilter = useCallback((filter: TimeFilter | null) => {
    setTimeFilterState(filter);
  }, []);

  const value = useMemo(
    () => ({ timeFilter, setTimeFilter, selectedColumn, setSelectedColumn }),
    [timeFilter, setTimeFilter, selectedColumn]
  );

  return (
    <TimeFilterContext.Provider value={value}>
      {children}
    </TimeFilterContext.Provider>
  );
}

export function useTimeFilter() {
  const ctx = useContext(TimeFilterContext);
  if (!ctx) throw new Error("useTimeFilter must be used within TimeFilterProvider");
  return ctx;
}
