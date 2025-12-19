"use client";

import {
  ChartId,
  InteractionPattern,
  ChartSeries,
  InteractionState,
} from "@/types/types";
import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
  useRef,
  useCallback,
  useMemo,
} from "react";

// --- CONFIGURATION ---
const EWMA_ALPHA = 0.15;
const TICK_RATE_MS = 100;
const TARGET_HOVER = 100;
const TARGET_IDLE = 0;
const CLICK_BOOST = 60;
const THRESHOLD_FOCUS = 60;
const THRESHOLD_COMPARE = 40;
const SORT_HYSTERESIS = 5;

// --- Logic ---
const determinePattern = (
  scores: Record<ChartId, number>
): InteractionPattern => {
  const values = Object.values(scores);
  if (values.length === 0) return "EXPLORATION";
  const maxScore = Math.max(...values);
  const highInterestCount = values.filter((v) => v >= THRESHOLD_COMPARE).length;
  if (highInterestCount >= 2) return "COMPARISON";
  if (maxScore >= THRESHOLD_FOCUS) return "FOCUS";
  return "EXPLORATION";
};

// --- Types ---
type Action =
  | { type: "CLICK_CHART"; chartId: ChartId }
  | { type: "ADD_CHART"; chart: ChartSeries }
  | {
      type: "TICK_UPDATE";
      newScores: Record<ChartId, number>;
      newPendingRankedIds: ChartId[];
    }
  | { type: "CONFIRM_LAYOUT" };

interface State extends InteractionState {
  rankedIds: ChartId[];
  pendingRankedIds: ChartId[];
  pendingPattern: InteractionPattern;
  hasPendingUpdate: boolean;
}

const initialState: State = {
  scores: {},
  pattern: "EXPLORATION",
  pendingPattern: "EXPLORATION",
  activeCharts: [],
  rankedIds: [],
  pendingRankedIds: [],
  hasPendingUpdate: false,
  hoveredId: null,
};

const interactionReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "CLICK_CHART": {
      const current = state.scores[action.chartId] || 0;
      return {
        ...state,
        scores: {
          ...state.scores,
          [action.chartId]: Math.min(current + CLICK_BOOST, 100),
        },
      };
    }
    case "ADD_CHART":
      return {
        ...state,
        activeCharts: [...state.activeCharts, action.chart],
        rankedIds: [...state.rankedIds, action.chart.id],
        pendingRankedIds: [...state.pendingRankedIds, action.chart.id],
        scores: { ...state.scores, [action.chart.id]: 0 },
      };
    case "TICK_UPDATE": {
      const suggestedPattern = determinePattern(action.newScores);
      const isPatternDifferent = suggestedPattern !== state.pattern;
      const currentOrderStr = state.rankedIds.join(",");
      const newOrderStr = action.newPendingRankedIds.join(",");
      const isOrderDifferent = currentOrderStr !== newOrderStr;

      return {
        ...state,
        scores: action.newScores,
        pendingRankedIds: action.newPendingRankedIds,
        pendingPattern: suggestedPattern,
        hasPendingUpdate: isPatternDifferent || isOrderDifferent,
      };
    }
    case "CONFIRM_LAYOUT":
      return {
        ...state,
        pattern: state.pendingPattern,
        rankedIds: state.pendingRankedIds,
        hasPendingUpdate: false,
      };
    default:
      return state;
  }
};

// --- SPLIT CONTEXTS ---

// 1. Layout Context (Stable: Updates rarely)
interface LayoutContextProps {
  sortedCharts: ChartSeries[];
  pattern: InteractionPattern;
  pendingPattern: InteractionPattern;
  hasPendingUpdate: boolean;
  confirmLayout: () => void;
  addChartToPool: (chart: ChartSeries) => void;
}
const LayoutContext = createContext<LayoutContextProps | undefined>(undefined);

// 2. Interaction Context (Volatile: Updates 10x/sec)
interface InteractionContextProps {
  scores: Record<ChartId, number>;
  setHover: (id: ChartId | null) => void;
  clickChart: (id: ChartId) => void;
}
const InteractionContext = createContext<InteractionContextProps | undefined>(
  undefined
);

export const InteractionProvider = ({
  children,
  initialCharts,
}: {
  children: ReactNode;
  initialCharts: ChartSeries[];
}) => {
  const [state, dispatch] = useReducer(interactionReducer, {
    ...initialState,
    activeCharts: initialCharts,
    rankedIds: initialCharts.map((c) => c.id),
    pendingRankedIds: initialCharts.map((c) => c.id),
    scores: initialCharts.reduce((acc, chart) => {
      acc[chart.id] = 0;
      return acc;
    }, {} as Record<string, number>),
  });

  const hoveredIdRef = useRef<ChartId | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // --- TICK LOOP ---
  useEffect(() => {
    const timer = setInterval(() => {
      const { scores, activeCharts, pendingRankedIds } = stateRef.current;
      const currentHoveredId = hoveredIdRef.current;

      const newScores: Record<string, number> = {};
      let hasScoreChanged = false;

      activeCharts.forEach((chart) => {
        const currentScore = scores[chart.id] || 0;
        const target =
          chart.id === currentHoveredId ? TARGET_HOVER : TARGET_IDLE;
        let nextScore = currentScore + EWMA_ALPHA * (target - currentScore);
        if (Math.abs(nextScore - target) < 0.5) nextScore = target;
        newScores[chart.id] = nextScore;
        if (Math.abs(nextScore - currentScore) > 0.1) hasScoreChanged = true;
      });

      let newPendingRankedIds = [...pendingRankedIds];
      let hasRankChanged = false;

      if (hasScoreChanged) {
        for (let i = 0; i < newPendingRankedIds.length - 1; i++) {
          const idA = newPendingRankedIds[i];
          const idB = newPendingRankedIds[i + 1];
          const scoreA = newScores[idA] || 0;
          const scoreB = newScores[idB] || 0;
          if (scoreB > scoreA + SORT_HYSTERESIS) {
            newPendingRankedIds[i] = idB;
            newPendingRankedIds[i + 1] = idA;
            hasRankChanged = true;
          }
        }
      }

      if (hasScoreChanged || hasRankChanged) {
        dispatch({
          type: "TICK_UPDATE",
          newScores,
          newPendingRankedIds: newPendingRankedIds,
        });
      }
    }, TICK_RATE_MS);

    return () => clearInterval(timer);
  }, []);

  // --- ACTIONS ---
  const setHover = useCallback((id: ChartId | null) => {
    hoveredIdRef.current = id;
  }, []);
  const clickChart = useCallback(
    (id: ChartId) => dispatch({ type: "CLICK_CHART", chartId: id }),
    []
  );
  const addChartToPool = useCallback(
    (c: ChartSeries) => dispatch({ type: "ADD_CHART", chart: c }),
    []
  );
  const confirmLayout = useCallback(
    () => dispatch({ type: "CONFIRM_LAYOUT" }),
    []
  );

  // --- DERIVED DATA ---
  const sortedCharts = useMemo(() => {
    return state.rankedIds
      .map((id) => state.activeCharts.find((c) => c.id === id))
      .filter((c): c is ChartSeries => !!c);
  }, [state.rankedIds, state.activeCharts]);

  // --- MEMOIZED CONTEXT VALUES ---
  // Only updates when Layout changes
  const layoutValue = useMemo(
    () => ({
      sortedCharts,
      pattern: state.pattern,
      pendingPattern: state.pendingPattern,
      hasPendingUpdate: state.hasPendingUpdate,
      confirmLayout,
      addChartToPool,
    }),
    [
      sortedCharts,
      state.pattern,
      state.pendingPattern,
      state.hasPendingUpdate,
      confirmLayout,
      addChartToPool,
    ]
  );

  // Updates frequently (Scores)
  const interactionValue = useMemo(
    () => ({
      scores: state.scores,
      setHover,
      clickChart,
    }),
    [state.scores, setHover, clickChart]
  );

  return (
    <LayoutContext.Provider value={layoutValue}>
      <InteractionContext.Provider value={interactionValue}>
        {children}
      </InteractionContext.Provider>
    </LayoutContext.Provider>
  );
};

// --- HOOKS ---
export const useLayoutContext = () => {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayoutContext missing");
  return ctx;
};

export const useInteractionContext = () => {
  const ctx = useContext(InteractionContext);
  if (!ctx) throw new Error("useInteractionContext missing");
  return ctx;
};

// Backwards compatibility (but try to avoid using this if possible)
export const useInteraction = () => {
  const layout = useLayoutContext();
  const interaction = useInteractionContext();
  return { ...layout, ...interaction };
};
