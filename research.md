# Architectural Blueprint and Implementation Strategy for a Next-Generation Electron HTML Editor

## 1. Executive Summary and Market Analysis

The domain of web development has long struggled with a dichotomy between accessibility and professional control. On one end of the spectrum lie abstraction-heavy website builders like Wix and Squarespace, which offer ease of use but lock users into proprietary hosting and codebases. On the other end are pure code editors like Visual Studio Code (VS Code), which provide infinite flexibility but require significant technical expertise. In the interstitial space, "Visual HTML Editors" like Pingendo and Mobirise have carved out a substantial market share by promising the best of both worlds: the visual velocity of a drag-and-drop builder combined with the code quality and portability of a hand-coded project.

This report provides an exhaustive technical analysis of these incumbent solutions and synthesizes those findings into a comprehensive architectural blueprint for a new, superior desktop application. The proposed solution leverages the **Electron** framework for cross-platform desktop capabilities, **React** for the user interface, **Zustand** for high-performance state management, and **Monaco Editor** for professional-grade code editing. Furthermore, this document serves as a strategic roadmap for utilizing **Windsurf**, an AI-powered integrated development environment (IDE), to accelerate the build process. By feeding the specific architectural constraints and schema definitions outlined herein into Windsurf’s "Cascade" engine, development teams can transition from concept to functional prototype with unprecedented speed.

### 1.1 Deconstructing the Incumbents: A Deep Dive

To architect a superior tool, one must first dissect the engineering decisions, strengths, and limitations of the current market leaders. Pingendo and Mobirise represent two distinct philosophical approaches to visual web editing—the "Glass Box" element-based approach and the "Black Box" block-based approach, respectively.

#### 1.1.1 Pingendo: The Bootstrap-Centric "Glass Box"

Pingendo positions itself as a visual interface specifically for the Bootstrap framework. Its core philosophy is transparency; it does not hide the underlying web technologies but rather exposes them through a visual layer.

**Core Mechanics and UI Philosophy** Pingendo’s interface is characterized by granular control over the Document Object Model (DOM). Unlike simplified builders that treat a "Pricing Table" as a single immutable object, Pingendo allows users to manipulate the atomic elements within that table—the rows, columns, headings, and buttons. This granularity mirrors the structure of the HTML DOM directly, making it a "Glass Box" tool where the user can see and manipulate the internal machinery.

A defining technical feature of Pingendo is its tight integration with SASS (Syntactically Awesome Style Sheets). When a user adjusts a visual property, such as a primary theme color, Pingendo does not merely apply an inline style (e.g., `style="color: red;"`). Instead, it modifies the underlying SASS variables (e.g., `$primary: #ff0000;`) and recompiles the CSS. This ensures that the generated code adheres to the DRY (Don't Repeat Yourself) principle and remains maintainable by professional developers. The interface includes a "Right Inspector" for configuring element styles and a "Code" view for inspecting HTML and SASS sources , reinforcing the tool's dual nature as both a designer and a developer instrument.

**Workflow and Limitations** The workflow emphasizes "design-time" decisions that map 1:1 to Bootstrap classes. Users drag pre-made blocks or atomic elements onto the canvas, and the editor provides real-time feedback. However, this atomic approach introduces a significant learning curve. To use Pingendo effectively, a user must understand the "Box Model," grid systems, and the hierarchy of Bootstrap utility classes. For a non-technical user, the freedom to place any element anywhere often results in broken layouts. An Electron-based successor must mitigate this by offering a "Smart Block" system that abstracts complexity while retaining atomic access for advanced users.

#### 1.1.2 Mobirise: The Block-Based Paradigm

Mobirise targets a different demographic: users who prioritize speed and ease of use over granular control. Its architecture is fundamentally "block-based" rather than "element-based" , prioritizing assembly over composition.

**The Block System Architecture** Mobirise’s core innovation is its rigid but highly effective block system. A website is constructed by stacking pre-designed horizontal sections (headers, features, footers). These blocks are not merely HTML snippets; they are complex data structures defined via JSON templates. A block package contains the HTML structure (`_customHTML`), style definitions (`_styles`), and metadata that defines editable parameters.

Research into Mobirise’s extension mechanism reveals that blocks function as self-contained logical units. When a user drags a "Design Block" onto the page, the system loads a JSON template, validates it, and processes it to render the content. This separation between the *definition* of a block (JSON) and its *instantiation* (DOM elements) is a critical architectural pattern. It allows for "User Blocks," where users can save modified blocks as `.js` files containing JSON objects, enabling easy sharing and reuse across projects.

**Portability and Lock-in** A critical selling point for Mobirise is the absence of vendor lock-in. The platform provides a full Code Export feature that generates standard HTML, CSS, and JavaScript, allowing users to host their sites anywhere. This contrasts with SaaS builders that bind the site to a specific hosting provider. However, Mobirise restricts deep customization (like editing the raw HTML of a block) to paid extensions , creating a friction point that a new open-architected tool could exploit.

#### 1.1.3 Comparative Analysis

| **Feature**         | **Pingendo**                        | **Mobirise**                       | **Proposed Electron Editor**                                |
| ------------------- | ----------------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| **Core Philosophy** | Atomic, Element-Based (Glass Box)   | Component, Block-Based (Black Box) | Hybrid: Block-First, Element-Accessible                     |
| **Framework**       | Strictly Bootstrap                  | Bootstrap / AMP                    | Framework Agnostic (Bootstrap/Tailwind support via plugins) |
| **Styling Engine**  | SASS Variable Mapping               | Inline Styles & JSON Parameters    | CSS Variables & Utility Classes (Tailwind)                  |
| **Customization**   | High (Granular DOM access)          | Low (Pre-defined parameters)       | High (Visual props + Full Code Access)                      |
| **Code Access**     | Native, Real-time SASS/HTML editing | Paid Extension required            | Native Monaco Editor Integration                            |
| **Extensibility**   | Limited to Bootstrap classes        | JSON-based User Blocks             | JSON Schema + React Component Registry                      |

### 1.2 Strategic Synthesis for the New Editor

The ideal tool generated by Windsurf must synthesize these two approaches into a cohesive whole. The "Hybrid Architecture" proposed in this report dictates that the application starts with high-level blocks (Mobirise style) for rapid layout assembly but allows "drilling down" into atomic elements (Pingendo style) for granular customization.

Crucially, the new editor must solve the "Export Gap." While Mobirise exports clean code, its internal representation is heavily reliant on proprietary JSON parameters. Pingendo exports clean SASS, but its UI is complex. The new editor will use a **JSON-based Block Tree** as its Single Source of Truth, which renders to a **Virtual DOM** for the editor and compiles to **Standard HTML/CSS** for export. This ensures that the complexity of the editor does not pollute the simplicity of the final output. Furthermore, unlike Mobirise, which often restricts code editing, the new tool will feature a **Monaco-powered code editor** that syncs bidirectionally with the visual canvas in real-time , treating code as a first-class citizen alongside the visual controls.

## 2. The Electron Architectural Foundation

Building a high-performance desktop application that manipulates web content requires a sophisticated runtime environment. **Electron** is the industry standard for this task, powering applications like VS Code, Slack, and Discord. However, the flexibility of Electron introduces significant architectural choices regarding process management, security, and rendering strategies.

### 2.1 The Electron Process Model

Electron applications are structured around a multi-process architecture consisting of a single **Main Process** and multiple **Renderer Processes**. Understanding this model is prerequisites for implementing secure file I/O and performant UI rendering.

#### 2.1.1 The Main Process: Orchestration and Native Access

The Main Process runs in a Node.js environment and is the entry point of the application. It is responsible for creating and managing `BrowserWindow` instances and serves as the bridge to the operating system's native capabilities.

For an HTML editor, the Main Process handles the "heavy lifting" of file operations. When a user requests to save a project, the Renderer cannot write to the disk directly due to security restrictions (sandboxing). Instead, it serializes the project state and sends it to the Main Process via Inter-Process Communication (IPC). The Main Process then utilizes the Node.js `fs` module to write the HTML and CSS files to the user's file system. This separation is critical for performance; by offloading file I/O to the Main Process, the Renderer remains responsive to user interactions, such as drag-and-drop events, without stuttering (blocking the UI thread).

#### 2.1.2 The Renderer Process: The Presentation Layer

The Renderer Process displays the application's user interface (UI). It runs an instance of the Chromium rendering engine. For a visual editor, the architecture is more complex than a standard app because it must render two distinct contexts:

1. **The Editor UI:** The panels, toolbars, property inspectors, and the code editor (Monaco). This is the "Application" layer.
2. **The Canvas (Preview Engine):** The area where the user's website is rendered and manipulated. This is the "Content" layer.

Isolating these two contexts is the single most important architectural decision in the project. If the Editor UI and the User Content share the same global scope (window object) and CSS context, "style bleeding" occurs—where the editor's CSS affects the user's website, or vice versa. Furthermore, the user's JavaScript could interfere with the editor's logic.

### 2.2 Canvas Isolation Strategy

To achieve the necessary isolation, we must choose between three Electron primitives: `<iframe>`, `BrowserView` (now `WebContentsView`), and Shadow DOM.

#### 2.2.1 Iframe Isolation: The Standard for Web Builders

The most robust and widely used approach for web-based builders is the `<iframe>`.

- **Mechanism:** The Editor UI (React) renders an `<iframe>` element. The user's HTML is loaded inside this frame.
- **Pros:** This provides complete CSS and JavaScript isolation. The browser's native security model ensures that styles defined in the parent do not leak into the child. Crucially, standard web APIs for drag-and-drop can be made to work across iframe boundaries with careful coordinate translation.
- **Cons:** Communication between the parent (Editor) and the child (Canvas) requires the `postMessage` API, which is asynchronous. Debugging events across this boundary can be complex.
- **Verdict:** Despite the complexity of `postMessage`, iframes are the preferred method for the "Canvas" component because they allow the editor to "reach in" and inject helper scripts (e.g., selection highlighters) into the user's DOM while maintaining style isolation.

#### 2.2.2 BrowserView and WebContentsView

Electron provides `BrowserView` (deprecated) and its successor `WebContentsView` to embed separate web contents.

- **Mechanism:** These act like separate browser tabs that are positioned explicitly over the main window. They run in their own process, offering potential performance gains.
- **Analysis:** While performant, `WebContentsView` is not part of the DOM. It is an overlay managed by the Main Process. This makes implementing a drag-and-drop interface—where a user drags a button from a sidebar (DOM) *into* the view (Non-DOM)—extremely difficult. Managing the z-index and coordinate systems between the DOM sidebar and the native view overlay is mathematically intensive and prone to bugs.
- **Verdict:** `WebContentsView` is too rigid for a rich interactive editor. We will proceed with the **Iframe** approach, leveraging React Portals or direct DOM injection for editor overlays.

### 2.3 Project Structure and Build System

To ensure long-term maintainability and optimal developer experience (DX), the project should be structured using **Electron-Vite**.

#### 2.3.1 Electron-Vite Integration

Electron-Vite is a specialized build tool that simplifies the setup of Electron with Vite, providing Hot Module Replacement (HMR) for both the Main and Renderer processes. Traditional Webpack-based boilerplates often require complex reloading scripts and slow compile times. Vite’s ES-module based serving ensures that changes to the React components or the Electron backend are reflected almost instantly.

**Recommended Directory Structure:**

```
/root
  /electron
    main.ts       // Main process entry: Window creation, IPC handlers
    preload.ts    // Preload script: Context bridge, API exposure
  /src
    /renderer     // The Editor UI (React App)
      /components
      /store
    /preview      // The isolated environment for the Canvas iframe
      /runtime.ts // Script injected into the user's page for drag handling
  package.json
  electron.vite.config.ts
```

This structure clearly separates the concerns of the runtime (Electron) and the UI (Src), facilitating a clean mental model for the AI (Windsurf) during code generation.

### 2.4 State Management Architecture

The application requires a robust state management solution to act as the "Single Source of Truth." This system must synchronize three disparate entities: the Visual Canvas (iframe), the Code Editor (Monaco), and the persisted Project Data (JSON).

#### 2.4.1 The Synchronization Challenge

The complexity lies in the bidirectional nature of the data flow.

1. **Visual -> Code:** If a user drags a "Header Block" from the sidebar to the canvas, the internal state must update, triggering a regeneration of the HTML string displayed in the Code Editor.
2. **Code -> Visual:** If the user types `<h1 class="text-primary">Hello</h1>` in the Code Editor, the system must parse this string, update the internal block tree, and re-render the Visual Canvas.

#### 2.4.2 Choosing the Right Library: Zustand vs. Redux

While Redux is a traditional choice, **Zustand** is the superior architectural fit for this specific application type.

- **Performance:** Canvas-based applications generate high-frequency events (e.g., dragging a mouse pixel by pixel). Redux’s boilerplate and rigid dispatch cycle can introduce overhead. Zustand supports transient updates (subscribing to state changes without triggering a full component re-render), which is critical for drag operations.
- **Simplicity:** Zustand’s API is minimalistic and hook-based, reducing the cognitive load when instructing Windsurf to generate state logic.
- **Data Structure:** The state should not be a raw HTML string. It must be an **Abstract Syntax Tree (AST)** or a JSON-based **Block Tree** (similar to Mobirise) that *generates* the HTML. This allows the state to hold metadata (like "is this block locked?") that is not present in the final HTML export.

**State Flow Definition:**

- *Visual Edit* -> Update JSON Tree -> Regenerate HTML -> Update Monaco & Canvas.
- *Code Edit* -> Parse HTML -> Update JSON Tree -> Update Canvas.

## 3. The Visual Editing Engine

The heart of the application is the visual editing engine. This component is responsible for the user's primary interaction with the tool: selecting components, dragging them onto the page, and configuring their properties.

### 3.1 Drag-and-Drop Implementation

Implementing a drag-and-drop system that works across an iframe boundary is non-trivial. For a React-based architecture, **dnd-kit** is the superior choice over competitors like `react-beautiful-dnd` or the native HTML5 Drag and Drop API.

#### 3.1.1 Why dnd-kit?

- **Headless Architecture:** dnd-kit provides the logic (sensors, collisions, coordinates) without imposing a specific DOM structure. This is essential because our "Droppable" zones are inside an iframe, while our "Draggable" sources are in the main window.
- **Virtual DOM Agnosticism:** Unlike libraries that rely heavily on specific React Fiber internals, dnd-kit’s sensor-based approach allows us to abstract the event listeners. We can attach sensors to the iframe's `contentWindow` to capture mouse events even when the cursor is logically "inside" the child document.
- **Performance:** dnd-kit minimizes re-renders, which is critical when dragging complex DOM trees. It allows us to animate a "drag overlay" (a thumbnail of the component being dragged) efficiently on the GPU.

#### 3.1.2 Interaction Logic and Iframe Traversal

A common issue in iframe-based editors is that the iframe "eats" mouse events. When the mouse moves over the iframe, the parent window loses track of the hover state, breaking the drag operation.

**Architectural Solution:**

1. **Overlay Technique:** During the drag operation (initiated in the sidebar), the editor renders a transparent `div` strictly over the iframe in the parent context. This transparent layer captures all mouse move events, ensuring the drag operation remains continuous.
2. **Coordinate Translation:** The editor calculates the position of the mouse relative to the iframe's top-left corner. It then sends these local coordinates to the iframe via `postMessage`.
3. **Internal Droppables:** A script inside the iframe receives these coordinates and performs "hit testing" (`document.elementFromPoint`) to determine which block the user is hovering over. It then draws a "Drop Indicator" (a blue line) to visualize where the new block will be inserted.
4. **Drop Execution:** When the mouse is released, the event handler in the parent triggers a state update in Zustand, inserting the new block at the calculated index.

### 3.2 Real-Time Code Synchronization via Monaco Editor

Integrating **Monaco Editor** (the engine behind VS Code) is essential for providing a professional coding experience. However, naive integration leads to "cursor jumping" and flickering.

#### 3.2.1 The "Flicker" Problem

If the application updates the Monaco Editor's value on every single frame of a drag operation, the editor will attempt to re-tokenize and re-render the text 60 times a second. This results in a flashing screen and loss of cursor position.

#### 3.2.2 Sync Implementation Strategy

To achieve smooth synchronization, we must implement a **Debounce and Diff** strategy.

1. **Debounced Updates:** Updates from the visual canvas to the code editor should be throttled. While the drag is happening, the code editor might be disabled or strictly read-only. The update is applied only on `dragEnd`.
2. **Diffing Algorithm:** When the state changes, instead of replacing the entire text value of the editor (which resets the scroll position and undo stack), we should calculate the difference between the current text and the new text. We can use a library implementation of the **Myers Diff Algorithm** to generate a set of "Edits" (insertions, deletions) and apply them to the Monaco model using `model.pushEditOperations()`.
3. **Code-to-Visual parsing:** When the user types in Monaco, we wait for a pause in typing (e.g., 500ms debounce). Then, we parse the HTML string into our internal JSON Block Tree. If the HTML is valid, we update the Zustand store, which triggers the iframe to re-render. If the HTML is invalid (e.g., unclosed tags), we display a linter error in Monaco without breaking the visual canvas.

### 3.3 Component Rendering Strategy

The editor needs a mechanism to map the abstract JSON data to actual DOM elements.

- **Standard HTML Mapping:** For simple elements, the renderer maps JSON `type: "div"` directly to a React `<div>` with the corresponding attributes.

- **Smart Component Mapping:** For complex blocks (like a Mobirise "Hero Section"), the renderer looks up a predefined template in a `ComponentRegistry`.

  JavaScript

  ```
  // Example Registry Lookup
  const renderBlock = (block) => {
     const Template = ComponentRegistry[block.type]; // e.g., 'hero-section-v1'
     if (!Template) return <UnknownBlock />;
     return <Template props={block.props} />;
  }
  ```

- **Editor Decorators:** In "Edit Mode," the renderer injects helper overlays (borders, padding indicators, "delete" buttons) around the elements. These helpers are React components that exist *only* in the editor runtime and are stripped out during the export process.

## 4. Data Structure and Asset Management

A robust data schema is the "DNA" of the project. It determines what is possible to build, save, and undo. Based on the analysis of Mobirise  and generic page builders , we propose a structured JSON schema.

### 4.1 JSON Schema for Blocks and Projects

The schema must balance the rigidity required for drag-and-drop with the flexibility required for custom HTML.

JSON

```
{
  "projectSettings": {
    "framework": "bootstrap-5",
    "theme": "default",
    "globalStyles": {
      "--primary-color": "#007bff",
      "--font-base": "Roboto, sans-serif"
    }
  },
  "pages":
    }
  ]
}
```

**Separation of Concerns:**

- **`props`**: Control the high-level configurable parameters defined by the block author (e.g., text content, image paths). This mirrors the Mobirise structure.
- **`style`**: Allows for granular CSS overrides that apply specific classes or inline styles.
- **`content`**: Provides an escape hatch for raw HTML, allowing the user (or the Monaco editor) to inject arbitrary code if necessary.

### 4.2 Asset Management and Local File Access

Handling local assets (images, videos) in Electron is complex due to browser security restrictions. Modern Chromium blocks loading `file://` resources in the renderer to prevent malicious scripts from scanning the user's hard drive.

#### 4.2.1 The Protocol Handler Solution

To solve this, we must register a custom protocol (e.g., `app-media://`) in the Main Process using the `protocol.handle` API.

**Implementation Logic:**

1. **Registration:** In `main.ts`, we register `protocol.handle('app-media', handler)`.
2. **Handler Logic:** The handler receives a request like `app-media://User/Docs/Project/img/logo.png`. It strips the protocol prefix, decodes the path, and uses `net.fetch` or standard file reading to serve the file from the local disk.
3. **Usage:** In the editor's React components, an image source is set to `<img src="app-media://..." />`. This bypasses Content Security Policy (CSP) issues while allowing the Main Process to validate that the file request is within the allowed project directory.

#### 4.2.2 Comparison with GrapesJS

GrapesJS includes an Asset Manager that typically relies on uploading files to a server. In our desktop context, we replace the "Upload" logic with "File Select" logic. When the user clicks "Change Image," the Renderer invokes `ipcRenderer.invoke('dialog:openFile')`. The Main Process opens the native OS file picker, returns the path, and the Renderer updates the JSON model with the new `app-media://` path.

### 4.3 Export Engine

The export engine is responsible for converting the internal JSON representation into standard, deployable web files.

1. **Traversal:** The engine traverses the JSON Block Tree.
2. **Generation:** It uses a template engine (like Handlebars) or React's `renderToStaticMarkup` to generate the HTML string for each block.
3. **Sanitization:** It strips out any `data-editor-id` attributes, internal classes, or editor-specific comments used for the UI.
4. **Asset Consolidation:** It parses the HTML for asset paths. It copies all referenced images from their source locations to a standardized `export/assets/` folder, updating the `src` attributes in the HTML to relative paths (e.g., `./assets/logo.png`).
5. **Write to Disk:** Finally, it uses `fs.promises.writeFile` in the Main Process to save the file structure.

## 5. Implementation Strategy with Windsurf AI

Windsurf, with its "Cascade" flow and ability to execute commands and edits, is uniquely positioned to build this complex application. However, AI models struggle with broad, vague instructions. The key to success is **Contextual Anchoring** and **Iterative Scaffolding**. The following plan outlines the prompt engineering strategy to guide Windsurf through the development lifecycle.

### 5.1 Prompt Engineering Strategy

To maximize Windsurf's utility, every major prompt must include:

- **Context:** Reference the "Master Architecture" (this report).
- **Constraints:** Explicitly state the technology stack (Electron, React, Vite, dnd-kit, Zustand, Monaco).
- **Scope:** Limit the prompt to a specific module or feature to prevent hallucination or partial implementations.

### 5.2 Phase 1: Scaffolding and Core Architecture

**Goal:** Initialize the Electron-Vite project and establish the IPC communication bridge.

**Windsurf Prompt:**

> "Initialize a new project using `electron-vite` with the React template. Structure the project as a monorepo with `packages/main`, `packages/preload`, and `packages/renderer`. Configure TypeScript for all packages.
>
> Implementation task: Set up the IPC handler in the Main process to listen for a 'save-project' event that writes a JSON file to disk. Create a corresponding context bridge in the Preload script exposing a `saveProject` function to the renderer. Verify the setup by creating a simple button in React that triggers this save. Ensure strict type safety for the IPC channels."

### 5.3 Phase 2: The Visual Engine (Canvas & Blocks)

**Goal:** Implement the dnd-kit drag-and-drop system and iframe isolation.

**Windsurf Prompt:**

> "Create a `Canvas` component in the renderer. This component should render an `iframe`. Inside the iframe, inject a script that allows it to receive messages from the parent via `postMessage`.
>
> Next, implement a `Sidebar` component using `dnd-kit` Draggable elements. Create a JSON schema definition for a simple 'Text Block' and an 'Image Block'. Implement the logic so that dragging a block from the Sidebar to the Canvas updates a global Zustand store, adding the block to a list. The Canvas should listen to this store and render the blocks inside the iframe. Handle the iframe mouse event absorption issue by overlaying a transparent capture layer during drag operations."

### 5.4 Phase 3: The Code Editor Integration

**Goal:** Integrate Monaco Editor and sync it with the visual canvas.

**Windsurf Prompt:**

> "Install `@monaco-editor/react`. Create a `CodeEditor` panel that sits alongside the Canvas.
>
> Implementation task: Create a transformation utility that converts our JSON Block Store into a standard HTML string. Feed this string into the Monaco Editor value.
>
> Next, implement the reverse sync: When the Monaco Editor content changes (debounced by 1000ms), parse the HTML using `hast-util-from-html` to reconstruct the JSON Block Store. If the HTML structure is invalid, show an error state in the UI instead of breaking the Canvas. Use a diffing strategy to only update changed nodes if possible."

### 5.5 Phase 4: Styling and Property Inspectors

**Goal:** Create the Pingendo-like "Inspector" panel for changing properties without coding.

**Windsurf Prompt:**

> "Create an `Inspector` panel. When a block in the Canvas is clicked, set it as the 'active' block in the Zustand store.
>
> The Inspector should dynamically render input fields based on the selected block's `props` schema (e.g., if an Image block is selected, show a 'Source' input; if a Text block, show 'Font Size').
>
> Implementation task: When an input changes in the Inspector, update the specific property in the JSON store. Ensure this update triggers a re-render of only that specific block in the Canvas using Zustand's transient update capabilities."

## 6. Detailed Implementation Specifications

To assist Windsurf in generating precise code, the following specifications must be adhered to.

### 6.1 State Store Specification (Zustand)

TypeScript

```
interface Block {
  id: string;
  type: string;
  content: Record<string, any>;
  styles: Record<string, string>;
  children?: Block;
}

interface EditorState {
  blocks: Block;
  selectedBlockId: string | null;
  history: Block; // For Undo/Redo
  addBlock: (type: string, index: number) => void;
  updateBlock: (id: string, data: Partial<Block>) => void;
  moveBlock: (dragIndex: number, hoverIndex: number) => void;
  selectBlock: (id: string) => void;
}
```

### 6.2 IPC API Specification

The `preload.ts` should expose the following API via `contextBridge`:

TypeScript

```
export const api = {
  project: {
    save: (data: ProjectData) => ipcRenderer.invoke('project:save', data),
    load: () => ipcRenderer.invoke('project:load'),
    exportHtml: (html: string) => ipcRenderer.invoke('project:export', html),
  },
  assets: {
    selectImage: () => ipcRenderer.invoke('assets:select'),
    readAsset: (path: string) => ipcRenderer.invoke('assets:read', path),
  }
};
```

## 7. Performance Optimization & Best Practices

Building an Electron app that feels native requires strict adherence to performance guidelines.

1. **Lazy Loading:** Use `React.lazy` and `Suspense` for heavy components like the Monaco Editor and the Settings panel. They should not block the initial render of the app.
2. **Virtualization:** If the user creates a page with hundreds of blocks, the Canvas renderer should use windowing (virtualization) to only render the DOM nodes currently in the viewport.
3. **IPC Throttling:** Avoid sending IPC messages on every keystroke. Use the main process for file I/O only when necessary (e.g., auto-save every minute, not every second).
4. **CSS Containment:** Use the CSS `contain` property on the high-level blocks in the Canvas. This tells the browser that the block's layout is independent of the rest of the page, significantly speeding up re-renders during drag operations.

## Conclusion

The proposed architecture represents a sophisticated fusion of modern web technologies designed to solve a longstanding problem in the developer tooling market. By combining the block-based accessibility of Mobirise with the atomic precision of Pingendo, and leveraging the performance of Electron and React, this tool bridges the gap between design and development. The architecture prioritizes standard compliance (clean HTML/CSS export), user freedom (User Blocks, no vendor lock-in), and performance (Zustand, Electron-Vite).

The use of Windsurf significantly accelerates this process. By feeding it the specific architectural constraints and schema definitions outlined in this report, the AI can move beyond generic code generation to implementing complex, domain-specific logic like bidirectional AST parsing and secure IPC bridging. This plan transforms the vague goal of "building an HTML editor" into a sequence of executed engineering tasks, minimizing technical debt and maximizing product quality.