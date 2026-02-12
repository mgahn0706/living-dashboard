import { useCallback, useEffect, useRef, useState } from "react";

/* =========================================================
   Types
========================================================= */

export type SystemType = "LD" | "Baseline";

export interface SessionMeta {
  participantId: string;
  systemType: SystemType;
  scenarioId: string;
  sessionStartTime: number;
  sessionEndTime?: number;
}

export interface LogEntry {
  timestamp: number;
  timeElapsedSeconds: number;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface ExperimentSession {
  meta: SessionMeta;
  logs: LogEntry[];
}

/* =========================================================
   Hook
========================================================= */

export function useExperimentLogger() {
  const STORAGE_KEY = "ld_user_study_session";

  const [session, setSession] = useState<ExperimentSession | null>(null);
  const startTimeRef = useRef<number | null>(null);

  /* =========================================================
     Restore from localStorage (on mount)
  ========================================================= */

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    try {
      const parsed: ExperimentSession = JSON.parse(stored);
      setSession(parsed);
      startTimeRef.current = parsed.meta.sessionStartTime;
    } catch {
      console.warn("Failed to restore experiment session.");
    }
  }, []);

  /* =========================================================
     Persist helper
  ========================================================= */

  const persist = useCallback((data: ExperimentSession) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, []);

  /* =========================================================
     Start Session
  ========================================================= */

  const startSession = useCallback(
    (participantId: string, systemType: SystemType, scenarioId: string) => {
      const now = Date.now();

      const newSession: ExperimentSession = {
        meta: {
          participantId,
          systemType,
          scenarioId,
          sessionStartTime: now,
        },
        logs: [],
      };

      startTimeRef.current = now;
      setSession(newSession);
      persist(newSession);
    },
    [persist]
  );

  /* =========================================================
     Log Event
  ========================================================= */

  const logEvent = useCallback(
    (eventType: string, payload: Record<string, unknown> = {}) => {
      if (!session || !startTimeRef.current) return;

      const now = Date.now();
      const timeElapsedSeconds = Math.floor(
        (now - startTimeRef.current) / 1000
      );

      const newLog: LogEntry = {
        timestamp: now,
        timeElapsedSeconds,
        eventType,
        payload,
      };

      const updated: ExperimentSession = {
        ...session,
        logs: [...session.logs, newLog],
      };

      setSession(updated);
      persist(updated);
    },
    [session, persist]
  );

  /* =========================================================
     End Session
  ========================================================= */

  const endSession = useCallback(() => {
    if (!session) return;

    const updated: ExperimentSession = {
      ...session,
      meta: {
        ...session.meta,
        sessionEndTime: Date.now(),
      },
    };

    setSession(updated);
    persist(updated);
  }, [session, persist]);

  /* =========================================================
     Download JSON
  ========================================================= */

  const downloadSession = useCallback(() => {
    if (!session) return;

    const fileName = `${session.meta.participantId}_${session.meta.systemType}_${session.meta.scenarioId}.json`;

    const blob = new Blob([JSON.stringify(session, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = fileName;
    a.click();

    URL.revokeObjectURL(url);
  }, [session]);

  /* =========================================================
     Clear Session
  ========================================================= */

  const clearSession = useCallback(() => {
    setSession(null);
    startTimeRef.current = null;
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  /* =========================================================
     Helper Metrics
  ========================================================= */

  const getTotalDurationSeconds = useCallback(() => {
    if (!session?.meta.sessionEndTime) return null;

    return Math.floor(
      (session.meta.sessionEndTime - session.meta.sessionStartTime) / 1000
    );
  }, [session]);

  const getEventCount = useCallback(
    (eventType: string) => {
      if (!session) return 0;
      return session.logs.filter((l) => l.eventType === eventType).length;
    },
    [session]
  );

  /* ========================================================= */

  return {
    session,
    startSession,
    logEvent,
    endSession,
    downloadSession,
    clearSession,
    getTotalDurationSeconds,
    getEventCount,
  };
}
