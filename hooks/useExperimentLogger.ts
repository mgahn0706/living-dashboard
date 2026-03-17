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
  const sessionRef = useRef<ExperimentSession | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const createSession = useCallback(
    (
      participantId = "anonymous",
      systemType: SystemType = "LD",
      scenarioId = "default"
    ) => {
      const now = Date.now();

      return {
        meta: {
          participantId,
          systemType,
          scenarioId,
          sessionStartTime: now,
        },
        logs: [],
      } satisfies ExperimentSession;
    },
    []
  );

  /* =========================================================
     Restore from localStorage (on mount)
  ========================================================= */

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    try {
      const parsed: ExperimentSession = JSON.parse(stored);
      setSession(parsed);
      sessionRef.current = parsed;
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

  const setActiveSession = useCallback(
    (nextSession: ExperimentSession) => {
      sessionRef.current = nextSession;
      startTimeRef.current = nextSession.meta.sessionStartTime;
      setSession(nextSession);
      persist(nextSession);
    },
    [persist]
  );

  const ensureSession = useCallback(() => {
    if (sessionRef.current && startTimeRef.current) {
      return sessionRef.current;
    }

    const nextSession = createSession();
    setActiveSession(nextSession);
    return nextSession;
  }, [createSession, setActiveSession]);

  /* =========================================================
     Start Session
  ========================================================= */

  const startSession = useCallback(
    (participantId: string, systemType: SystemType, scenarioId: string) => {
      const newSession = createSession(participantId, systemType, scenarioId);
      setActiveSession(newSession);
    },
    [createSession, setActiveSession]
  );

  /* =========================================================
     Log Event
  ========================================================= */

  const logEvent = useCallback(
    (eventType: string, payload: Record<string, unknown> = {}) => {
      const activeSession = ensureSession();
      const sessionStart = startTimeRef.current ?? activeSession.meta.sessionStartTime;

      const now = Date.now();
      const timeElapsedSeconds = Math.floor((now - sessionStart) / 1000);

      const newLog: LogEntry = {
        timestamp: now,
        timeElapsedSeconds,
        eventType,
        payload,
      };

      const updated: ExperimentSession = {
        ...activeSession,
        logs: [...activeSession.logs, newLog],
      };

      sessionRef.current = updated;
      setSession(updated);
      persist(updated);
    },
    [ensureSession, persist]
  );

  /* =========================================================
     End Session
  ========================================================= */

  const endSession = useCallback(() => {
    const activeSession = sessionRef.current;
    if (!activeSession) return;

    const updated: ExperimentSession = {
      ...activeSession,
      meta: {
        ...activeSession.meta,
        sessionEndTime: Date.now(),
      },
    };

    sessionRef.current = updated;
    setSession(updated);
    persist(updated);
  }, [persist]);

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
    sessionRef.current = null;
    startTimeRef.current = null;
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const restoreSession = useCallback((nextSession: ExperimentSession | null) => {
    setSession(nextSession);
    sessionRef.current = nextSession;
    startTimeRef.current = nextSession?.meta.sessionStartTime ?? null;

    if (nextSession) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
      return;
    }

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
    restoreSession,
    getTotalDurationSeconds,
    getEventCount,
  };
}
