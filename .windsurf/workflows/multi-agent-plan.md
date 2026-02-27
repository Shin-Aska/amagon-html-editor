---
description: multi-agent planning via claude opus 4.6 with specialized executors
auto_execution_mode: 3
---

## Overview
Use this workflow when you want Claude Opus 4.6 to design the overall plan, then hand off each task to the agent best suited for it. Always capture the plan in writing (scratchpad, doc, or chat) so any agent can reference it.

## Steps
1. **Collect current context**
   - Summarize the problem, repo state, constraints, and desired deliverables.
   - Note any deadlines or testing requirements.
2. **Open a planning session with Claude Opus 4.6**
   - Feed the context above plus the agent roster below.
   - Ask Claude to outline numbered phases and to recommend which agent should own each subtask.
   - Ensure the plan includes success criteria and validation steps.
3. **Review and finalize the plan**
   - Sanity-check scope, ordering, and dependencies.
   - If adjustments are needed, iterate with Claude until the plan is actionable.
   - Lock the plan before delegating work.
4. **Delegate execution to specialized agents**
   - For each task, brief the selected agent with:
     - The relevant slice of the plan and context.
     - Input/output expectations.
     - Any artifacts from previous steps.
   - Capture agent outputs and feed them back into the shared plan log.
5. **Integrate results**
   - Verify each deliverable against the plan’s success criteria.
   - Run tests or demos as required.
   - If issues appear, either loop back with the same agent or escalate to Claude for replanning.
6. **Close out**
   - Summarize what was delivered, remaining risks, and follow-up items.
   - Store the plan + transcripts for future reference.

## Agent roster & expertise
- **Claude Opus 4.6 (Planner & QA)**: High-level strategy, risk analysis, coordination, and final review.
- **GPT-5.2 High Thinking**: Complex architecture, algorithm design, and critical code paths.
- **Kimi K2.5**: UX polish, performance tuning, clipboard/shortcut flows, and accessibility.
- **Gemini 3.1 Pro High Thinking**: Data-heavy logic, testing matrices, and documentation structure.
- **MiniMax 2.5**: Rapid prototyping, content drafting, and quick UI iterations.
- **XAI Grok 3**: Debugging gnarly cross-stack issues, instrumentation, and observability tweaks.

## Handoff tips
- Keep a running checklist of completed subtasks and outstanding ones.
- Include links to PRs, commits, or files when briefing agents.
- Note blocking issues immediately so Claude can replan if necessary.

## Completion criteria
- Every plan step has an assigned agent, recorded outcome, and validation notes.
- Code/tests/docs are merged or staged per plan.
- Outstanding risks are documented for the next planning cycle.
