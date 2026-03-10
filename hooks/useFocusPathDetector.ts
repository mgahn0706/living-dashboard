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
  /* ===== short-term gesture window (keep small) ===== */
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

  /* ===== click ===== */
  clickFocusGain: number;
  clickDwellBonus: number;

  emitIntervalMilliseconds: number;

  /* ===== decay (long-term context memory) ===== */
  decayIntervalMilliseconds: number;

  /**
   * NEW: Half-life of focus memory in seconds.
   * Example: 60 means focus decays to 50% in ~1 minute (without idle acceleration).
   */
  focusHalfLifeSeconds: number;

  /**
   * (Optional) If you explicitly set this, it overrides focusHalfLifeSeconds.
   * Keep for backward compatibility.
   */
  decayLambdaPerSecond?: number;

  /**
   * Delay before idle decay acceleration kicks in.
   * Keeps the current focus view visually stable for a short idle window.
   */
  idleDecayGracePeriodMilliseconds: number;

  /* ===== dramatic decay ===== */
  idleDecayAcceleration: number; // >1 : longer idle → faster decay

  /* ===== safety clamp ===== */
  initialFocusScore: number; // initial baseline (e.g., medium)
  minimumFocusScore: number; // usually 0
};

type FocusEmitter = (viewId: string, delta: number) => void;

/* =======================================================
   Helpers
======================================================= */

function lambdaFromHalfLifeSeconds(halfLifeSeconds: number) {
  const hl = Math.max(1, halfLifeSeconds);
  // exp(-k) form: lambda = 0.5^(1/hl)
  return Math.pow(0.5, 1 / hl);
}

/* =======================================================
   Hook
======================================================= */

export function useFocusPathDetector(
  emitFocusDelta: FocusEmitter,
  configOverrides?: Partial<FocusDetectorConfig>
) {
  const configuration: FocusDetectorConfig = useMemo(() => {
    const base: FocusDetectorConfig = {
      /* ===== short-term gesture window ===== */
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

      /* ===== click defaults ===== */
      clickFocusGain: 2.4,
      clickDwellBonus: 0.8,

      emitIntervalMilliseconds: 120,

      /* ===== decay defaults (longer context memory) ===== */
      decayIntervalMilliseconds: 200,
      focusHalfLifeSeconds: 180, // ~3 minutes half-life for longer context
      idleDecayGracePeriodMilliseconds: 45_000, // ~45s before blur starts to noticeably build

      /* ===== dramatic decay ===== */
      idleDecayAcceleration: 1.2,

      /* ===== safety ===== */
      initialFocusScore: 1000,
      minimumFocusScore: 0,
    };

    const merged = { ...base, ...configOverrides };

    // If decayLambdaPerSecond is not provided, derive from half-life.
    if (merged.decayLambdaPerSecond == null) {
      merged.decayLambdaPerSecond = lambdaFromHalfLifeSeconds(
        merged.focusHalfLifeSeconds
      );
    }

    return merged;
  }, [configOverrides]);

  const pointerSamplesRef = useRef<PointerSample[]>([]);
  const lastEmitTimestampRef = useRef<number>(0);

  const dwellTrackerRef = useRef<
    Record<string, { enterTimestamp: number; lastMoveTimestamp: number }>
  >({});

  const lastInteractionTimestampRef = useRef<Record<string, number>>({});
  const activeViewsRef = useRef<Set<string>>(new Set());

  /**
   * We keep a local estimate of focus per view so we can cap negative deltas
   * and guarantee the aggregated score won't go below minimumFocusScore.
   */
  const focusEstimateRef = useRef<Record<string, number>>({});

  const safeEmit = useCallback(
    (viewId: string, delta: number) => {
      const min = configuration.minimumFocusScore;
      const initial = Math.max(min, configuration.initialFocusScore);

      const current =
        focusEstimateRef.current[viewId] != null
          ? focusEstimateRef.current[viewId]
          : initial;

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
        focusEstimateRef.current[viewId] = Math.max(
          configuration.minimumFocusScore,
          configuration.initialFocusScore
        );
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

      /* ---------- sliding window (short-term) ---------- */
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
     Click handler (strong explicit focus signal)
  ======================================================= */

  const handleClick = useCallback(
    (viewId: string) => {
      const now = performance.now();

      lastInteractionTimestampRef.current[viewId] = now;
      activeViewsRef.current.add(viewId);

      // Ensure estimate exists
      if (focusEstimateRef.current[viewId] == null) {
        focusEstimateRef.current[viewId] = Math.max(
          configuration.minimumFocusScore,
          configuration.initialFocusScore
        );
      }

      let delta = configuration.clickFocusGain;

      // Optional: amplify click if user already dwelled on the view
      const dwell = dwellTrackerRef.current[viewId];
      if (dwell) {
        const dwellTime = dwell.lastMoveTimestamp - dwell.enterTimestamp;
        if (dwellTime >= configuration.minimumDwellTimeForFocusMilliseconds) {
          delta += configuration.clickDwellBonus;
        }
      }

      safeEmit(viewId, delta);
    },
    [configuration, safeEmit]
  );

  /* =======================================================
     Long-term decay loop (1-minute+ context memory)
  ======================================================= */

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const now = performance.now();
      const dt = configuration.decayIntervalMilliseconds / 1000;

      const baseLambdaPerSecond =
        configuration.decayLambdaPerSecond ??
        lambdaFromHalfLifeSeconds(configuration.focusHalfLifeSeconds);

      for (const viewId of activeViewsRef.current) {
        const lastTs = lastInteractionTimestampRef.current[viewId];
        if (lastTs == null) continue;

        const idleTimeMs = now - lastTs;

        // Avoid decaying immediately after an interaction (small grace)
        if (idleTimeMs < configuration.emitIntervalMilliseconds) continue;

        // Ensure estimate exists
        if (focusEstimateRef.current[viewId] == null) {
          focusEstimateRef.current[viewId] = Math.max(
            configuration.minimumFocusScore,
            configuration.initialFocusScore
          );
        }

        // Base long-term decay (half-life ~ focusHalfLifeSeconds)
        let lambda = baseLambdaPerSecond;

        // Hold focus steady for a while, then ramp decay after sustained idle.
        if (idleTimeMs > configuration.idleDecayGracePeriodMilliseconds) {
          const acceleratedIdleMs =
            idleTimeMs - configuration.idleDecayGracePeriodMilliseconds;
          const idleFactor =
            acceleratedIdleMs / configuration.idleMinimumDurationMilliseconds;

          // Make decay faster as idle grows (dramatic decay)
          lambda = Math.pow(
            lambda,
            Math.pow(Math.max(1, idleFactor), configuration.idleDecayAcceleration)
          );
        }

        // Convert multiplicative decay to additive delta in log space
        // (keeps stable for small dt and composes well)
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

  return { handlePointerMove, handleClick };
}

/* =======================================================
   Path analysis (short-term gesture features)
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
