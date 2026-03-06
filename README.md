# Living Dashboard

An adaptive visualization workspace that uses multimodal user intent signals — pointer trajectories, clicks, voice utterances, and text chat — combined with dataset schema context to generate real-time dashboard adaptation recommendations. The system follows a human-in-the-loop workflow where AI suggestions are previewed and explicitly accepted or declined before any state mutation.

## Features

- **Multimodal Intent Capture** — voice input (Web Speech API), text chat, pointer tracking, and click-based focus scoring with temporal decay
- **AI-Driven Adaptation** — LLM-powered recommendations (OpenAI gpt-4.1-mini) for reordering, resizing, adding, modifying, filtering, or removing views
- **Human-in-the-Loop** — recommendations are previewed on hover and only applied on explicit user acceptance, with one-step undo
- **Data Ingestion** — supports JSON, CSV, and XLSX uploads with automatic schema extraction and type detection
- **Visualization** — bar, line, scatter, pie charts and tables via Recharts with coordinated cross-view selection and linked highlighting
- **Initial Dashboard Synthesis** — LLM generates 3–5 starter views from dataset schema when the dashboard is empty
- **Experiment Logging** — timestamped event logging with localStorage persistence and JSON export for HCI user studies
- **Manual Chart Authoring** — sidebar for creating and editing charts without AI assistance

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Framework | Next.js 15, React 19, TypeScript |
| Styling | Tailwind CSS 4, Radix UI, Framer Motion |
| Visualization | Recharts, D3.js |
| AI | OpenAI API (gpt-4.1-mini) |
| Interaction | @dnd-kit (drag-and-drop), Web Speech API, react-resizable-panels |
| Data | XLSX parser, custom CSV parser |

## Getting Started

### Prerequisites

- Node.js (compatible with Next.js 15)
- An OpenAI API key (optional — mock recommendations available without it)

### Installation

```bash
cd living-dashboard
npm install
```

### Environment Variables

Create a `.env.local` file in the `living-dashboard` directory:

```
OPENAI_API_KEY=your_openai_api_key_here
```

If no API key is available, the `/api/mock-recommend` endpoint can be used for deterministic testing.

### Running

```bash
# Development server (http://localhost:3000)
npm run dev

# Production build
npm run build
npm start

# Lint
npm run lint
```

## Project Structure

```
living-dashboard/
├── app/
│   ├── page.tsx                    # Main orchestration & state management
│   ├── layout.tsx                  # Root layout with metadata
│   ├── globals.css                 # Global styles
│   └── api/
│       ├── recommend/route.ts      # LLM recommendation endpoint
│       ├── initial-build/route.ts  # Initial dashboard synthesis endpoint
│       └── mock-recommend/route.ts # Mock recommendations for testing
│
├── components/
│   ├── SiteHeader.tsx              # Header with dataset upload controls
│   ├── dashboard/
│   │   ├── DashboardView.tsx       # Dashboard grid layout
│   │   ├── ViewCard.tsx            # Individual chart/table card
│   │   └── ChartRenderer.tsx       # Recharts-based chart rendering
│   ├── recommendation/
│   │   └── RecommendationSidebar.tsx  # AI recommendations & input
│   ├── chartCreator/
│   │   └── chartCreatorSidebar.tsx    # Manual chart creation
│   └── ui/                         # Shadcn/Radix UI primitives
│
├── context/
│   ├── DatasetContext.tsx          # Dataset ingestion & schema extraction
│   ├── FocusContext.tsx            # Attention/focus scoring
│   └── SelectionContext.tsx        # Cross-view selection coordination
│
├── hooks/
│   ├── useRecommendation.ts       # Recommendation request lifecycle
│   ├── useFocusPathDetector.ts    # Pointer path analysis
│   ├── useVoiceInput.ts           # Web Speech API integration
│   └── useExperimentLogger.ts     # HCI experiment event logging
│
├── lib/
│   └── llm/
│       ├── makePrompt.ts          # Adaptive recommendation prompt
│       └── makeInitialBuildPrompt.ts  # Initial dashboard prompt
│
├── types/
│   └── dashboard.ts               # TypeScript type definitions
│
└── data/                          # Sample datasets
```

## Architecture

The system is organized into four layers:

1. **Interface Layer** — React components for the dashboard surface, view cards, sidebars, and header
2. **State & Context Layer** — React Context providers for dataset, focus scores, and cross-view selection
3. **Adaptation Logic Layer** — custom hooks for recommendation lifecycle, focus detection, and voice input
4. **Service/API Layer** — Next.js API routes for LLM communication with strict JSON parsing and safe fallbacks

### Recommendation Actions

| Action | Description |
|--------|-------------|
| `REORDER` | Adjust view priority/position |
| `RESIZE` | Change view size (sm, md, lg) |
| `NEW_CONTENT` | Add a new visualization |
| `MODIFY_CONTENT` | Change chart type or axes |
| `MODIFY_FILTER` | Apply or remove filters |
| `REMOVE_CONTENT` | Delete a redundant view |

### Design Principles

- **Signal-driven adaptation** — infer relevance from observed interaction evidence
- **Minimal disruption** — prefer incremental view updates over full dashboard replacement
- **Explicit agency** — all AI-generated recommendations are actionable but never auto-applied
- **Traceability** — recommendation history and interaction events are logged for study and replay

## Known Constraints

- Dashboard state is in-memory and resets on page reload
- CSV parsing uses simple splitting (may not handle quoted commas)
- Recommendation quality depends on LLM compliance with strict JSON instructions
- Focus score calibration uses hand-tuned heuristics
- Selection model is single active-dimension (intentional simplicity)

## License

Private
