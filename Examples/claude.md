# Claude Code Instructions: AI Recommendation Reliability

## Context
This dashboard has an AI recommendation system where users ask questions (voice or text) 
and the AI suggests actions to take on the dashboard visuals so the user can find the 
answer themselves. The AI should never answer questions directly — it guides the user 
to the answer through dashboard interactions.

## Available Actions on Visuals
The only actions a user can physically perform on visuals are:
- **Click** — applicable to all visuals
- **Drill-down** — applicable to one specific bar chart only

The AI recommendation types reflect dashboard-level and visual-level operations:
- `REORDER` — change the layout position of a visual on the dashboard
- `RESIZE` — change the size of a visual
- `NEW_CONTENT` — add a new visual to the dashboard
- `REMOVE_CONTENT` — remove a visual from the dashboard
- `MODIFY_CONTENT` — change what a visual displays (chart type, fields, aggregation)
- `MODIFY_FILTER` — apply or change a filter on a visual

## Problems to Fix

### Problem 1: AI acts on unrelated visuals
The AI applies recommendations (especially `MODIFY_FILTER`) to visuals that have no 
relevance to the user's question. For example, asking about revenue by product causes 
the AI to suggest filter changes on a map or a time-series chart.

**Goal:** The AI should only recommend actions on visuals whose data fields are 
relevant to what the user is asking about. Add a relevance pre-scoring step before 
the LLM call that evaluates each visual's fields against the user's question, and 
pass this into the prompt. Instruct the LLM to ignore low-relevance visuals.

### Problem 2: Inconsistent recommendations between runs
Asking the same question twice produces different recommendations. The AI is making 
too many decisions simultaneously (which visual, which action, which parameters).

**Goal:** Reduce what the LLM decides. Pre-select candidate visuals deterministically 
before the LLM call. The LLM's job should be parameterization of actions on a 
shortlist, not open-ended discovery across all visuals.

### Problem 3: No reasoning before acting
The AI jumps from user question to recommendations without an intermediate reasoning 
step. This causes it to pattern-match on the surface of the question rather than 
analyzing the actual dashboard gap.

**Goal:** Add a structured reasoning block to the LLM output (before recommendations 
are emitted) that forces it to identify: what the user needs to see, which visuals 
are relevant, and what gap currently exists. Use this to gate recommendation 
generation.

### Problem 4: MODIFY_FILTER is overused
`MODIFY_FILTER` is applied too broadly and inconsistently. It should only be 
recommended when a filter on that specific visual would meaningfully surface the 
answer — and only if the visual's dataset actually contains the field being filtered.

**Goal:** Add a structural eligibility check: a visual is only a candidate for 
`MODIFY_FILTER` if the filter field exists in its bound dataset. Enforce this before 
the LLM call, not after.

### Problem 5: Drill-down is not surfaced as a recommendation
The drill-down action exists on one specific bar chart but is never suggested by the 
AI, even when it would be the most direct way for the user to find an answer.

**Goal:** Identify which visual supports drill-down and make `MODIFY_CONTENT` or a 
dedicated recommendation type aware of it. When the user's question matches the 
drill-down dimension of that chart, this should be the primary recommendation.

### Problem 6: Click interactions are not recommended
Clicking a data point (e.g., clicking a bar to filter other visuals, or clicking a 
legend item) may be the most useful action the user can take, but the AI never 
suggests it.

**Goal:** The AI should be able to recommend a click interaction — specifying which 
visual and roughly what to click — when that action would help the user find the 
answer. Consider whether this fits an existing recommendation type or needs a new one.

## What Not to Change
- Do not change the streaming architecture
- Do not change how recommendations are applied in the UI
- Do not change the undo/snapshot mechanism
- The LLM model and temperature settings are out of scope