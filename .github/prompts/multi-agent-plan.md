---
description: multi-agent planning via claude opus 4.6 with specialized executors
auto_execution_mode: 0
---

## Overview
Use this workflow when you want Claude Opus 4.6 to design the overall plan, then hand off each task to the agent best suited for it.

The key requirement: **Claude must output a Markdown checkbox plan** (not prose) that you can execute phase-by-phase with other agents.

This workflow is **plan-only**: it must end after writing the plan to `plan.md`. Execution happens in a separate workflow.

## Steps
1. **Collect current context**
   - Summarize the problem, repo state, constraints, and desired deliverables.
   - Note any deadlines or testing requirements.
2. **Open a planning session with Claude Opus 4.6**
   - Feed the context above plus the agent roster below.
   - Use the **copy/paste prompt template** below.
   - Do not accept Claude’s answer unless it matches the required checkbox format.
3. **Review and finalize the plan**
   - Sanity-check scope, ordering, and dependencies.
   - If adjustments are needed, iterate with Claude until the plan is actionable.
   - Lock the plan before delegating work.
4. **Write the plan to `plan.md` (repo root)**
   - Save Claude’s output verbatim into `plan.md`.
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
4) Every Phase MUST specify exactly one assigned agent from the roster (not Claude), except a final "QA / Integration" phase which can be Claude.
4a) Distribute execution across multiple non-Claude agents (use at least 2 different executor agents across the phases).
5) Every Phase MUST include:
   - Goal (1-2 sentences)
   - Context for Agent (what to read / what invariants to respect)
   - Tasks section with checklist items using the format: "- [ ] **N.M** ..." and each item being concrete and verifiable
   - Acceptance Criteria section as a checklist
   - Validation steps (tests to run, manual verification)
6) Include a Dependency Graph section and a Recommended Execution Order table.
7) Include a Handoff Prompts section: for each Phase, provide a one-line message I can paste into the assigned agent, e.g. "Run /execute-plan Phase 3".
8) Keep it actionable: no vague tasks like "improve" or "polish". Prefer file paths, components, and APIs.
9) Every phase must only be assign to one agent. You cannot have multiple agents working on the same phase (that also means you cannot have subtasks assigned to different agents)

Project context:
[PASTE CONTEXT HERE]

Agent roster (choose from these):
- Claude Opus 4.6 (Planner & QA only)
- Claude Sonnet 4.6 (complex architecture, algorithms, critical code paths)
- Gemini 3.1 Pro High (deep reasoning, large-scale refactoring, thorough analysis)
- Gemini 3.1 Pro Low (UI generation, component volume, styling, well-scoped implementation)
- Gemini 3.1 Flash (quick tasks, boilerplate, simple fixes, documentation)

Now produce the plan.
```

## Agent roster & expertise
- **Claude Opus 4.6 (Planner & QA only)**: High-level strategy, risk analysis, coordination, and final review.
- **Claude Sonnet 4.6**: Complex architecture, algorithm design, critical code paths, and nuanced implementation.
- **Gemini 3.1 Pro High**: Deep reasoning, large-scale refactoring, thorough code analysis, and complex problem-solving.
- **Gemini 3.1 Pro Low**: UI/UX component generation, widget libraries, styling/theming, and well-scoped implementation.
- **Gemini 3.1 Flash**: Quick tasks, boilerplate generation, simple bug fixes, and documentation.

## Handoff tips
- Keep a running checklist of completed subtasks and outstanding ones.
- Include links to PRs, commits, or files when briefing agents.
- Note blocking issues immediately so Claude can replan if necessary.

## Completion criteria
- Every plan step has an assigned agent, recorded outcome, and validation notes.
- Code/tests/docs are merged or staged per plan.
- Outstanding risks are documented for the next planning cycle.
