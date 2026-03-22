---
description: multi-agent planning via claude opus 4.6 with claude pro, gpt-5/codex executors, and optional gemini
auto_execution_mode: 0
---

## Overview
Use this workflow when you want Claude Opus 4.6 to design the overall plan, then hand off each task to the agent best suited for it.

The primary executor pool is **Claude Pro** and **GPT-5 / Codex**. Gemini agents are available as an opt-in via the `Enable Gemini` setting flag.

The key requirement: **Claude must output a Markdown checkbox plan** (not prose) that you can execute phase-by-phase with other agents.

This workflow is **plan-only**: it must end after writing the plan to `plan.md`. Execution happens in a separate workflow.

## Settings / State Flags

Include a `Setting:` line at the top of your task prompt to activate optional behaviours. Multiple flags can be combined:

```
Setting: Enable Gemini, Almost Limit[OpenAI, Claude]
```

### `Enable Gemini`
Unlocks Gemini agents (3.1 Pro High, 3.1 Pro Low, 3 Flash). Without this flag, Gemini agents must not be assigned to any phase.

### `Almost Limit[OpenAI]`
Signals that OpenAI API usage is approaching ~80% of quota.
- Prefer mini/small OpenAI models (`GPT-5.4-mini`, `GPT-5.1-Codex-Mini`) over full-size ones.
- If a phase would normally use a large OpenAI model, downgrade to the nearest mini equivalent or reassign to a Claude model.

### `Almost Limit[Claude]`
Signals that Claude API usage is approaching ~80% of quota.
- If `Almost Limit[OpenAI]` is **not** active: shift as much work as possible to OpenAI models (implementation AND QA).
- QA reassignment under this flag:
  - Simple QA → GPT-5.1-Codex-Mini
  - Standard QA → GPT-5.3-Codex or GPT-5.2-Codex
  - Complex QA → GPT-5.4
- If **both** limits are active: use mini models only — Claude Haiku 4.5 for Claude-side, GPT-5.4-mini / GPT-5.1-Codex-Mini for OpenAI-side.

---

## Steps
1. **Collect current context**
   - Summarize the problem, repo state, constraints, and desired deliverables.
   - Note any active Settings flags, deadlines, or testing requirements.
2. **Open a planning session with Claude Opus 4.6**
   - Feed the context above plus the agent roster below.
   - Use the **copy/paste prompt template** below.
   - Do not accept Claude's answer unless it matches the required checkbox format.
3. **Review and finalize the plan**
   - Sanity-check scope, ordering, and dependencies.
   - If adjustments are needed, iterate with Claude until the plan is actionable.
   - Lock the plan before delegating work.
4. **Write the plan to `plan.md` (repo root)**
   - Save Claude's output verbatim into `plan.md`.
   - Ensure the plan is Markdown with checkboxes.
5. **Stop**
   - Do not execute any phases in this workflow.
   - Next: run the `/execute-plan` workflow to execute the next phase (or a user-specified phase).

## Claude Opus prompt template (forces checkbox plan)
Copy/paste the following into Claude Opus 4.6. Replace the bracketed sections.

```text
You are the PLANNER. Produce an EXECUTION PLAN that will be carried out by multiple specialized agents.

Hard requirements (must follow exactly):
1) Output MUST be Markdown.
2) Output MUST be a checkbox plan, with tasks using literal "- [ ]" checkboxes (no bullets without checkboxes).
3) Plan MUST be split into numbered Phases (Phase 1, Phase 2, ...).
4) Every Phase MUST specify exactly one assigned agent from the roster.
4a) Distribute execution across multiple agents (use at least 2 different executor agents across the phases).
4b) Apply the active Settings flags before assigning any agent:
    - Almost Limit[OpenAI]: prefer mini/small OpenAI models; downgrade or reassign large OpenAI models.
    - Almost Limit[Claude]: shift implementation and QA to OpenAI models if OpenAI is not also at limit.
    - If both limits active: mini models only on both sides.
4c) QA escalation path (default — overridden by limit flags above):
    - Simple QA (running test suites, build verification, manual smoke testing): Claude Haiku 4.5
    - Standard QA (integration testing, regression checks, code review): Claude Sonnet 4.6
    - Complex QA (architectural validation, security review, cross-cutting concerns): Claude Opus 4.6
5) Every Phase MUST include:
   - Goal (1-2 sentences)
   - Context for Agent (what to read / what invariants to respect)
   - Tasks section with checklist items using the format: "- [ ] **N.M** ..." and each item being concrete and verifiable
   - Acceptance Criteria section as a checklist
   - Validation steps (tests to run, manual verification)
6) Include a Dependency Graph section and a Recommended Execution Order table.
7) Include a Handoff Prompts section: for each Phase, provide a one-line message I can paste into the assigned agent, e.g. "Run /execute-plan Phase 3". Each handoff prompt must also echo the active Settings flags.
8) Keep it actionable: no vague tasks like "improve" or "polish". Prefer file paths, components, and APIs.
9) Every phase must only be assigned to one agent. You cannot have multiple agents working on the same phase.

Active settings: [PASTE ACTIVE FLAGS HERE, e.g. "Enable Gemini, Almost Limit[OpenAI]" — or "None"]

Project context:
[PASTE CONTEXT HERE]

Agent roster — always available (choose from these unless limit flags apply):

Claude Pro:
- Claude Opus 4.6 (Planner & Complex QA — architectural validation, security review, cross-cutting concerns)
- Claude Sonnet 4.6 (Standard QA, complex architecture, algorithms, critical code paths)
- Claude Haiku 4.5 (Simple QA, quick tasks, boilerplate, simple fixes, documentation)

GPT-5 / Codex (OpenAI):
- GPT-5.4 (High-complexity reasoning, cross-cutting analysis, large refactors)
- GPT-5.4-mini (Balanced general-purpose tasks, mid-complexity implementation)
- GPT-5.2 (General implementation, feature development)
- GPT-5.3-Codex (Coding specialist — complex multi-file implementation, agentic coding)
- GPT-5.2-Codex (Coding specialist — targeted edits, moderate-scope refactoring)
- GPT-5.1-Codex-Max (Deep code generation, large-scale coding tasks)
- GPT-5.1-Codex-Mini (Fast code fixes, simple targeted implementation)

[IF "Enable Gemini" was specified, also available:]
- Gemini 3.1 Pro High (Simple QA — test suites, build verification; deep reasoning, large-scale refactoring, thorough analysis)
- Gemini 3.1 Pro Low (UI generation, component volume, styling, well-scoped implementation)
- Gemini 3 Flash (quick tasks, boilerplate, simple fixes, documentation)

Now produce the plan.
```

## Agent roster & expertise

### Claude Pro (always available)
- **Claude Opus 4.6 (Planner & Complex QA)**: High-level strategy, risk analysis, coordination, architectural validation, security review, and final review for complex concerns.
- **Claude Sonnet 4.6 (Standard QA)**: Complex architecture, algorithm design, critical code paths, nuanced implementation, integration testing, regression checks, and code review.
- **Claude Haiku 4.5 (Simple QA)**: Running test suites, build verification, manual smoke testing, quick tasks, boilerplate, simple bug fixes, and documentation.

### GPT-5 / Codex — OpenAI (always available)
- **GPT-5.4**: Highest-capability OpenAI model. Best for high-complexity reasoning, cross-cutting analysis, and large-scale refactors. Use as Complex QA substitute when Claude is at limit.
- **GPT-5.4-mini**: Balanced model for general-purpose tasks and mid-complexity implementation. Preferred when `Almost Limit[OpenAI]` is active instead of GPT-5.4.
- **GPT-5.2**: Solid general-purpose model for feature development and standard implementation work.
- **GPT-5.3-Codex**: Coding specialist. Best for complex multi-file implementation and agentic coding tasks.
- **GPT-5.2-Codex**: Coding specialist for targeted edits and moderate-scope refactoring.
- **GPT-5.1-Codex-Max**: Deep code generation and large-scale coding tasks requiring maximum Codex capability.
- **GPT-5.1-Codex-Mini**: Fast, lightweight Codex model. Preferred when `Almost Limit[OpenAI]` is active.

### Gemini (opt-in via `Enable Gemini` setting)
- **Gemini 3.1 Pro High**: Deep reasoning, large-scale refactoring, thorough code analysis, and Simple QA (test suites, build verification).
- **Gemini 3.1 Pro Low**: UI/UX component generation, widget libraries, styling/theming, and well-scoped implementation.
- **Gemini 3 Flash**: Quick tasks, boilerplate generation, simple bug fixes, and documentation.

---

## Handoff tips
- Keep a running checklist of completed subtasks and outstanding ones.
- Include links to PRs, commits, or files when briefing agents.
- Always echo active Settings flags at the top of each handoff prompt.
- Note blocking issues immediately so Claude can replan if necessary.

## Completion criteria
- Every plan step has an assigned agent, recorded outcome, and validation notes.
- Code/tests/docs are merged or staged per plan.
- Outstanding risks are documented for the next planning cycle.
