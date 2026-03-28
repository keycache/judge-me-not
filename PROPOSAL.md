# UX Polish Proposal

A holistic review of all four screens, shared components, and global patterns.
Issues are grouped by scope and ordered roughly by impact.

---

## 1. System-level

### 1.1 Toast / transient feedback (all screens)
**Problem:** Status and validation messages are rendered inline as `<Text>` nodes inside their parent card. Every time one appears or disappears, it resizes the card and shifts everything below it — visible in the screenshots as the card growing when an error shows, and again when loading starts.

**Proposal:** Introduce a single, screen-level `Toast` component (absolute-positioned at the bottom of the safe area, animated slide-up/fade). All `setStatus`, `setValidationErrors`, `setPromptStatus`, and `setResetStatus` calls become `showToast(...)` calls. The card layout becomes stable and fixed-height.

Variants needed:
- `info` — default muted colour
- `success` — green (`AppTheme.colors.success`)
- `warning` — existing warning amber

Currently every status—including successes like "API key updated" and "Attempt saved"—renders in `AppTheme.colors.warning` amber, which implies something went wrong. The success variant fixes that.

---

### 1.2 Dropdown caret character (Prepare, Practice, Insights)
**Problem:** All dropdowns use the literal text character `"v"` as a caret. It reads as a typo, looks inconsistent in weight and placement, and has no semantic meaning to screen readers.

**Proposal:** Replace with `<IconSymbol name="chevron.right" />` rotated 90°, or add `chevron.down` to the icon mapping. The icon already exists as `chevron.right` in the mapping.

---

### 1.3 Shared `SelectorDropdown` duplication (Practice + Insights)
**Problem:** Both `practice.tsx` and `insights.tsx` define an identical local `SelectorDropdown` component (~40 lines each).

**Proposal:** Extract to `components/ui/selector-dropdown.tsx`. Single source of truth, easier to improve in one place.

---

### 1.4 Dead screens (explore + modal)
**Problem:** `app/(tabs)/explore.tsx` is left-over Expo starter boilerplate (still uses `ThemedText`, `ParallaxScrollView`, etc. inconsistent with the rest of the design system). `app/modal.tsx` is unused scaffolding. Both add noise to the codebase.

**Proposal:** Delete both files. The `explore` tab is already hidden via `href: null`; remove the `Tabs.Screen` entry too.

---

## 2. Prepare screen (`index.tsx`)

### 2.1 Input Mode card — tab + action conflation (Attachment 1)
**Problem:** "Gallery" and "Take Photo" are tabs styled like choice buttons, but pressing them immediately launches the system picker. The user cannot just indicate their preferred source without triggering an OS dialog. If they dismiss the picker, the tab still switches to "gallery" — but nothing was picked. This breaks the principle that a tab selects a mode and an explicit action triggers the operation.

**Proposal:** Separate selection from action.
- Keep Gallery / Take Photo as visual source tabs (select source, no side effect).
- Add a distinct "Add Image" button below them that triggers the picker for the active source.

This also fixes the attachment-2→3 layout shift: the "image strip" and the constraints hint always render in the composer area regardless of whether images have been added, keeping the card height stable.

```
[ TEXT DESCRIPTION ]  [ IMAGE UPLOAD ✓ ]      ← top-level tabs

  IMAGE SOURCE
  [ GALLERY ✓ ]  [ TAKE PHOTO ]               ← source tabs (select only)

  [ + ADD IMAGE ]                              ← explicit action button

  Max 5 images, each up to 6MB.
  [ thumb 1 ] [ thumb 2 ]                     ← strip always visible (empty = dashed placeholders)

[ GENERATE SESSION ]
```

### 2.2 Card height stability during generation (Attachment 4)
**Problem:** When generation starts, `loadingStateCard` appears below the button, expanding the card. The card shrinks again when generation completes. This causes scroll jump.

**Proposal:** Reserve a fixed-height status slot below the button at all times (same height as the loading card). In the idle state it is empty/invisible; during generation it shows the spinner+copy without changing the card's bounding box. The `validationErrors` block uses the same reserved slot (shown instead of the loading state).

### 2.3 Image remove button quality
**Problem:** The remove overlay uses a text "x" (18×18 box). It feels unpolished and is a small touch target.

**Proposal:** Use `<IconSymbol name="xmark" />` (add to mapping: `'xmark': 'close'`). Increase touch target to 24×24 with `hitSlop={10}`.

### 2.4 Nested tab visual hierarchy
**Problem:** The Image Source sub-tabs are indented via a left border (`borderLeftWidth: 1`). The indentation is subtle — it does not clearly communicate that these are a second level inside the Image Upload mode.

**Proposal:** Wrap the sub-section in a lightly tinted surface (`surfaceSecondary` background, `borderSubtle` border, `xs` padding). The boundary makes the hierarchy unambiguous without needing an indent trick.

### 2.5 Session list — delete icon discoverability
**Problem:** The trash icon is absolutely positioned top-right of each session row. It overlaps the title content area for long titles and has no affordance that the row itself is also pressable (open details).

**Proposal:** Separate the two actions into a consistent row layout: session title+meta take full width, and a `···` overflow menu or trash icon is right-aligned in a dedicated column. Alternatively, swipe-to-delete using `react-native`'s `TouchableHighlight`-within-`ScrollView` pattern.

---

## 3. Practice screen (`practice.tsx`)

### 3.1 Recording state feedback
**Problem:** The recording timer renders as `"Recording Seconds: 12"` — developer copy. The mic meter is always visible even when idle (showing "n/a" and a zero-fill bar).

**Proposal:**
- Replace with a styled countdown/elapsed display: a monospace pill showing `0:12 / 2:00` with an accent-coloured progress ring or bar. Only render this when `isRecording` is true.
- Collapse the mic meter entirely when not recording. Show it only during an active recording session, animating in.

### 3.2 Recording button visual states
**Problem:** The recording button only changes its label between "Start Recording" and "Stop Recording". There is no visual differentiation in the button appearance itself when active.

**Proposal:** When recording is active, the button should use a distinct destructive style (e.g. red/warning border, pulsing ring, or filled warning background). This provides an at-a-glance indicator that recording is live without having to read the label.

### 3.3 Notes input visibility
**Problem:** The multiline notes `AppInput` ("Optional notes used as candidate answer text...") is always visible in the question detail card, taking up three lines of space for a rarely-used feature.

**Proposal:** Collapse it behind a ghost button "+ Add notes" that expands inline. If notes have been typed, show them collapsed (1 line) with an edit icon. This keeps the primary recording flow clean.

### 3.4 Session + Question selection layout
**Problem:** The "Session + Question Selection" card contains two dropdowns stacked with labels, plus a "Pick Random Question" button. The card is dense and the two dropdowns look identical — no visual hierarchy between session (parent) and question (child).

**Proposal:** Visual hierarchy:
- Session dropdown is primary — full-width, labelled clearly.
- Question dropdown is secondary — slightly inset or grouped in a subsection below, with a visible dependency (greyed out + placeholder "Choose a session first" when no session is selected).
- "Pick Random Question" moved next to the question dropdown as a small ghost icon-button (shuffle icon), not a full-width button.

### 3.5 Past Answers — Show/Hide affordance
**Problem:** "Show" and "Hide" are plain small text `Pressable` elements — easy to miss and small touch target.

**Proposal:** Use a chevron icon button (rotate 0°/180° on toggle) next to the count, matching the pattern used by collapsible sections in the rest of the design system.

### 3.6 Attempt score prominence
**Problem:** The score renders as a large `fontSize: 28` heading (`8/10`) at the top of the attempt row, making it visually dominant before the user has read any feedback.

**Proposal:** Display the score as a badge alongside the status pill in the attempt header row (e.g. `8/10` in a small accent-coloured box, same height as the `draft` / `completed` badge). Reserve the large display for an aggregate/summary context.

### 3.7 Evaluation tab panel height
**Problem:** `evaluationTabPanel` uses `height: '40%'`. In React Native, percentage heights on non-flex containers are relative to the parent's explicit height, which can produce inconsistent results. In practice this shows a cut-off text panel of unpredictable size.

**Proposal:** Switch to `maxHeight: 200` (or a layout-calculated value), and let the `ScrollView` inside it handle overflow. This becomes predictable across device sizes.

### 3.8 Status messages (see §1.1)
Messages like `"Recording... cap 120s."`, `"Attempt saved locally (12s). Submit to evaluate."`, and `"Attempt queued for evaluation (offline)."` currently render inline in warning amber. Move these to toast (§1.1) and use appropriate variants (`info` for saved, `success` for evaluated, `warning` for errors).

---

## 4. Insights screen (`insights.tsx`)

### 4.1 Empty state
**Problem:** The "No Insights Yet" empty state is a card with plain body text and two raw meta counts. It lacks visual weight and doesn't guide the user toward any action.

**Proposal:** Structure the empty state with:
- A headline: "Nothing to show yet"
- A short guidance line: "Submit and evaluate at least one practice attempt to unlock trends."
- A ghost action button: "Go to Practice" (deep-link to the Practice tab).

### 4.2 Metric card typography
**Problem:** The large metric numbers (readiness %, attempt count) use `monoFamily` — consistent with data elsewhere, but combined with the card title in `headingFamily` the pairing reads as unstyled. The numbers feel accidentally large rather than intentionally prominent.

**Proposal:** Use `headingFamily` for the metric number too (matching the score display pattern used in Practice). This is already the established pattern for prominent numbers in the design system.

### 4.3 Readiness % label
**Problem:** `"90%"` on its own with `"Average score 9/10"` below — no label on the number itself. A user landing on this card for the first time has to read the card title "Readiness" to understand what the percentage means.

**Proposal:** Add a small `metaText` label directly above the number: `"READINESS SCORE"` (mirroring the metric intent, not repeating the card title).

### 4.4 Focus Area card copy
**Problem:** `"Strongest category: Behavioral"` and `"Most frequent gap: Add more concrete metrics"` are plain `bodyText` lines. There is no visual separation between a positive signal and an improvement area.

**Proposal:** Style them with icon prefixes: a green `checkmark.circle.fill` for "Strongest" and a warning-amber `exclamationmark.circle` (add to mapping) for "Most frequent gap". The colour alone conveys sentiment quickly.

---

## 5. Profile screen (`profile.tsx`)

### 5.1 Success messages in warning colour (see §1.1)
"API key updated." and "Prompt and practice settings updated." both render in `AppTheme.colors.warning`. This misuses the warning colour for positive confirmations. Toast with `success` variant (§1.1) fixes this.

### 5.2 "App State" card — single-line card
**Problem:** `"Current key status: Configured"` lives in its own `AppCard` which adds a card header and border for one line of content.

**Proposal:** Merge this into the "API Settings" card as a `metaText` line below the button row (or below the status toast). Removes one unnecessary card from the scroll.

### 5.3 "Danger Zone" visual separation
**Problem:** The danger zone card looks identical in appearance to every other card — same background, same typography, same border. Users can scroll past it without registering the risk.

**Proposal:** Give it a warning-tinted left border (`borderLeftWidth: 3, borderLeftColor: AppTheme.colors.warning`) and a slightly warmer background (a very small tint of warning over `surfacePrimary`). This is a common and well-understood pattern for destructive sections.

### 5.4 "Prompt Preview" card — overwhelming raw text
**Problem:** The full resolved prompt is shown verbatim as a scrollable block of monospace text. For most users this is unreadable and not actionable.

**Proposal:** Collapse this under a "Preview prompt" disclosure button (collapsed by default). Show only the first 3–4 lines with a fade-out mask and a "Show full prompt" expander. Advanced users who want to audit the prompt can expand it; the default state is clean.

### 5.5 Prompt Settings — chip overflow
**Problem:** `MODEL_VARIANTS` chips use `flexWrap: 'wrap'`, but the variant strings are long (e.g. `"gemini-3.1-flash-lite-preview"`). On smaller screens these wrap into visually awkward multi-line rows.

**Proposal:** Switch to a vertical radio-list layout for model variant selection: each option is a full-width pressable row with a selection indicator and a short description line. Keeps all options legible without wrapping.

---

## 6. Navigation & information architecture

### 6.1 Tab icons vs. function
The `Prepare` tab uses a `house.fill` icon — a home icon — rather than something that communicates "create" or "prepare" (e.g. a document or plus icon). `mic.fill` for Practice and `chart.bar.fill` for Insights are well-matched. Consider `square.and.pencil` or `plus.circle.fill` for Prepare.

### 6.2 No active-state feedback in session/question selection
When the user lands on Practice with no sessions or the previously active session deleted, the content area shows "No sessions available." inside the selection card and "Select a question to view full details." in the details card at the same time. The two empty states in sequence feel repetitive.

**Proposal:** If no sessions exist, show a single full-card empty state in place of both the selection and question cards: "No sessions yet. Head to Prepare to generate your first session." with a navigation action.

---

## Priority order for implementation

| # | Change | Effort | Impact |
|---|--------|--------|--------|
| 1 | Toast system replacing inline status/error text | Medium | High — fixes layout shift on all screens |
| 2 | Dropdown caret icon | Low | Medium — obvious visual quality signal |
| 3 | Prepare: separate tab selection from picker launch | Low | High — fixes core UX confusion |
| 4 | Prepare: fixed-height status slot (no layout shift) | Low | High — directly addresses the screenshots |
| 5 | Practice: recording UI (timer, active button state, collapse meter when idle) | Medium | High — core screen |
| 6 | Practice: notes input collapsed by default | Low | Medium |
| 7 | Profile: Danger Zone styling | Low | Medium — safety |
| 8 | Profile: collapse Prompt Preview | Low | Low |
| 9 | Profile: merge "App State" card into API Settings | Low | Low |
| 10 | Extract shared SelectorDropdown component | Low | Low (maintainability) |
| 11 | Insights: empty state with navigation action | Low | Medium |
| 12 | Insights: metric typography + labels | Low | Low |
| 13 | Practice: attempt score as badge not headline | Low | Medium |
| 14 | Practice: evaluation tab panel fixed maxHeight | Low | Medium |
| 15 | Delete explore.tsx + modal.tsx scaffolding | Low | Low (hygiene) |
