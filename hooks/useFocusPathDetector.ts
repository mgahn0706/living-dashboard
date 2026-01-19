"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

/* =======================================================
   Types
======================================================= */

type PointerSample = {
  timestamp: number;
  x: number;
  y: number;
  viewId: string;
};

type FocusDetectorConfig = {
  analysisWindowMilliseconds: number;
  maximumStoredSamples: number;
  minimumSamplesForAnalysis: number;

  idleSpeedPixelsPerSecond: number;
  idleMinimumDurationMilliseconds: number;

  circlingMinimumAngleRadians: number;
  circlingMinimumLoops: number;
  circlingMinimumRadiusPixels: number;
  circlingMaximumRadiusPixels: number;

  minimumDwellTimeForFocusMilliseconds: number;

  baseFocusGain: number;
  idleFocusGain: number;
  circlingFocusGain: number;
  passThroughPenalty: number;

  emitIntervalMilliseconds: number;

  /* ===== decay ===== */
  decayIntervalMilliseconds: number;
  decayLambdaPerSecond: number;

  /* ===== dramatic decay ===== */
  idleDecayAcceleration: number; // >1 : longer idle → faster decay

  /* ===== safety clamp ===== */
  minimumFocusScore: number; // usually 0
};

type FocusEmitter = (viewId: string, delta: number) => void;

/* =======================================================
   Hook
======================================================= */

export function useFocusPathDetector(
  emitFocusDelta: FocusEmitter,
  configOverrides?: Partial<FocusDetectorConfig>
) {
  const configuration: FocusDetectorConfig = useMemo(
    () => ({
      analysisWindowMilliseconds: 1200,
      maximumStoredSamples: 120,
      minimumSamplesForAnalysis: 10,

      idleSpeedPixelsPerSecond: 12,
      idleMinimumDurationMilliseconds: 350,

      circlingMinimumAngleRadians: Math.PI * 1.2,
      circlingMinimumLoops: 0.6,
      circlingMinimumRadiusPixels: 12,
      circlingMaximumRadiusPixels: 140,

      minimumDwellTimeForFocusMilliseconds: 180,

      baseFocusGain: 0.4,
      idleFocusGain: 1.0,
      circlingFocusGain: 1.2,
      passThroughPenalty: 0.6,

      emitIntervalMilliseconds: 120,

      /* ===== decay defaults ===== */
      decayIntervalMilliseconds: 200,
      decayLambdaPerSecond: 0.6,
      idleDecayAcceleration: 1.6,

      /* ===== safety ===== */
      minimumFocusScore: 0,

      ...configOverrides,
    }),
    [configOverrides]
  );

  const pointerSamplesRef = useRef<PointerSample[]>([]);
  const lastEmitTimestampRef = useRef<number>(0);

  const dwellTrackerRef = useRef<
    Record<string, { enterTimestamp: number; lastMoveTimestamp: number }>
  >({});

  const lastInteractionTimestampRef = useRef<Record<string, number>>({});
  const activeViewsRef = useRef<Set<string>>(new Set());

  /**
   * IMPORTANT:
   * We keep a local estimate of focus per view so we can cap negative deltas
   * and guarantee the aggregated score won't go below minimumFocusScore.
   */
  const focusEstimateRef = useRef<Record<string, number>>({});

  const safeEmit = useCallback(
    (viewId: string, delta: number) => {
      const min = configuration.minimumFocusScore;

      const current =
        focusEstimateRef.current[viewId] != null
          ? focusEstimateRef.current[viewId]
          : min;

      // Cap negative delta so (current + delta) never goes below min.
      let cappedDelta = delta;
      if (cappedDelta < 0) {
        const maxNegative = min - current; // <= 0
        if (cappedDelta < maxNegative) cappedDelta = maxNegative;
      }

      // Update local estimate (clamped)
      const next = Math.max(min, current + cappedDelta);
      focusEstimateRef.current[viewId] = next;

      // Emit to the external aggregator
      emitFocusDelta(viewId, cappedDelta);
    },
    [emitFocusDelta, configuration.minimumFocusScore]
  );

  /* =======================================================
     Pointer handler
  ======================================================= */

  const handlePointerMove = useCallback(
    (viewId: string, event: { clientX: number; clientY: number }) => {
      const now = performance.now();

      lastInteractionTimestampRef.current[viewId] = now;
      activeViewsRef.current.add(viewId);

      // Ensure estimate exists
      if (focusEstimateRef.current[viewId] == null) {
        focusEstimateRef.current[viewId] = configuration.minimumFocusScore;
      }

      /* ---------- dwell tracking ---------- */
      const dwell = dwellTrackerRef.current[viewId];
      if (!dwell) {
        dwellTrackerRef.current[viewId] = {
          enterTimestamp: now,
          lastMoveTimestamp: now,
        };
      } else {
        dwell.lastMoveTimestamp = now;
      }

      /* ---------- store pointer sample ---------- */
      pointerSamplesRef.current.push({
        timestamp: now,
        x: event.clientX,
        y: event.clientY,
        viewId,
      });

      /* ---------- limit buffer ---------- */
      if (
        pointerSamplesRef.current.length > configuration.maximumStoredSamples
      ) {
        pointerSamplesRef.current.splice(
          0,
          pointerSamplesRef.current.length - configuration.maximumStoredSamples
        );
      }

      /* ---------- sliding window ---------- */
      const cutoff = now - configuration.analysisWindowMilliseconds;
      pointerSamplesRef.current = pointerSamplesRef.current.filter(
        (s) => s.timestamp >= cutoff
      );

      /* ---------- throttle emit ---------- */
      if (
        now - lastEmitTimestampRef.current <
        configuration.emitIntervalMilliseconds
      ) {
        return;
      }
      lastEmitTimestampRef.current = now;

      const relevantSamples = pointerSamplesRef.current.filter(
        (s) => s.viewId === viewId
      );

      if (relevantSamples.length < configuration.minimumSamplesForAnalysis) {
        safeEmit(viewId, configuration.baseFocusGain);
        return;
      }

      const analysis = analyzePointerPath(relevantSamples, configuration);

      const dwellTime =
        dwellTrackerRef.current[viewId]?.lastMoveTimestamp -
        dwellTrackerRef.current[viewId]?.enterTimestamp;

      let focusDelta = configuration.baseFocusGain;

      if (analysis.isIdle) focusDelta += configuration.idleFocusGain;
      if (analysis.isCircling) focusDelta += configuration.circlingFocusGain;

      if (dwellTime < configuration.minimumDwellTimeForFocusMilliseconds) {
        focusDelta -= configuration.passThroughPenalty;
      }

      safeEmit(viewId, focusDelta);
    },
    [configuration, safeEmit]
  );

  /* =======================================================
     Dramatic decay loop (time-accelerated)
  ======================================================= */

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const now = performance.now();
      const dt = configuration.decayIntervalMilliseconds / 1000;

      for (const viewId of activeViewsRef.current) {
        const lastTs = lastInteractionTimestampRef.current[viewId];
        if (lastTs == null) continue;

        const idleTimeMs = now - lastTs;
        if (idleTimeMs < configuration.emitIntervalMilliseconds) continue;

        // Ensure estimate exists
        if (focusEstimateRef.current[viewId] == null) {
          focusEstimateRef.current[viewId] = configuration.minimumFocusScore;
        }

        let lambda = configuration.decayLambdaPerSecond;

        if (idleTimeMs > configuration.idleMinimumDurationMilliseconds) {
          const idleFactor =
            idleTimeMs / configuration.idleMinimumDurationMilliseconds;

          lambda = Math.pow(
            lambda,
            Math.pow(idleFactor, configuration.idleDecayAcceleration)
          );
        }

        const decayDelta = Math.log(lambda) * dt; // negative

        safeEmit(viewId, decayDelta);
      }
    }, configuration.decayIntervalMilliseconds);

    return () => window.clearInterval(intervalId);
  }, [configuration, safeEmit]);

  /* =======================================================
     Cleanup dwell tracker
  ======================================================= */

  useEffect(() => {
    const id = window.setInterval(() => {
      const now = performance.now();
      for (const v in dwellTrackerRef.current) {
        if (
          now - dwellTrackerRef.current[v].lastMoveTimestamp >
          configuration.analysisWindowMilliseconds
        ) {
          delete dwellTrackerRef.current[v];
        }
      }
    }, 500);

    return () => window.clearInterval(id);
  }, [configuration.analysisWindowMilliseconds]);

  return { handlePointerMove };
}

/* =======================================================
   Path analysis
======================================================= */

function analyzePointerPath(
  samples: PointerSample[],
  configuration: FocusDetectorConfig
) {
  let totalDistance = 0;

  for (let i = 1; i < samples.length; i++) {
    const dx = samples[i].x - samples[i - 1].x;
    const dy = samples[i].y - samples[i - 1].y;
    totalDistance += Math.sqrt(dx * dx + dy * dy);
  }

  const duration = samples[samples.length - 1].timestamp - samples[0].timestamp;
  const speed = (totalDistance / Math.max(1, duration)) * 1000;

  const isIdle =
    speed <= configuration.idleSpeedPixelsPerSecond &&
    duration >= configuration.idleMinimumDurationMilliseconds;

  const cx = samples.reduce((s, p) => s + p.x, 0) / samples.length;
  const cy = samples.reduce((s, p) => s + p.y, 0) / samples.length;

  const angles: number[] = [];
  const radii: number[] = [];

  for (const p of samples) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    angles.push(Math.atan2(dy, dx));
    radii.push(Math.sqrt(dx * dx + dy * dy));
  }

  let accAngle = 0;

  for (let i = 1; i < angles.length; i++) {
    let d = angles[i] - angles[i - 1];
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    accAngle += d;
  }

  const avgRadius = radii.reduce((s, r) => s + r, 0) / radii.length;
  const loops = Math.abs(accAngle) / (2 * Math.PI);

  const isCircling =
    !isIdle &&
    Math.abs(accAngle) >= configuration.circlingMinimumAngleRadians &&
    loops >= configuration.circlingMinimumLoops &&
    avgRadius >= configuration.circlingMinimumRadiusPixels &&
    avgRadius <= configuration.circlingMaximumRadiusPixels;

  return { isIdle, isCircling };
}
