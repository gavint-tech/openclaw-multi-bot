# Karpathy Guidelines as Cursor Rules for OpenClaw Office

Date: 2026-04-14
Status: Approved for implementation

## Summary

Add a single Cursor Rule file at `.cursor/rules/karpathy-guidelines.mdc` to adapt Andrej Karpathy's behavioral guidelines to the OpenClaw Office codebase. The rule should preserve the original four principles while grounding them in this repository's real constraints: vanilla HTML/CSS/JS, ES5-style browser code, Canvas rendering, nginx static serving, and OpenClaw gateway integration.

## Project Context

OpenClaw Office is a small static dashboard rather than a framework-based web app. The current codebase uses browser globals and focused single-file responsibilities:

- `src/agents.js`: seed agents, activity log fixtures, sprite presets
- `src/app.js`: UI interactions, selection state, modal behavior, terminal input, dashboard boot
- `src/pixel.js`: Canvas drawing helpers for avatars and room scenes
- `src/openclaw-api.js`: IIFE-style WebSocket connector for the gateway

This context matters because a generic rule file could encourage abstractions or tooling that do not fit the project.

## Goals

- Capture the four Karpathy principles in a Cursor-native rule file.
- Make the rule specific enough to guide edits in this repository.
- Reinforce existing project boundaries instead of inventing new architecture.
- Keep the rule simple: one file, always applied, written in English.

## Non-Goals

- Adding frameworks, libraries, linters, or build tooling
- Refactoring application code as part of the rule adoption
- Creating multiple layered rules or a reusable cross-project skill

## Chosen Approach

Use a single `.mdc` file with `alwaysApply: true`. The content is organized into:

1. Project context for grounding
2. Think Before Coding
3. Simplicity First
4. Surgical Changes
5. Goal-Driven Execution
6. A short pre-submission checklist

This approach keeps the rule easy to maintain while giving the assistant enough context to avoid overengineering.

## Principle Adaptation

### Think Before Coding

The assistant should state assumptions before edits, surface tradeoffs when multiple implementations are possible, and ask when global state or cross-file behavior is unclear. This is especially important because the app relies on browser globals shared across multiple files.

### Simplicity First

The assistant should stay within the existing ES5-style code patterns and avoid introducing frameworks, module systems, or speculative abstractions. Simple DOM logic and direct Canvas helpers are preferred over reusable systems that the project does not need.

### Surgical Changes

The assistant should edit only the files related to the request and preserve existing style, comments, and file boundaries. Unrelated cleanup should be reported, not bundled into the same change.

### Goal-Driven Execution

The assistant should define success criteria before implementation and verify changes in terms that make sense for this repo:

- UI change: what should appear or behave differently in the browser
- Gateway change: what should happen when the WebSocket or Docker stack is running
- Bug fix: what exact behavior should no longer fail

## File to Create

`/.cursor/rules/karpathy-guidelines.mdc`

## Verification Plan

1. Create the rule file with valid Cursor frontmatter.
2. Confirm the file exists under `.cursor/rules/`.
3. Review the final content to ensure it references actual project files and constraints.

## Risks and Mitigations

- Risk: The rule becomes too generic and does not influence behavior in this repo.
  Mitigation: Include explicit references to `src/app.js`, `src/pixel.js`, `src/agents.js`, and `src/openclaw-api.js`.

- Risk: The rule pushes overly strict style mandates that exceed the Karpathy intent.
  Mitigation: Keep the content focused on behavior, simplicity, and scope control rather than exhaustive coding standards.

## Reference

- Source inspiration: [Karpathy Guidelines CLAUDE.md](https://github.com/forrestchang/andrej-karpathy-skills/blob/main/CLAUDE.md)
