"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type SystemMode = "A" | "B";

export const SYSTEM_MODE_STORAGE_KEY = "ld_participant_mode";

type SystemModeContextType = {
  systemMode: SystemMode | null;
  hasSelectedSystemMode: boolean;
  isSystemA: boolean;
  isSystemB: boolean;
  setSystemMode: (mode: SystemMode) => void;
  clearSystemMode: () => void;
};

const SystemModeContext = createContext<SystemModeContextType | null>(null);

export function SystemModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [systemMode, setSystemModeState] = useState<SystemMode | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(SYSTEM_MODE_STORAGE_KEY);
    if (stored === "A" || stored === "B") {
      setSystemModeState(stored);
    }
  }, []);

  const setSystemMode = useCallback((mode: SystemMode) => {
    setSystemModeState(mode);
    localStorage.setItem(SYSTEM_MODE_STORAGE_KEY, mode);
  }, []);

  const clearSystemMode = useCallback(() => {
    setSystemModeState(null);
    localStorage.removeItem(SYSTEM_MODE_STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({
      systemMode,
      hasSelectedSystemMode: systemMode !== null,
      isSystemA: systemMode === "A",
      isSystemB: systemMode === "B",
      setSystemMode,
      clearSystemMode,
    }),
    [systemMode, setSystemMode, clearSystemMode]
  );

  return (
    <SystemModeContext.Provider value={value}>
      {children}
    </SystemModeContext.Provider>
  );
}

export function useSystemMode() {
  const ctx = useContext(SystemModeContext);

  if (!ctx) {
    throw new Error("useSystemMode must be used inside SystemModeProvider");
  }

  return ctx;
}
