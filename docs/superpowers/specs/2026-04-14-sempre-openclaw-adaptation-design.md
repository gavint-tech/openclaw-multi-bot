# Adapting Sempre Concepts to OpenClaw Office

Date: 2026-04-14
Status: Drafted after design review

## Summary

Evolve `openclaw-office` incrementally toward a lightweight multi-agent platform inspired by `sempre`, while keeping OpenClaw as the execution core and preserving the current Docker-based simplicity. The target is not a full rewrite into `sempre`, but a staged migration that adds config-driven agents, orchestration, an Obsidian-compatible shared knowledge vault, tool routing, automation, and stronger deployment conventions over time.

## Current Starting Point

`openclaw-office` is currently a simple Docker-based UI around OpenClaw:

- `src/agents.js` contains hardcoded agent definitions and demo log data
- `src/app.js` owns UI interactions and in-browser state
- `src/openclaw-api.js` is a thin WebSocket connector
- the current UX is Web UI-first, with no real orchestration, memory, or automation backbone

This makes the project a good candidate for incremental platformization, but not yet a multi-agent operating system like `sempre`.

## Desired Outcome

The adapted system should support:

- Web UI as a control panel
- ChatOps entry points
- scheduled and triggered jobs
- config-driven team and agent definitions
- GM/worker task orchestration
- shared knowledge and reusable context through an Obsidian-compatible KM vault
- explicit tool routing to platform services
- a deployment model that is still easy to run locally but can grow into a more operational stack

## Chosen Direction

Use a backbone-first incremental approach.

This means the project should first gain the core platform layers that `sempre` relies on, then evolve the UI to control those layers. The order matters: if the UI expands before config, orchestration, and run-state foundations exist, the system risks becoming a visually richer dashboard without a durable backend model.

## Target Architecture

OpenClaw remains the execution engine, but new platform layers sit around it:

- `ControlPlane`: owns team config, task submission, task normalization, and operational APIs
- `GMOrchestrator`: receives tasks, plans work, delegates to workers, and merges results
- `WorkerRuntime`: runs worker-specific tasks under role and tool policies
- `RunStore`: stores operational truth such as task state, run history, assignment, summaries, and failures
- `KMVault`: stores reusable outputs, notes, SOPs, project context, and research in an Obsidian-compatible markdown vault
- `ToolGateway`: routes task types to the correct underlying service
- `OpenClawOfficeWebUI`: evolves from a status dashboard into the main control panel

## What Stays vs What Changes

### What stays

- OpenClaw as the execution core
- Docker-based local deployment
- the existing idea of multiple agents in one environment
- the current Web UI as the starting interaction surface

### What changes

- `src/agents.js` should stop being the source of truth and eventually become mock data, fallback data, or be removed
- `src/app.js` should shift from holding business state to acting as a view/controller over runtime data
- task execution should become explicit through task and run models
- memory and automation should move out of ad hoc UI behavior into dedicated platform services, with the first long-term memory layer built around a markdown vault rather than an abstract store

## Core Data Flow

1. A task enters through Web UI, ChatOps, or schedule.
2. `TaskIngress` normalizes the request into a canonical task shape.
3. `GMOrchestrator` decides whether to answer directly or delegate to workers.
4. `WorkerRuntime` executes using allowed tools and services.
5. `RunStore` records the full lifecycle of the task.
6. `KMVault` saves reusable context and outputs in markdown form.
7. Results are surfaced back to Web UI and ChatOps from the stored run state.

This gives all entry points a common operational path instead of separate logic per interface.

## Phased Roadmap

### Phase 1: TeamConfig backbone

Introduce a central team/agent configuration source covering:

- team metadata
- agents
- roles
- personas
- default models
- channels
- schedule metadata

Primary goal:
- remove hardcoded agent ownership from `src/agents.js`

Verification:
- changing the config updates which agents exist without editing UI seed data directly

### Phase 2: TaskIngress and RunStore

Define the canonical task/run model.

Primary goal:
- make Web UI, ChatOps, and schedules feed the same task lifecycle

Verification:
- a submitted task has a traceable state such as `received`, `planned`, `running`, `completed`, or `failed`

### Phase 3: Minimal GM orchestration

Add a lightweight GM planner that can assign by role and aggregate outcomes.

Primary goal:
- move from direct agent triggering to planned delegation

Verification:
- one incoming task can be routed to one or more workers and return a combined result

### Phase 4: Shared KM vault

Add a lightweight knowledge layer using an Obsidian-compatible markdown vault for summaries, reusable context, and notes.

Primary goal:
- let future tasks reuse prior outputs

Verification:
- a later task can retrieve and reference relevant stored context from the vault

### Phase 5: Tool routing

Introduce a routing layer that maps task classes to platform services such as browser, scraping, GitHub, and workflows.

Primary goal:
- make tool access explicit and enforceable

Verification:
- tasks of different types follow different service paths instead of calling everything directly

### Phase 6: Automation

Add scheduled jobs, webhooks, and recurring workflows.

Primary goal:
- support always-on operations without manual triggering

Verification:
- a scheduled task runs automatically and produces visible run history and outputs

### Phase 7: UI evolution

Expand the current dashboard into a control plane that exposes config, runs, health, schedules, and memory summaries.

Primary goal:
- make the operational model visible and controllable from the browser

Verification:
- users can inspect and manage live system behavior from the UI instead of only seeing demo-like status cards

## Error Handling Model

Use three layers of error handling:

### Ingress errors

Examples:
- invalid config
- unsupported channel
- malformed task payload

Handling:
- reject early and show the user an actionable validation message

### Run errors

Examples:
- worker timeout
- execution failure
- orchestration failure

Handling:
- persist failure state and a short reason in `RunStore`
- show both operator-facing and user-facing summaries

### Degraded-mode errors

Examples:
- KM vault lookup unavailable
- one platform service is down

Handling:
- continue in degraded mode where possible instead of failing the whole system

This is important during incremental rollout, when not every future service exists from day one.

## Testing Strategy

Because new functions and APIs should be backed by tests and docs, the early implementation phases should prioritize:

- unit tests for config parsing and validation
- unit tests for task planning and routing decisions
- unit tests for run lifecycle transitions
- unit tests for KM vault read/write behavior
- focused tests for UI controller functions that are newly introduced

At the beginning, broad end-to-end UI coverage is lower priority than making the backend task and run model stable.

## API and Flow Documentation Requirement

Any new or changed API should include a current-state flow document for that endpoint or event path.

Examples likely to need flow documentation:

- submit task
- list runs
- run detail
- sync team config
- trigger scheduled run

Each documented flow should capture:

- input shape
- validation rules
- orchestration path
- state transitions
- response or event stream
- failure cases

## Recommendation for the First Implementation Slice

Start with:

1. `TeamConfig`
2. `ConfigValidation`
3. `TaskIngress`
4. `RunStore`

Only after those are stable should the project add richer orchestration, memory, tool routing, and automation.

This slice gives the project a durable backbone without forcing a full `sempre`-style platform rewrite up front. Once the first slice is stable, the next recommended addition is the KM vault layer so reusable knowledge starts compounding early.

## References

- OpenClaw Office context: `README.md`
- Sempre reference: [Mone-Industries/sempre](https://github.com/Mone-Industries/sempre)
