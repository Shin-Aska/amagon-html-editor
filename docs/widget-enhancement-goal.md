# Widget enhancement goal

Order: editing experience for every widget → customization for every widget → npm audit dependency updates.

Compatibility: keep existing project data and authored content; new styling uses the existing block styles model. No new runtime dependencies. Run checks with a single worker on low-memory machines.

## Phase 1 — editing experience

- [x] Content, Design, and Advanced navigation shared by every widget.
- [x] Search across settings, collapsible sections with editors mounted on demand.
- [x] Accessible native property labels, keyboard navigation, individual property reset.
- [x] Conditional controls retain hidden values; structured object settings are editable.
- [x] Duplicate repeated items with fresh identities for nested tab elements; atomic default-tab updates on deletion.
- [x] Automated coverage for every widget plus desktop visual verification; each widget has its own test case to avoid a single large timeout on slower machines.

## Phase 2 — customization

- [x] Appropriate design presets for all 63 widget types (15 profiles, including sizing for spacers/spinners/progress, rules for dividers, choice-label sizing, and clipped media).
- [x] Theme-aware appearance, dimensions, layout, and media controls.
- [x] Reset styling overrides without removing content or CSS classes.
- [x] Automated preset/style serialization coverage for every widget in preview and export for Bootstrap, Tailwind, and vanilla. Divider, Spacer, Modal, and Offcanvas now preserve overrides; explicit overrides win over Bootstrap utilities.

## Phase 3 — security

- [x] Run npm audit and apply compatible dependency fixes (security scope clarified by the user).
- [x] Upgrade Electron to 42.11.18, Vite to 7.3.7, Vitest to 4.1.12, Zod to 4.6.7 and minimatch to 11.0.5, and update vulnerable transitive packages. Runtime integration verification passed on Linux.
- [x] Complete targeted tests and document the broad-suite limitations below.

## Coverage

All widgets share the experience controls. Customization coverage is tracked explicitly below and checked against the registry in tests.

| Widget | Category | Experience | Customization |
| --- | --- | --- | --- |
| Container (`container`) | Layout | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Row (`row`) | Layout | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Column (`column`) | Layout | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Divider (`divider`) | Layout | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Spacer (`spacer`) | Layout | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Heading (`heading`) | Typography | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Paragraph (`paragraph`) | Typography | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Image (`image`) | Media | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Video (`video`) | Media | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Icon (`icon`) | Media | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Carousel (`carousel`) | Media | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Button (`button`) | Interactive | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Link (`link`) | Interactive | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Form (`form`) | Interactive | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Input (`input`) | Interactive | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Textarea (`textarea`) | Interactive | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Checkbox (`checkbox`) | Interactive | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Select (`select`) | Interactive | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Navbar (`navbar`) | Components | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Hero (`hero`) | Components | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Feature Card (`feature-card`) | Components | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Footer (`footer`) | Components | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Accordion (`accordion`) | Components | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Tabs (`tabs`) | Components | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Pricing Table (`pricing-table`) | Components | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Testimonial (`testimonial`) | Components | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Call to Action (`cta-section`) | Components | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Modal (`modal`) | Components | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Page List (`page-list`) | Components | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Raw HTML (`raw-html`) | Embed | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Iframe (`iframe`) | Embed | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Section (`section`) | Layout | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Blockquote (`blockquote`) | Typography | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| List (`list`) | Typography | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Code Block (`code-block`) | Typography | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Alert (`alert`) | Components | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Badge (`badge`) | Components | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Progress (`progress`) | Components | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Spinner (`spinner`) | Components | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Radio (`radio`) | Interactive | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Range (`range`) | Interactive | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| File Input (`file-input`) | Interactive | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Breadcrumb (`breadcrumb`) | Components | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Pagination (`pagination`) | Components | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Table (`table`) | Components | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Dropdown (`dropdown`) | Components | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Offcanvas (`offcanvas`) | Components | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Card (`card`) | Components | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Stats Section (`stats-section`) | Sections | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Team Grid (`team-grid`) | Sections | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Gallery (`gallery`) | Sections | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Timeline (`timeline`) | Sections | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Logo Cloud (`logo-cloud`) | Sections | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Process Steps (`process-steps`) | Sections | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Newsletter (`newsletter`) | Sections | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Comparison Table (`comparison-table`) | Sections | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Contact Card (`contact-card`) | Sections | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Social Links (`social-links`) | Components | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Cookie Banner (`cookie-banner`) | Components | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Back to Top (`back-to-top`) | Components | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Countdown (`countdown`) | Interactive | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Before/After Slider (`before-after`) | Interactive | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |
| Map Embed (`map-embed`) | Interactive | Shared inspector coverage verified | Explicit profile and preview/export coverage verified |

## Dependency audit — 7 November 2026

The 1.11.0 release preparation resolved the remaining font-generator findings without forcing a breaking downgrade. The generator now fetches the same Fontsource APIv2 JSON from a pinned upstream commit and validates the consumed fields with the application's existing Zod dependency. Its unused CLI dependency chain was removed. Monaco's DOMPurify dependency is overridden within major version 3 to the patched 3.4.17 release. Both the full audit and production audit report zero vulnerabilities. See [release validation](releases/1.11.0/validation.md) for the compatible dependency set and release checks.

The installed dependency versions and integrity hashes are recorded in `package-lock.json`. Development now requires Node 22.12 or later for Electron 42.

## Validation

- 67 inspector checks pass, including each of the 63 widget types, dropdown defaults, typed numeric choices, complex CSS measurements, search, reset/undo, conditional controls, and independent nested-item copies.
- 104 export/architecture checks pass: widget preset and width-priority coverage across frameworks, existing HTML serializer tests, and the production module architecture checks.
- 23 existing preview/cache/theme checks pass with a 30-second per-test timeout suitable for this machine.
- Clean TypeScript and production builds pass.
- A desktop smoke check passed on Electron 42, with content, preset, theme color, search, reset, and compact-panel screenshots. The final smoke check also passed choosing the first dropdown option and retaining that property after resetting style overrides.
- The initial widget-goal broad run reported 1,032 passes and 20 failures. It is not a green full suite: failures include Windows path fixtures, archive streaming timeouts, binding privileged port 443, and five-second timeouts in larger rendering/architecture cases. Follow-up focused tests passed the changed rendering paths and slow preview/theme/architecture cases. Representative path and archive failures reproduced with the previous Zod 4.5.4 dependency. The broad run also retained a stale serializer module during implementation; that regression case passes in a fresh test run.

The widget work requires no project-format migration. The follow-up 1.11.0 release preparation commits the combined work on `feat/1.11.0` and prepares reviewable GitHub drafts.

The app was reopened with `npm run dev` on Electron 42.11.18; the existing Sample Website AMG project loaded successfully and the new inspector rendered without renderer errors during the check. The development app remains running.
