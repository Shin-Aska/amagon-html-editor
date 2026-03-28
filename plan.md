# UI Redesign Plan — Settings, Credentials & Publish

> Active settings: None
> Generated: 2026-03-27

---

## Dependency Graph

```
Phase 1 ──► Phase 4
Phase 2 ──► Phase 4
Phase 3 ──► Phase 4
```

Phase 1–3 are independent of each other and can run in any order. Phase 4 (QA) depends on all three.

## Recommended Execution Order

| Order | Phase | Agent | Depends On |
|-------|-------|-------|------------|
| 1 | Phase 1 — Credentials Tab: Table View + Edit Modal | Claude Sonnet 4.6 | — |
| 2 | Phase 2 — AI Assistant & Media Search Tabs: Provider Picker | Claude Haiku 4.5 | — |
| 3 | Phase 3 — Publish Dialog Visual Redesign | Claude Sonnet 4.6 | — |
| 4 | Phase 4 — QA & Build Verification | Claude Haiku 4.5 | 1, 2, 3 |

---

## Phase 1 — Credentials Tab: Table View + Edit Modal

**Assigned Agent:** Claude Sonnet 4.6

### Goal
Replace the grouped card list in the Credentials tab of Global Settings with a compact table view (columns: Type, Provider, Actions) and move credential editing into a dedicated overlay modal.

### Context for Agent
- File to edit: `src/renderer/components/SettingsDialog/SettingsDialog.tsx` (Credentials tab section, currently ~lines 200–380)
- Styles to edit: `src/renderer/components/SettingsDialog/SettingsDialog.css`
- The existing inline editor (`showEditor`, `editingDef`, `editingValues` state) must be converted to a modal overlay pattern
- IPC calls to keep: `app.getCredentials()`, `app.getCredentialValues(id)`, `app.saveCredential(id, values)`, `app.deleteCredential(id)`
- After any save/delete, `dispatchAiAvailabilityChanged()` must still be called
- Do NOT change any IPC channel names or main-process code
- Category colour tokens already exist in the CSS: purple = AI, cyan = multimedia, green = publisher — reuse them

### Tasks

- [x] **1.1** Read `src/renderer/components/SettingsDialog/SettingsDialog.tsx` in full before making any changes
- [x] **1.2** Read `src/renderer/components/SettingsDialog/SettingsDialog.css` in full before making any changes
- [x] **1.3** Replace the grouped card list in the Credentials tab with an HTML `<table>` (or CSS-grid table) with columns: **Type** (category pill), **Provider** (provider name), **Actions** (Edit button + Remove button)
- [x] **1.4** Remove the "Add New Credential" inline editor section; replace with an "Add Credential" button in the tab header that opens the same modal (step 1.5)
- [x] **1.5** Build a self-contained `<CredentialEditModal>` component (within the same file or as a new file `src/renderer/components/SettingsDialog/CredentialEditModal.tsx`):
  - Triggered by clicking Edit on a row (passes `definitionId` and existing values) OR clicking Add Credential (passes `null` for new)
  - Contains: category type dropdown (create-only), provider selector (create-only), dynamic sensitive field inputs, Cancel and Save buttons
  - On Save: calls `app.saveCredential(id, values)` then closes and refreshes the credential list
  - On Cancel: closes without saving
  - Modal must trap focus and close on Escape or overlay click
- [x] **1.6** Ensure the Remove button in the table shows a confirmation step (inline "Are you sure?" replace of the button, or a small confirm popover) before calling `app.deleteCredential(id)`
- [x] **1.7** Style the table in `SettingsDialog.css`: zebra rows, compact row height (~44px), pill badges for Type column reusing existing category colour variables, hover state on action buttons
- [x] **1.8** Remove all now-unused inline-editor state variables and helper functions from `SettingsDialog.tsx`

### Acceptance Criteria

- [ ] Credentials tab shows a table with Type, Provider, and Actions columns — no card grid
- [ ] Clicking Edit opens the edit modal pre-populated with current (masked) values; saving works end-to-end
- [ ] Clicking Add Credential opens the same modal in create mode with provider selector
- [ ] Remove triggers a confirmation before deleting; deleting updates the table without a full page reload
- [ ] No inline editor markup remains in the Credentials tab DOM
- [ ] AI availability event is dispatched after every save and delete

### Validation Steps

- [x] Run `npm run build` and confirm zero TypeScript errors
- [ ] Open Global Settings → Credentials tab: table renders with existing credentials
- [ ] Add a new credential: modal opens, fill fields, save → row appears in table
- [ ] Edit a credential: modal opens pre-filled, change a value, save → row updates
- [ ] Delete a credential: confirm prompt appears, confirm → row removed

---

## Phase 2 — AI Assistant & Media Search Tabs: Provider Picker Only

**Assigned Agent:** Claude Haiku 4.5

### Goal
Remove API key input fields from the AI Assistant and Media Search tabs. Each tab becomes a pure provider/model selector. A clear, user-visible notice directs users to the Credentials tab for key management.

### Context for Agent
- File to edit: `src/renderer/components/SettingsDialog/SettingsDialog.tsx` (AI Assistant tab ~lines 380–500, Media Search tab ~lines 500–570)
- Styles to edit: `src/renderer/components/SettingsDialog/SettingsDialog.css`
- IPC calls to keep for AI tab: `ai.getConfig()`, `ai.setConfig(config)`, `ai.getModels()`, `ai.fetchModelsForProvider(data)` — but the `apiKey` field should no longer be collected here
- IPC calls to keep for Media tab: `mediaSearch.getConfig()`, `mediaSearch.setConfig(config)` — remove `apiKey` field
- The `openGlobalSettings({ tab: 'keys' })` helper is already available; use it for the "Manage API Keys" link
- Do NOT remove `apiKey` from the IPC payloads in main-process code — just stop collecting it in the UI (send empty string or omit from the setConfig call)
- Model fetching for AI tab should continue to work using the stored credential from the Credentials tab (the main process already reads it from the credential store; no UI key needed)

### Tasks

- [x] **2.1** Read the AI Assistant tab section of `SettingsDialog.tsx` in full before editing
- [x] **2.2** Read the Media Search tab section of `SettingsDialog.tsx` in full before editing
- [x] **2.3** Remove the API key `<input>` element and its label from the **AI Assistant** tab; also remove the Ollama URL field's dependency on apiKey state (keep the Ollama URL field itself — only the apiKey input goes away)
- [x] **2.4** Remove the API key `<input>` element and its label from the **Media Search** tab
- [x] **2.5** In both tabs, add a visible inline notice: *"API keys are managed in the [Credentials tab](#)"* where the link calls `openGlobalSettings({ tab: 'keys' })` (switch to Credentials tab within the same open dialog)
- [x] **2.6** Remove all `apiKey` local state variables from both tab sections and any onChange/onBlur handlers that referenced them
- [x] **2.7** Update the `ai.setConfig()` call: omit `apiKey` from the payload (or send empty string). The main process reads the API key from the credential store directly
- [x] **2.8** Update the `mediaSearch.setConfig()` call similarly: omit `apiKey` from the payload
- [x] **2.9** Style the inline notice in `SettingsDialog.css`: subtle info callout box (light blue/info colour, small icon, compact padding)

### Acceptance Criteria

- [x] AI Assistant tab shows provider dropdown and model selector — no API key input field
- [x] Media Search tab shows provider dropdown — no API key input field
- [x] Both tabs display the "Credentials tab" notice with a working link that switches to the Credentials tab
- [x] Changing provider and model in AI Assistant tab still saves correctly via `ai.setConfig()`
- [x] Changing provider in Media Search tab still saves correctly via `mediaSearch.setConfig()`
- [x] No `apiKey` state variables remain in the AI or Media tab sections of `SettingsDialog.tsx`

### Validation Steps

- [x] Run `npm run build` — zero TypeScript errors
- [ ] Open Global Settings → AI Assistant tab: no API key field visible; provider and model dropdowns work; notice link switches to Credentials tab
- [ ] Open Global Settings → Media Search tab: no API key field visible; provider dropdown works; notice link switches to Credentials tab
- [ ] Confirm AI model fetching still works (models load from stored credential, not from a UI field)

---

## Phase 3 — Publish Dialog Visual Redesign

**Assigned Agent:** Claude Sonnet 4.6

### Goal
Redesign the Publish to Web dialog for a polished, professional appearance. Improve layout hierarchy, spacing, step indicators, and visual feedback across all six steps without changing any business logic or IPC calls.

### Context for Agent
- Files to edit: `src/renderer/components/PublishDialog/` (all files — read them all first)
- Do NOT change any IPC calls, state management logic, or workflow step ordering
- The six steps are: Select → Credentials → Validating → Validated → Publishing → Result
- The dialog currently uses a centered modal with backdrop blur; keep the modal pattern but improve internals
- Avoid inline styles; use CSS classes

### Tasks

- [x] **3.1** Read all files in `src/renderer/components/PublishDialog/` in full before making any changes
- [x] **3.2** Add a **step progress indicator** at the top of the modal (horizontal stepper showing: Select → Configure → Validate → Publish) that highlights the active step — map the 6 internal steps to these 4 user-facing labels
- [x] **3.3** Redesign the **provider selection step** (step 1):
  - Replace plain list with a card grid (2-column on wider screens, 1-column on narrow)
  - Each card: provider icon placeholder area, name in bold, description in secondary text, "Bound" badge if currently bound
  - Selected card has a distinct border/highlight state
- [x] **3.4** Redesign the **credentials step** (step 2):
  - Improve form field spacing (label above input, consistent gap)
  - Style the binding controls section with a subtle separator and indentation for the nested "Save credentials" checkbox
  - Replace plain checkboxes with styled checkboxes matching the app design system
- [x] **3.5** Redesign the **validating step** (step 3): centred spinner with provider name shown ("Validating with {provider}…"), subtle animated dots or pulse
- [x] **3.6** Redesign the **validated step** (step 4):
  - If no issues: full-width success banner with checkmark icon
  - If issues: list with clear error (red) and warning (yellow) pills, file path in monospace, message and suggestion on separate lines
  - Publish button only enabled when no errors (already the case — ensure styling communicates this clearly with a disabled-state style)
- [x] **3.7** Redesign the **publishing step** (step 5): larger progress bar with percentage text centred inside the bar, status message below
- [x] **3.8** Redesign the **result step** (step 6):
  - Success: large outlined checkmark circle (green), "Published Successfully" heading, URL in a copyable pill input, row of action buttons (Copy URL, Open in Browser, Done)
  - Failure: large outlined X circle (red), "Publish Failed" heading, error message in a styled alert box, "Try Again" and "Done" buttons
- [x] **3.9** Update `PublishDialog.css` (or equivalent): define new class names for the above, remove stale/unused CSS, ensure dark-mode and light-mode work

### Acceptance Criteria

- [x] Step progress indicator is visible and updates as the workflow advances
- [x] Provider cards render in a grid with hover and selected states
- [x] Credentials form is clearly laid out with readable labels and well-spaced inputs
- [x] Validating step shows spinner with provider name
- [x] Validated step clearly distinguishes errors from warnings; Publish button visually disabled on error
- [x] Publishing step shows an in-bar percentage
- [x] Result step success and failure screens are visually distinct and polished
- [x] No business logic, IPC call, or state variable was modified — only JSX structure and CSS

### Validation Steps

- [x] Run `npm run build` — zero TypeScript errors
- [ ] Open Publish Dialog: step indicator visible, provider cards render cleanly
- [ ] Proceed through all steps (mock or real): each step renders correctly
- [ ] Verify light and dark theme both look acceptable

---

## Phase 4 — QA & Build Verification

**Assigned Agent:** Claude Haiku 4.5

### Goal
Verify the complete build succeeds, run any existing test suites, and perform a manual smoke test of all three redesigned areas to confirm no regressions.

### Context for Agent
- Phases 1, 2, and 3 must all be complete before this phase runs
- Build command: `npm run build`
- Test command (if tests exist): `npm test` or `npm run test`
- Check `package.json` for the exact test script name before running

### Tasks

- [ ] **4.1** Run `npm run build` and confirm exit code 0 with zero TypeScript or bundler errors
- [ ] **4.2** Check `package.json` for a test script; if present, run it and confirm all tests pass
- [ ] **4.3** Review `src/renderer/components/SettingsDialog/SettingsDialog.tsx` for leftover dead code (unused state variables, commented-out blocks, orphaned handlers) from Phases 1 and 2 and remove any found
- [ ] **4.4** Review `src/renderer/components/PublishDialog/` for leftover dead CSS classes or unused JSX from Phase 3 and remove any found
- [ ] **4.5** Verify Phase 1 acceptance criteria are met by reading the Credentials tab code
- [ ] **4.6** Verify Phase 2 acceptance criteria are met by reading the AI Assistant and Media Search tab code
- [ ] **4.7** Verify Phase 3 acceptance criteria are met by reading the PublishDialog code
- [ ] **4.8** Document any remaining issues or edge cases in a comment at the bottom of this `plan.md`

### Acceptance Criteria

- [ ] `npm run build` exits with code 0
- [ ] All test suites pass (or no test suite exists and this is noted)
- [ ] No unused state variables or dead code introduced by Phases 1–3
- [ ] All three redesigned areas match their respective acceptance criteria from Phases 1–3

### Validation Steps

- [ ] Build output in terminal shows no errors or warnings
- [ ] Test runner output shows no failures

---

## Handoff Prompts

Use these prompts to kick off each phase in the assigned agent. Echo active settings at the top.

> **Active settings: None**

| Phase | Agent | Handoff Prompt |
|-------|-------|----------------|
| Phase 1 | Claude Sonnet 4.6 | `Active settings: None. Run /execute-plan Phase 1` |
| Phase 2 | Claude Haiku 4.5 | `Active settings: None. Run /execute-plan Phase 2` |
| Phase 3 | Claude Sonnet 4.6 | `Active settings: None. Run /execute-plan Phase 3` |
| Phase 4 | Claude Haiku 4.5 | `Active settings: None. Run /execute-plan Phase 4` (only after Phases 1–3 are complete) |
