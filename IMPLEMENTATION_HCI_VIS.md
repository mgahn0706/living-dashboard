# Living Dashboard: HCI-VIS Style Implementation Explanation

## Abstract
Living Dashboard is an adaptive visualization workspace implemented with Next.js and React. The system combines multimodal user intent signals (pointer trajectories, clicks, voice utterances, and text chat) with dataset schema context to generate real-time dashboard adaptation recommendations. The implementation follows a human-in-the-loop workflow: AI suggestions are previewed and explicitly accepted or declined by users before state mutation.

## 1. System Goal and Design Rationale
The service is designed for collaborative visual analysis where user attention and conversation evolve quickly. The core implementation objective is to reduce interaction cost while preserving user control. This is operationalized through four principles:

1. Signal-driven adaptation: infer relevance from observed interaction evidence.
2. Minimal disruption: prefer incremental view updates over full dashboard replacement.
3. Explicit agency: all AI-generated recommendations are actionable but not auto-applied.
4. Traceability: recommendation history and interaction events are logged for study and replay.

## 2. Architecture Overview
The implementation is organized into four layers.

1. Interface Layer
- Main app shell and orchestration: `app/page.tsx`
- Header and dataset ingestion entry point: `components/SiteHeader.tsx`
- Dashboard rendering surface: `components/dashboard/DashboardView.tsx`
- Per-view interaction and recommendation affordances: `components/dashboard/ViewCard.tsx`
- Right-panel control surfaces:
  - AI history and multimodal input: `components/recommendation/RecommendationSidebar.tsx`
  - Manual chart authoring/editing: `components/chartCreator/chartCreatorSidebar.tsx`

2. State and Context Layer
- Dataset and schema management: `context/DatasetContext.tsx`
- Attention modeling (focus score): `context/FocusContext.tsx`
- Cross-view selection coordination: `context/SelectionContext.tsx`

3. Adaptation Logic Layer
- Recommendation request lifecycle: `hooks/useRecommendation.ts`
- Pointer-path focus inference: `hooks/useFocusPathDetector.ts`
- Voice transcription stream: `hooks/useVoiceInput.ts`
- Prompt construction:
  - Adaptive recommendation prompt: `lib/llm/makePrompt.ts`
  - Initial dashboard construction prompt: `lib/llm/makeInitialBuildPrompt.ts`

4. Service/API Layer
- Recommendation endpoint: `app/api/recommend/route.ts`
- Initial layout generation endpoint: `app/api/initial-build/route.ts`
- Mock recommendation endpoint for local deterministic testing: `app/api/mock-recommend/route.ts`

## 3. Data Model and View Semantics
The visualization grammar is intentionally constrained for robustness.

- Types are defined in `types/dashboard.ts`.
- Supported chart types: `BAR`, `LINE`, `SCATTER`, `TABLE`.
- A dashboard is an ordered list of `View` objects with explicit `priority`.
- Recommendation actions are constrained to:
  - `REORDER`
  - `RESIZE`
  - `NEW_CONTENT`
  - `MODIFY_CONTENT`
  - `REMOVE_CONTENT`

In `app/page.tsx`, view normalization functions (`normalizeViewUpdate`, `buildNewViewFromPayload`) enforce safe conversions between table and chart forms, preventing malformed payloads from directly corrupting UI state.

## 4. Dataset Ingestion and Schema Extraction
Dataset ingestion is initiated from the header upload control (`components/SiteHeader.tsx`) and executed in `context/DatasetContext.tsx`.

### Supported formats
- JSON
- CSV
- XLSX

### Preprocessing pipeline
1. Parse raw file (`parseCSV`, `parseXLSX`, JSON parse).
2. Extract nested attribute paths (`extractKeysRecursive`).
3. Build hierarchical schema tree (`buildSchema`).
4. Infer primitive attribute types (`detectPrimitiveType`) using thresholded heuristics for number/date/string.
5. Persist:
- `rawData`
- `attributeKeys`
- `attributeTypes`
- `schema`

This schema metadata is then injected into LLM prompts for both initial view synthesis and later adaptation recommendations.

## 5. Interaction Evidence and Focus Modeling
Attention is estimated through a continuous focus signal implemented by `hooks/useFocusPathDetector.ts` and exposed through `context/FocusContext.tsx`.

### Evidence channels
1. Pointer path features
- Speed-based idle detection
- Circling detection from cumulative angular change and radius bounds
- Dwell-time-aware pass-through penalty

2. Click events
- Immediate positive focus gain
- Optional dwell bonus for deliberate clicks

3. Temporal decay
- Exponential decay with configurable half-life (`focusHalfLifeSeconds`)
- Idle-accelerated decay to prevent stale focus accumulation
- Lower-bound clamping (`minimumFocusScore`) to keep scores non-negative

The resulting per-view `focusScore` map is consumed in recommendation prompt generation and shown in each `ViewCard` for user interpretability.

## 6. Multimodal Intent Capture
Intent capture is split across voice and text.

### Voice
`hooks/useVoiceInput.ts` wraps Web Speech API recognition with:
- Continuous listening mode
- Interim transcript display
- Final utterance capture with language tags (`en-US`, `ko-KR`, `ja-JP`)
- Auto-restart behavior for long sessions

### Text
Text chat messages are collected in `app/page.tsx` and merged with voice utterances in `components/recommendation/RecommendationSidebar.tsx` for a unified conversational timeline.

Both channels trigger recommendation refresh through `triggerRecommendation(...)` in `hooks/useRecommendation.ts`.

## 7. Recommendation Generation Pipeline
The recommendation pipeline has strict structure and defensive parsing.

### Client-side trigger
`hooks/useRecommendation.ts`
1. Build prompt via `makePrompt(...)` with:
- current views
- current focus scores
- recent voice utterances
- text chat history
- dataset schema
2. POST to `/api/recommend`.
3. Filter out already dismissed recommendation IDs.

### Server-side generation
`app/api/recommend/route.ts`
1. Receive prompt payload.
2. Call OpenAI Responses API (`gpt-4.1-mini`).
3. Enforce strict JSON parse.
4. On malformed output, return empty list as safe fallback.

### Prompt-level safeguards
`lib/llm/makePrompt.ts` explicitly constrains output:
- JSON array only
- bounded action vocabulary
- valid chart types only
- unique recommendation IDs
- requirement of `targetViewId` for existing-view modifications
- incremental change policy (up to 3 recommendations)

## 8. Human-in-the-Loop Adaptation and Preview
Recommendations are never auto-committed.

### Preview mechanism
- Hovering a recommendation computes preview state in `app/page.tsx` (`previewMap`, `addPreview`).
- `ViewCard` renders overlays for three outcomes:
  - modify preview
  - remove preview
  - add preview

### Commit mechanism
On explicit apply, `app/page.tsx` executes typed mutation logic:
- `MODIFY_CONTENT` and `RESIZE`: normalized view updates
- `REORDER`: priority rewrite + stable sort
- `NEW_CONTENT`: generated new view with next priority
- `REMOVE_CONTENT`: target view removal

### Rollback
A recommendation history stack stores pre-mutation snapshots (`_prevViews`) enabling one-step undo from `RecommendationSidebar`.

## 9. Visualization Rendering and Coordinated Selection
`components/dashboard/ChartRenderer.tsx` handles rendering and linked highlighting.

### Rendering features
- Recharts-based `BAR`, `LINE`(Area), and `SCATTER`
- Typed x-axis inference for category/number/date
- Epoch/date-string normalization and date tick formatting
- Aggregation by x-key for `LINE` and `BAR`

### Selection model
`context/SelectionContext.tsx` uses a single active-dimension replace model:
- selecting one datum filters/highlights matching rows/marks across all views
- selecting the same value again clears state

This design favors interpretability over complex multi-filter interactions, aligning with low-friction collaboration.

## 10. Initial Dashboard Synthesis
When no views are present, users can initialize with LLM support (`Initialize dashboard with LLM` in `DashboardView`).

Flow:
1. `app/page.tsx` posts `attributeKeys`, `attributeTypes`, and schema to `/api/initial-build`.
2. `app/api/initial-build/route.ts` builds a constrained prompt (`makeInitialBuildPrompt.ts`).
3. LLM returns 3-5 candidate views as JSON.
4. Client normalizes and inserts generated views with descending priority.

## 11. Instrumentation for HCI Evaluation
`hooks/useExperimentLogger.ts` provides experiment-session logging with:
- participant/system/scenario metadata
- timestamped events (e.g., recommendation shown/accepted/declined, view select/modify/delete, text/voice activity)
- local persistence via `localStorage`
- JSON export for post-hoc analysis

This supports comparative studies (e.g., adaptive system vs baseline) without additional backend infrastructure.

## 12. Reliability and Failure Handling
The implementation includes defensive patterns:

1. Strict JSON gate for LLM responses in both API routes.
2. Safe fallback to empty recommendation lists on parse errors.
3. Type-safe view construction utilities to isolate ambiguous payload handling.
4. Unsupported browser speech API detection with graceful degradation.
5. Non-destructive recommendation dismissal and explicit user confirmation before application.

## 13. Implementation Tradeoffs and Current Constraints
1. Local in-memory dashboard state favors interaction speed but is non-persistent across page reloads.
2. CSV parsing is simple and may not handle quoted commas/edge dialects.
3. Recommendation quality is tightly coupled to LLM compliance with strict JSON instructions.
4. Focus score calibration currently uses hand-tuned heuristics; task-specific retuning may improve robustness.
5. Selection model intentionally limits complexity (single active dimension).

## 14. Reproducibility Notes
Minimum runtime requirements:
- Node.js runtime compatible with Next.js 15
- `OPENAI_API_KEY` configured for live recommendation and initial-build endpoints

Local run:
```bash
npm install
npm run dev
```

If no API key is available, `/api/mock-recommend` can be used for deterministic recommendation behavior during interface testing.

## 15. Summary
The service implements an HCI/VIS-oriented adaptive dashboard architecture that couples multimodal interaction evidence with constrained LLM reasoning. The codebase emphasizes controllable adaptation, explicit user agency, and experiment-ready instrumentation, making it suitable for both deployment prototyping and user-study settings.
