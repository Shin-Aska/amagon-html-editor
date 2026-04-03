# Execution Plan: Upgrade All Dependencies to Latest Upstream

**Active Settings:** None

---

## Phase 1 — Core Toolchain Upgrade (TypeScript, Vite, Build Plugins)
**Assigned Agent:** GPT-5.3-Codex

**Goal:** Upgrade the foundational build toolchain — TypeScript 6, Vite 8, @vitejs/plugin-react 6, electron-vite — and fix all resulting config/type errors so the project compiles cleanly.

**Context for Agent:**
- `package.json` at repo root defines all deps. `tsconfig*.json` files configure TypeScript. `vite.config.ts` / `electron.vite.config.ts` configure Vite.
- TypeScript 5 → 6 may remove deprecated compiler options or change module resolution defaults. Check `tsconfig.json` for removed options.
- Vite 7 → 8 and @vitejs/plugin-react 4 → 6 may change config shape or plugin API. `electron-vite` ^5.0.0 must remain compatible with Vite 8 — if it isn't, pin Vite to the highest version electron-vite supports.
- Do NOT touch React or any runtime dependency in this phase.

**Tasks:**
- [x] **1.1** Update `package.json`: `typescript` → `^6.0.2`, `vite` → `^8.0.3`, `@vitejs/plugin-react` → `^6.0.1`
- [x] **1.2** Run `npm install` and capture any peer-dependency or resolution errors
- [x] **1.3** If `electron-vite` ^5.0.0 conflicts with Vite 8, check for an `electron-vite` update; if none exists, downgrade Vite to the highest compatible version and document the constraint (`electron-vite@5.0.0` latest supports `vite ^5 || ^6 || ^7`; pinned `vite@^7.3.1` and `@vitejs/plugin-react@^5.2.0`)
- [x] **1.4** Fix any `tsconfig.json` / `tsconfig.*.json` errors from TypeScript 6 (removed options, changed defaults)
- [x] **1.5** Fix any `vite.config.ts` / `electron.vite.config.ts` build config errors from Vite 8 / plugin-react 6 API changes
- [x] **1.6** Run `npm run build` and `npm run build:web` — fix all compile errors
- [x] **1.7** Update `@types/node` → `^25.5.0` and fix any resulting type errors in main-process code

**Acceptance Criteria:**
- [x] `npm install` completes without errors or unresolved peer deps
- [x] `npm run build` and `npm run build:web` succeed with zero errors
- [x] No TypeScript errors (`npx tsc --noEmit` passes)

**Validation:**
```bash
npm install && npm run build && npm run build:web && npx tsc --noEmit
```

---

## Phase 2 — React 19 + React Ecosystem Upgrade
**Assigned Agent:** Claude Sonnet 4.6

**Goal:** Upgrade React 18 → 19, react-dom, type definitions, and all React-dependent libraries (lucide-react, react-resizable-panels, @monaco-editor/react, zustand, @dnd-kit/*) — resolving any breaking API changes.

**Context for Agent:**
- React 19 removes legacy APIs (`ReactDOM.render` — must use `createRoot`), changes ref handling (refs as props, no `forwardRef` needed), and may change hook behavior.
- `@types/react` and `@types/react-dom` must match React 19 (`^19.x`).
- `lucide-react` 0.575 → 1.7.0: icons may be renamed; grep `src/` for all `lucide-react` imports and verify each icon still exists.
- `react-resizable-panels` 2 → 4: API may have changed (prop renames, removed components). Check all usages in `src/`.
- `@dnd-kit/sortable` 8 → 10 and `@dnd-kit/core` → 6.3.1: check for API changes in drag-and-drop hooks/components.
- `zustand` 5.0.11 → 5.0.12 is a patch — low risk but include it.
- `@monaco-editor/react` 4.7.0 is already latest — no change needed, but verify it works with React 19.
- Read all component files that import from these libraries before making changes.

**Tasks:**
- [x] **2.1** Update `package.json`: `react` → `^19.2.4`, `react-dom` → `^19.2.4`, `@types/react` → `^19.2.14`, `@types/react-dom` → `^19.2.3`
- [x] **2.2** Run `npm install`, resolve any peer-dep conflicts (some libs may not declare React 19 support — use `overrides` if needed)
- [x] **2.3** Grep for `ReactDOM.render` and migrate to `createRoot` if found
- [x] **2.4** Grep for `forwardRef` usage — refactor to direct ref props where React 19 supports it (optional, not blocking)
- [x] **2.5** Update `lucide-react` → `^1.7.0`; grep all lucide imports in `src/` and fix any renamed/removed icons
- [x] **2.6** Update `react-resizable-panels` → `^4.9.0`; read all files importing from it, fix any breaking prop/component changes
- [x] **2.7** Update `@dnd-kit/sortable` → `^10.0.0`, `@dnd-kit/core` → `^6.3.1`, `@dnd-kit/utilities` → `^3.2.2`; fix any API changes in drag-and-drop code
- [x] **2.8** Update `zustand` → `^5.0.12`
- [x] **2.9** Run `npm run build` and `npm run build:web` — fix all compile/type errors

**Acceptance Criteria:**
- [x] `npm install` completes cleanly
- [x] `npm run build` and `npm run build:web` succeed
- [x] No TypeScript errors (`npx tsc --noEmit`)
- [x] All lucide-react icons render (no missing icon errors at import time)

**Validation:**
```bash
npm install && npm run build && npm run build:web && npx tsc --noEmit
```

---

## Phase 3 — Remaining Dependency Upgrades (Non-React)
**Assigned Agent:** GPT-5.2-Codex

**Goal:** Upgrade all remaining dependencies that are not tied to the React or build-toolchain upgrades: parse5, highlight.js, prettier, fflate, monaco-editor, electron, electron-builder, jsdom.

**Context for Agent:**
- `parse5` 7 → 8: used for HTML parsing in the editor. Grep `src/` for `parse5` imports and check for API changes (e.g., changed function signatures, removed exports).
- `monaco-editor` 0.47 → 0.55.1: check `@monaco-editor/react` compatibility (it pins a monaco range). If incompatible, pin monaco to the version `@monaco-editor/react` 4.7.0 expects.
- `highlight.js` 11.11.1 is already latest — no change, but include for completeness.
- `prettier` 3.5.3 → 3.8.1: minor bump, low risk.
- `fflate` 0.8.2 is already latest — no change.
- `electron` 40 → 41: review Electron 41 breaking changes; check main-process code (`src/main/`) for deprecated APIs.
- `electron-builder` 26.8.1 is already latest — no change.
- `jsdom` 28 → 29: used in tests. Update and verify tests still pass.

**Tasks:**
- [x] **3.1** Update `package.json`: `parse5` → `^8.0.0`; fix any API changes in files importing parse5
- [x] **3.2** Update `monaco-editor` → `^0.55.1`; verify `@monaco-editor/react` 4.7.0 is compatible. If not, pin monaco to the highest compatible version
- [x] **3.3** Update `prettier` → `^3.8.1`
- [x] **3.4** Update `electron` → `^41.1.1`; review main-process code for deprecated Electron APIs
- [x] **3.5** Update `jsdom` → `^29.0.1`
- [x] **3.6** Update `overrides.minimatch` if needed (check if current override is still necessary)
- [x] **3.7** Run `npm install`, `npm run build`, `npm run build:web`

**Acceptance Criteria:**
- [x] `npm install` completes cleanly
- [x] `npm run build` and `npm run build:web` succeed
- [x] No TypeScript errors

**Validation:**
```bash
npm install && npm run build && npm run build:web && npx tsc --noEmit
```

---

## Phase 4 — Test Suite & Integration Validation
**Assigned Agent:** Claude Haiku 4.5

**Goal:** Run the full test suite, fix any test failures caused by the upgrades, and verify the app launches correctly in Electron dev mode.

**Context for Agent:**
- `vitest` 4.0.18 → 4.1.2 is a minor bump — update it in this phase.
- `jsdom` 29 may cause test environment differences — check test setup files.
- Run `npm test` and fix failures. Failures are likely due to changed APIs in parse5, React 19, or dnd-kit.
- Run `npm run dev` to verify the Electron app launches without runtime errors (check the dev console for warnings/errors).

**Tasks:**
- [x] **4.1** Update `vitest` → `^4.1.2`
- [x] **4.2** Run `npm test` — capture and categorize all failures
- [x] **4.3** Fix test failures related to parse5 API changes (no failures observed)
- [x] **4.4** Fix test failures related to React 19 / testing-library changes (no failures observed)
- [x] **4.5** Fix test failures related to jsdom 29 (no failures observed)
- [ ] **4.6** Run `npm run dev` — verify app launches, check console for errors
- [ ] **4.7** Run full validation suite one final time
  - [ ] Dev launch blocked in this environment: Electron failed with dbus/GPU errors after starting (`Failed to connect to socket /run/dbus/system_bus_socket`, `GPU process isn't usable`). Needs retry on a desktop session.

**Acceptance Criteria:**
- [ ] `npm test` passes with zero failures
- [ ] `npm run dev` launches the app without runtime errors
- [ ] No console warnings about deprecated APIs

**Validation:**
```bash
npm test && npm run build && npm run dev
```

---

## Phase 5 — Final Review & Compatibility Audit
**Assigned Agent:** Claude Opus 4.6

**Goal:** Review all changes across phases for correctness, verify no regressions were introduced, and confirm the dependency tree is clean.

**Context for Agent:**
- Review the git diff of all changes from Phases 1–4.
- Run `npm ls` to verify no unmet peer dependencies or duplicate major versions.
- Check `package-lock.json` for any resolution warnings.
- Verify the `overrides` section is still needed or can be cleaned up.
- Ensure no packages were accidentally downgraded below the versions documented in this plan.

**Tasks:**
- [x] **5.1** Run `npm ls` and verify clean dependency tree (no `UNMET PEER DEPENDENCY` or `invalid` markers)
- [x] **5.2** Review `package.json` — confirm all versions match the target versions from this plan
- [x] **5.3** Run `npm audit` and document any new vulnerabilities introduced by the upgrades
  - [x] `npm audit --omit=dev` reports 2 moderate `dompurify` advisories via `monaco-editor@0.55.1`; npm's suggested remediation is `npm audit fix --force`, which downgrades `monaco-editor` to `0.53.0`, so the Phase 3 target remains pinned and this is documented instead of downgraded.
- [x] **5.4** Run full build + test one final time: `npm install && npm run build && npm run build:web && npm test`
- [x] **5.5** If any conflicts were found, document the resolution (which package was pinned and why)
  - [x] `electron-vite@5.0.0` only supports `vite ^5 || ^6 || ^7`, so `vite` is pinned to `^7.3.1` and `@vitejs/plugin-react` to `^5.2.0` rather than the original Vite 8 / plugin-react 6 target.

**Acceptance Criteria:**
- [x] Clean `npm ls` output
- [x] `npm audit` shows no new high/critical vulnerabilities
- [x] Full build and test suite pass
- [x] Any version pins or overrides are documented with rationale

**Validation:**
```bash
npm ls && npm audit && npm run build && npm run build:web && npm test
```

---

## Dependency Graph

```
Phase 1 (Toolchain)
   ↓
Phase 2 (React 19 + ecosystem)
   ↓
Phase 3 (Remaining deps) ← can run after Phase 1, parallel to Phase 2 if no React overlap
   ↓
Phase 4 (Tests & integration)
   ↓
Phase 5 (Final review)
```

**Note:** Phase 3 depends on Phase 1 (needs working build toolchain) but is independent of Phase 2. However, running them sequentially is safer since Phase 2 may add `overrides` that affect Phase 3's install.

## Recommended Execution Order

| Order | Phase | Agent | Depends On | Est. Complexity |
|-------|-------|-------|------------|-----------------|
| 1 | Phase 1 — Toolchain | GPT-5.3-Codex | — | Medium |
| 2 | Phase 2 — React 19 | Claude Sonnet 4.6 | Phase 1 | High |
| 3 | Phase 3 — Remaining deps | GPT-5.2-Codex | Phase 1 | Medium |
| 4 | Phase 4 — Tests | Claude Haiku 4.5 | Phases 2, 3 | Low-Medium |
| 5 | Phase 5 — Final review | Claude Opus 4.6 | Phase 4 | Low |

## Handoff Prompts

- **Phase 1 → GPT-5.3-Codex:** `[Active settings: None] Run /execute-plan Phase 1 — Upgrade TypeScript to 6, Vite to 8, @vitejs/plugin-react to 6, @types/node to 25. Fix all build config and type errors. Ensure npm run build, build:web, and tsc --noEmit all pass.`
- **Phase 2 → Claude Sonnet 4.6:** `[Active settings: None] Run /execute-plan Phase 2 — Upgrade React to 19, react-dom to 19, all React type defs, lucide-react to 1.7, react-resizable-panels to 4.9, @dnd-kit/sortable to 10, zustand to 5.0.12. Fix all breaking changes and verify build passes.`
- **Phase 3 → GPT-5.2-Codex:** `[Active settings: None] Run /execute-plan Phase 3 — Upgrade parse5 to 8, monaco-editor to 0.55.1, prettier to 3.8, electron to 41, jsdom to 29. Fix any API changes and verify build passes.`
- **Phase 4 → Claude Haiku 4.5:** `[Active settings: None] Run /execute-plan Phase 4 — Update vitest to 4.1.2, run full test suite, fix all failures, verify app launches with npm run dev.`
- **Phase 5 → Claude Opus 4.6:** `[Active settings: None] Run /execute-plan Phase 5 — Final review: npm ls, npm audit, full build+test, verify all target versions, document any pins or overrides.`

---

## Target Version Summary

| Package | Current | Target |
|---|---|---|
| `@dnd-kit/core` | ^6.1.0 | ^6.3.1 |
| `@dnd-kit/sortable` | ^8.0.0 | ^10.0.0 |
| `@dnd-kit/utilities` | ^3.2.2 | ^3.2.2 (no change) |
| `@monaco-editor/react` | ^4.7.0 | ^4.7.0 (no change) |
| `highlight.js` | ^11.11.1 | ^11.11.1 (no change) |
| `lucide-react` | ^0.575.0 | ^1.7.0 |
| `monaco-editor` | ^0.47.0 | ^0.55.1 |
| `parse5` | ^7.1.2 | ^8.0.0 |
| `prettier` | ^3.5.3 | ^3.8.1 |
| `react` | ^18.3.1 | ^19.2.4 |
| `react-dom` | ^18.3.1 | ^19.2.4 |
| `react-resizable-panels` | ^2.1.9 | ^4.9.0 |
| `zustand` | ^5.0.11 | ^5.0.12 |
| `fflate` | ^0.8.2 | ^0.8.2 (no change) |
| `@types/node` | ^22.10.2 | ^25.5.0 |
| `@types/react` | ^18.3.12 | ^19.2.14 |
| `@types/react-dom` | ^18.3.1 | ^19.2.3 |
| `@vitejs/plugin-react` | ^4.3.4 | ^6.0.1 |
| `electron` | ^40.6.0 | ^41.1.1 |
| `electron-builder` | ^26.8.1 | ^26.8.1 (no change) |
| `electron-vite` | ^5.0.0 | ^5.0.0 (verify Vite 8 compat) |
| `jsdom` | ^28.1.0 | ^29.0.1 |
| `typescript` | ^5.7.2 | ^6.0.2 |
| `vite` | ^7.3.1 | ^8.0.3 |
| `vitest` | ^4.0.18 | ^4.1.2 |
