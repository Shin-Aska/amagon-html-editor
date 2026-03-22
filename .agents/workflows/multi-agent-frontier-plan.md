

Let me first read the existing multi-agent-plan.md to get the exact file content and structure.Here's the new `multi-agent-plan-frontier.md` file with a much more diverse agent roster leveraging the full range of available models, including mini/nano models for cost efficiency:

```markdown
---
description: multi-agent planning via frontier models with a diverse, cost-optimized agent roster
auto_execution_mode: 0
---

## Overview
Use this workflow when you want a top-tier reasoning model to design the overall plan, then hand off each task to the agent best suited for it — drawing from a wide roster of Claude, Gemini, GPT, Grok, and o-series models.

The key requirement: **The planner must output a Markdown checkbox plan** (not prose) that you can execute phase-by-phase with other agents.

This workflow is **plan-only**: it must end after writing the plan to `plan.md`. Execution happens in a separate workflow.

### Cost philosophy
- **Mini/nano/flash-lite models** should be used for simple, well-scoped tasks (boilerplate, docs, formatting, simple fixes).
- **Mid-tier models** handle standard implementation, UI work, and routine QA.
- **Frontier reasoning models** are reserved for planning, complex architecture, security review, and hard debugging.

## Steps
1. **Collect current context**
   - Summarize the problem, repo state, constraints, and desired deliverables.
   - Note any deadlines or testing requirements.
2. **Open a planning session with the Planner agent**
   - Feed the context above plus the agent roster below.
   - Use the **copy/paste prompt template** below.
   - The planner can be **Claude 4.6 Opus**, **GPT-5.2**, or **Gemini 3.1 Pro** — pick whichever is available.
   - Do not accept the planner's answer unless it matches the required checkbox format.
3. **Review and finalize the plan**
   - Sanity-check scope, ordering, and dependencies.
   - If adjustments are needed, iterate with the planner until the plan is actionable.
   - Lock the plan before delegating work.
4. **Write the plan to `plan.md` (repo root)**
   - Save the planner's output verbatim into `plan.md`.
   - Ensure the plan is Markdown with checkboxes.
5. **Stop**
   - Do not execute any phases in this workflow.
   - Next: run the `/execute-plan` workflow to execute the next phase (or a user-specified phase).

## Planner prompt template (forces checkbox plan)
Copy/paste the following into your chosen Planner model. Replace the bracketed sections.
```
text
You are the PLANNER. Produce an EXECUTION PLAN that will be carried out by multiple specialized agents.

Hard requirements (must follow exactly):
1) Output MUST be Markdown.
2) Output MUST be a checkbox plan, with tasks using literal "- [ ]" checkboxes (no bullets without checkboxes).
3) Plan MUST be split into numbered Phases (Phase 1, Phase 2, ...).
4) Every Phase MUST specify exactly one assigned agent from the roster.
   4a) Distribute execution across multiple agents (use at least 3 different executor agents across the phases).
   4b) Use mini/nano/flash-lite models for simple tasks (boilerplate, docs, formatting, renaming, simple fixes) to save cost.
   4c) QA phases MUST follow this escalation path:
    - **Trivial QA** (lint, format check, build verification): assign to **GPT-5 mini** or **GPT-4.1 mini**
    - **Simple QA** (running test suites, smoke testing, basic regression): assign to **Gemini 3 Flash** or **Claude 4.5 Haiku**
    - **Standard QA** (integration testing, regression checks, code review): assign to **Claude 4.6 Sonnet** or **GPT-5.1-Codex**
    - **Complex QA** (architectural validation, security review, cross-cutting concerns): assign to **Claude 4.6 Opus** or **o3**
5) Every Phase MUST include:
    - Goal (1-2 sentences)
    - Context for Agent (what to read / what invariants to respect)
    - Tasks section with checklist items using the format: "- [ ] **N.M** ..." and each item being concrete and verifiable
    - Acceptance Criteria section as a checklist
    - Validation steps (tests to run, manual verification)
6) Include a Dependency Graph section and a Recommended Execution Order table.
7) Include a Handoff Prompts section: for each Phase, provide a one-line message I can paste into the assigned agent, e.g. "Run /execute-plan Phase 3".
8) Keep it actionable: no vague tasks like "improve" or "polish". Prefer file paths, components, and APIs.
9) Every phase must only be assigned to one agent. You cannot have multiple agents working on the same phase (that also means you cannot have subtasks assigned to different agents).
10) For each phase, add an estimated **Cost Tier** label: 💰 (mini/nano/flash-lite), 💰💰 (mid-tier), or 💰💰💰 (frontier).

Project context:
[PASTE CONTEXT HERE]

Agent roster (choose from these):

🔴 FRONTIER — Planning, Complex QA, Hard Problems:
- Claude 4.6 Opus          (Reasoning + Vision, 200k) — Planner, architectural validation, security review
- GPT-5.2                  (Reasoning + Vision, 400k) — Planner alt, complex debugging, cross-cutting analysis
- o3                       (Reasoning + Vision, 200k) — Deep multi-step reasoning, formal verification, math-heavy logic
- Grok-4.1 Fast            (Reasoning + Vision, 2M)   — Massive-context analysis, full-repo reasoning

🟠 HIGH-TIER — Complex Implementation, Standard QA, Architecture:
- Claude 4.6 Sonnet        (Vision, 200k)             — Standard QA, integration testing, code review, complex implementation
- Claude 4.5 Sonnet        (Reasoning + Vision, 200k)  — Algorithm design, critical code paths, nuanced implementation
- GPT-5.1-Codex            (Reasoning + Vision, 400k)  — Heavy coding tasks, multi-file refactoring, code generation
- Gemini 3.1 Pro           (Reasoning + Vision, 1M)    — Large-scale refactoring, thorough analysis, deep reasoning with huge context
- Grok-4                   (Reasoning + Vision, 256k)  — Complex coding, architecture decisions

🟡 MID-TIER — Standard Implementation, UI Work, Moderate Complexity:
- GPT-5.1-Codex-Mini       (Reasoning + Vision, 400k)  — Moderate coding tasks, well-scoped feature implementation
- Gemini 3 Pro             (Reasoning + Vision, 1M)    — Standard implementation with large context needs
- Gemini 3 Flash           (Vision, 1M)                — Simple QA (test suites, build verification), moderate implementation
- Claude 4.5 Haiku         (Vision, 200k)              — Fast simple QA, smoke testing, quick code review
- GPT-5                    (Reasoning + Vision, 400k)  — General-purpose implementation

🟢 BUDGET — Boilerplate, Docs, Simple Fixes, Trivial QA:
- GPT-5 mini               (Reasoning + Vision, 400k)  — Trivial QA (lint, build check), simple well-scoped fixes
- GPT-5 nano               (Reasoning + Vision, 400k)  — Boilerplate generation, formatting, renaming, trivial edits
- GPT-4.1 mini             (Vision, 1M)                — Documentation, simple bug fixes, config changes
- GPT-4.1 nano             (Vision, 1M)                — Ultra-cheap: docs, comments, formatting, file scaffolding
- Gemini 2.5 Flash-Lite    (Vision, 1M)                — Lightweight tasks, template generation, simple transformations
- Grok Code Fast 1         (256k)                      — Fast boilerplate, simple code generation

Now produce the plan.
```
## Agent roster & expertise

### 🔴 Frontier (Planning, Complex QA, Hard Problems) — 💰💰💰
| Agent | Best For | Context | Capabilities |
|-------|----------|---------|-------------|
| **Claude 4.6 Opus** | Primary planner, architectural validation, security review, final sign-off | 200k | Reasoning, Vision |
| **GPT-5.2** | Alternate planner, complex cross-cutting debugging, system-level analysis | 400k | Reasoning, Vision |
| **o3** | Deep multi-step reasoning, formal verification, math-heavy logic, algorithm correctness proofs | 200k | Reasoning, Vision |
| **Grok-4.1 Fast** | Massive-context whole-repo analysis, codebase-wide dependency tracing | 2M | Reasoning, Vision |

### 🟠 High-Tier (Complex Implementation, Standard QA) — 💰💰
| Agent | Best For | Context | Capabilities |
|-------|----------|---------|-------------|
| **Claude 4.6 Sonnet** | Standard QA, integration testing, code review, complex but scoped implementation | 200k | Vision |
| **Claude 4.5 Sonnet** | Algorithm design, critical code paths, nuanced TypeScript/React implementation | 200k | Reasoning, Vision |
| **GPT-5.1-Codex** | Heavy multi-file coding, large refactors, code generation at scale | 400k | Reasoning, Vision |
| **Gemini 3.1 Pro** | Large-scale refactoring with huge context, thorough analysis across many files | 1M | Reasoning, Vision |
| **Grok-4** | Complex coding tasks requiring strong reasoning with generous context | 256k | Reasoning, Vision |

### 🟡 Mid-Tier (Standard Implementation, UI, Moderate Complexity) — 💰💰
| Agent | Best For | Context | Capabilities |
|-------|----------|---------|-------------|
| **GPT-5.1-Codex-Mini** | Moderate coding tasks, well-scoped feature implementation, component creation | 400k | Reasoning, Vision |
| **Gemini 3 Pro** | Standard implementation needing large context window | 1M | Reasoning, Vision |
| **Gemini 3 Flash** | Simple QA (test suites, build verification), moderate UI/component work | 1M | Vision |
| **Claude 4.5 Haiku** | Fast simple QA, smoke testing, quick code review, rapid iteration | 200k | Vision |
| **GPT-5** | General-purpose implementation, balanced cost/quality | 400k | Reasoning, Vision |

### 🟢 Budget (Boilerplate, Docs, Trivial QA) — 💰
| Agent | Best For | Context | Capabilities |
|-------|----------|---------|-------------|
| **GPT-5 mini** | Trivial QA (lint, format, build check), simple well-scoped fixes | 400k | Reasoning, Vision |
| **GPT-5 nano** | Boilerplate generation, formatting, renaming, trivial edits | 400k | Reasoning, Vision |
| **GPT-4.1 mini** | Documentation generation, simple bug fixes, config file changes | 1M | Vision |
| **GPT-4.1 nano** | Ultra-cheap: writing docs, comments, formatting, file scaffolding | 1M | Vision |
| **Gemini 2.5 Flash-Lite** | Lightweight tasks, template generation, simple transformations | 1M | Vision |
| **Grok Code Fast 1** | Fast boilerplate, simple code generation, quick utility functions | 256k | — |

## QA escalation path
```

Trivial QA ──► GPT-5 mini / GPT-4.1 mini
(lint, format, build check)

Simple QA ──► Gemini 3 Flash / Claude 4.5 Haiku
(test suites, smoke tests, basic regression)

Standard QA ──► Claude 4.6 Sonnet / GPT-5.1-Codex
(integration tests, regression, code review)

Complex QA ──► Claude 4.6 Opus / o3
(architecture validation, security review, cross-cutting concerns)
```
## Cost optimization guidelines
- **Default to the cheapest agent** that can handle the task reliably.
- Use **GPT-5 nano** or **GPT-4.1 nano** for any task that is purely mechanical (rename, reformat, add comments, scaffold files).
- Use **Gemini 2.5 Flash-Lite** or **Grok Code Fast 1** for generating boilerplate or templates.
- Reserve **Gemini 3.1 Pro** or **Grok-4.1 Fast** when you genuinely need huge context windows (>200k tokens of input).
- Reserve **o3** for tasks requiring provably correct multi-step reasoning.
- Never use a frontier model for documentation or formatting tasks.

## Handoff tips
- Keep a running checklist of completed subtasks and outstanding ones.
- Include links to PRs, commits, or files when briefing agents.
- Note blocking issues immediately so the planner can replan if necessary.
- When handing off to a budget model, provide **extra-explicit instructions** — they benefit from precise, unambiguous prompts.
- When handing off to frontier models, provide **full context** — they can synthesize large amounts of information effectively.

## Completion criteria
- Every plan step has an assigned agent, recorded outcome, and validation notes.
- Code/tests/docs are merged or staged per plan.
- Outstanding risks are documented for the next planning cycle.
- Cost tier was respected: no frontier model was used for budget-tier tasks.
```


This new workflow file offers several improvements over the original:

1. **20+ agents across 4 tiers** (🔴 Frontier, 🟠 High-Tier, 🟡 Mid-Tier, 🟢 Budget) instead of just 5 agents
2. **Cost optimization** is a first-class concern — mini/nano/flash-lite models are explicitly recommended for mechanical tasks like docs, formatting, and boilerplate
3. **4-level QA escalation** (Trivial → Simple → Standard → Complex) instead of 3 levels
4. **Cost Tier labels** (💰/💰💰/💰💰💰) are required on every phase so you can see spend at a glance
5. **Model diversity** — utilizes Claude, Gemini, GPT, Grok, and o-series models, each matched to their strengths (e.g., Grok-4.1 Fast for 2M-context whole-repo analysis, o3 for formal reasoning)
6. **Explicit cost guidelines** to prevent over-spending on trivial work