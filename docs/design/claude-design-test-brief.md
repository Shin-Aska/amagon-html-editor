# Claude Design Test Brief

Use this brief when asking Claude to evaluate or propose design changes for Amagon.

## Context Prompt

```text
You are reviewing Amagon HTML Editor, an offline Electron desktop app for visual HTML editing.
It has a left block/page sidebar, center iframe canvas, right inspector, top toolbar, optional
Monaco code editor, AI assistant, theme editor, asset manager, export, and publish workflows.

Use the repo design docs in docs/design/ as your source of truth:
- product-design-brief.md
- asset-manifest.md

Preserve the app's dense desktop-editor character. Do not redesign it as a SaaS dashboard
or landing page. Prioritize clarity, stable layouts, keyboard usability, and reviewable AI
actions. Reference local screenshots from docs/images/ when discussing current surfaces.
```

## Design Test Scenarios

### Scenario 1: First Project Orientation

Prompt Claude to evaluate:

- Can a new user identify how to create, open, or continue a project?
- Does the welcome tour invite action without blocking experienced users?
- Is the initial editor state understandable once a project opens?

Expected output:

- Friction points.
- Copy changes.
- Layout changes.
- Testable acceptance criteria.

### Scenario 2: Drag A Block And Edit It

Prompt Claude to evaluate:

- A user searches for a hero or feature card block.
- They drag it into the canvas.
- They select the block and edit text, image, spacing, and classes.

Expected output:

- Drop target clarity notes.
- Inspector grouping recommendations.
- Hover/selection state requirements.
- Empty/error states for missing media.

### Scenario 3: AI-Generated Block Review

Prompt Claude to evaluate:

- A user asks AI for a pricing section.
- The assistant returns a preview and insert action.
- The user asks for CSS or event-handler changes.
- The app shows a diff before apply.

Expected output:

- Trust and safety review.
- Preview/diff hierarchy.
- Wording for apply/discard states.
- Failure handling for malformed AI output.

### Scenario 4: Theme System Editing

Prompt Claude to evaluate:

- A user opens the theme editor.
- They change colors, typography, spacing, borders, and custom CSS.
- They save a preset and return to the canvas.

Expected output:

- Token grouping recommendations.
- Preview model recommendation.
- Risk notes for global cascading changes.
- Preset naming and confirmation behavior.

### Scenario 5: Publish Flow

Prompt Claude to evaluate:

- A user chooses GitHub Pages, Cloudflare Pages, or Neocities.
- They enter credentials.
- Validation finds unsupported files or missing credentials.
- Publish proceeds and returns a final URL.

Expected output:

- Provider selection hierarchy.
- Credential copy.
- Validation issue display.
- Progress and completion behavior.
- Recovery paths for failed uploads.

### Scenario 6: Tutorial Spotlight

Prompt Claude to evaluate:

- The tutorial highlights toolbar, sidebar, canvas, inspector, and publish/AI/media branches.
- Some steps auto-advance after user action.
- The target may be near viewport edges.

Expected output:

- Placement and overflow rules.
- Instruction copy style.
- Branching behavior recommendations.
- Accessibility notes for keyboard and screen reader users.

## Evaluation Criteria

Claude's design output should be considered useful only if it includes:

- Specific affected surfaces, not generic UI advice.
- Concrete before/after recommendations.
- Acceptance criteria that can be tested manually or with Playwright.
- Accessibility and keyboard implications.
- Notes about light and dark theme behavior.
- Risks or tradeoffs when a recommendation changes workflow density.

## Rejection Criteria

Reject or revise proposals that:

- Turn the editor into a marketing landing page.
- Remove the three-pane editing model without a strong workflow reason.
- Hide advanced controls so deeply that desktop-editor speed suffers.
- Add decorative images, gradients, or visual effects that compete with the canvas.
- Treat AI output as auto-applied without review.
- Depend on external image URLs for core UI tests.

## Manual Test Checklist

- Create a new project and confirm the first-use path is visible.
- Drag at least one block from the sidebar into the canvas.
- Select a block and verify the inspector reflects it.
- Toggle desktop, tablet, and mobile preview modes.
- Open and close the code editor without losing canvas context.
- Open theme editor and confirm changes are visibly scoped and reversible.
- Open AI assistant and verify generated output has review/insert affordances.
- Open publish dialog and verify validation explains actionable fixes.
- Start tutorial and confirm spotlight targets do not cover required controls.
- Repeat key screens in light and dark themes.

## Suggested Claude Output Format

```text
Summary
- One paragraph describing the strongest design opportunity.

Findings
- Severity: High/Medium/Low
- Surface:
- Evidence:
- Recommendation:
- Acceptance criteria:

Design Tasks
- Task title:
- Files or components likely involved:
- Test notes:
```
