"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

export type CategoryFilter = {
  column: string;
  selectedValues: Set<string>;
};

type CategoryFilterContextType = {
  categoryFilters: CategoryFilter[];
  addFilter: (column: string, initialValues?: string[]) => void;
  removeFilter: (column: string) => void;
  toggleValue: (column: string, value: string) => void;
  selectAll: (column: string, allValues: string[]) => void;
  deselectAll: (column: string) => void;
};

const CategoryFilterContext = createContext<CategoryFilterContextType | null>(null);

export function CategoryFilterProvider({ children }: { children: React.ReactNode }) {
  const [categoryFilters, setCategoryFilters] = useState<CategoryFilter[]>([]);

  const addFilter = useCallback((column: string, initialValues?: string[]) => {
    setCategoryFilters((prev) => {
      if (prev.some((f) => f.column === column)) return prev;
      return [...prev, { column, selectedValues: new Set(initialValues ?? []) }];
    });
  }, []);

  const removeFilter = useCallback((column: string) => {
    setCategoryFilters((prev) => prev.filter((f) => f.column !== column));
  }, []);

  const toggleValue = useCallback((column: string, value: string) => {
    setCategoryFilters((prev) =>
      prev.map((f) => {
        if (f.column !== column) return f;
        const next = new Set(f.selectedValues);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        return { ...f, selectedValues: next };
      })
    );
  }, []);

  const selectAll = useCallback((column: string, allValues: string[]) => {
    setCategoryFilters((prev) =>
      prev.map((f) =>
        f.column === column ? { ...f, selectedValues: new Set(allValues) } : f
      )
    );
  }, []);

  const deselectAll = useCallback((column: string) => {
    setCategoryFilters((prev) =>
      prev.map((f) =>
        f.column === column ? { ...f, selectedValues: new Set<string>() } : f
      )
    );
  }, []);

  const value = useMemo(
    () => ({ categoryFilters, addFilter, removeFilter, toggleValue, selectAll, deselectAll }),
    [categoryFilters, addFilter, removeFilter, toggleValue, selectAll, deselectAll]
  );

  return (
    <CategoryFilterContext.Provider value={value}>
      {children}
    </CategoryFilterContext.Provider>
  );
}

export function useCategoryFilter() {
  const ctx = useContext(CategoryFilterContext);
  if (!ctx) throw new Error("useCategoryFilter must be used within CategoryFilterProvider");
  return ctx;
}
