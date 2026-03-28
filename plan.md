# Tutorial Expansion — Execution Plan

**Active Settings:** None

---

## Phase 1 — Core Tutorial UX Fixes (Pages, Widgets, Properties, Responsive, Keyboard Shortcuts)
**Assigned Agent:** GPT-5.3-Codex

### Goal
Fix and improve the existing tutorial steps: expand Pages to include right-click context menu, fix the drag-to-canvas step orientation, make Properties and Responsive View non-blocking (Next button instead of requiring action), and rework Keyboard Shortcuts to point at Help menu instead of asking the user to press `?`.

### Context for Agent
- Tutorial steps: `src/renderer/components/Tutorial/tutorialSteps.ts` — 13 steps currently defined.
- Tutorial store: `src/renderer/store/tutorialStore.ts` — action types: `click`, `drag-to-canvas`, `select-block`, `change-viewport`, `edit-property`, `none`.
- Tutorial overlay: `src/renderer/components/Tutorial/TutorialOverlay.tsx` — positions spotlight and info box.
- Tutorial info box: `src/renderer/components/Tutorial/TutorialInfoBox.tsx` — renders step content with Next/Back/Skip.
- Sidebar pages: `src/renderer/components/Sidebar/Sidebar.tsx` — pages list with right-click context menu (Open, Page Properties, Move to, Delete). Context menu state: `pageContextMenu { x, y, pageId }`.
- Editor layout: `src/renderer/store/editorStore.ts` — `setEditorLayout('standard')` ensures sidebar + canvas + inspector visible.
- Widget grid: `[data-tutorial="widget-grid"]` is the drag source. Canvas is `[data-tutorial="canvas"]`.
- Toolbar has `[data-tutorial="toolbar-viewport"]` for responsive preview.
- Inspector: `[data-tutorial="inspector"]` — edit-property action currently requires the user to change a block property to advance.
- Keyboard shortcuts: `src/renderer/components/KeyboardShortcutsHelp/KeyboardShortcutsHelp.tsx` — opened via Help menu or `Ctrl+?`.
- Help menu button likely in toolbar or menubar area — find selector for it.
- Need to add `data-tutorial` attributes to: Help menu button, page list area, and any new target elements.

### Tasks
- [x] **1.1** **Pages step expansion**: After the existing `sidebar-pages` step (id: `sidebar-pages`), insert a new step `page-context-menu` that:
  - Spotlights the first page item in the sidebar page list (add `data-tutorial="page-list-item"` to the first page `<li>` or `<div>` in `Sidebar.tsx`).
  - Body text: "Right-click a page to see options like Page Properties, Move to Folder, and more."
  - Action type: `none`, autoAdvance: `false` (Next button to proceed).
  - `onEnter`: ensure Pages tab is open.

- [x] **1.2** **Drag-to-canvas fix — reorder/orient**: Modify the `drag-widget` step's `onEnter` callback to call `setEditorLayout('standard')` to ensure the canvas is visible alongside the widget panel. If the current layout hides the canvas, switch to standard layout first.
  - Also update the body text to be clearer: "Grab any widget from the list and drag it onto the canvas area to the right. If the widget appears on the page, you're good to go!"
  - The step already has `autoAdvance: true` with `drag-to-canvas` action — keep that, but ensure the overlay doesn't block the drag interaction. Check that the `SpotlightMask` click-through allows drag events on the widget grid.

- [x] **1.3** **Properties step — make Next-clickable**: Change the `inspector` step:
  - Change `action` from `{ type: 'edit-property' }` to `{ type: 'none' }`.
  - Change `autoAdvance` from `true` to `false`.
  - Update body text: "The Inspector shows all properties for the selected block. You can change text, colors, spacing, and more. Click Next to continue."

- [x] **1.4** **Responsive View step — make Next-clickable**: Change the `toolbar-viewport` step:
  - Change `action` from `{ type: 'change-viewport' }` to `{ type: 'none' }`.
  - Change `autoAdvance` from `true` to `false`.
  - Update body text: "Switch between Desktop, Tablet, and Mobile views to see how your page looks at each breakpoint. Click Next to continue."

- [x] **1.5** **Keyboard Shortcuts step — arrow to Help menu**: Rework the `keyboard-shortcuts` step:
  - Add `data-tutorial="help-menu-btn"` to the Help button in the toolbar/menubar.
  - Change `target` from `null` to `'[data-tutorial="help-menu-btn"]'` so the spotlight highlights the Help menu.
  - Set `arrowDirection` to `'bottom'` (or appropriate direction based on Help button location).
  - Update body text: "Click <strong>Help → Keyboard Shortcuts</strong> to view all shortcuts. <a href='#' data-action='open-shortcuts'>Open Keyboard Shortcuts</a>"
  - Add a click handler (via `onEnter` or inline link) that opens the keyboard shortcuts panel when the link is clicked. Wire the `data-action='open-shortcuts'` link to dispatch the keyboard shortcuts dialog.
  - Keep action type `none`, autoAdvance `false` — user clicks Next to proceed.
  - Ensure the tutorial state persists if the user opens the shortcuts dialog from this link (tutorial overlay should remain active after dialog closes).

- [x] **1.6** Add all new `data-tutorial` attributes to the relevant components:
  - `data-tutorial="page-list-item"` on the first page item in Sidebar.
  - `data-tutorial="help-menu-btn"` on the Help menu trigger button.
  - Verify existing attributes still work after changes.

- [x] **1.7** Update step count references — the total will change as new steps are added. Ensure `TutorialInfoBox` step counter dynamically uses `steps.length` (it already does via `totalSteps` prop).

### Acceptance Criteria
- [x] Pages step includes right-click context mention with spotlight on first page item
- [x] Drag-to-canvas step ensures standard layout with canvas visible before asking user to drag
- [x] Properties step allows advancing via Next button without requiring an edit
- [x] Responsive View step allows advancing via Next button without requiring viewport change
- [x] Keyboard Shortcuts step points to Help menu with arrow, includes clickable link to open shortcuts
- [x] Tutorial state persists when shortcuts dialog is opened and closed
- [x] All new `data-tutorial` attributes are present
- [ ] Existing tutorial steps still function correctly

### Validation Steps
- Run the tutorial end-to-end and verify each modified step
- Verify drag-to-canvas works (widget can be dragged through spotlight overlay)
- Verify Next button appears on Properties and Responsive View steps
- Verify Keyboard Shortcuts link opens the shortcuts panel without breaking tutorial
- [x] `npm test` passes
- [x] `npm run build` succeeds

---

## Phase 2 — Completion Step Redesign & Branching Tutorial Architecture
**Assigned Agent:** Claude Sonnet 4.6

### Goal
Redesign the "You're all set!" completion step: remove the Skip button, replace "Explore on your own" with a branching choice UI offering three extended tutorial paths (AI Assistance, Web Media Search, Publish). Extend `TutorialStep` and `tutorialStore` to support branching flows and sub-tutorial loading.

### Context for Agent
- Current completion step: `tutorialSteps.ts` line 167–175 — id `completion`, no target, body text, "Explore on your own" button.
- `TutorialInfoBox.tsx` — renders buttons; `isCompletion` flag triggers confetti. Currently has: Back, primary button ("Explore on your own"), and Skip button.
- `tutorialStore.ts` — `completeTutorial()` persists completion and deactivates. `startTutorial(steps)` loads a step array and starts from index 0.
- The branching step needs to offer 3 clickable cards/buttons. When clicked, load the corresponding sub-tutorial steps and continue the flow (not restart — continue from current state).
- Need a new concept: **sub-tutorial steps** — after the base tutorial, the user picks a branch. Each branch is a separate array of steps that gets appended or loaded.
- `TutorialStep` interface in `tutorialStore.ts` may need a new optional field like `choices?: TutorialChoice[]` for branching UI.
- `TutorialInfoBox.tsx` needs a new rendering mode when `step.choices` is present — show choice cards instead of Next/Back/Skip.

### Tasks
- [x] **2.1** Extend `TutorialStep` interface in `tutorialStore.ts`:
  - Add optional `choices?: TutorialChoice[]` field.
  - Define `TutorialChoice` interface: `{ id: string, label: string, description: string, icon?: string, steps: TutorialStep[] }`.
  - Add optional `hideSkip?: boolean` field to control Skip button visibility per step.
  - Add optional `hidePrimaryAction?: boolean` to hide the Next/Explore button when choices are shown.

- [x] **2.2** Add `loadBranchSteps(branchSteps: TutorialStep[])` action to `tutorialStore`:
  - Inserts `branchSteps` after the current step index in the `steps` array.
  - Calls `nextStep()` to advance into the branch.
  - This allows seamless continuation without restarting.

- [x] **2.3** Redesign the `completion` step in `tutorialSteps.ts`:
  - Change id to `branch-choice` (the actual completion will be at the end of each branch or if user declines).
  - Set `hideSkip: true` and `hidePrimaryAction: true`.
  - Title: "You're all set with the basics!"
  - Body: "Amagon offers more. Want to dive deeper into one of these features?"
  - Add `choices` array with three options:
    1. `{ id: 'ai-assistance', label: 'AI Assistance', description: 'Learn to use AI providers for chat, code generation, and styling', icon: '🤖' }`
    2. `{ id: 'web-media-search', label: 'Web Media Search', description: 'Search and import images from Unsplash, Pexels, and Pixabay', icon: '🖼️' }`
    3. `{ id: 'publish', label: 'Publish Your Site', description: 'Deploy to GitHub Pages, Cloudflare, or Neocities', icon: '🚀' }`
  - Each choice's `steps` array will be empty placeholder arrays for now (filled in Phases 3–5).
  - Add a 4th option or a small link: "No thanks, I'll explore on my own" that calls `completeTutorial()`.

- [x] **2.4** Update `TutorialInfoBox.tsx` to handle branching:
  - When `step.choices` is present, render choice cards instead of normal navigation.
  - Each card: icon, label, description, clickable. On click → call `loadBranchSteps(choice.steps)`.
  - Add a "No thanks, explore on my own" text button below the cards that calls `completeTutorial()`.
  - When `step.hideSkip` is true, hide the Skip button.
  - When `step.hidePrimaryAction` is true, hide the Next/Explore button.
  - Style the choice cards: flex column or row layout, hover effect, clear clickable affordance.

- [x] **2.5** Add CSS for the branching choice UI in `Tutorial.css`:
  - `.tutorial-choices` container with flex layout.
  - `.tutorial-choice-card` with icon, label, description, hover state, border, padding.
  - `.tutorial-choice-decline` link/button styled as subtle text.
  - Ensure cards fit within the info box width (may need to increase info box width for this step).

- [x] **2.6** Add a true `completion` step that goes at the end of each branch tutorial:
  - Same confetti animation as current completion.
  - Title: "Tutorial complete!"
  - Body: "You've finished the [branch name] tutorial. You can restart any tutorial from Settings → General."
  - "Explore on your own" button calls `completeTutorial()`.
  - This step template will be reused by each branch (Phases 3–5).

### Acceptance Criteria
- [x] Completion step shows 3 choice cards + decline option (no Skip button, no Next button)
- [x] Clicking a choice loads that branch's steps and continues the tutorial
- [x] Clicking "explore on my own" completes the tutorial
- [x] `TutorialStep` interface supports `choices`, `hideSkip`, `hidePrimaryAction`
- [x] `loadBranchSteps` correctly inserts steps and advances
- [x] Choice card UI is styled and accessible (keyboard navigable, ARIA labels)
- [x] Each branch ends with a proper completion step

### Validation Steps
- Verify branching UI renders correctly with placeholder branches
- Click each choice card and verify branch steps load
- Click decline and verify tutorial completes
- Verify Back button from first branch step goes back to choice screen
- Keyboard navigate through choice cards
- `npm test` passes
- `npm run build` succeeds

---

## Phase 3 — AI Assistance Branch Tutorial
**Assigned Agent:** GPT-5.3-Codex

### Goal
Implement the AI Assistance branch tutorial: introduce AI providers, check/prompt for API key setup, navigate to AI chat, guide user through dragging a button, adding a CSS class, adding an onclick event via AI, using theme designer, and editing custom CSS via AI.

### Context for Agent
- AI store: `src/renderer/store/aiStore.ts` — has provider config, API key check.
- AI config check: Main process IPC `ai:getConfig` returns `{ provider, model, encryptedApiKeys }`. If no key for active provider, prompt setup.
- AI assistant sidebar tab: `data-tutorial="sidebar-tab-ai"` (add if missing).
- AI chat UI: `src/renderer/components/AiAssistant/AiAssistant.tsx` — `.ai-assistant`, `.ai-input`, `.ai-send-btn`.
- Global settings: opened via some action, has "keys" tab for API key management.
- Widget drag: reuse existing `drag-to-canvas` action detection.
- CSS classes editor: `src/renderer/components/Inspector/CssClassesEditor.tsx` — `.css-classes-editor`, `.inspector-input`.
- Event actions editor: `src/renderer/components/Inspector/EventActionsEditor.tsx` — `.event-actions-editor`, `.event-actions-add-btn`.
- Theme editor: `src/renderer/components/ThemeEditor/ThemeEditor.tsx` — opened via menu/toolbar.
- Custom CSS: Theme editor → Custom CSS tab, Monaco editor.
- AI CSS assist: `AiCssAssistModal` available in custom CSS.
- Need `data-tutorial` attributes on: AI tab, AI chat input, AI send button, CSS classes input, event actions editor, theme editor trigger, custom CSS tab.
- Tutorial step architecture from Phase 2: branch steps array loaded via `loadBranchSteps`.
- Need new action types in `tutorialStore.ts` for: `add-class` (detect class added to block), `add-event` (detect event added), `open-theme-editor` (detect theme editor opened), `ai-message-sent` (detect AI message sent).

### Tasks
- [ ] **3.1** Create `src/renderer/components/Tutorial/branches/aiAssistanceTutorial.ts` exporting `aiAssistanceSteps: TutorialStep[]`.

- [ ] **3.2** **Step: AI Introduction** (no target, centered):
  - Title: "AI Assistance"
  - Body: "Amagon supports multiple AI providers (OpenAI, Anthropic, Google, Mistral, Ollama). You can use AI for chat-based code generation, styling assistance, and more."
  - Action: `none`, autoAdvance: `false`.

- [ ] **3.3** **Step: API Key Check** (conditional):
  - `onEnter`: Check if an AI API key is configured (query `aiStore` or IPC `ai:getConfig`). If a key exists for any provider, skip this step automatically (call `nextStep()` in `onEnter`).
  - If no key: spotlight the Settings/Keys area. Title: "Set up an AI Provider". Body: "To use AI features, you need an API key. Click the button below to open settings, or click Next if you've already set one up."
  - Include a clickable element or `onEnter` action that opens Global Settings → Keys tab.
  - Action: `none`, autoAdvance: `false`.

- [ ] **3.4** **Step: Navigate to AI Chat** — spotlight the AI sidebar tab:
  - Target: `[data-tutorial="sidebar-tab-ai"]`.
  - Title: "Open AI Chat"
  - Body: "Click the AI tab to open the AI assistant."
  - Action: `click`, autoAdvance: `true`.
  - `onEnter`: ensure sidebar is visible via `setEditorLayout('standard')`.

- [ ] **3.5** **Step: Drag a Button widget** — spotlight widget grid:
  - `onEnter`: switch to Widgets tab first.
  - Title: "Add a Button"
  - Body: "Drag a Button widget onto the canvas."
  - Action: `drag-to-canvas`, autoAdvance: `true`.

- [ ] **3.6** **Step: Add CSS class `.ai-button-demo`** — spotlight CSS classes editor in Inspector:
  - `onEnter`: ensure the newly added button is selected (or prompt user to select it).
  - Target: `[data-tutorial="css-classes-editor"]` (add this `data-tutorial` attribute to `CssClassesEditor.tsx`).
  - Title: "Add a CSS Class"
  - Body: "In the CSS Classes field, type <code>ai-button-demo</code> and press Enter."
  - Add new action type `add-class` to `tutorialStore.ts` — subscribe to `editorStore.blocks` and check if selected block's `classes` array includes `ai-button-demo`.
  - autoAdvance: `true`.

- [ ] **3.7** **Step: Add onclick event via AI** — spotlight event actions editor:
  - Target: `[data-tutorial="event-actions-editor"]` (add this attribute to `EventActionsEditor.tsx`).
  - Title: "Add an Event with AI"
  - Body: "Click <strong>+ Add Event</strong>, select <strong>On Click</strong>, then use the AI assist button to generate: <code>alert('Hello World')</code>."
  - Action: `add-event` — new action type that detects when an event is added to the selected block (subscribe to block's events/attributes).
  - autoAdvance: `true`.
  - Note: If detecting exact event addition is too complex, fall back to `none` with manual Next.

- [ ] **3.8** **Step: Open Theme Designer** — spotlight theme editor trigger:
  - Target: `[data-tutorial="theme-editor-btn"]` (add to the toolbar/menu button that opens theme editor).
  - Title: "Theme Designer"
  - Body: "Open the Theme Designer to redesign your site's colors."
  - Action: `click`, autoAdvance: `true`.
  - `onEnter`: ensure toolbar is visible.

- [ ] **3.9** **Step: Redesign colors** (inside theme editor):
  - Target: spotlight the Colors tab in theme editor (add `data-tutorial="theme-colors-tab"`).
  - Title: "Redesign Site Colors"
  - Body: "Explore the color options or pick a preset. Change any color to see live updates on the canvas."
  - Action: `none`, autoAdvance: `false` (Next to continue).

- [ ] **3.10** **Step: Custom CSS via AI** — navigate to Custom CSS tab:
  - Target: spotlight Custom CSS tab (add `data-tutorial="theme-custom-css-tab"`).
  - Title: "Custom CSS with AI"
  - Body: "Go to the Custom CSS tab. Use the AI assist to change the <code>.ai-button-demo</code> button color to red."
  - Action: `none`, autoAdvance: `false`.

- [ ] **3.11** **Step: AI Branch Completion** — reuse completion template from Phase 2 task 2.6:
  - Title: "AI Assistance Tutorial Complete!"
  - Body: "You've learned how to use AI for code generation, styling, and theme customization."
  - Confetti, "Explore on your own" button.

- [ ] **3.12** Add all required `data-tutorial` attributes to components:
  - `CssClassesEditor.tsx`: `data-tutorial="css-classes-editor"`
  - `EventActionsEditor.tsx`: `data-tutorial="event-actions-editor"`
  - Theme editor open button: `data-tutorial="theme-editor-btn"`
  - Theme Colors tab: `data-tutorial="theme-colors-tab"`
  - Theme Custom CSS tab: `data-tutorial="theme-custom-css-tab"`
  - AI sidebar tab (verify exists): `data-tutorial="sidebar-tab-ai"`

- [ ] **3.13** Add new action types to `tutorialStore.ts` `startActionListener`:
  - `add-class`: subscribe to `editorStore.blocks`, check selected block's classes for target value.
  - `add-event`: subscribe to `editorStore.blocks`, check selected block's events/attributes for new event handler.
  - (Or simplify: only `add-class` with auto-detect, keep event step as manual Next.)

- [ ] **3.14** Wire AI assistance steps into the `branch-choice` step's choices array (replace placeholder from Phase 2).

### Acceptance Criteria
- [ ] AI tutorial branch has ~10 steps covering: intro, API key check, AI chat, drag button, add class, add event, theme designer, custom CSS
- [ ] API key check step auto-skips if key is already configured
- [ ] `add-class` action correctly detects when `.ai-button-demo` is added
- [x] All new `data-tutorial` attributes are present on target elements
- [ ] Branch loads correctly from the choice screen and ends with completion
- [ ] Tutorial state persists throughout the branch

### Validation Steps
- Run base tutorial → choose AI Assistance → verify all steps render correctly
- Test with and without an AI API key configured
- Verify CSS class detection works
- Verify theme editor steps spotlight correct elements
- `npm test` passes
- `npm run build` succeeds

---

## Phase 4 — Web Media Search Branch Tutorial
**Assigned Agent:** GPT-5.2-Codex

### Goal
Implement the Web Media Search branch tutorial: highlight Asset Manager, open Web Search, check/prompt for API key, search for "dog", insert first 3 images, close asset manager, drag a carousel widget, and assign the imported images.

### Context for Agent
- Asset Manager: `src/renderer/components/AssetManager/AssetManager.tsx` — modal opened from image/video fields in Inspector.
- MediaSearchPanel: `src/renderer/components/AssetManager/MediaSearchPanel.tsx` — `.msp-search-form`, `.msp-search-btn`, `.msp-results-grid`, `.msp-result-item`.
- Media search config: IPC `media-search:getConfig` returns `{ enabled, provider, encryptedApiKeys }`.
- Carousel widget: type `carousel`, Inspector shows `CarouselField.tsx` with `.carousel-add-btn` to add slides, `.carousel-slides-list`.
- Asset picker opens in multi-image mode for carousel.
- Need `data-tutorial` attributes on: Asset Manager trigger (find where it's opened from toolbar/menu), Web Search tab in Asset Manager, search input, result items, carousel add slides button.
- The tutorial needs to guide: open asset manager → web search → search "dog" → select 3 images → insert → close → drag carousel → assign images.
- This is a complex multi-step flow. Some steps may need to detect state changes (images imported to project, carousel block added, images assigned).

### Tasks
- [ ] **4.1** Create `src/renderer/components/Tutorial/branches/webMediaSearchTutorial.ts` exporting `webMediaSearchSteps: TutorialStep[]`.

- [ ] **4.2** **Step: Web Media Intro** (centered, no target):
  - Title: "Web Media Search"
  - Body: "Search for images from Unsplash, Pexels, and Pixabay — right from Amagon. Let's try it out."
  - Action: `none`.

- [ ] **4.3** **Step: Open Asset Manager** — spotlight the asset manager trigger:
  - Find or add a toolbar/menu button that opens the Asset Manager directly (or spotlight the menu path).
  - Add `data-tutorial="asset-manager-btn"` to the trigger.
  - Title: "Open Asset Manager"
  - Body: "Click to open the Asset Manager where you can browse and import media."
  - Action: `click`, autoAdvance: `true`.

- [ ] **4.4** **Step: Go to Web Search tab**:
  - Target: the Web Search tab in Asset Manager (add `data-tutorial="am-web-search-tab"`).
  - Title: "Web Search"
  - Body: "Click the Web Search tab to search for images online."
  - Action: `click`, autoAdvance: `true`.

- [ ] **4.5** **Step: API Key Check** (conditional):
  - `onEnter`: Check if media search API key is configured. If yes, auto-skip.
  - If no key: spotlight settings button in MediaSearchPanel (`.msp-settings-btn`).
  - Title: "Configure Media Search"
  - Body: "Set up an API key for your preferred image provider (Unsplash, Pexels, or Pixabay) to enable web search."
  - Action: `none`, autoAdvance: `false`.

- [ ] **4.6** **Step: Search for "dog"**:
  - Target: `.msp-search-form` or the search input (add `data-tutorial="media-search-input"`).
  - Title: "Search for Images"
  - Body: "Type <code>dog</code> in the search box and click Search."
  - Action: `none` (user types and searches manually, click Next after results appear). Or detect search results appearing.
  - autoAdvance: `false`.

- [ ] **4.7** **Step: Select and Insert 3 images**:
  - Target: `.msp-results-grid` (add `data-tutorial="media-search-results"`).
  - Title: "Select Images"
  - Body: "Click on the first 3 images to select them, then click <strong>Insert Selected</strong> to add them to your project."
  - Action: `none`, autoAdvance: `false` (Next to continue after inserting).

- [ ] **4.8** **Step: Close Asset Manager**:
  - Title: "Close Asset Manager"
  - Body: "Close the Asset Manager to return to the editor."
  - Action: `none`, autoAdvance: `false`.
  - `onEnter`: Could auto-close if asset manager provides a close callback.

- [ ] **4.9** **Step: Drag a Carousel widget**:
  - `onEnter`: switch to Widgets tab.
  - Target: `[data-tutorial="widget-grid"]`.
  - Title: "Add a Carousel"
  - Body: "Drag a Carousel widget onto the canvas."
  - Action: `drag-to-canvas`, autoAdvance: `true`.

- [ ] **4.10** **Step: Assign images to Carousel**:
  - Target: spotlight the carousel field in Inspector (add `data-tutorial="carousel-field"`).
  - `onEnter`: ensure the carousel block is selected.
  - Title: "Add Images to Carousel"
  - Body: "Click <strong>+ Add Slides</strong> and select the images you just imported."
  - Action: `none`, autoAdvance: `false`.

- [ ] **4.11** **Step: Web Media Branch Completion**:
  - Title: "Web Media Search Tutorial Complete!"
  - Body: "You've learned how to search, import, and use web images in your projects."
  - Confetti, "Explore on your own" button.

- [ ] **4.12** Add all required `data-tutorial` attributes to components:
  - Asset Manager trigger: `data-tutorial="asset-manager-btn"`
  - Web Search tab: `data-tutorial="am-web-search-tab"`
  - Media search input: `data-tutorial="media-search-input"`
  - Media search results grid: `data-tutorial="media-search-results"`
  - Carousel field in Inspector: `data-tutorial="carousel-field"`

- [ ] **4.13** Wire web media search steps into the `branch-choice` step's choices array (replace placeholder from Phase 2).

### Acceptance Criteria
- [ ] Web Media branch has ~10 steps covering the full search-to-carousel flow
- [ ] API key check step auto-skips if key is already configured
- [ ] Asset Manager opens and Web Search tab is navigable during tutorial
- [ ] Carousel drag detection works (reuses existing `drag-to-canvas` action)
- [ ] All `data-tutorial` attributes present on target elements
- [ ] Branch ends with proper completion step

### Validation Steps
- Run base tutorial → choose Web Media Search → verify all steps
- Test with and without media search API key
- Verify carousel widget drag works within tutorial
- `npm test` passes
- `npm run build` succeeds

---

## Phase 5 — Publish Branch Tutorial
**Assigned Agent:** GPT-5.2-Codex

### Goal
Implement the Publish branch tutorial: introduce publishing providers, guide through the PublishDialog flow (select provider, configure credentials, validate, publish).

### Context for Agent
- PublishDialog: `src/renderer/components/PublishDialog/PublishDialog.tsx` — 4-step wizard (Select → Configure → Validate → Publish).
- Opened via menu or toolbar action — find the trigger and add `data-tutorial` attribute.
- Provider cards: `.publish-provider-card` — clickable cards for GitHub Pages, Cloudflare, Neocities.
- Credential inputs: `.publish-field-input`.
- Validation button: `.publish-btn-primary`.
- Progress tracking: `.publish-progress-track`.
- Publish dialog state is internal to the component (step index 0–3).
- Need `data-tutorial` attributes on: publish trigger button, provider cards area, credential form, validate button, publish button.

### Tasks
- [ ] **5.1** Create `src/renderer/components/Tutorial/branches/publishTutorial.ts` exporting `publishSteps: TutorialStep[]`.

- [ ] **5.2** **Step: Publish Introduction** (centered, no target):
  - Title: "Publish Your Site"
  - Body: "Deploy your site to GitHub Pages, Cloudflare Pages, or Neocities — directly from Amagon."
  - Action: `none`.

- [ ] **5.3** **Step: Open Publish Dialog**:
  - Target: `[data-tutorial="publish-btn"]` (add to the publish trigger in toolbar/menu).
  - Title: "Open Publish"
  - Body: "Click to open the Publish dialog."
  - Action: `click`, autoAdvance: `true`.

- [ ] **5.4** **Step: Select a Provider**:
  - Target: `.publish-provider-card` area or add `data-tutorial="publish-providers"` to the provider selection container.
  - Title: "Choose a Provider"
  - Body: "Select where you'd like to deploy your site. Each provider has different features and requirements."
  - Action: `none`, autoAdvance: `false`.

- [ ] **5.5** **Step: Configure Credentials**:
  - Target: add `data-tutorial="publish-credentials"` to the credentials form area.
  - Title: "Enter Credentials"
  - Body: "Fill in the required credentials for your chosen provider. These are stored securely on your machine."
  - Action: `none`, autoAdvance: `false`.

- [ ] **5.6** **Step: Validate Configuration**:
  - Target: add `data-tutorial="publish-validate-btn"` to the Validate button.
  - Title: "Validate"
  - Body: "Click Validate to check that your credentials and configuration are correct before publishing."
  - Action: `none`, autoAdvance: `false`.

- [ ] **5.7** **Step: Publish**:
  - Target: add `data-tutorial="publish-action-btn"` to the Publish button.
  - Title: "Publish!"
  - Body: "When ready, click Publish to deploy your site. You'll see a progress bar and get a live URL when it's done."
  - Action: `none`, autoAdvance: `false`.

- [ ] **5.8** **Step: Publish Branch Completion**:
  - Title: "Publish Tutorial Complete!"
  - Body: "You now know how to deploy your site. You can publish updates any time from the same dialog."
  - Confetti, "Explore on your own" button.

- [ ] **5.9** Add all required `data-tutorial` attributes:
  - Publish trigger: `data-tutorial="publish-btn"`
  - Provider selection area: `data-tutorial="publish-providers"`
  - Credentials form: `data-tutorial="publish-credentials"`
  - Validate button: `data-tutorial="publish-validate-btn"`
  - Publish button: `data-tutorial="publish-action-btn"`

- [ ] **5.10** Wire publish steps into the `branch-choice` step's choices array (replace placeholder from Phase 2).

### Acceptance Criteria
- [ ] Publish branch has ~7 steps covering intro → open → provider → credentials → validate → publish → completion
- [ ] PublishDialog opens correctly during tutorial
- [ ] All `data-tutorial` attributes present on publish UI elements
- [ ] Tutorial overlays render correctly on top of the PublishDialog modal
- [ ] Branch ends with proper completion step

### Validation Steps
- Run base tutorial → choose Publish → verify all steps
- Verify publish dialog layers correctly with tutorial overlay (z-index)
- `npm test` passes
- `npm run build` succeeds

---

## Phase 6 — Integration, Polish & QA
**Assigned Agent:** Claude Sonnet 4.6

### Goal
Integrate all three branch tutorials, verify end-to-end flows, fix edge cases (z-index layering with modals, branch navigation, step counts), polish the choice card UI, and ensure no regressions.

### Context for Agent
- All branch files: `src/renderer/components/Tutorial/branches/aiAssistanceTutorial.ts`, `webMediaSearchTutorial.ts`, `publishTutorial.ts`.
- Main tutorial steps: `src/renderer/components/Tutorial/tutorialSteps.ts` — now includes `branch-choice` step.
- Tutorial store: `src/renderer/store/tutorialStore.ts` — `loadBranchSteps` action.
- TutorialInfoBox: `src/renderer/components/Tutorial/TutorialInfoBox.tsx` — choice card rendering.
- TutorialOverlay: `src/renderer/components/Tutorial/TutorialOverlay.tsx` — spotlight positioning.
- Tutorial CSS: `src/renderer/components/Tutorial/Tutorial.css`.
- Z-index concerns: Tutorial overlay is z-index 10000–10004. PublishDialog and AssetManager are modal overlays — verify tutorial renders above them.

### Tasks
- [ ] **6.1** Verify all three branches are correctly wired into the `branch-choice` step's `choices` array. Import all branch step arrays and assign them.

- [ ] **6.2** Test z-index layering: ensure tutorial overlay (spotlight, info box) renders above PublishDialog (`.publish-overlay`), AssetManager, ThemeEditor, and Global Settings modals. Adjust z-index if needed.

- [ ] **6.3** Test Back navigation: from the first step of any branch, pressing Back should return to the `branch-choice` step (not the step before it in the base tutorial).

- [ ] **6.4** Test Skip behavior: skipping during a branch should exit the entire tutorial (both branch and base), not just the branch.

- [ ] **6.5** Verify step counter: during a branch, the counter should show progress within the current branch steps (e.g., "3 of 10 — AI Assistance"), not the base tutorial's total. Or show combined total — decide on UX and implement consistently.

- [ ] **6.6** Polish choice cards: ensure they look good in both light and dark themes, have hover/focus states, are keyboard navigable (Tab between cards, Enter to select), and have proper ARIA roles (`role="group"` with `role="button"` cards).

- [ ] **6.7** Verify all `data-tutorial` attributes across all components are present and pointing to correct elements. Run through each branch manually.

- [ ] **6.8** Run `npm test` and `npm run build` to verify no regressions.

- [ ] **6.9** Code review: ensure no security issues (especially around the `dangerouslySetInnerHTML` in step body text — all HTML is statically defined, not user input, so this is acceptable).

### Acceptance Criteria
- [ ] All 3 branches load and complete successfully from the choice screen
- [ ] Z-index layering works correctly with all modal dialogs
- [ ] Back/Skip navigation behaves correctly in branches
- [ ] Step counter shows appropriate progress
- [ ] Choice cards are polished and accessible in both themes
- [ ] All `data-tutorial` attributes verified
- [ ] No test regressions
- [ ] Build succeeds

### Validation Steps
- Full end-to-end test: base tutorial → each branch → completion
- Test all 3 branches in light and dark mode
- Test keyboard navigation through choice cards and all branch steps
- Test Skip at various points during branches
- `npm test` passes
- `npm run build` succeeds

---

## Phase 7 — Simple QA Pass
**Assigned Agent:** Claude Haiku 4.5

### Goal
Final QA verification: run test suite, type check, build, and do a code review of all new/modified files for correctness.

### Tasks
- [ ] **7.1** Run `npm test` and report results.
- [ ] **7.2** Run `npx tsc --noEmit` and report results (expect pre-existing credentialCatalog.ts error only).
- [ ] **7.3** Run `npm run build` and report results.
- [ ] **7.4** Code review all new files:
  - `src/renderer/components/Tutorial/branches/aiAssistanceTutorial.ts`
  - `src/renderer/components/Tutorial/branches/webMediaSearchTutorial.ts`
  - `src/renderer/components/Tutorial/branches/publishTutorial.ts`
  - Modified: `tutorialSteps.ts`, `tutorialStore.ts`, `TutorialInfoBox.tsx`, `Tutorial.css`
- [ ] **7.5** Verify all `data-tutorial` attributes are present in the component files they target.
- [ ] **7.6** Document any remaining issues or edge cases found.

### Acceptance Criteria
- [ ] All tests pass
- [ ] No new TypeScript errors introduced
- [ ] Build succeeds
- [ ] Code review finds no critical issues
- [ ] All tutorial attributes verified

### Validation Steps
- `npm test` → all pass
- `npx tsc --noEmit` → only pre-existing errors
- `npm run build` → success
- Manual file review complete

---

## Dependency Graph

```
Phase 1 (Core UX Fixes) ──┐
                           ├──→ Phase 2 (Branching Architecture) ──┬──→ Phase 3 (AI Branch)
                           │                                       ├──→ Phase 4 (Web Media Branch)
                           │                                       └──→ Phase 5 (Publish Branch)
                           │                                                     │
                           └─────────────────────────────────────────────────────┘
                                                                                 │
                                                                          Phase 6 (Integration & Polish)
                                                                                 │
                                                                          Phase 7 (QA)
```

Phases 3, 4, and 5 can run in **parallel** after Phase 2 completes.

## Recommended Execution Order

| Order | Phase | Agent | Depends On |
|-------|-------|-------|------------|
| 1 | Phase 1 — Core Tutorial UX Fixes | GPT-5.3-Codex | — |
| 2 | Phase 2 — Branching Architecture | Claude Sonnet 4.6 | Phase 1 |
| 3a | Phase 3 — AI Assistance Branch | GPT-5.3-Codex | Phase 2 |
| 3b | Phase 4 — Web Media Search Branch | GPT-5.2-Codex | Phase 2 |
| 3c | Phase 5 — Publish Branch | GPT-5.2-Codex | Phase 2 |
| 4 | Phase 6 — Integration & Polish | Claude Sonnet 4.6 | Phases 3, 4, 5 |
| 5 | Phase 7 — QA | Claude Haiku 4.5 | Phase 6 |

## Handoff Prompts

- **Phase 1:** `Run /execute-plan Phase 1` — Active settings: None. GPT-5.3-Codex: Fix Pages step (add right-click context tutorial), fix drag-to-canvas orientation, make Properties and Responsive View non-blocking, rework Keyboard Shortcuts to point at Help menu. See `plan.md` Phase 1 for full details.
- **Phase 2:** `Run /execute-plan Phase 2` — Active settings: None. Claude Sonnet 4.6: Redesign completion step with branching choice UI, extend TutorialStep interface with `choices`/`hideSkip`/`hidePrimaryAction`, add `loadBranchSteps` to store, build choice card UI in TutorialInfoBox.
- **Phase 3:** `Run /execute-plan Phase 3` — Active settings: None. GPT-5.3-Codex: Implement AI Assistance branch tutorial (~10 steps). API key check, AI chat, drag button, add class, add event via AI, theme designer, custom CSS via AI.
- **Phase 4:** `Run /execute-plan Phase 4` — Active settings: None. GPT-5.2-Codex: Implement Web Media Search branch tutorial (~10 steps). Asset Manager, web search, search "dog", insert images, drag carousel, assign images.
- **Phase 5:** `Run /execute-plan Phase 5` — Active settings: None. GPT-5.2-Codex: Implement Publish branch tutorial (~7 steps). Publish dialog flow: provider selection, credentials, validate, publish.
- **Phase 6:** `Run /execute-plan Phase 6` — Active settings: None. Claude Sonnet 4.6: Integrate all branches, fix z-index layering, verify Back/Skip behavior, polish choice cards, verify all data-tutorial attributes.
- **Phase 7:** `Run /execute-plan Phase 7` — Active settings: None. Claude Haiku 4.5: Run npm test, tsc --noEmit, npm run build. Code review all new/modified tutorial files.


